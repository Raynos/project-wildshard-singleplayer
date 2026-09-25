import * as THREE from 'three';
import { TIER_CONFIG } from '../core/tier';
import { setting, settingFromUrl } from '../ui/Settings';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { loadHDR } from '../core/assets';
import { fogUniforms, paintedAir, patchCloudShadows, isPaintedAir } from './Atmosphere';
import { buildPainterlyClouds, skyLayerUniforms, type SkyLayerUniforms } from './PainterlySky';
import { buildPainterlyRange } from './PainterlyRange';
import { wind } from './steppeWind';
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import { getActiveChunk } from '../chunks/registry';
import type { ChunkSky } from '../chunks/ChunkDef';
import { bakedTexture, preloadBakedTextures } from '../boot/bakedTextures';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { bakedSkyUrls, loadBakedSky as loadSkyPair } from './BakedSky';
import { macrotask } from '../boot/plan';
import { installStylize, toonUniforms } from './stylize';
import { StylizedSky } from './StylizedSky';
import { DayNight } from './DayNight';
import { loadStylizedLUT } from './lut';
import type { LookupTexture } from 'postprocessing';

/** the key light's shadow direction steps (E89, src/world/DayNight.ts SHADOW_STEP): ≤ ~1 shadow texel about every 1.5 s */
const KEY_SHADOW_STEP = 0.25 * Math.PI / 180;

/** the sun's shadow map(s): cascade count, map size (px), how far they reach (m), the caster margin (m) and, for two
 *  cascades, where the near one ends (m) */
export interface ShadowRig { cascades: number; size: number; far: number; margin: number; split: number; /** the phone's low-poly rig (E123): normal bias in texels */ phone: boolean }

/** `?pshadow=` names for the phone's on-device A/B (E123); `<size>x<cascades>@<far>[/<split>]` spells any other */
const PHONE_SHADOW_RIGS: Record<string, Omit<ShadowRig, 'margin' | 'phone'>> = {
  old: { cascades: 1, size: 1024, far: 80, split: 0 },    // before E123: one 189 m square at 1024², 18.5 cm a texel
  '2k': { cascades: 1, size: 2048, far: 80, split: 0 },
  '2c': { cascades: 2, size: 1024, far: 80, split: 14 },
  '2c2k': { cascades: 2, size: 2048, far: 80, split: 14 }, // the user's pick (2026-09-25, "both 2048 and 2c"): 1.7 cm a texel near you
  near: { cascades: 1, size: 1024, far: 55, split: 0 },
};

/** the phone's rig on the low-poly shard when the URL names none (E123, the user's pick: `2c2k`, two cascades at 2048², the near
 *  one to 14 m — ~+0.5 ms a frame on the M5 against `2k`; `?pshadow=2k` is the one-square rig it replaced) */
const PHONE_SHADOW_DEFAULT = '2c2k';

/**
 * The shadow rig for this tier and shard. The phone's portrait camera (94° vertical FOV) makes a cascade's square far
 * wider than its reach: the one 80 m cascade was 189 m across, so a 1024² texel was 18.5 cm and every shadow edge a
 * row of 18 cm steps smeared by the PCF (E123: "blocky, blobby, pixelated, bleeding"). `?pshadow=` overrides on the phone.
 */
export function shadowRig(stylized: boolean): ShadowRig {
  const T = TIER_CONFIG;
  const base: ShadowRig = { cascades: T.cascades, size: T.shadowMapSize, far: T.shadowFar, margin: T.shadowMargin, split: 0, phone: false };
  if (T.cascades !== 1 || !stylized && !new URLSearchParams(location.search).has('pshadow')) return base; // desktop / the other shards: the tier table
  const want = new URLSearchParams(location.search).get('pshadow') ?? PHONE_SHADOW_DEFAULT;
  const named = PHONE_SHADOW_RIGS[want];
  if (named) return { ...named, margin: base.margin, phone: true };
  const m = /^(512|1024|2048|4096)x([12])@(\d+)(?:\/(\d+))?$/.exec(want);
  if (!m) { console.warn(`[sky] ?pshadow=${want}: not a rig (${Object.keys(PHONE_SHADOW_RIGS).join(' · ')} · <size>x<cascades>@<far>[/<split>])`); return base; }
  const cascades = Number(m[2]);
  return { size: Number(m[1]), cascades, far: Number(m[3]), split: cascades === 2 ? Number(m[4] ?? 14) : 0, margin: base.margin, phone: true };
}

/** the low-poly shard's sun before the day / night clock moves it: mid-morning from the east-south-east, 38° up */
const STYLIZED_SUN = new THREE.Vector3(-0.74, 0.616, -0.27).normalize();

/** how far the planet group sits from the camera (Game.ts re-places it every frame along `planetDir`) */
export const PLANET_DIST = 1700;

/** public/assets/baked/<slug>/sky.json — the HDR's sun direction and horizon colour, scanned at build time (scripts/bake-sky.mjs). */
async function loadBakedSky(hdri: string): Promise<{ sunDir: [number, number, number]; horizon: [number, number, number] } | null> {
  const url = `/assets/baked/${getActiveChunk().slug}/sky.json`;
  if (!(url in PUBLIC_BYTES) || new URLSearchParams(location.search).has('nobake') || new URLSearchParams(location.search).has('hdri')) return null;
  try {
    const j = await (await fetch(url)).json() as { hdri: string; sunDir: [number, number, number]; horizon: [number, number, number] };
    return j.hdri === hdri ? j : null; // a different HDRI than the bake saw → scan at launch
  } catch { return null; }
}

/**
 * Lighting rig: HDRI sky for IBL + background, a cascaded-shadow sun matched to the
 * HDRI's brightest pixel, a visible sun disc (for god rays) and the ringed planet that
 * hangs over every Wildshard shard.
 */
