/**
 * Pine Hollow's day / night clock (PINE-HOLLOW-REMASTER PH-L2; Jake's PH-U7: "the full cycle, 20 + 4 min, dawn / day /
 * golden hour / night, like Driftwood, in photoreal"; picked over the pre-remaster fixed sunset: "A + a brighter night").
 * Sky.ts builds it for Pine Hollow on the WebGL path (the WebGPU path still takes Sky.setupHDRI's fixed sky).
 *
 *   phase 0..1 over the cycle (24 min, `?clock=` seconds): [0, 20/24) is the day, sunrise at 0, sunset at 20/24
 *   ?tod=0.4167 | dawn | sunrise | morning | day | golden | sunset | dusk | night   the start phase (`?clock=1e6` freezes it)
 *   night / dusk / dawn / lamps   0..1 read by the ambience, the cabins' lights, the pond's fireflies (Sky getters)
 *
 * THE SKY is a dome drawn from two photographic keys at a time — the Poly Haven "Qwantani" pure-sky time-lapse
 * (pineSkyKeys.ts, gain-mapped pairs baked by scripts/bake-sky-keys.mjs with each key's own sun painted out) — blended by
 * the clock, each turned about the vertical so its sun glow sits on the clock's sun azimuth, and scaled by a per-key gain
 * (Poly Haven exposes every HDRI alike: the night key would otherwise be as bright as noon). The dome adds an analytic
 * aureole around the clock's own sun / moon; Sky.sunDisc is the disc and the god-ray source. The same shader renders the
 * blend into a 1024×512 equirect every 2 s and PMREM turns it into the scene's environment (IBL) in place, so every lit
 * material sees the sky of the hour. The keys' GPU textures are decoded on demand (at most 3 resident: the two being
 * blended and the next one, decoded ahead); their CPU copies are dropped after upload.
 *
 * THE LIGHT: the same CSM lights, hemisphere and fog as the fixed sky — never added or removed — driven by keyed presets
 * (sunrise, morning / evening golden, day, the old sunset, dusk, night, dawn): the sun's colour and intensity, the
 * hemisphere fill, the fog's colour (each key's horizon, measured at decode) and density, the fog's sun in-scatter,
 * the volumetric shafts' strength, the god rays, the cloud layer and the far ridges' haze. The light body is the sun by day
 * and the moon by night (a high arc, cold blue, dim enough to be night and bright enough to play by), faded out at the
 * swap; the shadow direction moves in 0.25° steps (Driftwood's E89: a shadow map that turns a hair every frame crawls).
 * Nothing here changes a program: it is uniforms, light intensities / colours and texture uniforms only.
 */
import * as THREE from 'three';
import { PINE_SKY_KEYS, type SkyKeyName } from './pineSkyKeys';
import { loadBakedSky } from './BakedSky';
import { setting, type OptionValue } from '../ui/Settings';
import { pinePhoneCuts } from '../core/tier';

/** the PMREMGenerator (r186) internals the stepped refresh drives, one call a frame (PineDayNight.stepEnvironment) */
interface PmremSteps {
  _setSize: (cubeSize: number) => void;
  _textureToCubeUV: (texture: THREE.Texture, target: THREE.WebGLRenderTarget) => void;
  _applyGGXFilter: (target: THREE.WebGLRenderTarget, lodIn: number, lodOut: number) => void;
  _lodMeshes: unknown[];
}
/** the generator still has them (a three upgrade that renames one falls back to the whole refresh) */
function hasSteps(gen: object): gen is PmremSteps {
  return ['_setSize', '_textureToCubeUV', '_applyGGXFilter'].every((k) => typeof Reflect.get(gen, k) === 'function') && Array.isArray(Reflect.get(gen, '_lodMeshes'));
}

const DAY = 20 / 24;
const d2r = Math.PI / 180;
/** the shadow-casting light turns in steps of this (DayNight.ts SHADOW_STEP, E89) */
const SHADOW_STEP = 0.25 * d2r;
/** the sun's path: rises in the NE (compass 54°), 52° up in the south at noon, sets in the NW (306°: the old sunset's azimuth) */
const RISE_AZ = 54, SET_AZ = 306, NOON_EL = 52;
/** named phases for `?tod=` and Settings ▸ Time of day */
export const PINE_PHASES = { sunrise: 0.008, morning: 0.085, day: 0.4167, midday: 0.4167, noon: 0.4167, golden: 0.735, sunset: 0.8, dusk: 0.85, night: 0.92, dawn: 0.985 } as const;
const FIXED_PHASE: Record<Exclude<OptionValue<'time'>, 'live'>, number> = { midday: PINE_PHASES.midday, golden: PINE_PHASES.golden, sunset: PINE_PHASES.sunset, night: PINE_PHASES.night };

interface Preset {
  /** the HDRI key */
  key: SkyKeyName;
  /** the key's gain: sky brightness relative to the photo (Poly Haven normalises every exposure) */
  bg: number;
  /** scene.environmentIntensity over the rendered sky */
  env: number;
  /** the light body (sun by day, moon by night): colour, intensity */
  light: THREE.Color; lightI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  /** the fog's in-scatter toward the light, its distance and height densities */
  fogSun: THREE.Color; fogDist: number; fogHeight: number;
  /** volumetric shafts (VolumetricsEffect uStrength) and their colour; god-ray opacity */
  vol: number; volColor: THREE.Color; rays: number;
  /** the dome's aureole around the light, the disc, the corona sprite (colour × opacity) */
  glow: THREE.Color; disc: THREE.Color; halo: THREE.Color; haloO: number;
  /** the cloud layer: the tint toward the light, the lit / shade multiplier and its opacity */
  cloudSun: THREE.Color; cloudLit: THREE.Color; cloudA: number;
  /** the far ridges' haze colour (Horizon.ts) */
  far: THREE.Color;
  /** the night lights (cabin windows, lanterns): 0 day … 1 full night */
  lamps: number;
  /** the grade's saturation (HueSaturationEffect; the fixed look's 0.18): night drains colour, as the eye does in the dark */
  sat: number;
}

