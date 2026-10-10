/**
 * Nalati's sky rig (07 §6.2 step 6; was the engine's `world/DayClock.ts`): applies the shared DayCycle and the steppe's
 * authored keyframes (dayKeys.ts) to the existing sky, lighting, fog, clouds and post effects. Clock arithmetic and
 * phase events live in the engine's dayCycle.ts; elevation keys and interpolation policy are this look's data.
 */
import * as THREE from 'three';
import type { ShardManifest, RGB } from '@wildshard/game/shard/manifest';
import type { Game } from '@wildshard/engine/core/Game';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { compassDir, type DayCycle, type DayKeys } from '@wildshard/engine/world/dayCycle';
import { painterlyUniforms, syncPainterlySun } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { smoothstep } from '@wildshard/engine/core/noise';

export interface SkyKey {
  el: number;
  sun: RGB; sunI: number;
  zenith: RGB; horizon: RGB; ground: RGB; glow: RGB; stars: number;
  hemiSky: RGB; hemiGround: RGB; hemiI: number; env: number;
  fog: RGB; fogSun: RGB;
  shade: RGB; rim: RGB;
  cloudSun: RGB; cloud: RGB; planet: RGB;
  shadowTint: RGB; highTint: RGB; lift: RGB; gain: RGB; sat: number; contrast: number;
  vol: RGB; volS: number; rays: number;
}

export interface SkyKeyProfile {
 frames: (day: SkyKey) => SkyKey[];
 blend: (out: SkyKey, a: SkyKey, b: SkyKey, t: number) => void;
}

// ─────────────────────────────────────────────── the look ───────────────────────────────────────────────

/** everything the sky rig paints, as plain numbers (lerpable) — the clock builds one, weather modifies it, `apply` writes it */
export interface SkyLook {
  /** the sun's direction (even below the horizon: the dome's afterglow follows it) */
  sunDir: THREE.Vector3;
  /** the key light: the sun by day, the moon at night */
  keyDir: THREE.Vector3; keyColor: THREE.Color; keyIntensity: number;
  /** 0 = the key is the sun, 1 = the moon (the disc's look) */
  moon: number;
  /** the sun/moon disc's visibility 0..1 (a storm deck hides it) */
  disc: number;
  zenith: THREE.Color; horizon: THREE.Color; ground: THREE.Color; glow: THREE.Color;
  stars: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiIntensity: number;
  envIntensity: number;
  fogColor: THREE.Color; fogSunColor: THREE.Color; fogDist: number; fogHeightDensity: number;
  shadeTint: THREE.Color; rimColor: THREE.Color;
  cloudSun: THREE.Color; cloudLight: THREE.Color; planetLight: THREE.Color; planetOpacity: number;
  shadowTint: THREE.Color; highTint: THREE.Color; lift: THREE.Color; gain: THREE.Color;
  saturation: number; contrast: number; brightness: number;
  volColor: THREE.Color; volStrength: number;
  godRays: number;
}

export function makeLook(): SkyLook {
  const c = (): THREE.Color => new THREE.Color();
  return {
    sunDir: new THREE.Vector3(0, 1, 0), keyDir: new THREE.Vector3(0, 1, 0), keyColor: c(), keyIntensity: 1, moon: 0, disc: 1,
    zenith: c(), horizon: c(), ground: c(), glow: c(), stars: 0,
    hemiSky: c(), hemiGround: c(), hemiIntensity: 0.5, envIntensity: 1,
    fogColor: c(), fogSunColor: c(), fogDist: 0.0003, fogHeightDensity: 0.0006,
    shadeTint: c(), rimColor: c(),
    cloudSun: c(), cloudLight: new THREE.Color(1, 1, 1), planetLight: new THREE.Color(1, 1, 1), planetOpacity: 1,
    shadowTint: c(), highTint: c(), lift: c(), gain: c(), saturation: 0, contrast: 0, brightness: 0,
    volColor: c(), volStrength: 0.35, godRays: 1,
  };
}