export class Sky {
  sunDir = new THREE.Vector3(0.3, 0.6, 0.4).normalize();
  sunColor = new THREE.Color(...getActiveChunk().sky.sunColor);
  csm!: CSM;
  sunDisc!: THREE.Mesh;
  planet = new THREE.Group();
  planetDir = new THREE.Vector3(-0.75, 0.33, 0.55).normalize();
  /** the fill light (ChunkSky.hemiSky / hemiGround / hemiIntensity) — a runtime handle for the day/night clocks (DayNight.ts, DayClock.ts) */
  hemi!: THREE.HemisphereLight;
  private materials = new Set<THREE.Material>();

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private renderer: THREE.WebGLRenderer) {}

  /** the player's camera (world modules cull against it) */
  get viewCamera(): THREE.PerspectiveCamera { return this.camera; }

  async build(): Promise<this> {
    const { sky: S, atmosphere: A, style } = getActiveChunk();
    // Look Lab (E65): the sky (E83) and toon lighting (E87) are locked in; the URL alone still builds the pre-remaster looks
    const qs = new URLSearchParams(location.search);
    const toon = style === 'lowpoly' && !(settingFromUrl('lighting') && setting('lighting') === 'standard'), // toon locked in (E87): only ?lighting=standard lights it the old way
      stylizedSky = style === 'lowpoly' && !(settingFromUrl('sky') && setting('sky') === 'hdri'); // stylized locked in (E83, the user's Look Lab pick): only ?sky=hdri brings back the photo HDRI
    if (toon) installStylize(); // the toon lighting model (D1) — patched into three's chunk before anything compiles
    if (toon && qs.has('pedge')) toonUniforms.uToonEdge.value = Number.parseFloat(qs.get('pedge') ?? '1') || 0; // E123 A/B: the warm band round cast shadows
    const qn = (k: string, d: number) => { const v = qs.get(k); return v === null ? d : Number.parseFloat(v); };
    const horizon = stylizedSky ? await this.setupStylized() : await this.setupHDRI(qs, qn);
    this.scene.fog = new THREE.Fog(horizon, 1, 1e6); // distances unused: Atmosphere.ts overrides the maths
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    fogUniforms.fogSunColor.value.set(...S.fogSunColor);
    fogUniforms.fogHeight.value = A.fogHeight;
    fogUniforms.fogHeightFalloff.value = A.fogHeightFalloff;
    fogUniforms.fogHeightDensity.value = A.fogHeightDensity;
    fogUniforms.fogDistDensity.value = A.fogDistDensity;

    const rig = shadowRig(this.stylized !== null);
    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: rig.cascades, mode: rig.split > 0 ? 'custom' : 'practical',
      // the near cascade ends at `split` m: a tight square round the player (the deck, the pier under foot), the far one takes the rest
      customSplitsCallback: (_n: number, _near: number, far: number, out: number[]) => { out.push(Math.min(0.9, rig.split / far), 1); },
      maxFar: rig.far, shadowMapSize: rig.size, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: qn('sunI', S.sunIntensity), shadowBias: -0.00012, lightMargin: rig.margin, lightNear: 1, lightFar: 600,
    });
    this.csm.fade = true;
    if (!TIER_CONFIG.softShadows) this.renderer.shadowMap.type = THREE.PCFShadowMap; // 16-tap PCFSoft → 9-tap PCF on the phone
    patchCSMShaderChunk();
    patchCloudShadows(); // painterly shards: the drifting cloud shadows in the sun loop (a no-op elsewhere)
    // the stylized shard's low sun (golden hour, dawn) grazes the flat decks: more normal bias or the planks speckle with acne
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = this.stylized ? 0.14 : 0.05; l.shadow.radius = this.stylized ? 0.6 : 2; }
    this.texelBias = this.stylized !== null && rig.phone;

    this.hemi = new THREE.HemisphereLight(S.hemiSky, S.hemiGround, S.hemiIntensity);
    this.scene.add(this.hemi);

    this.buildSunDisc();
    this.buildPlanet();
    if (this.stylized) {
      const st = this.stylized, fog = this.scene.fog;
      this.clouds = st.dome; // Game.ts keeps `clouds` on the camera: the dome and its cumulus ring
      // the day / night clock (L7, D3) turns every knob above from here on
      if (fog instanceof THREE.Fog) this.dayNight = new DayNight({
        sunDir: this.sunDir, lights: this.csm.lights, lightDirection: this.csm.lightDirection, hemi: this.hemi, fog,
        fogSunDir: fogUniforms.fogSunDir.value, fogSunColor: fogUniforms.fogSunColor.value, toon: toonUniforms,
        setSkyPalette: (pal, dir) => { st.setPalette(pal); st.u.uSunDir.value.copy(dir); },
        disc: this.sunDisc, planetSun: this.giantUniforms.uSunDir.value, planetHaze: this.giantUniforms.uHaze.value,
        refreshEnvironment: () => { this.refreshEnvironment(); },
      }, qn('sunI', S.sunIntensity) / 2.7);
    } else this.buildClouds();
    return this;
  }

  /** Pine Hollow's rig (and any `style: 'pbr'` shard): the HDRI is the background and the IBL; returns the fog colour. */
  private async setupHDRI(qs: URLSearchParams, qn: (k: string, d: number) => number): Promise<THREE.Color> {
    const { sky: S } = getActiveChunk();
    const hdriName = qs.get('hdri') ?? S.hdri;
    // baked procedural textures (clouds, fur…) and the baked sun / horizon (scripts/bake-sky.mjs) ride along with the HDR
    // the HDR itself: the gain-mapped JPEG + PNG pair (~0.3 MB, BakedSky.ts) when the build has it, else the 4–5 MB .hdr
    const pair = bakedSkyUrls(hdriName);
    const hdrUrl = `/assets/hdri/${hdriName}_2k.hdr`;
    // `ChunkSky.sun` places the sun by hand; `ChunkSky.painted` paints the whole sky around it (nothing downloaded)
    if (S.sun) this.sunDir.copy(compassDir(S.sun.azimuth, S.sun.elevation));
    const painted = S.painted && !qs.has('hdri') ? S.painted : null;
    const loadSky = painted ? Promise.resolve(paintSky(painted, this.sunDir))
      : pair ? loadSkyPair(pair).catch((e: unknown) => { console.warn(`[sky] gain-mapped pair not used (${String(e)}); loading the .hdr`); return loadHDR(hdrUrl); }) : loadHDR(hdrUrl);
    const [hdr, , baked] = await Promise.all([loadSky, preloadBakedTextures(), painted ? Promise.resolve(null) : loadBakedSky(hdriName)]);
    if (!S.sun) { if (baked) this.sunDir.fromArray(baked.sunDir).normalize(); else this.findSun(hdr); }
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    // three tasks, not one 130 ms one at 4x CPU: the PMREM program compile, the 2048x1024 half-float upload, then the
    // cube-UV render + blur passes (same calls, same result — only the task boundaries move)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    await macrotask();
    this.renderer.initTexture(hdr);
    await macrotask();
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = qn('envI', S.envIntensity);
    this.scene.background = hdr;
    this.scene.backgroundIntensity = qn('bgI', S.bgIntensity);
    this.scene.backgroundBlurriness = 0.0;

    // Fog colour = average of the sky just above the horizon in the view direction
    return baked ? new THREE.Color(...baked.horizon) : this.sampleHorizon(hdr);
  }

  /**
   * The low-poly shard (D2): no HDRI at all — the stylized gradient dome + faceted cumulus (StylizedSky.ts) is the
   * background, a PMREM of the dome is the (specular-only, stylize.ts) environment, and the sun comes from the
   * day / night clock's start time. Returns the fog colour (the dome's horizon).
   */
  stylized: StylizedSky | null = null;
  /** the low-poly shard's learned colour LUT (lut.ts, X1) — Game.buildComposer ends the grade with it; null elsewhere */
  lut: LookupTexture | null = null;
  /** the low-poly shard's day / night clock (DayNight.ts) — null on a PBR shard */
  dayNight: DayNight | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private async setupStylized(): Promise<THREE.Color> {
    const { sky: S } = getActiveChunk();
    const [, lut] = await Promise.all([preloadBakedTextures(), loadStylizedLUT()]);
    this.lut = lut;
    this.sunDir.copy(STYLIZED_SUN);
    const st = new StylizedSky(this.sunDir).build();
    this.stylized = st;
    this.scene.add(st.dome);
    this.scene.background = null;
    this.refreshEnvironment();
    this.scene.environmentIntensity = S.envIntensity;
    toonUniforms.uFogZenith.value.copy(st.u.uZenith.value); // the colour-ramp fog (L3) fades into the dome's own gradient
    return st.u.uHorizon.value.clone();
  }

  /**
   * After an in-place WebGL restore (src/core/GpuRecovery.ts, E54): the PMREM environment was a render target, so it came
   * back empty. Render it again — the stylized dome through refreshEnvironment, the HDR shard from its background texture.
   */
  rebuildEnvironment(): void {
    if (this.stylized) { this.pmrem = null; this.envRT = null; this.refreshEnvironment(); return; } // a fresh generator: the old one's targets belong to the lost context
    const hdr = this.scene.background;
    if (!(hdr instanceof THREE.Texture)) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
  }

  /** re-render the dome into the PMREM environment (DayNight calls it when the sky has moved on; ~1 ms of GPU) */
  refreshEnvironment(): void {
    if (!this.stylized) return;
    this.pmrem ??= new THREE.PMREMGenerator(this.renderer);
    const rt = this.pmrem.fromScene(this.stylized.envScene, 0, 1, 3000, { size: 64 });
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  /**
   * Shared 1×1 fillers so every plain MeshStandard/Physical material carries the same map slots
   * (map · normal · ao · roughness · metalness) and therefore the same program: three keys a program
   * on WHICH slots exist, not their contents, so a coloured post, a mapped plank and a full PBR set
   * were three ~150 ms Metal compiles on the iPhone for what is one shader with different uniforms.
   * White multiplies by 1, a flat normal leaves the geometry normal; materials with their own
   * shader patch (an own customProgramCacheKey) are left alone.
   */
  private static fillers: { white: THREE.DataTexture; flatNormal: THREE.DataTexture } | null = null;
  private static fillSlots(mat: THREE.Material) {
    const m = mat as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial || Object.hasOwn(mat, 'customProgramCacheKey')) return;
    if (!Sky.fillers) {
      const tex = (rgb: [number, number, number], srgb: boolean) => { const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
      Sky.fillers = { white: tex([255, 255, 255], true), flatNormal: tex([128, 128, 255], false) };
    }
    const { white, flatNormal } = Sky.fillers;
    m.map ??= white;
    m.normalMap ??= flatNormal;
    m.aoMap ??= white;         // ao · roughness · metalness read r · g · b: white = ×1
    m.roughnessMap ??= white;
    m.metalnessMap ??= white;
  }

  /** Wrap CSM's onBeforeCompile so materials keep their own shader patches. */
  setupMaterial(mat: THREE.Material): void {
    if (this.materials.has(mat)) return;
    this.materials.add(mat);
    Sky.fillSlots(mat);
    const own = mat.onBeforeCompile.bind(mat);
    this.csm.setupMaterial(mat);
    const csmHook = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => { own(shader, renderer); csmHook(shader, renderer); };
    const key = mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey = () => `${key()}|csm`;
    mat.needsUpdate = true;
  }

  /** the cloud layer(s) — Game.ts keeps them centred on the camera */
  clouds!: THREE.Object3D;
  private cloudUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uLight: { value: new THREE.Color(1, 1, 1) }, uDrift: { value: new THREE.Vector2() } };
  /** a painted sky's layer uniforms for SKY_LAYER_GLSL (PainterlySky.ts): a backdrop / far-range shader shares the air + the hour */
  skyLayer: SkyLayerUniforms | null = null;
  /** the painted snow range (PainterlyRange.ts), painterly skies only */
  paintedRange: THREE.Mesh | null = null;
  /** the painterly air's uniforms (aerial perspective, cloud shadows — Atmosphere.ts `paintedAir`), for live tuning (`__world.sky.air`) */
  readonly air = paintedAir;
  /** a painted sky (Nalati): the painterly clouds + the cloud shadows drift with the one Wind */
  private painterly = false;

  /** where the key light's shadow wants to point (setKeyLight); null on a shard nothing moves the sun on */
  private keyShadowWant: THREE.Vector3 | null = null;

  /**
   * E123: on the phone's low-poly rig the normal bias is held in shadow texels, not metres. 0.14 m was ~0.75 of the old
   * 18.5 cm texel; on a finer map the same 0.14 m only lifts contact shadows off the deck (E112 already flips it for
   * two-sided sheets). A cascade's square follows the camera's aspect (a resize, a rotation), so it is read each frame.
   */
  private texelBias = false;
  private fitNormalBias(): void {
    for (const l of this.csm.lights) {
      const texel = (l.shadow.camera.right - l.shadow.camera.left) / l.shadow.mapSize.x;
      if (Number.isFinite(texel) && texel > 0) l.shadow.normalBias = Math.min(0.14, 0.76 * texel);
    }
  }

  update(dt = 0): void {
    const want = this.keyShadowWant;
    if (want !== null && want.angleTo(this.csm.lightDirection) > KEY_SHADOW_STEP) this.csm.lightDirection.copy(want); // a big jump (a Time of day pick, the sun ↔ moon swap) moves at once
    this.csm.update();
    if (this.texelBias) this.fitNormalBias(); this.cloudUniforms.uTime.value += dt; this.giantUniforms.uTime.value += dt;
    if (this.stylized) { this.dayNight?.update(dt); this.stylized.update(dt); toonUniforms.uCloudTime.value += dt; }
    if (this.painterly) {
      // the sky's clouds and their shadows on the ground drift downwind (the shadows at ~1.6× the wind, as clouds aloft do)
      const s = (wind.speed * 1.6 + 2) * dt;
      this.cloudUniforms.uDrift.value.x += wind.dirX * s * 0.00004; this.cloudUniforms.uDrift.value.y += wind.dirZ * s * 0.00004;
      const k = paintedAir.fogCloud.value.x;
      paintedAir.fogCloudOff.value.x -= wind.dirX * s * k; paintedAir.fogCloudOff.value.y -= wind.dirZ * s * k;
    }
  }

  // ── runtime setters (the day/night clock + weather, src/world/DayClock.ts; nothing calls them on a fixed-time shard) ──

  /**
   * Move the key light (the sun, or the moon at night) and recolour it: the CSM direction + colour × intensity, the
   * fog's in-scatter direction, the cloud / planet lighting direction. `sunDir` is updated in place (Game.ts places
   * the sun disc along it every frame; the painterly material reads it through `syncPainterlySun`).
   * The shadow direction moves in KEY_SHADOW_STEP steps, not every frame (E89, as DayNight does it: a sun sliding a
   * fraction of a texel per frame made every shadow edge crawl); the disc, the fog and the clouds stay continuous.
   */
  setKeyLight(dir: THREE.Vector3, color: THREE.Color, intensity: number): void {
    this.sunDir.copy(dir).normalize();
    this.sunColor.copy(color);
    this.keyShadowWant = (this.keyShadowWant ?? new THREE.Vector3()).copy(this.sunDir).negate(); // stepped in update(): the frame's last writer wins (the rig, then LightCheat)
    for (const l of this.csm.lights) { l.color.copy(color); l.intensity = intensity; }
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.giantUniforms.uSunDir.value.copy(this.sunDir);
  }

  /** the cloud layer's colour toward the sun, and a multiplier over the whole layer (night, a storm's gloom); default white */
  setCloudLight(sunColor: THREE.Color, light: THREE.Color): void {
    this.cloudUniforms.uSunColor.value.copy(sunColor);
    this.cloudUniforms.uLight.value.copy(light);
  }

  /** a multiplier over the ringed giant's colour and its opacity (a storm deck hides it); default white, 1 */
  setPlanetLight(light: THREE.Color, opacity = 1): void {
    this.giantUniforms.uLight.value.copy(light);
    this.giantUniforms.uOpacity.value = opacity;
  }

  /** Thin procedural cirrus/cumulus layer on a sky dome — the HDRI has none, and a forest needs a sky with some drama. */
  private buildClouds() {
    const geo = new THREE.SphereGeometry(1400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const tex = bakedTexture('clouds', makeCloudTexture); // 512² six-octave simplex on a torus: ~200 ms of phone CPU when not baked
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (getActiveChunk().sky.painted && isPaintedAir()) {
      // Nalati: cel-shaded cumulus round the horizon + high puffs (PainterlySky.ts), and the same fbm drives the cloud shadows
      this.painterly = true;
      tex.needsUpdate = true;
      paintedAir.fogCloudTex.value = tex;
      this.cloudUniforms.uSunDir.value.copy(this.sunDir);
      this.cloudUniforms.uSunColor.value.set(...getActiveChunk().sky.cloudSunColor);
      const haze = (this.scene.fog as THREE.Fog).color; // live: the day/night rig recolours it
      this.clouds = buildPainterlyClouds(this.cloudUniforms, haze, tex);
      this.skyLayer = skyLayerUniforms(this.cloudUniforms, haze);
      // the procedural painted snow range (PainterlyRange.ts): opt-in `?paintedrange=1` — the shard's range is the horizon
      // ring (Horizon.ts) + the painted matte backdrop (the painted-asset agent); this stays as a fallback / comparison
      if (new URLSearchParams(location.search).get('paintedrange') === '1') {
        this.paintedRange = buildPainterlyRange(this.renderer, this.cloudUniforms, haze);
        this.clouds.add(this.paintedRange);
      }
      this.scene.add(this.clouds);
      return;
    }
    // a painted sky (Nalati) gets big painted cumulus: larger cells, crisper edges, bright sunlit tops over soft blue-grey bellies
    const big = getActiveChunk().sky.painted ? 1.0 : 0.0;
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunColor.value.set(...getActiveChunk().sky.cloudSunColor);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.cloudUniforms, tClouds: { value: tex }, uBig: { value: big } },
      transparent: true, depthWrite: false, side: THREE.BackSide,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tClouds; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uBig; uniform vec3 uLight;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < 0.02) discard;
          // project onto a flat cloud plane at height ~1 for a believable perspective
          vec2 p = d.xz / (d.y + 0.15);
          vec2 uv = p * mix(0.5, 0.26, uBig) + vec2(uTime * 0.004, uTime * 0.002);
          float a = texture2D(tClouds, uv).r;
          float b = texture2D(tClouds, uv * mix(3.1, 2.2, uBig) + vec2(-uTime * 0.006, uTime * 0.003)).r;
          float dens = a * mix(0.7, 0.82, uBig) + b * mix(0.3, 0.18, uBig);
          float cover = mix(smoothstep(0.52, 0.8, dens), smoothstep(0.55, 0.6, dens), uBig);
          float horizon = smoothstep(0.02, 0.22, d.y);
          float sunAmt = max(dot(d, uSunDir), 0.0);
          vec3 lit = mix(vec3(0.62, 0.66, 0.74), vec3(1.0, 0.94, 0.86), smoothstep(0.3, 0.9, a));
          // painted cumulus: the belly (thin, low density) blue-grey, the piled-up tops bright, the sun side warm
          float top = smoothstep(0.56, 0.78, dens) * (0.6 + 0.4 * smoothstep(0.4, 0.8, b));
          vec3 painted = mix(vec3(0.66, 0.74, 0.9), vec3(1.25, 1.22, 1.18), top);
          lit = mix(lit, painted, uBig);
          lit = mix(lit, uSunColor * 1.3, pow(sunAmt, 6.0) * 0.6);
          float alpha = cover * horizon * mix(0.85, 0.97, uBig);
          gl_FragColor = vec4(lit * uLight, alpha);
        }`,
    });
    this.clouds = new THREE.Mesh(geo, mat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -10;
    this.scene.add(this.clouds);
  }

  private findSun(hdr: THREE.DataTexture) {
    const { width, height, data } = hdr.image as { width: number; height: number; data: Float32Array | Uint16Array };
    let best = -1, bx = 0, by = 0;
    const isHalf = data instanceof Uint16Array;
    const px = (i: number) => (isHalf ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const l = px(i) + px(i + 1) + px(i + 2);
      if (l > best) { best = l; bx = x; by = y; }
    }
    // HDR is flipY=true so row 0 is the top → v = 1 - y/height
    const u = (bx + 0.5) / width, v = 1 - (by + 0.5) / height;
    const theta = (u - 0.5) * 2 * Math.PI, phi = (v - 0.5) * Math.PI;
    this.sunDir.set(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi)).normalize();
    if (this.sunDir.y < 0.12) { this.sunDir.y = 0.12; this.sunDir.normalize(); }
  }

  private sampleHorizon(hdr: THREE.DataTexture) {
    const { width, height, data } = hdr.image as { width: number; height: number; data: Float32Array | Uint16Array };
    const isHalf = data instanceof Uint16Array;
    const px = (i: number) => (isHalf ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
    const c = new THREE.Color(0, 0, 0);
    const y = Math.floor(height * 0.47); // just above the horizon line
    let n = 0;
    for (let x = 0; x < width; x += 4) { const i = (y * width + x) * 4; c.r += px(i); c.g += px(i + 1); c.b += px(i + 2); n++; }
    c.multiplyScalar(1 / n);
    // clamp very bright values so fog never blows out
    const m = Math.max(c.r, c.g, c.b, 1e-3);
    if (m > 1.1) c.multiplyScalar(1.1 / m);
    return c;
  }

  private buildSunDisc() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.95, 0.85), fog: false, toneMapped: false });
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 24), mat);
    this.sunDisc.position.copy(this.sunDir).multiplyScalar(1500);
    this.sunDisc.frustumCulled = false;
    // soft corona so the disc reads as a glowing sun rather than a white ball
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = ctx2d(c);
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,210,0.9)'); grad.addColorStop(0.12, 'rgba(255,210,150,0.55)'); grad.addColorStop(0.4, 'rgba(255,170,90,0.12)'); grad.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    halo.scale.setScalar(getActiveChunk().sky.painted ? 250 : 420); // a painted sun: a tighter glow (the mockups keep the sky blue right up to it)
    halo.scale.z = 1;
    this.sunDisc.add(halo);
    this.scene.add(this.sunDisc);
  }

  private buildPlanet() {
    const P = getActiveChunk().sky.planet;
    if (P) { this.buildGasGiant(P); return; }
    // A gas giant with rings sits low over the east horizon — the world's signature skyline.
    const dir = this.planetDir;
    const dist = 1700, radius = 300;
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), new THREE.MeshLambertMaterial({
      color: 0x9aa4b4, fog: false, emissive: 0x2c3646, emissiveIntensity: 0.7, transparent: true, opacity: 0.85,
    }));
    const bandsTex = bakedTexture('planet', makePlanetTexture); bandsTex.colorSpace = THREE.SRGBColorSpace;
    body.material.map = bandsTex;
    const ringTex = makeRingTexture();
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.25, radius * 2.35, 128, 1), new THREE.MeshLambertMaterial({
      map: ringTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false, alphaMap: ringTex,
      color: 0xb8c0cc, emissive: 0x1e2838, emissiveIntensity: 0.7, opacity: 0.8,
    }));
    this.setupMaterial(body.material);
    this.setupMaterial(ring.material);
    // ring uv: remap radial
    const uv = ring.geometry.getAttribute('uv');
    const pos = ring.geometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - radius * 1.25) / (radius * 1.1), 0.5);
    }
    ring.rotation.x = Math.PI / 2 - 0.42; ring.rotation.z = 0.35;
    this.planet.add(body, ring);
    this.planet.position.copy(dir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }

  /**
   * `ChunkSky.planet`: a banded gas giant with a thin bright ring on the sky where the def puts it
   * (Driftwood Isle). Two transparent, fogless, depth-write-free meshes in `this.planet` (Game.ts
   * keeps the group `PLANET_DIST` along `planetDir` from the camera): the body is a sphere shaded in
   * its own shader — band texture wrapped about the ring axis, soft terminator from the sun's side,
   * limb darkening and sky-haze at the limb so it sits *in* the sky like the mockups — and the ring
   * an annulus whose shader hides the part behind the body and darkens the body's shadow on it.
   */
  private buildGasGiant(P: NonNullable<ChunkSky['planet']>) {
    const d2r = Math.PI / 180;
    const az = P.azimuth * d2r, el = P.elevation * d2r;
    this.planetDir.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const dist = PLANET_DIST, R = dist * Math.tan(P.size * 0.5 * d2r);
    const haze = new THREE.Color().copy((this.scene.fog as THREE.Fog).color).lerp(new THREE.Color(0.55, 0.7, 0.95), 0.4);
    const bands = bakedTexture('giant', makeGiantTexture); bands.colorSpace = THREE.SRGBColorSpace;
    bands.wrapS = THREE.RepeatWrapping; bands.wrapT = THREE.ClampToEdgeWrapping;
    this.giantUniforms.uSunDir.value.copy(this.sunDir);
    this.giantUniforms.uHaze.value.copy(haze);
    this.giantUniforms.uRadius.value = R;
    if (getActiveChunk().sky.painted) { this.giantUniforms.uHazeAmt.value = 0.22; this.giantUniforms.uGain.value = 1.5; this.giantUniforms.uFar.value = 1; }
    this.giantUniforms.uCrisp.value = this.stylized ? 1 : 0;

    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms, tBands: { value: bands } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vW; uniform float uFar;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
          if (uFar > 0.5) gl_Position.z = gl_Position.w * 0.9999; // behind every range and cloud (the painterly sky)
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tBands; uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uTime; uniform vec3 uLight; uniform float uOpacity; uniform float uHazeAmt; uniform float uGain; uniform float uCrisp;
        varying vec3 vN; varying vec3 vW;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          // bands wrap about the ring axis; the giant turns very slowly
          vec3 T = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0)));
          vec3 B = cross(uAxis, T);
          float lat = dot(N, uAxis);
          float lon = atan(dot(N, B), dot(N, T)) / 6.2831853 + uTime * 0.0025;
          vec3 col = texture2D(tBands, vec2(lon, lat * 0.5 + 0.5)).rgb;
          float mu = clamp(dot(N, V), 0.0, 1.0);                // ≤ 1: pow(1 − mu) below must never see a negative (NaN → bloom black square, E91)
          float day = smoothstep(-0.35, 0.3, dot(N, uSunDir));   // a wide soft terminator: the disc reads bright, with a shaded crescent
          float limb = 0.45 + 0.55 * mu;                       // limb darkening
          vec3 lit = col * (0.24 + 0.95 * day) * limb + col * vec3(0.05, 0.08, 0.14) * (1.0 - day); // a little sky bounce on the night side
          // sky haze: the disc is pale and airy, more so at the limb (it sits in the atmosphere, not in front of it)
          float h = (0.1 + 0.45 * pow(1.0 - mu, 2.4)) * uHazeAmt * (1.0 - 0.7 * uCrisp);   // uCrisp (the stylized sky): a crisp, opaque disc
          vec3 c = mix(lit * uGain, uHaze, h);
          gl_FragColor = vec4(c * uLight, mix(0.92 - 0.25 * pow(1.0 - mu, 3.0), 1.0, uCrisp) * uOpacity);
        }`,
    }));
    body.renderOrder = -12;

    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.38, R * 2.08, 160, 1), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec2 vL; varying vec3 vC; uniform float uFar;
        void main() {
          vL = position.xy;
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vC = modelMatrix[3].xyz;                      // the planet's centre (the ring sits at the group origin)
          gl_Position = projectionMatrix * viewMatrix * w;
          if (uFar > 0.5) gl_Position.z = gl_Position.w * 0.9999;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uRadius; uniform vec3 uLight; uniform float uOpacity; uniform float uHazeAmt; uniform float uGain; uniform float uCrisp;
        varying vec3 vW; varying vec2 vL; varying vec3 vC;
        // does the ray o + d t (t > 0, t < tmax) pass through the body?
        bool hitsBody(vec3 o, vec3 d, float tmax) {
          float t = dot(vC - o, d);
          if (t < 0.0 || t > tmax) return false;
          return length(o + d * t - vC) < uRadius * 0.995;
        }
        void main() {
          float r = length(vL) / uRadius;                 // 1.38 … 2.08
          float t = (r - 1.38) / 0.70;
          // radial profile: a bright dense inner band, a thin gap, a fainter outer sheet with fine ringlets
          float a = 0.62 + 0.38 * sin(t * 31.0) * sin(t * 7.3 + 1.0);
          a *= smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.86, t);
          a *= 1.0 - 0.85 * smoothstep(0.03, 0.0, abs(t - 0.56));            // the Cassini gap
          a *= 1.0 - 0.5 * smoothstep(0.012, 0.0, abs(t - 0.3));
          a *= mix(1.0, 0.55, smoothstep(0.6, 1.0, t));                        // the outer sheet is thinner
          float bright = 0.55 + 0.45 * sin(t * 19.0 + 0.4);
          // hidden behind the body / in the body's shadow
          vec3 toEye = cameraPosition - vW; float dEye = length(toEye);
          if (hitsBody(vW, toEye / dEye, dEye)) discard;
          float shadow = hitsBody(vW, uSunDir, 1e9) ? 0.22 : 1.0;
          // lit face vs the face in shade
          vec3 V = toEye / dEye;
          float sameSide = sign(dot(uAxis, V)) == sign(dot(uAxis, uSunDir)) ? 1.0 : 0.6;
          float lit = (0.5 + 0.5 * abs(dot(uAxis, uSunDir))) * sameSide * shadow;
          vec3 col = vec3(0.98, 0.95, 0.88) * (0.45 + 0.9 * lit) * bright * uGain;
          col = mix(col, uHaze, 0.2 * uHazeAmt * (1.0 - 0.6 * uCrisp));
          gl_FragColor = vec4(col * uLight, a * mix(0.8, 0.95, uCrisp) * uOpacity);
        }`,
    }));
    ring.rotation.set((90 - P.tilt) * d2r, 0, (P.roll ?? 20) * d2r, 'ZXY');
    ring.renderOrder = -11;

    this.planet.add(body, ring);
    this.planet.position.copy(this.planetDir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion).applyQuaternion(this.planet.quaternion).normalize();
    this.giantUniforms.uAxis.value.copy(axis);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }
  /** uHazeAmt / uGain / uFar: Driftwood's giant is 1 / 1 / 0; the painterly sky draws it brighter, clearer and at the far plane (behind the ranges); uCrisp: the stylized (low-poly) sky's crisp, opaque disc */
  private giantUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Color() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uRadius: { value: 1 }, uLight: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 }, uHazeAmt: { value: 1 }, uGain: { value: 1 }, uFar: { value: 0 }, uCrisp: { value: 0 } };
}

/**
 * three r186's CSMShader replaces `lights_fragment_begin` with a copy that predates the
 * `#ifdef STANDARD` block computing `material.dfg` / multi-scattering compensation, so every
 * CSM material loses its IBL specular (metals go black, water loses its sky). Re-insert it.
 */