const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);
const hex = (h: number): THREE.Color => new THREE.Color(h);
const P: Record<'sunrise' | 'golden' | 'day' | 'sunset' | 'dusk' | 'night' | 'dawn', Preset> = {
  sunrise: {
    key: 'sunrise', bg: 0.8, env: 1.1, light: c(1.0, 0.62, 0.38), lightI: 2.8, hemiSky: hex(0x8a98c0), hemiGround: hex(0x3a3026), hemiI: 0.36,
    fogSun: c(1.0, 0.66, 0.42), fogDist: 0.00055, fogHeight: 0.009, vol: 0.55, volColor: c(1.0, 0.66, 0.4), rays: 0.85,
    glow: c(2.2, 1.15, 0.55), disc: c(1.0, 0.78, 0.55), halo: c(1.0, 0.72, 0.5), haloO: 0.95, cloudSun: c(1.0, 0.72, 0.52), cloudLit: c(0.95, 0.82, 0.78), cloudA: 0.8, far: c(0.5, 0.5, 0.6), lamps: 0.35, sat: 0.16,
  },
  golden: {
    key: 'golden', bg: 1.3, env: 1.05, light: c(1.0, 0.66, 0.36), lightI: 4.2, hemiSky: hex(0x9aa4c0), hemiGround: hex(0x5c3e20), hemiI: 0.4,
    fogSun: c(1.0, 0.7, 0.4), fogDist: 0.00042, fogHeight: 0.005, vol: 0.66, volColor: c(1.0, 0.7, 0.4), rays: 1,
    glow: c(2.2, 1.15, 0.5), disc: c(1.0, 0.88, 0.7), halo: c(1.0, 0.76, 0.5), haloO: 0.9, cloudSun: c(1.0, 0.72, 0.48), cloudLit: c(1.0, 0.92, 0.84), cloudA: 0.75, far: c(0.56, 0.58, 0.68), lamps: 0, sat: 0.24,
  },
  day: {
    key: 'day', bg: 1.8, env: 1.1, light: c(1.0, 0.96, 0.9), lightI: 4.4, hemiSky: hex(0xa0b8e0), hemiGround: hex(0x4d4232), hemiI: 0.5,
    fogSun: c(1.0, 0.96, 0.88), fogDist: 0.00035, fogHeight: 0.004, vol: 0.42, volColor: c(1.0, 0.95, 0.85), rays: 0.8,
    glow: c(1.3, 1.25, 1.15), disc: c(1.0, 0.98, 0.95), halo: c(1.0, 0.95, 0.88), haloO: 0.55, cloudSun: c(1.0, 0.97, 0.92), cloudLit: c(1.05, 1.05, 1.05), cloudA: 0.6, far: c(0.55, 0.64, 0.8), lamps: 0, sat: 0.14,
  },
  sunset: { // the pre-remaster fixed look's numbers (pine-hollow.ts sky / atmosphere): sun 3.8, hemi 0x8fa8d0 / 0x4a3a28 × 0.45, env 1.1, bg 0.95
    key: 'sunset', bg: 0.95, env: 1.16, light: c(1.0, 0.76, 0.5), lightI: 3.8, hemiSky: hex(0x8fa8d0), hemiGround: hex(0x4a3a28), hemiI: 0.45,
    fogSun: c(1.0, 0.78, 0.5), fogDist: 0.00045, fogHeight: 0.005, vol: 0.55, volColor: c(1.0, 0.72, 0.42), rays: 1,
    glow: c(2.4, 1.3, 0.55), disc: c(1.0, 0.95, 0.85), halo: c(1.0, 1.0, 1.0), haloO: 1, cloudSun: c(1.0, 0.82, 0.62), cloudLit: c(1.0, 1.0, 1.0), cloudA: 1, far: c(0.5, 0.58, 0.74), lamps: 0.55, sat: 0.18,
  },
  dusk: {
    key: 'dusk', bg: 0.42, env: 1.2, light: c(0.55, 0.6, 0.85), lightI: 0.0, hemiSky: hex(0x5d6694), hemiGround: hex(0x2a2430), hemiI: 0.3,
    fogSun: c(0.85, 0.55, 0.58), fogDist: 0.0006, fogHeight: 0.008, vol: 0.28, volColor: c(0.7, 0.55, 0.75), rays: 0.3,
    glow: c(0.45, 0.28, 0.3), disc: c(0.9, 0.93, 1.0), halo: c(0.6, 0.62, 0.8), haloO: 0.25, cloudSun: c(0.8, 0.5, 0.55), cloudLit: c(0.48, 0.44, 0.56), cloudA: 0.55, far: c(0.24, 0.24, 0.34), lamps: 1, sat: -0.05,
  },
  night: {
    key: 'night', bg: 0.11, env: 3.0, light: c(0.6, 0.72, 1.0), lightI: 3.2, hemiSky: hex(0x4a5e9c), hemiGround: hex(0x1e2434), hemiI: 0.95,
    fogSun: c(0.32, 0.4, 0.58), fogDist: 0.0007, fogHeight: 0.009, vol: 0.4, volColor: c(0.42, 0.52, 0.78), rays: 0.55,
    glow: c(0.1, 0.13, 0.2), disc: c(1.7, 1.8, 2.0), halo: c(0.5, 0.6, 0.9), haloO: 0.35, cloudSun: c(0.3, 0.36, 0.5), cloudLit: c(0.16, 0.19, 0.27), cloudA: 0.18, far: c(0.05, 0.065, 0.1), lamps: 1, sat: -0.3,
  },
  dawn: {
    key: 'dawn', bg: 0.5, env: 1.2, light: c(0.55, 0.62, 0.9), lightI: 0.0, hemiSky: hex(0x6d7aa8), hemiGround: hex(0x2c2a30), hemiI: 0.3,
    fogSun: c(0.95, 0.75, 0.68), fogDist: 0.0006, fogHeight: 0.012, vol: 0.35, volColor: c(0.85, 0.72, 0.7), rays: 0.3,
    glow: c(0.7, 0.5, 0.42), disc: c(0.9, 0.93, 1.0), halo: c(0.8, 0.7, 0.7), haloO: 0.3, cloudSun: c(0.95, 0.7, 0.62), cloudLit: c(0.62, 0.58, 0.64), cloudA: 0.6, far: c(0.34, 0.37, 0.48), lamps: 0.9, sat: -0.02,
  },
};