/** the colour / number part of a look at one sun elevation (the key frames) */
const rgbOf = (c: THREE.Color): RGB => [c.r, c.g, c.b];

/**
 * The key frames below the def's "day": golden hour, sunset, the afterglow, the blue hour, night. Painterly, not
 * physical — night is a readable moonlit blue (the Qara Batyr mockup), dusk a warm orange-violet (the Kokbori one).
 */
/** the moon as a key light (colour, full intensity) */
const MOON_COLOR: RGB = [0.62, 0.74, 1.0];
const MOON_I = 0.95;

const _a = new THREE.Color();
function lerpRGB(out: THREE.Color, a: RGB, b: RGB, t: number): void { out.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * The sky rig: reads the shard's own look off the live objects (so "day" = the def, exactly), takes over the background
 * with a painted dome that can change (gradient, sun glow, stars, moon glow), and applies a `SkyLook` every frame.
 */
export class SkyRig {
  readonly dome: THREE.Mesh;
  private readonly day: SkyKey;
  private readonly dayKeys: DayKeys<SkyKey>;
  private readonly keyScratch: SkyKey;
  private readonly domeU = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: 0 }, uStars: { value: 0 },
    uTime: { value: 0 }, uFlash: { value: 0 },
  };
  private readonly discColor = new THREE.Color();
  private readonly baseDiscScale: number;
  private halo: THREE.Sprite | null = null;
  private readonly baseHaloScale: THREE.Vector3 = new THREE.Vector3(420, 420, 1);
  private readonly moonDisc = new THREE.Color(0.85, 0.9, 1.0);
  /** 0..1, extra lightning flash in the dome (Weather drives it) */
  flash = 0;
  /** the def's own (day) fog colour and sun intensity — what "full daylight" means for things that dim with the light */
  readonly dayFog = new THREE.Color();
  readonly daySunIntensity: number;

  constructor(private game: Game, private sky: Sky, keys: SkyKeyProfile, def: ShardManifest) {
    const S = def.sky, G = def.grade, A = def.atmosphere;
    const P = S.painted ?? { zenith: [0.1, 0.28, 0.85] as RGB, horizon: [0.62, 0.78, 0.98] as RGB, ground: [0.3, 0.36, 0.3] as RGB, glow: [1.0, 0.82, 0.55] as RGB };
    const fog = game.scene.fog as THREE.Fog | null;
    const vs = A.volumetric?.strength ?? 0.55;
    this.day = {
      el: 14,
      // the def's own light, as SkyRig.build starts it (standalone the live values are these at this point): inside a grid
      // cell the shared sky is still the road's when the region builds (SF63: the cell lit with the road's key, fill and
      // environment read paler and flatter than standalone)
      sun: S.sunColor, sunI: S.sunIntensity,
      zenith: P.zenith, horizon: P.horizon, ground: P.ground, glow: P.glow, stars: 0,
      hemiSky: rgbOf(new THREE.Color(S.hemiSky)), hemiGround: rgbOf(new THREE.Color(S.hemiGround)), hemiI: S.hemiIntensity, env: S.envIntensity,
      fog: fog ? rgbOf(fog.color) : P.horizon, fogSun: S.fogSunColor,
      shade: rgbOf(painterlyUniforms.uPShade.value), rim: rgbOf(painterlyUniforms.uPRimColor.value),
      cloudSun: S.cloudSunColor, cloud: [1, 1, 1], planet: [1, 1, 1],
      shadowTint: G.shadowTint, highTint: G.highTint, lift: G.lift, gain: G.gain, sat: G.saturation, contrast: G.contrast,
      vol: A.volumetricSunColor, volS: vs, rays: 1,
    };
    this.dayKeys = { coordinate: 'elevation', frames: [this.day, ...keys.frames(this.day)].map((key) => [key.el, key]), blend: keys.blend };
    this.keyScratch = { ...this.day, sun: [...this.day.sun], zenith: [...this.day.zenith], horizon: [...this.day.horizon], ground: [...this.day.ground], glow: [...this.day.glow], hemiSky: [...this.day.hemiSky], hemiGround: [...this.day.hemiGround], fog: [...this.day.fog], fogSun: [...this.day.fogSun], shade: [...this.day.shade], rim: [...this.day.rim], cloudSun: [...this.day.cloudSun], cloud: [...this.day.cloud], planet: [...this.day.planet], shadowTint: [...this.day.shadowTint], highTint: [...this.day.highTint], lift: [...this.day.lift], gain: [...this.day.gain], vol: [...this.day.vol] };
    this.dayFog.setRGB(...this.day.fog);
    this.daySunIntensity = this.day.sunI;
    this.fogDist = fogUniforms.fogDistDensity.value;
    this.fogHeight = fogUniforms.fogHeightDensity.value;
    this.bright = G.brightness;

    // the painted dome replaces the painted texture as the background (same gradient maths as Sky.paintSky)
    const mat = new THREE.ShaderMaterial({
      uniforms: this.domeU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99995, p.w); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uGlow;
        uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uMoon; uniform float uStars; uniform float uTime; uniform float uFlash;
        varying vec3 vDir;
        float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float e = d.y;
          vec3 col;
          if (e >= 0.0) {
            float t = smoothstep(0.0, 1.0, pow(e, 0.55));
            col = mix(uHorizon, uZenith, t);
            vec2 sh = uSunDir.xz; float shl = max(length(sh), 1e-3);
            float side = pow(max(dot(normalize(d.xz + 1e-5), sh / shl), 0.0), 2.0) * (1.0 - t) * 0.35;
            // the sun's glow follows it just under the horizon (the afterglow), fading as it sinks
            float below = smoothstep(-0.3, 0.02, uSunDir.y);
            float g = max(dot(d, normalize(uSunDir + vec3(0.0, max(0.0, -uSunDir.y), 0.0))), 0.0);
            col += uGlow * ((pow(g, 6.0) * 0.45 + pow(g, 48.0) * 1.6 * step(0.0, uSunDir.y)) + side) * below;
            // stars: a sparse hashed field, twinkling, fading into the horizon haze
            if (uStars > 0.0) {
              vec3 q = d * 260.0; vec3 cell = floor(q);
              float h = hash3(cell);
              float star = step(0.9965, h) * smoothstep(0.5, 0.05, length(fract(q) - 0.5));
              float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
              col += vec3(0.8, 0.86, 1.0) * star * tw * uStars * smoothstep(0.02, 0.25, e) * (0.6 + 2.4 * fract(h * 97.0));
            }
            // the moon's halo
            float m = max(dot(d, uMoonDir), 0.0);
            col += vec3(0.5, 0.6, 0.85) * (pow(m, 24.0) * 0.12 + pow(m, 300.0) * 0.5) * uMoon;
          } else {
            float t = smoothstep(0.0, 0.12, -e);
            col = mix(uHorizon * 0.85, uGround, t);
          }
          col += vec3(0.7, 0.7, 1.0) * uFlash * (0.35 + 0.65 * smoothstep(-0.05, 0.5, e));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;
    this.dome.name = 'sky-dome';
    game.scene.add(this.dome);
    game.scene.background = null; // the dome draws the sky; the painted texture stays as the environment (IBL)

    const discMat = sky.sunDisc.material;
    if (discMat instanceof THREE.MeshBasicMaterial) this.discColor.copy(discMat.color);
    this.baseDiscScale = sky.sunDisc.scale.x;
    const halo = sky.sunDisc.children.find((c): c is THREE.Sprite => c instanceof THREE.Sprite);
    if (halo) { this.halo = halo; this.baseHaloScale.copy(halo.scale); }
  }

  private readonly fogDist: number;
  private readonly fogHeight: number;
  private readonly bright: number;

  /** the time-of-day look at the clock's hour → out */
  look(clock: DayCycle<SkyKey>, out: SkyLook): SkyLook {
    clock.spec.keys = this.dayKeys;
    return sampleSkyLook(clock, out, this.keyScratch, this.fogDist, this.fogHeight, this.bright);
  }

  /** write a look into every consumer (cheap: uniform writes only) */
  apply(L: SkyLook, dt: number): void {
    const { sky, game } = this;
    sky.setKeyLight(L.keyDir, L.keyColor, L.keyIntensity);
    syncPainterlySun(sky);
    painterlyUniforms.uPShade.value.copy(L.shadeTint);
    painterlyUniforms.uPRimColor.value.copy(L.rimColor);
    sky.hemi.color.copy(L.hemiSky); sky.hemi.groundColor.copy(L.hemiGround); sky.hemi.intensity = L.hemiIntensity;
    game.scene.environmentIntensity = L.envIntensity;
    const fog = game.scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(L.fogColor);
    fogUniforms.fogSunColor.value.copy(L.fogSunColor);
    fogUniforms.fogDistDensity.value = L.fogDist;
    fogUniforms.fogHeightDensity.value = L.fogHeightDensity;
    sky.setCloudLight(L.cloudSun, L.cloudLight);
    sky.setPlanetLight(L.planetLight, L.planetOpacity);
    // the disc: the sun, or at night a smaller pale moon
    const disc = sky.sunDisc;
    disc.visible = L.disc > 0.01;
    const dm = disc.material;
    if (dm instanceof THREE.MeshBasicMaterial) {
      _a.copy(this.discColor).lerp(this.moonDisc, L.moon);
      dm.color.copy(_a).multiplyScalar(L.disc * (L.moon > 0 ? 1.4 : 1));
    }
    const k = L.moon > 0 ? 0.55 : 1;
    disc.scale.setScalar(this.baseDiscScale * k);
    if (this.halo) {
      this.halo.scale.copy(this.baseHaloScale).multiplyScalar(L.moon > 0 ? 0.5 : 1);
      this.halo.material.opacity = L.disc * (L.moon > 0 ? 0.35 : 1);
    }
    const u = this.domeU;
    u.uZenith.value.copy(L.zenith); u.uHorizon.value.copy(L.horizon); u.uGround.value.copy(L.ground); u.uGlow.value.copy(L.glow);
    u.uSunDir.value.copy(L.sunDir); u.uMoonDir.value.copy(L.keyDir); u.uMoon.value = L.moon * L.disc; u.uStars.value = L.stars;
    u.uTime.value += dt; u.uFlash.value = this.flash;
    // No engine chain: Nalati's look is a 'replace' chain (grade.ts: its one GradeV2Effect), so `game.post` is null on its own
    // page and the hour's grade reaches the frame through `uV2LookSat` (light.ts). Inside its grid cell `game.post` is the
    // page shell's chain, which the frame carries neutral for a replace look (SF63): writing the level's saturation 0.1 /
    // contrast 0.15 and split tone into it every frame graded the cell twice (darker, bluer, harder than standalone).
    this.dome.position.copy(game.camera.position);
  }
}

