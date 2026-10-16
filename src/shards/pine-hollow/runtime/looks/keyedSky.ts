import { loadBakedSky, skyHorizonColor } from '@wildshard/engine/boot/bakedApi';
import type { SkyBackdropContext, SkyBackdropFactory, SkyBackdropPost, SkyBackdropTargets } from '@wildshard/engine/render/look';
import type { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { DayClock } from '@wildshard/sdk/looks/dayClock';
import { driveDayAir, driveDayLight, runDayClock } from '@wildshard/sdk/looks/daySky';
import { graphDaySkyBackdrop, type DaySkyBody, type DaySkyGraphs } from '@wildshard/sdk/looks/graphDaySky';
import { overcastOver } from '@wildshard/sdk/looks/overcast';
import * as THREE from 'three';
import type { KeyedSkyStyle, SKY_PRESET, SkyKeyRow, SkyPreset } from '../../data/keyedSkyRows';

/** A keyed sky's clock: the shared day clock over its row. */
export type KeyedSkyDay = DayClock<typeof SKY_PRESET, KeyedSkyStyle>;

/**
 * A day / night sky drawn from photographic keys (SHARD-PLATFORM M3, look-family rows): the backdrop half of a keyed sky,
 * its clock and every number data (`KeyedSkyStyle`, on the shared day clock `@wildshard/sdk/looks/dayClock`).
 *
 * THE SKY is a dome drawn from two baked equirect keys at a time (gain-mapped pairs, each key's own sun painted out by the
 * bake), blended by the clock, each turned about the vertical so its sun glow sits on the clock's sun azimuth (the moon key's
 * on the moon), and scaled by a per-preset gain. The dome adds an analytic aureole around the clock's own sun / moon. Both
 * are the shard's look.materials graphs (data/skyLook.ts; the keys lent as they decode, the rest params set each frame): the
 * dome's, and the environment pass's, which renders the blend into a 1024×512 equirect every 2 s and PMREM turns it into the scene's environment (IBL) in
 * place, so every lit material sees the sky of the hour. The SDK's graph day sky (`@wildshard/sdk/looks/graphDaySky`) owns
 * the graphs, the environment, the clock's jumps and the backdrop's lifecycle; this is the sky and its frame. The keys' GPU textures are decoded on demand (at most 3 resident:
 * the two being blended and the next one, decoded ahead); their CPU copies are dropped after upload.
 *
 * THE LIGHT: the scene's CSM lights, hemisphere and fog — never added or removed — driven by the keyed presets: the sun's
 * colour and intensity, the hemisphere fill, the fog's colour (each key's horizon, measured at decode) and density, the
 * fog's sun in-scatter, the volumetric shafts, the god rays, the cloud layer and the far ridges' haze. The light body is the
 * sun by day and the moon by night, faded out at the swap; the shadow direction moves in 0.25° steps (a shadow map that
 * turns a hair every frame crawls). Nothing here changes a program: uniforms, light intensities / colours and texture
 * uniforms only.
 *
 * THE WEATHER lays multipliers over the blended preset (`KeyedSky.mod`, written by the shard's weather every frame), and the
 * look loop a layer over every preset (`KeyedSky.look`); the presets' own numbers are never edited.
 */

/** A key's file URLs (the row's `keyFiles`, `{id}` replaced by the key's id): the colour JPEG and its gain map. */
function skyKeyFiles(style: KeyedSkyStyle, key: SkyKeyRow): { color: string; gain: string } {
  return { color: style.keyFiles.color.replaceAll('{id}', key.id), gain: style.keyFiles.gain.replaceAll('{id}', key.id) };
}

const SHADOW_STEP = 0.25 * Math.PI / 180;
const tmpC = new THREE.Color();

/** one decoded key: its GPU texture (CPU copy dropped after upload) and its horizon colour */
interface Resident { tex: THREE.DataTexture; horizon: THREE.Color; used: number; /** GPU bytes (RGBA16F 8 a texel, RGB9_E5 4) */ bytes: number }

/**
 * The weather's hook on the clock: multipliers laid over the keyed presets after they are blended — the presets' own
 * numbers are never edited. Identity ({ overcast 0, fog × 1 }) is the clock exactly as it was.
 */
export interface SkyWeather {
  /** 0 … 1 the cloud deck: the sun and moon hidden (light, shafts, rays, disc, aureole), the sky and its IBL dimmed and
   *  greyed, the far haze and the fog greyed and thickened, the cloud layer full, colour drained, lamps lit early */
  overcast: number;
  /** × the fog's distance / height densities */
  fogDist: number;
  fogHeight: number;
  /** 0 … 1 a ground fog: the fog's colour paled toward a cool white (a mist, not a haze) */
  mist: number;
}

/** How a keyed sky is built on one page. */
export interface KeyedSkyOptions {
  /** the phone's stepped IBL refresh: one PMREM level a frame */
  readonly envSteps: boolean;
  /** decoded keys as RGB9_E5 (half the GPU bytes) */
  readonly packKeys: boolean;
  /** a 512×256 environment equirect (a 128 cube) instead of 1024×512 */
  readonly smallEnv: boolean;
}

/** The sky's two graphs' texture lender (the dome's and the environment pass's); their params are the `pine.sky` channels. */
interface KeyedSkyGraphs { readonly lend: (name: string, texture: THREE.Texture) => void }

export class KeyedSky {
  readonly clock: DayCycle<SkyPreset>;
  get phase(): number { return this.clock.phase; }
  night = 0;
  dusk = 0;
  dawn = 0;
  lamps = 0;
  /** the weather's multipliers (see SkyWeather); identity = no weather */
  readonly mod: SkyWeather = { overcast: 0, fogDist: 1, fogHeight: 1, mist: 0 };
  /** the look loop's layer over every preset (a shard without one leaves the identity): × the volumetric in-scatter, × the
   *  distance fog, + the grade saturation, × the sky's fill (IBL + hemisphere), × the dome by day — the presets' numbers
   *  untouched */
  readonly look = { vol: 1, fogDist: 1, sat: 0, ambient: 1, sky: 1 };
  /** the dome (the host adds it and keeps it on the camera) */
  readonly dome: THREE.Mesh;
  /** the environment pass: the same sky, one texel per direction of an equirect */
  readonly envScene = new THREE.Scene();
  readonly envCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly envEquirect: THREE.WebGLRenderTarget;
  private readonly style: KeyedSkyStyle;
  /** the two keys the graphs blend */
  private readonly u = { tA: { value: null as THREE.Texture | null }, tB: { value: null as THREE.Texture | null } };
  /** the keys' blend, turns (radians) and gains and the deck: the `pine.sky` channels' numeric owner (generators/skyChannels.ts
   *  turns them, the glow, the grey and the flat colour into both graphs' params) */
  readonly keys = { mix: 0, turnA: 0, turnB: 0, gainA: 1, gainB: 1, overcast: 0 };
  /** the blended preset (the channels read its glow) and the fog colour (their flat colour) */
  cur: SkyPreset;
  readonly fog: { readonly color: THREE.Color };
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private fogCol = new THREE.Color();
  /** the air's frame (`driveDayAir`), refilled every frame */
  private readonly air = { fog: this.fogCol, body: this.sun, cloudBody: this.sun, fade: 0, above: 0, discScale: 1, haloK: 1 };
  private resident = new Map<string, Resident>();
  private loading = new Map<string, Promise<Resident | null>>();
  private blobs = new Map<string, Promise<{ color: Blob; gain: Blob }>>();
  private frame = 0;
  private disposed = false;
  private readonly day: KeyedSkyDay;
  private readonly renderer: SkyBackdropContext['renderer'];
  private readonly scene: THREE.Scene;
  private readonly opts: KeyedSkyOptions;
  private readonly graphs: KeyedSkyGraphs;

  constructor(day: KeyedSkyDay, renderer: SkyBackdropContext['renderer'], scene: THREE.Scene, opts: KeyedSkyOptions, dome: THREE.Mesh, env: THREE.Material, graphs: KeyedSkyGraphs) {
    const style = day.style;
    this.day = day; this.renderer = renderer; this.scene = scene; this.opts = opts; this.graphs = graphs;
    this.style = style;
    const curves = day.spec.curves;
    this.clock = runDayClock(day, style.cycleMinutes * 60, { ...curves, lamps: (p) => Math.max(curves.lamps(p), .35 * this.mod.overcast) });
    const first = day.presets[style.frames[0]?.[1] ?? ''];
    if (first === undefined) throw new Error('keyed sky: no keyframes');
    this.cur = day.clone(first);
    this.fog = { color: this.fogCol };
    // the environment graph drawn as the GLSL program was: no depth, untouched by the material's tone map (the post chain grades it)
    env.depthTest = false; env.toneMapped = false;
    this.dome = dome;
    // the environment pass: the same sky, one texel per direction of a 1024×512 equirect (PMREM's cube is a quarter of its
    // width: 256); `smallEnv`: 512×256 → a 128 cube, PMREM's three cube-UV targets 768×1024 → 384×512 RGBA16F (~−16.5 MB)
    const envW = opts.smallEnv ? 512 : 1024;
    this.envEquirect = new THREE.WebGLRenderTarget(envW, envW / 2, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.envEquirect.texture.mapping = THREE.EquirectangularReflectionMapping;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, env);
    quad.frustumCulled = false;
    this.envScene.add(quad);
  }

  /** a key is lent to the graphs (the environment waits for one) */
  get ready(): boolean { return this.u.tA.value !== null; }

  /** decode the keys around the clock's phase (a jump, the boot) */
  async prepare(): Promise<void> {
    const [a, b] = this.segment(this.phase);
    await Promise.all([this.ensure(a[1].key), this.ensure(b[1].key)]);
  }

  /** the clock's frame (the host's `drive`): every knob at the phase; `snap` at a jump */
  drive(T: SkyBackdropTargets | null, post: SkyBackdropPost | null, snap: boolean): void {
    if (!snap) this.frame++;
    this.apply(T, post, snap);
  }

  /** after an in-place WebGL restore (GpuRecovery): the keys' CPU copies are gone (the host decodes them again) */
  dropKeys(): void {
    for (const r of this.resident.values()) r.tex.dispose();
    this.resident.clear();
  }

  /** Free the keys (the host frees the dome, the environment pass and the environment); decodes in flight drop theirs. */
  dispose(): void {
    this.disposed = true;
    this.dropKeys(); this.blobs.clear();
    this.u.tA.value = null; this.u.tB.value = null;
  }

  /** The GPU bytes the resident keys hold now / at most (three at the decoded size). */
  keyBytes(): number { let bytes = 0; for (const r of this.resident.values()) bytes += r.bytes; return bytes; }
  keyCeiling(): number { return 3 * Math.max(0, ...[...this.resident.values()].map((r) => r.bytes)); }

  /** the keyframes around phase p: [a, b] and the blend t */
  private segment(p: number): [readonly [number, SkyPreset], readonly [number, SkyPreset], number] {
    return this.clock.segment(p);
  }

  private keyRow(k: string): KeyedSkyStyle['keys'][string] {
    const row = this.style.keys[k];
    if (row === undefined) throw new Error(`keyed sky: no key ${k}`);
    return row;
  }

  private blobsOf(k: string): Promise<{ color: Blob; gain: Blob }> {
    let b = this.blobs.get(k);
    if (b === undefined) {
      const files = skyKeyFiles(this.style, this.keyRow(k));
      const get = async (url: string): Promise<Blob> => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.blob(); };
      b = Promise.all([get(files.color), get(files.gain)]).then(([color, gain]) => ({ color, gain }));
      b.catch(() => { this.blobs.delete(k); });
      this.blobs.set(k, b);
    }
    return b;
  }

  /** decode key k to a GPU texture (once; at most 3 resident, least recently used dropped) */
  private ensure(k: string): Promise<Resident | null> {
    const have = this.resident.get(k);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(k);
    if (p === undefined) {
      p = this.blobsOf(k).then(async ({ color, gain }) => {
        const urls = { color: URL.createObjectURL(color), gain: URL.createObjectURL(gain) };
        try {
          const tex = await loadBakedSky(urls);
          tex.name = `${skyKeyFiles(this.style, this.keyRow(k)).color.replace(/^\/assets\//u, '')} + gain.png`;
          tex.wrapS = THREE.RepeatWrapping; // the equirect seam blends across u = 0 / 1
          const horizon = skyHorizonColor(tex);
          if (this.opts.packKeys) packSkyKeyRgb9e5(tex); // half the key's GPU bytes
          this.renderer.initTexture(tex); // upload now, not on the frame that first draws it
          tex.image.data = null;          // the GPU has it: drop the CPU copy (rebuild() decodes again after a context loss)
          if (this.disposed) { tex.dispose(); return null; }
          const r: Resident = { tex, horizon, used: this.frame, bytes: tex.image.width * tex.image.height * (this.opts.packKeys ? 4 : 8) };
          this.resident.set(k, r);
          this.evict();
          return r;
        } finally { URL.revokeObjectURL(urls.color); URL.revokeObjectURL(urls.gain); this.loading.delete(k); }
      }).catch((e: unknown) => { console.warn(`[keyed sky] key ${k} did not load`, e); this.loading.delete(k); return null; });
      this.loading.set(k, p);
    }
    return p;
  }

  private evict(): void {
    while (this.resident.size > 3) {
      let oldest: string | null = null, t = Infinity;
      for (const [k, r] of this.resident) if (r.used < t && r.tex !== this.u.tA.value && r.tex !== this.u.tB.value) { t = r.used; oldest = k; }
      if (oldest === null) return;
      this.resident.get(oldest)?.tex.dispose();
      this.resident.delete(oldest);
    }
  }

  /** the turn (radians) that puts key k's sun glow on the direction `body` */
  private rot(k: string, body: THREE.Vector3): number {
    return (this.keyRow(k).sunU - 0.5) * 2 * Math.PI - Math.atan2(body.z, body.x);
  }

  /** `snap`: move the shadow light to the exact phase now (boot, a Time of day pick), not in SHADOW_STEP steps */
  private apply(T: SkyBackdropTargets | null, post: SkyBackdropPost | null, snap: boolean): void {
    const p = this.phase, DAY = this.style.dayFraction, day0 = this.day;
    const [a, b, t] = this.segment(p);
    this.clock.key(this.cur);
    const C = this.cur;
    const ov = weatherOver(C, this.mod, this.style);
    C.vol *= this.look.vol; C.fogDist *= this.look.fogDist; C.sat += this.look.sat;
    const fill = 1 + (this.look.ambient - 1) * (1 - day0.nightAt(p)); // by day: the night's moonlight is its own
    C.env *= fill; C.hemiI *= fill;
    day0.sunAt(p, this.sun);
    day0.moonAt(p, this.moon);
    const day = p < DAY;
    // ── the sky keys: two textures, each turned so its glow sits on the body it was shot around ──
    const ra = this.resident.get(a[1].key), rb = this.resident.get(b[1].key);
    const glowBody = (k: string): THREE.Vector3 => (k === this.style.moonKey ? this.moon : this.sun);
    if (ra) ra.used = this.frame;
    if (rb) rb.used = this.frame;
    const A = ra ?? rb, B = rb ?? ra;
    const k = this.keys;
    k.overcast = ov;
    if (A && B) {
      this.u.tA.value = A.tex; this.u.tB.value = B.tex;
      this.graphs.lend('keyA', A.tex); this.graphs.lend('keyB', B.tex);
      k.mix = ra && rb ? t : 0;
      k.turnA = this.rot(ra ? a[1].key : b[1].key, glowBody(ra ? a[1].key : b[1].key));
      k.turnB = this.rot(rb ? b[1].key : a[1].key, glowBody(rb ? b[1].key : a[1].key));
      const dim = 1 - 0.5 * ov; // the deck: the sky's brightness under it
      k.gainA = (ra ? a[1].bg : b[1].bg) * dim; k.gainB = (rb ? b[1].bg : a[1].bg) * dim;
      this.fogCol.copy(A.horizon).multiplyScalar(k.gainA).lerp(tmpC.copy(B.horizon).multiplyScalar(k.gainB), k.mix);
      const m = Math.max(this.fogCol.r, this.fogCol.g, this.fogCol.b, 1e-3);
      if (m > 1.1) this.fogCol.multiplyScalar(1.1 / m);
      if (ov > 0) { const g = (this.fogCol.r * 0.2126 + this.fogCol.g * 0.7152 + this.fogCol.b * 0.0722) * 0.92; this.fogCol.lerp(tmpC.setRGB(g * 0.95, g * 0.98, g * 1.03), ov * 0.85); }
      const mist = Math.min(1, Math.max(0, this.mod.mist));
      if (mist > 0) { const g = (this.fogCol.r * 0.2126 + this.fogCol.g * 0.7152 + this.fogCol.b * 0.0722) * 1.08; this.fogCol.lerp(tmpC.setRGB(g * 0.96, g, g * 1.05), mist * 0.6); }
      // the look loop's sky (by day): the dome — and so the IBL rendered from it — × look.sky; the fog colour above stays
      const skyK = 1 + (this.look.sky - 1) * (1 - day0.nightAt(p));
      k.gainA *= skyK; k.gainB *= skyK;
    }
    if (!ra || !rb) void Promise.all([this.ensure(a[1].key), this.ensure(b[1].key)]);
    // decode the key after this segment ahead of time (its upload lands mid-segment, not on the transition)
    const [, next] = this.segment((b[0] + 0.0005) % 1);
    if (!this.resident.has(next[1].key) && !this.loading.has(next[1].key)) void this.ensure(next[1].key);

    // ── the light body: the sun by day, the moon by night, faded out at the swap ──
    const lightDir = day ? this.sun : this.moon;
    this.night = day0.nightAt(p);
    this.dusk = Math.max(this.night, 1 - THREE.MathUtils.smoothstep(this.sun.y, this.style.dusk[0], this.style.dusk[1]));
    this.dawn = day0.dawnAt(p);
    this.lamps = Math.max(C.lamps, this.night);
    if (!T) return;
    const fade = driveDayLight(T, day0, p, this.sun, this.moon, C, 1, SHADOW_STEP, snap);
    // the shadow's depth: full by day, the style's `nightShadow` by night (a uniform: no program changes; ≤ 4 cascades)
    const shade = 1 + (this.style.nightShadow - 1) * this.night;
    for (let i = 0; i < Math.min(T.lights.length, 4); i++) { const l = T.lights[i]; if (l !== undefined) l.shadow.intensity = shade; }
    T.sunColor.copy(C.light).multiplyScalar(Math.max(0.05, fade * C.lightI / 3.8));
    // the disc (the god-ray source) and its corona: the moon is smaller and comes and goes by size, not colour (a darkened
    // disc reads as a black dot on the dusk sky); neither shows through the ground
    const air = this.air;
    air.body = lightDir; air.cloudBody = day || this.night < 0.5 ? this.sun : this.moon; air.fade = fade; air.haloK = day ? 1 : fade;
    air.above = THREE.MathUtils.smoothstep(lightDir.y, -0.03, 0.02);
    air.discScale = (day ? 1 : 0.6 * Math.max(1e-3, fade)) * Math.max(1e-3, 1 - ov);
    driveDayAir(T, post, this.scene, C, air);
  }
}