/** keyframes over the phase (sorted; wraps 1 → 0): the sky key and every knob are blended between neighbours */
const KEYS: readonly [number, Preset][] = [
  [PINE_PHASES.sunrise, P.sunrise], [PINE_PHASES.morning, P.golden], [0.2, P.day], [0.62, P.day], [PINE_PHASES.golden, P.golden],
  [PINE_PHASES.sunset, P.sunset], [DAY + 0.017, P.dusk], [0.885, P.night], [0.962, P.night], [PINE_PHASES.dawn, P.dawn],
];

/** compass azimuth (0 = north = +Z, 90 = east = −X) + elevation (deg) → unit vector toward the body */
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}
/** the sun: an east → south → west arc by day, on round under the north by night (its glow leads the dawn) */
export function pineSunAt(p: number, out: THREE.Vector3): THREE.Vector3 {
  if (p < DAY) { const s = p / DAY; return dirFrom(RISE_AZ + (SET_AZ - RISE_AZ) * s, NOON_EL * Math.sin(Math.PI * s), out); }
  const s = (p - DAY) / (1 - DAY); return dirFrom(SET_AZ + (360 + RISE_AZ - SET_AZ) * s, -Math.sin(Math.PI * s) * 24, out);
}
/** the moon: up through the night, high in the south (≈ 58°, where the night key's moon is) */
export function pineMoonAt(p: number, out: THREE.Vector3): THREE.Vector3 {
  const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
  return dirFrom(115 + 130 * s, 26 + 32 * Math.sin(Math.PI * s), out);
}
/** 0 at day … 1 at full night (the ambience, the lamps) */
export function pineNightAt(p: number): number {
  return THREE.MathUtils.smoothstep(p, DAY - 0.012, DAY + 0.04) * (1 - THREE.MathUtils.smoothstep(p, 0.962, 0.997));
}

const SKY_GLSL = /* glsl */`
  uniform sampler2D tA; uniform sampler2D tB; uniform float uMix;
  uniform vec2 uRotA; uniform vec2 uRotB; uniform float uGainA; uniform float uGainB;
  uniform vec3 uLightDir; uniform vec3 uGlow; uniform float uGrey; uniform vec3 uFlat;
  vec3 keySample(sampler2D t, vec3 d, vec2 rot) {
    vec3 r = vec3(rot.x * d.x - rot.y * d.z, d.y, rot.y * d.x + rot.x * d.z);
    return texture2D(t, equirectUv(r)).rgb;
  }
  vec3 skyColor(vec3 d) {
    vec3 col = keySample(tA, d, uRotA) * (uGainA * (1.0 - uMix)) + keySample(tB, d, uRotB) * (uGainB * uMix);
    float mu = clamp(dot(d, uLightDir), 0.0, 1.0);
    float up = smoothstep(-0.12, 0.02, d.y);             // the aureole stays above the haze line
    col += uGlow * (0.55 * pow(mu, 900.0) + 0.3 * pow(mu, 60.0) + 0.12 * pow(mu, 8.0)) * up;
    // the weather's cloud deck (PineSkyMod.overcast): the photo's blue and its clouds go to a flat cool grey
    // (the photo's own clouds soften into it: mostly the flat deck, a little of their shading left)
    col = mix(col, mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uFlat, 0.7) * vec3(0.94, 0.97, 1.0), uGrey);
    return col;
  }`;

const tmpC = new THREE.Color();

/** one decoded key: its GPU texture (CPU copy dropped after upload) and its horizon colour */
interface Resident { tex: THREE.DataTexture; horizon: THREE.Color; used: number }