/** copy a look (weather modifies a copy of the clock's look) */
export function copyLook(out: SkyLook, L: SkyLook): SkyLook {
  out.sunDir.copy(L.sunDir); out.keyDir.copy(L.keyDir); out.keyColor.copy(L.keyColor); out.keyIntensity = L.keyIntensity;
  out.moon = L.moon; out.disc = L.disc;
  out.zenith.copy(L.zenith); out.horizon.copy(L.horizon); out.ground.copy(L.ground); out.glow.copy(L.glow); out.stars = L.stars;
  out.hemiSky.copy(L.hemiSky); out.hemiGround.copy(L.hemiGround); out.hemiIntensity = L.hemiIntensity; out.envIntensity = L.envIntensity;
  out.fogColor.copy(L.fogColor); out.fogSunColor.copy(L.fogSunColor); out.fogDist = L.fogDist; out.fogHeightDensity = L.fogHeightDensity;
  out.shadeTint.copy(L.shadeTint); out.rimColor.copy(L.rimColor);
  out.cloudSun.copy(L.cloudSun); out.cloudLight.copy(L.cloudLight); out.planetLight.copy(L.planetLight); out.planetOpacity = L.planetOpacity;
  out.shadowTint.copy(L.shadowTint); out.highTint.copy(L.highTint); out.lift.copy(L.lift); out.gain.copy(L.gain);
  out.saturation = L.saturation; out.contrast = L.contrast; out.brightness = L.brightness;
  out.volColor.copy(L.volColor); out.volStrength = L.volStrength; out.godRays = L.godRays;
  return out;
}