function patchCSMShaderChunk() {
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (chunk.includes('material.dfg')) return;
  const block = /* glsl */`
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;`;
  THREE.ShaderChunk.lights_fragment_begin = chunk.replace('IncidentLight directLight;', block);
}

/** compass degrees (0 = north = +Z, 90 = east = −X) + elevation → a unit direction (the `ChunkSky.planet` convention) */
function compassDir(azimuth: number, elevation: number): THREE.Vector3 {
  const d2r = Math.PI / 180, az = azimuth * d2r, el = elevation * d2r;
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

/**
 * `ChunkSky.painted`: a small equirectangular half-float sky in the HDR's layout (row 0 = the top, flipY, the same
 * u/v → direction mapping `findSun` reads) — zenith → horizon gradient, a soft warm glow and a hot core round the
 * sun, the ground colour below the skyline. It is the background and the PMREM environment, so it replaces the
 * HDRI entirely (~2 ms to paint, nothing to download).
 */
function paintSky(P: NonNullable<ChunkSky['painted']>, sun: THREE.Vector3): THREE.DataTexture {
  const W = 512, H = 256;
  const data = new Uint16Array(W * H * 4);
  const [zr, zg, zb] = P.zenith, [hr, hg, hb] = P.horizon, [gr, gg, gb] = P.ground, [wr, wg, wb] = P.glow;
  const half = (v: number): number => THREE.DataUtils.toHalfFloat(v);
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H, phi = (v - 0.5) * Math.PI;
    const cp = Math.cos(phi), e = Math.sin(phi);
    for (let x = 0; x < W; x++) {
      const theta = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      const dx = Math.cos(theta) * cp, dz = Math.sin(theta) * cp;
      const g = Math.max(0, dx * sun.x + e * sun.y + dz * sun.z);
      let r: number, gg2: number, b: number;
      if (e >= 0) {
        const t = THREE.MathUtils.smoothstep(e ** 0.55, 0, 1);
        r = hr + (zr - hr) * t; gg2 = hg + (zg - hg) * t; b = hb + (zb - hb) * t;
        // the horizon is warmer on the sun's side, and a soft wide glow + a hot core surround the disc
        const side = (Math.max(0, dx * sun.x + dz * sun.z) / Math.max(1e-3, Math.hypot(sun.x, sun.z))) ** 2 * (1 - t) * 0.35;
        const glow = g ** 6 * 0.45 + g ** 48 * 1.6 + side;
        r += wr * glow; gg2 += wg * glow; b += wb * glow;
      } else {
        const t = THREE.MathUtils.smoothstep(-e, 0, 0.12);
        r = hr * 0.85 + (gr - hr * 0.85) * t; gg2 = hg * 0.85 + (gg - hg * 0.85) * t; b = hb * 0.85 + (gb - hb * 0.85) * t;
      }
      const i = (y * W + x) * 4;
      data[i] = half(r); data[i + 1] = half(gg2); data[i + 2] = half(b); data[i + 3] = half(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.flipY = true; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[sky] no 2d canvas context');
  return g;
}

function makeCloudTexture() {
  // tileable fbm: sample simplex noise on a torus so both axes wrap without seams
  const N = 512;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = ctx2d(c);
  const img = g.createImageData(N, N);
  const n = new Noise2D(1234);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    const px = Math.cos(u) * 1.5, py = Math.sin(u) * 1.5, pz = Math.cos(v) * 1.5, pw = Math.sin(v) * 1.5;
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 6; o++) { const f = 2 ** o; s += (n.get((px + pz * 0.7) * f, (py + pw * 0.7) * f + o * 7.3) * 0.5 + 0.5) * amp; norm += amp; amp *= 0.55; }
    s /= norm;
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = s * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function makePlanetTexture() {
  const rng = new Rng(4242); // seeded: the bake (scripts/bake-textures.mjs) must be reproducible
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = ctx2d(c);
  const bands = ['#d9d3c6', '#c4b8a6', '#e6e0d4', '#b8a996', '#d2c9ba', '#a8998a', '#e3dccf', '#c9bcab'];
  for (let y = 0; y < 512; y++) {
    const t = y / 512;
    const k = t * bands.length + Math.sin(t * 37) * 0.6 + Math.sin(t * 91) * 0.25;
    const b = bands[Math.floor(Math.abs(k)) % bands.length];
    if (b === undefined) continue;
    g.fillStyle = b; g.globalAlpha = 0.9 + 0.1 * Math.sin(y * 0.2);
    g.fillRect(0, y, 1024, 1);
  }
  g.globalAlpha = 0.18;
  for (let i = 0; i < 90; i++) {
    g.fillStyle = i % 3 ? '#ffffff' : '#8a7a68'; g.beginPath();
    g.ellipse(rng.next() * 1024, rng.next() * 512, 30 + rng.next() * 140, 3 + rng.next() * 7, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeRingTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 4;
  const g = ctx2d(c);
  for (let x = 0; x < 1024; x++) {
    const t = x / 1024;
    let a = 0.55 + 0.45 * Math.sin(t * 28) * Math.sin(t * 7.3 + 1) ;
    a *= t < 0.06 ? t / 0.06 : 1;
    a *= t > 0.9 ? (1 - t) / 0.1 : 1;
    if (Math.abs(t - 0.58) < 0.035) a *= 0.12;            // Cassini-style gap
    if (Math.abs(t - 0.3) < 0.012) a *= 0.4;
    const l = 205 + 30 * Math.sin(t * 19);
    g.fillStyle = `rgba(${l},${l - 8},${l - 22},${Math.max(0, Math.min(1, a))})`; g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * The gas giant's bands (`ChunkSky.planet`): cream / tan / rust latitude bands with turbulent edges and
 * a few storm ovals, wrapping seamlessly in longitude (noise sampled on a circle). Seeded so the bake is
 * reproducible (scripts/bake-textures.mjs, name `giant`).
 */
function makeGiantTexture() {
  const W = 512, H = 256;
  const rng = new Rng(7171), n = new Noise2D(7171);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const img = g.createImageData(W, H);
  // colour stops down the latitude (0 = south pole … 1 = north pole)
  const stops: [number, [number, number, number]][] = [
    [0.0, [200, 180, 150]], [0.08, [230, 214, 184]], [0.16, [196, 156, 108]], [0.24, [240, 228, 202]], [0.3, [172, 104, 64]],
    [0.36, [234, 218, 188]], [0.43, [208, 168, 118]], [0.5, [246, 236, 214]], [0.56, [190, 136, 90]], [0.62, [228, 208, 176]],
    [0.7, [156, 92, 58]], [0.76, [236, 222, 196]], [0.84, [200, 164, 118]], [0.92, [224, 204, 174]], [1.0, [188, 168, 142]],
  ];
  const ramp = (vIn: number, out: [number, number, number]) => {
    const v = Math.min(1, Math.max(0, vIn));
    let i = 0; for (; i < stops.length - 2; i++) { const next = stops[i + 1]; if (!next || !(next[0] < v)) break; }
    const s0 = stops[i], s1 = stops[i + 1];
    if (!s0 || !s1) return;
    const [v0, c0] = s0, [v1, c1] = s1;
    const u = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    const e = u * u * (3 - 2 * u) * 0.6 + u * 0.4; // soft-ish band edges
    out[0] = c0[0] + (c1[0] - c0[0]) * e; out[1] = c0[1] + (c1[1] - c0[1]) * e; out[2] = c0[2] + (c1[2] - c0[2]) * e;
  };
  const col: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * Math.PI * 2, v = y / H;
    const cu = Math.cos(u), su = Math.sin(u);
    // turbulence: seamless in u (circle), stretched along the bands
    const t1 = n.fbm(cu * 1.4 + v * 9.0, su * 1.4 + 3.0, 3);
    const t2 = n.get(cu * 4.0 + v * 22.0, su * 4.0 + 11.0);
    ramp(v + t1 * 0.035 + t2 * 0.008, col);
    const shade = 0.96 + 0.04 * n.get(cu * 3 + v * 30, su * 3 + 5);
    const i = (y * W + x) * 4; img.data[i] = col[0] * shade; img.data[i + 1] = col[1] * shade; img.data[i + 2] = col[2] * shade; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // storm ovals: a couple of rust spots and pale eddies riding the bands
  for (let i = 0; i < 14; i++) {
    const big = i < 2;
    g.globalAlpha = big ? 0.55 : 0.3;
    g.fillStyle = big ? '#b0603e' : i % 3 ? '#f4eee0' : '#a97a52';
    g.beginPath();
    g.ellipse(rng.next() * W, H * (0.2 + rng.next() * 0.6), big ? 22 + rng.next() * 14 : 8 + rng.next() * 16, big ? 9 + rng.next() * 4 : 2.5 + rng.next() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