/** the knobs the clock turns — Sky hands them over (no Sky import: Sky imports this) */
export interface PineTargets {
  sunDir: THREE.Vector3; sunColor: THREE.Color;
  lights: THREE.DirectionalLight[]; lightDirection: THREE.Vector3;
  hemi: THREE.HemisphereLight; fog: THREE.Fog;
  fogU: { fogSunDir: { value: THREE.Vector3 }; fogSunColor: { value: THREE.Color }; fogDistDensity: { value: number }; fogHeightDensity: { value: number } };
  /** true while the eye is under water (Atmosphere.ts owns the fog then) */
  underwater: () => boolean;
  disc: THREE.Mesh; halo: THREE.Sprite | null;
  cloud: { uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color }; uCloudLit: { value: THREE.Color }; uCloudAlpha: { value: number } };
  far: { uHazeCol: { value: THREE.Color }; uSeaSky: { value: THREE.Color }; uSeaSun: { value: THREE.Color }; uSeaSunDir: { value: THREE.Vector3 } };
}
/** the post effects the clock drives (Game.buildComposer hands them over) */
export interface PinePost {
  vol: { setSun: (dir: THREE.Vector3, color: THREE.Color) => void; setFogColor: (c: THREE.Color) => void; setStrength: (s: number) => void };
  rays: { blendMode: { opacity: { value: number } } } | null;
  /** the grade's HueSaturationEffect */
  hueSat: { saturation: number } | null;
}

/**
 * The weather's hook on the clock (PH-L10, src/pinehollow/weather.ts writes it every frame): multipliers laid over the keyed
 * presets after they are blended — the presets' own numbers are never edited. Identity ({ overcast 0, fog × 1 }) is the
 * clock exactly as it was.
 */
export interface PineSkyMod {
  /** 0 … 1 the cloud deck: the sun and moon hidden (light, shafts, rays, disc, aureole), the sky and its IBL dimmed and
   *  greyed, the far haze and the fog greyed and thickened, the cloud layer full, colour drained, lamps lit early */
  overcast: number;
  /** × the fog's distance / height densities (the dawn fog, the rain's haze, the old-growth) */
  fogDist: number;
  fogHeight: number;
  /** 0 … 1 the dawn ground fog: the fog's colour paled toward a cool white (a mist, not a haze) */
  mist: number;
}