/** lay the weather over the blended preset (in place: the fog's multipliers, then the style's overcast rows); returns the
 *  overcast it applied */
function weatherOver(C: SkyPreset, mod: SkyWeather, style: KeyedSkyStyle): number {
  C.fogDist *= mod.fogDist; C.fogHeight *= mod.fogHeight;
  return overcastOver(C, style.overcast, mod.overcast);
}

/**
 * A decoded sky key as RGB9_E5 instead of RGBA16F (SF47-g): the key's alpha is the constant 1 the decode writes and the sky
 * shader reads only .rgb, so the GPU keeps 4 bytes a texel, not 8. RGB9_E5 keeps 9 mantissa bits per channel under one
 * shared exponent, sampled and filtered like the half-float key; the driver packs it from the half-float RGB rows at upload
 * (WebGL2: RGB9_E5 ← RGB / HALF_FLOAT). Call it after anything reads the RGBA data (the horizon).
 */
export function packSkyKeyRgb9e5(tex: THREE.DataTexture): void {
  const { width, height, data } = tex.image;
  if (!(data instanceof Uint16Array) || tex.format !== THREE.RGBAFormat || tex.type !== THREE.HalfFloatType) throw new Error('keyed sky key: expected RGBA half-float data');
  const texels = width * height, rgb = new Uint16Array(texels * 3);
  for (let i = 0; i < texels; i++) {
    rgb[i * 3] = data[i * 4] ?? 0; rgb[i * 3 + 1] = data[i * 4 + 1] ?? 0; rgb[i * 3 + 2] = data[i * 4 + 2] ?? 0;
  }
  tex.image.data = rgb;
  tex.format = THREE.RGBFormat;
  tex.internalFormat = 'RGB9_E5';
  tex.needsUpdate = true;
}