/** Apply the shared sky channels from the clock's interpolated numeric key. */
export function sampleSkyLook(clock: DayCycle<SkyKey>, out: SkyLook, key: SkyKey, fogDist: number, fogHeight: number, brightness: number): SkyLook {
    const el = clock.sunElevation;
    compassDir(clock.sunAzimuth, el, out.sunDir);
    clock.key(key);
    const a = key, b = key, s = 0;
    // the key light: the sun until it touches the horizon, then (at zero) the moon
    const moonT = smoothstep(-2, -12, el);
    if (el > -1.5) {
      lerpRGB(out.keyColor, a.sun, b.sun, s);
      out.keyIntensity = lerpN(a.sunI, b.sunI, s) * smoothstep(-1.5, 1.5, el);
      out.keyDir.copy(out.sunDir);
      out.moon = 0;
    } else {
      out.keyColor.setRGB(...MOON_COLOR);
      out.keyIntensity = MOON_I * moonT;
      compassDir(clock.moonAzimuth, clock.moonElevation, out.keyDir);
      out.moon = 1;
    }
    out.disc = out.moon > 0 ? moonT : smoothstep(-2.5, 0.5, el);
    lerpRGB(out.zenith, a.zenith, b.zenith, s); lerpRGB(out.horizon, a.horizon, b.horizon, s);
    lerpRGB(out.ground, a.ground, b.ground, s); lerpRGB(out.glow, a.glow, b.glow, s);
    out.stars = lerpN(a.stars, b.stars, s);
    lerpRGB(out.hemiSky, a.hemiSky, b.hemiSky, s); lerpRGB(out.hemiGround, a.hemiGround, b.hemiGround, s);
    out.hemiIntensity = lerpN(a.hemiI, b.hemiI, s);
    out.envIntensity = lerpN(a.env, b.env, s);
    lerpRGB(out.fogColor, a.fog, b.fog, s); lerpRGB(out.fogSunColor, a.fogSun, b.fogSun, s);
    out.fogDist = fogDist; out.fogHeightDensity = fogHeight;
    lerpRGB(out.shadeTint, a.shade, b.shade, s); lerpRGB(out.rimColor, a.rim, b.rim, s);
    lerpRGB(out.cloudSun, a.cloudSun, b.cloudSun, s); lerpRGB(out.cloudLight, a.cloud, b.cloud, s); lerpRGB(out.planetLight, a.planet, b.planet, s);
    out.planetOpacity = 1;
    lerpRGB(out.shadowTint, a.shadowTint, b.shadowTint, s); lerpRGB(out.highTint, a.highTint, b.highTint, s);
    lerpRGB(out.lift, a.lift, b.lift, s); lerpRGB(out.gain, a.gain, b.gain, s);
    out.saturation = lerpN(a.sat, b.sat, s); out.contrast = lerpN(a.contrast, b.contrast, s); out.brightness = brightness;
    lerpRGB(out.volColor, a.vol, b.vol, s); out.volStrength = lerpN(a.volS, b.volS, s);
    out.godRays = lerpN(a.rays, b.rays, s);
    return out;
}