export class PineDayNight {
  phase: number;
  readonly cycle: number;
  night = 0;
  dusk = 0;
  dawn = 0;
  lamps = 0;
  /** the weather's multipliers (see PineSkyMod); identity = no weather */
  readonly mod: PineSkyMod = { overcast: 0, fogDist: 1, fogHeight: 1, mist: 0 };
  /** the look loop's layer over every preset (PH-L1 / L4, ChunkLook; Sky sets it, a shard without one leaves the identity): × the
   *  volumetric in-scatter, × the distance fog, + the grade saturation, × the sky's fill (IBL + hemisphere), × the dome by day — the presets'
   *  numbers untouched */
  readonly look = { vol: 1, fogDist: 1, sat: 0, ambient: 1, sky: 1 };
  /** the dome: add it to the scene; Sky.update keeps it on the camera */
  readonly dome: THREE.Mesh;
  private readonly u = {
    tA: { value: null as THREE.Texture | null }, tB: { value: null as THREE.Texture | null }, uMix: { value: 0 },
    uRotA: { value: new THREE.Vector2(1, 0) }, uRotB: { value: new THREE.Vector2(1, 0) }, uGainA: { value: 1 }, uGainB: { value: 1 },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: new THREE.Color() }, uGrey: { value: 0 }, uFlat: { value: new THREE.Color() },
  };
  private frozen = false;
  private T: PineTargets | null = null;
  private post: PinePost | null = null;
  private cur: Preset = clonePreset(P.day);
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private want = new THREE.Vector3();
  private fogCol = new THREE.Color();
  private resident = new Map<SkyKeyName, Resident>();
  private loading = new Map<SkyKeyName, Promise<Resident | null>>();
  private blobs = new Map<SkyKeyName, Promise<{ color: Blob; gain: Blob }>>();
  private frame = 0;
  // the environment: the blend rendered to an equirect, PMREM'd into a cube-UV target reused in place
  private envEquirect: THREE.WebGLRenderTarget;
  private envScene = new THREE.Scene();
  private envCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pmrem: THREE.PMREMGenerator;
  private envCube: THREE.WebGLRenderTarget | null = null;
  private envTimer = 0;
  /**
   * E142 (the 30-fps-at-2× lane): the 2-second IBL refresh in steps. The whole refresh is the sky into the equirect, then
   * PMREM — r186's GGX prefilter, ten 256-sample passes: ~2 ms of the M5's GPU in one frame every 2 s (the finest
   * level 0.5, each 16² level ~0.1–0.2 of pass overhead), i.e. a phone frame's whole budget, a hitch twice a minute ×
   * 15. On Pine Hollow's phone tier it runs one step a frame instead: the sky → equirect → the cube's top level, then one
   * GGX level a frame (11 frames, ~0.37 s at 30 fps), filled in place so scene.environment keeps its identity. For those
   * frames the finer levels are the new sky and the rougher ones the sky of 2 s before (it moves 0.14 % of its day in
   * 2 s). A jump (boot, a Time of day pick, a GPU restore) still refreshes whole.
   * -1 = idle, 0 = the top level, i = GGX level i.
   */
  private envStep = -1;
  private readonly envSteps = pinePhoneCuts();

  private constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, phase: number, cycle: number, frozen: boolean) {
    this.phase = phase; this.cycle = cycle; this.frozen = frozen;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2300, 64, 32), new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        #include <common>
        ${SKY_GLSL}
        varying vec3 vDir;
        void main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }`,
    }));
    dome.name = 'pine-sky-dome';
    dome.frustumCulled = false;
    dome.renderOrder = -1000; // first of the opaque pass, depth untouched: everything draws over it
    this.dome = dome;
    // the environment pass: the same sky, one texel per direction of a 1024×512 equirect
    this.envEquirect = new THREE.WebGLRenderTarget(1024, 512, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.envEquirect.texture.mapping = THREE.EquirectangularReflectionMapping;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, new THREE.ShaderMaterial({
      uniforms: this.u, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        #include <common>
        ${SKY_GLSL}
        varying vec2 vUv;
        void main() {
          float th = (vUv.x - 0.5) * 2.0 * PI, ph = (vUv.y - 0.5) * PI;
          gl_FragColor = vec4(skyColor(vec3(cos(th) * cos(ph), sin(ph), sin(th) * cos(ph))), 1.0);
        }`,
    }));
    quad.frustumCulled = false;
    this.envScene.add(quad);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** the clock at the URL's / Settings' time, its first two keys decoded, the environment rendered */
  static async create(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Promise<PineDayNight> {
    const qs = new URLSearchParams(location.search);
    const todRaw = qs.get('tod') ?? '';
    const named = (PINE_PHASES as Record<string, number | undefined>)[todRaw];
    const tod = named ?? Number.parseFloat(todRaw);
    const clock = Number.parseFloat(qs.get('clock') ?? '');
    const time = setting('time'); // 'live' whenever ?tod / ?clock are in the URL
    const frozen = time !== 'live';
    const phase = frozen ? FIXED_PHASE[time] : Number.isFinite(tod) ? ((tod % 1) + 1) % 1 : PINE_PHASES.morning + 0.05;
    const dn = new PineDayNight(renderer, scene, phase, Number.isFinite(clock) && clock > 1 ? clock : 24 * 60, frozen);
    const [a, b] = dn.segment(phase);
    await Promise.all([dn.ensure(a[1].key), dn.ensure(b[1].key)]);
    return dn;
  }

  /** hand over the lights, fog, disc, clouds and far haze (Sky.build, once they exist); applies the current time */
  bind(targets: PineTargets): void { this.T = targets; this.apply(true); this.refreshEnvironment(); }
  /** the volumetric shafts and god rays (Game.buildComposer) */
  attachPost(post: PinePost): void { this.post = post; this.apply(true); }

  /** Settings ▸ Time of day: park the sun at a pick, or run the clock on from where it stands */
  setTime(t: OptionValue<'time'>): void {
    this.frozen = t !== 'live';
    if (t === 'live') return;
    this.phase = FIXED_PHASE[t];
    void this.jump();
  }
  /** dev / captures: jump to a phase (0..1) */
  setPhase(p: number): Promise<void> {
    this.phase = ((p % 1) + 1) % 1;
    return this.jump();
  }
  /** decode the current segment's keys, then snap every knob and the environment to the phase */
  private async jump(): Promise<void> {
    const [a, b] = this.segment(this.phase);
    await Promise.all([this.ensure(a[1].key), this.ensure(b[1].key)]);
    this.apply(true); this.refreshEnvironment();
  }

  update(dt: number, camera: THREE.Camera): void {
    if (!this.frozen) this.phase = (this.phase + dt / this.cycle) % 1;
    this.dome.position.copy(camera.position);
    this.frame++;
    this.apply();
    this.envTimer += dt;
    if (!this.envSteps) { if (this.envTimer > 2) this.refreshEnvironment(); return; }
    if (this.envStep < 0 && this.envTimer > 2) { this.envTimer = 0; this.envStep = 0; }
    if (this.envStep >= 0) this.stepEnvironment();
  }

  /** one step of the stepped refresh (`envStep`): the top level from the sky, or the next GGX level from the one above */
  private stepEnvironment(): void {
    const gen: object = this.pmrem, cube = this.envCube;
    if (cube === null || !hasSteps(gen) || this.u.tA.value === null) { this.refreshEnvironment(); return; }
    const r = this.renderer, prev = r.getRenderTarget(), face = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel(), autoClear = r.autoClear;
    try {
      if (this.envStep === 0) {
        r.setRenderTarget(this.envEquirect);
        r.render(this.envScene, this.envCam);
        gen._setSize(this.envEquirect.width / 4);
        gen._textureToCubeUV(this.envEquirect.texture, cube);
      } else {
        r.autoClear = false; // as PMREMGenerator._applyPMREM: the level is drawn into its own rectangle of the atlas
        gen._applyGGXFilter(cube, this.envStep - 1, this.envStep);
      }
    } finally {
      // PMREMGenerator._cleanup's target reset (its own restores a module-level target from its last whole run)
      r.autoClear = autoClear;
      cube.scissorTest = false;
      cube.viewport.set(0, 0, cube.width, cube.height);
      cube.scissor.set(0, 0, cube.width, cube.height);
      r.setRenderTarget(prev, face, mip);
    }
    this.envStep = this.envStep + 1 < gen._lodMeshes.length ? this.envStep + 1 : -1;
  }

  /** after an in-place WebGL restore (GpuRecovery): the keys' CPU copies are gone — decode them again, re-render the IBL */
  rebuild(): void {
    for (const r of this.resident.values()) r.tex.dispose();
    this.resident.clear();
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envCube = null;
    void this.setPhase(this.phase);
  }

  /** the keyframes around phase p: [a, b] and the blend t */
  private segment(p: number): [readonly [number, Preset], readonly [number, Preset], number] {
    const n = KEYS.length;
    let i = n - 1;
    for (let k = 0; k < n; k++) { const e = KEYS[k]; if (e && e[0] <= p) i = k; }
    const a = KEYS[i] ?? KEYS[0], b = KEYS[(i + 1) % n] ?? KEYS[0];
    if (a === undefined || b === undefined) throw new Error('PineDayNight: no keys');
    const pa = a[0], pb = b[0] <= pa ? b[0] + 1 : b[0], pp = p < pa ? p + 1 : p;
    return [a, b, THREE.MathUtils.smoothstep(pp, pa, pb)];
  }

  private blobsOf(k: SkyKeyName): Promise<{ color: Blob; gain: Blob }> {
    let b = this.blobs.get(k);
    if (b === undefined) {
      const id = PINE_SKY_KEYS[k].id;
      const get = async (url: string): Promise<Blob> => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.blob(); };
      b = Promise.all([get(`/assets/hdri/${id}_2k.key.jpg`), get(`/assets/hdri/${id}_2k.key.gain.png`)]).then(([color, gain]) => ({ color, gain }));
      b.catch(() => { this.blobs.delete(k); });
      this.blobs.set(k, b);
    }
    return b;
  }

  /** decode key k to a GPU texture (once; at most 3 resident, least recently used dropped) */
  private ensure(k: SkyKeyName): Promise<Resident | null> {
    const have = this.resident.get(k);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(k);
    if (p === undefined) {
      p = this.blobsOf(k).then(async ({ color, gain }) => {
        const urls = { color: URL.createObjectURL(color), gain: URL.createObjectURL(gain) };
        try {
          const tex = await loadBakedSky(urls);
          tex.wrapS = THREE.RepeatWrapping; // the equirect seam blends across u = 0 / 1
          const horizon = horizonOf(tex);
          this.renderer.initTexture(tex); // upload now, not on the frame that first draws it
          tex.image.data = null;          // the GPU has it: drop the 16 MB CPU copy (rebuild() decodes again after a context loss)
          const r: Resident = { tex, horizon, used: this.frame };
          this.resident.set(k, r);
          this.evict();
          return r;
        } finally { URL.revokeObjectURL(urls.color); URL.revokeObjectURL(urls.gain); this.loading.delete(k); }
      }).catch((e: unknown) => { console.warn(`[pine sky] key ${k} did not load`, e); this.loading.delete(k); return null; });
      this.loading.set(k, p);
    }
    return p;
  }

  private evict(): void {
    while (this.resident.size > 3) {
      let oldest: SkyKeyName | null = null, t = Infinity;
      for (const [k, r] of this.resident) if (r.used < t && r.tex !== this.u.tA.value && r.tex !== this.u.tB.value) { t = r.used; oldest = k; }
      if (oldest === null) return;
      this.resident.get(oldest)?.tex.dispose();
      this.resident.delete(oldest);
    }
  }

  /** the rotation that puts key k's sun glow on the direction `body` */
  private rot(k: SkyKeyName, body: THREE.Vector3, out: THREE.Vector2): void {
    const thKey = (PINE_SKY_KEYS[k].sunU - 0.5) * 2 * Math.PI, thBody = Math.atan2(body.z, body.x);
    const a = thKey - thBody;
    out.set(Math.cos(a), Math.sin(a));
  }

  refreshEnvironment(): void {
    this.envTimer = 0;
    this.envStep = -1; // a stepped refresh in flight is superseded
    if (this.u.tA.value === null) return;
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.envEquirect);
    r.render(this.envScene, this.envCam);
    r.setRenderTarget(prev);
    // the first call allocates the cube-UV target and PMREM's own passes; after that the same target is filled in place, so
    // scene.environment keeps its identity (and every program its envmap define)
    this.envCube = this.envCube === null ? this.pmrem.fromEquirectangular(this.envEquirect.texture) : this.pmrem.fromEquirectangular(this.envEquirect.texture, this.envCube);
    this.scene.environment = this.envCube.texture;
  }

  /** `snap`: move the shadow light to the exact phase now (boot, a Time of day pick), not in SHADOW_STEP steps */
  private apply(snap = false): void {
    const p = this.phase;
    const [a, b, t] = this.segment(p);
    lerpPreset(this.cur, a[1], b[1], t);
    const C = this.cur;
    const ov = weatherOver(C, this.mod);
    C.vol *= this.look.vol; C.fogDist *= this.look.fogDist; C.sat += this.look.sat;
    const fill = 1 + (this.look.ambient - 1) * (1 - pineNightAt(p)); // by day: the night's moonlight is its own (PH-L2)
    C.env *= fill; C.hemiI *= fill;
    pineSunAt(p, this.sun);
    pineMoonAt(p, this.moon);
    const day = p < DAY;
    // ── the sky keys: two textures, each turned so its glow sits on the body it was shot around ──
    const ra = this.resident.get(a[1].key), rb = this.resident.get(b[1].key);
    const glowBody = (k: SkyKeyName) => (k === 'night' ? this.moon : this.sun);
    if (ra) ra.used = this.frame;
    if (rb) rb.used = this.frame;
    const A = ra ?? rb, B = rb ?? ra;
    if (A && B) {
      this.u.tA.value = A.tex; this.u.tB.value = B.tex;
      this.u.uMix.value = ra && rb ? t : 0;
      this.rot(ra ? a[1].key : b[1].key, glowBody(ra ? a[1].key : b[1].key), this.u.uRotA.value);
      this.rot(rb ? b[1].key : a[1].key, glowBody(rb ? b[1].key : a[1].key), this.u.uRotB.value);
      const dim = 1 - 0.5 * ov; // the deck: the sky's brightness under it
      this.u.uGainA.value = (ra ? a[1].bg : b[1].bg) * dim; this.u.uGainB.value = (rb ? b[1].bg : a[1].bg) * dim;
      this.fogCol.copy(A.horizon).multiplyScalar(this.u.uGainA.value).lerp(tmpC.copy(B.horizon).multiplyScalar(this.u.uGainB.value), this.u.uMix.value);
      const m = Math.max(this.fogCol.r, this.fogCol.g, this.fogCol.b, 1e-3);
      if (m > 1.1) this.fogCol.multiplyScalar(1.1 / m);
      if (ov > 0) { const g = (this.fogCol.r * 0.2126 + this.fogCol.g * 0.7152 + this.fogCol.b * 0.0722) * 0.92; this.fogCol.lerp(tmpC.setRGB(g * 0.95, g * 0.98, g * 1.03), ov * 0.85); }
      const mist = Math.min(1, Math.max(0, this.mod.mist));
      if (mist > 0) { const g = (this.fogCol.r * 0.2126 + this.fogCol.g * 0.7152 + this.fogCol.b * 0.0722) * 1.08; this.fogCol.lerp(tmpC.setRGB(g * 0.96, g, g * 1.05), mist * 0.6); }
      // the look loop's sky (by day): the dome — and so the IBL rendered from it — × look.sky; the fog colour above stays
      const skyK = 1 + (this.look.sky - 1) * (1 - pineNightAt(p));
      this.u.uGainA.value *= skyK; this.u.uGainB.value *= skyK;
    }
    this.u.uGrey.value = 0.92 * ov;
    this.u.uFlat.value.copy(this.fogCol).multiplyScalar(1.05);
    if (!ra || !rb) void Promise.all([this.ensure(a[1].key), this.ensure(b[1].key)]);
    // decode the key after this segment ahead of time (its upload lands mid-segment, not on the transition)
    const [, next] = this.segment((b[0] + 0.0005) % 1);
    if (!this.resident.has(next[1].key) && !this.loading.has(next[1].key)) void this.ensure(next[1].key);

    // ── the light body: the sun by day, the moon by night, faded out at the swap ──
    const lightDir = day ? this.sun : this.moon;
    const fade = day
      ? THREE.MathUtils.smoothstep(this.sun.y, -0.01, 0.06)
      : THREE.MathUtils.smoothstep(p, DAY + 0.012, DAY + 0.045) * (1 - THREE.MathUtils.smoothstep(p, 0.968, 0.994));
    this.night = pineNightAt(p);
    this.dusk = Math.max(this.night, 1 - THREE.MathUtils.smoothstep(this.sun.y, 0.06, 0.35));
    const dd = Math.min(Math.abs(p - PINE_PHASES.sunrise), Math.abs(p - 1 - PINE_PHASES.sunrise));
    this.dawn = 1 - THREE.MathUtils.smoothstep(dd, 0.01, 0.07);
    this.lamps = Math.max(C.lamps, this.night);
    this.u.uLightDir.value.copy(day || this.night < 0.5 ? this.sun : this.moon);
    this.u.uGlow.value.copy(C.glow).multiplyScalar((day ? THREE.MathUtils.smoothstep(this.sun.y, -0.08, 0.02) : 1) * (1 - ov));
    const T = this.T;
    if (!T) return;
    T.sunDir.copy(lightDir);
    const want = this.want.copy(lightDir).negate();
    if (snap || want.angleTo(T.lightDirection) > SHADOW_STEP) T.lightDirection.copy(want);
    for (const l of T.lights) { l.color.copy(C.light); l.intensity = C.lightI * fade; }
    T.sunColor.copy(C.light).multiplyScalar(Math.max(0.05, fade * C.lightI / 3.8));
    T.hemi.color.copy(C.hemiSky); T.hemi.groundColor.copy(C.hemiGround); T.hemi.intensity = C.hemiI;
    this.scene.environmentIntensity = C.env;
    if (!T.underwater()) {
      T.fog.color.copy(this.fogCol);
      T.fogU.fogSunColor.value.copy(C.fogSun);
      T.fogU.fogDistDensity.value = C.fogDist;
      T.fogU.fogHeightDensity.value = C.fogHeight;
    }
    T.fogU.fogSunDir.value.copy(lightDir);
    // the disc (the god-ray source) and its corona: the moon is smaller; neither shows through the ground
    const above = THREE.MathUtils.smoothstep(lightDir.y, -0.03, 0.02);
    // the moon comes and goes by size, not colour: a darkened disc would read as a black dot on the dusk sky
    (T.disc.material as THREE.MeshBasicMaterial).color.copy(C.disc).multiplyScalar(above);
    T.disc.scale.setScalar((day ? 1 : 0.6 * Math.max(1e-3, fade)) * Math.max(1e-3, 1 - ov));
    if (T.halo) { T.halo.material.color.copy(C.halo); T.halo.material.opacity = C.haloO * above * (day ? 1 : fade); }
    T.cloud.uSunDir.value.copy(day || this.night < 0.5 ? this.sun : this.moon);
    T.cloud.uSunColor.value.copy(C.cloudSun); T.cloud.uCloudLit.value.copy(C.cloudLit); T.cloud.uCloudAlpha.value = C.cloudA;
    T.far.uHazeCol.value.copy(C.far); T.far.uSeaSky.value.copy(C.far).multiplyScalar(1.1); T.far.uSeaSun.value.copy(C.light).multiplyScalar(Math.max(0.1, fade)); T.far.uSeaSunDir.value.copy(lightDir);
    const post = this.post;
    if (post) {
      post.vol.setSun(lightDir, tmpC.copy(C.volColor).multiplyScalar(Math.max(0.15, fade)));
      post.vol.setFogColor(this.fogCol);
      post.vol.setStrength(C.vol);
      if (post.rays) post.rays.blendMode.opacity.value = C.rays * above;
      if (post.hueSat) post.hueSat.saturation = C.sat;
    }
  }
}