const skies = new WeakMap<SkyRig, KeyedSky>();
/** The keyed sky a backdrop built on this sky rig (the shard's weather and transitions read it). */
export function keyedSkyOf(sky: SkyRig): KeyedSky | null { return skies.get(sky) ?? null; }

/**
 * A shard's sky backdrop from its keyed-sky row, on the SDK's graph day sky: the clock at the URL's / Settings' time, its
 * first two keys decoded, the look loop's layer applied. `memoryTrim` read once at build: packed keys, and on the phone a
 * half-size environment.
 */
export function keyedSkyBackdrop(day: KeyedSkyDay, memoryTrim: () => boolean, looks: { readonly source: Parameters<typeof graphDaySkyBackdrop>[0]['source']; readonly dome: string; readonly env: string }): SkyBackdropFactory {
  const dome = day.style.dome;
  // the dome first of the opaque pass, depth untouched: everything draws over it
  return graphDaySkyBackdrop({ name: 'keyed sky', source: looks.source, ids: [looks.dome, looks.env], dome: { graph: looks.dome, radius: dome.radius, segments: dome.segments, order: -1000, name: dome.name }, channels: 'pine.sky', build: async (context, g: DaySkyGraphs, mesh): Promise<DaySkyBody<SkyPreset>> => {
    const { sky, scene, renderer, level, tier, look } = context;
    const opts: KeyedSkyOptions = { envSteps: level.tiers?.[tier]?.envSteps === true, packKeys: memoryTrim(), smallEnv: tier === 'phone' && memoryTrim() };
    const keyed = new KeyedSky(day, renderer, scene, opts, mesh, g.material(looks.env), {
      lend: (name, texture) => { g.setTexture(looks.dome, name, texture); g.setTexture(looks.env, name, texture); } });
    await keyed.prepare();
    skies.set(sky, keyed);
    if (look) Object.assign(keyed.look, { vol: look.vol, fogDist: look.fogDist, sat: look.sat, ambient: look.ambient, sky: look.sky });
    day.sunAt(keyed.phase, sky.sunDir);
    return {
      clock: keyed.clock, follow: true, horizon: new THREE.Color(...level.sky.fogSunColor),
      owners: new Map<string, unknown>([['keys', keyed.keys], ['preset', keyed.cur], ['fog', keyed.fog]]),
      // the 2-second IBL refresh, with `envSteps` one PMREM level a frame (E142, the 30-fps-at-2× lane); a jump refreshes whole
      environment: { source: { kind: 'equirect', scene: keyed.envScene, camera: keyed.envCam, target: keyed.envEquirect }, refresh: { every: 2, stepped: opts.envSteps, ready: () => keyed.ready } },
      drive: (T, post, snap) => { keyed.drive(T, post, snap); },
      prepare: () => keyed.prepare(),
      rebuild: () => { keyed.dropKeys(); },
      // a disposed sky leaves the rig it was registered on (only if it is still the one there)
      dispose: () => { if (skies.get(sky) === keyed) skies.delete(sky); keyed.dispose(); },
      bytes: () => keyed.keyBytes(),
      ceiling: () => keyed.keyCeiling(),
    };
  } });
}