/** the mean of the row just above the horizon (Sky.sampleHorizon's maths, on the decoded half-float key) */
function horizonOf(tex: THREE.DataTexture): THREE.Color {
  const { width, height, data } = tex.image;
  const out = new THREE.Color(0, 0, 0);
  if (!(data instanceof Uint16Array)) return out;
  const y = Math.floor(height * 0.47);
  let n = 0;
  for (let x = 0; x < width; x += 4) {
    const i = (y * width + x) * 4;
    out.r += THREE.DataUtils.fromHalfFloat(data[i] ?? 0); out.g += THREE.DataUtils.fromHalfFloat(data[i + 1] ?? 0); out.b += THREE.DataUtils.fromHalfFloat(data[i + 2] ?? 0); n++;
  }
  return out.multiplyScalar(1 / Math.max(1, n));
}

/** lay the weather over the blended preset (in place); returns the overcast it applied */
function weatherOver(C: Preset, mod: PineSkyMod): number {
  const ov = Math.min(1, Math.max(0, mod.overcast));
  C.fogDist *= mod.fogDist; C.fogHeight *= mod.fogHeight;
  if (ov <= 0) return 0;
  const k = 1 - ov;
  C.lightI *= 1 - 0.82 * ov;                        // the sun behind the deck: soft shadows, little direct light
  C.env *= 1 - 0.3 * ov;
  C.hemiI *= 1 + 0.15 * ov;                         // the diffuse sky takes over
  const grey = (col: THREE.Color, amt: number): void => { const l = col.r * 0.2126 + col.g * 0.7152 + col.b * 0.0722; col.lerp(tmpC.setRGB(l * 0.95, l * 0.98, l * 1.04), amt); };
  grey(C.hemiSky, 0.7 * ov); grey(C.light, 0.6 * ov); grey(C.fogSun, 0.9 * ov); grey(C.far, 0.8 * ov); grey(C.cloudLit, 0.9 * ov); grey(C.cloudSun, 0.9 * ov);
  C.cloudLit.multiplyScalar(1 - 0.45 * ov);
  C.far.multiplyScalar(1 - 0.35 * ov);
  C.fogSun.multiplyScalar(1 - 0.5 * ov);
  C.cloudA *= 1 - 0.75 * ov;                        // the painted cloud layer melts into the deck
  C.vol *= 1 - 0.75 * ov; C.rays *= k;
  C.haloO *= k; C.glow.multiplyScalar(k);          // (the disc shrinks away in apply: a darkened disc reads as a black dot)
  C.fogDist *= 1 + 1.6 * ov;                        // rain haze
  C.sat -= 0.12 * ov;
  C.lamps = Math.max(C.lamps, 0.35 * ov);           // the cabins light up under a dark sky
  return ov;
}

function clonePreset(p: Preset): Preset {
  return {
    ...p, light: p.light.clone(), hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), fogSun: p.fogSun.clone(), volColor: p.volColor.clone(),
    glow: p.glow.clone(), disc: p.disc.clone(), halo: p.halo.clone(), cloudSun: p.cloudSun.clone(), cloudLit: p.cloudLit.clone(), far: p.far.clone(),
  };
}

function lerpPreset(out: Preset, a: Preset, b: Preset, t: number): void {
  const L = (o: THREE.Color, x: THREE.Color, y: THREE.Color): void => { o.copy(x).lerp(y, t); };
  const n = (x: number, y: number): number => x + (y - x) * t;
  out.key = t < 0.5 ? a.key : b.key;
  out.bg = n(a.bg, b.bg); out.env = n(a.env, b.env);
  L(out.light, a.light, b.light); out.lightI = n(a.lightI, b.lightI);
  L(out.hemiSky, a.hemiSky, b.hemiSky); L(out.hemiGround, a.hemiGround, b.hemiGround); out.hemiI = n(a.hemiI, b.hemiI);
  L(out.fogSun, a.fogSun, b.fogSun); out.fogDist = n(a.fogDist, b.fogDist); out.fogHeight = n(a.fogHeight, b.fogHeight);
  out.vol = n(a.vol, b.vol); L(out.volColor, a.volColor, b.volColor); out.rays = n(a.rays, b.rays);
  L(out.glow, a.glow, b.glow); L(out.disc, a.disc, b.disc); L(out.halo, a.halo, b.halo); out.haloO = n(a.haloO, b.haloO);
  L(out.cloudSun, a.cloudSun, b.cloudSun); L(out.cloudLit, a.cloudLit, b.cloudLit); out.cloudA = n(a.cloudA, b.cloudA); L(out.far, a.far, b.far);
  out.lamps = n(a.lamps, b.lamps); out.sat = n(a.sat, b.sat);
}
