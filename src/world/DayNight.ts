/**
 * Day / night — an engine-generic clock and the sky rig it drives (Nalati B10; Driftwood D38 wants the same clock).
 *
 * A shard that wants time to pass builds one; a shard that does not (Pine Hollow, Driftwood today) never constructs it,
 * so its fixed sun, fog and grade stay exactly as its ChunkDef paints them.
 *
 *   const clock = new DayClock({ start: DayClock.hourOfSun(def.sky.sun) });   // start where the def's sun stands
 *   clock.update(dt)                    // every frame
 *   clock.hour / clock.phase            // 0..24 · 'dawn' | 'day' | 'golden' | 'dusk' | 'night'
 *   clock.sunElevation / sunAzimuth     // degrees (compass azimuth: 0 = north = +Z, 90 = east = −X)
 *   clock.onDusk(fn) · onNight(fn) · onDawn(fn) · onDay(fn) · onGolden(fn)   // fire on entering the phase (fn(phase, prev))
 *   clock.onPhase(fn)                   // every phase change
 *   clock.set('dusk') / clock.set(21.5) // jump (dev `?time=dusk`); fires the phase event
 *   clock.scale = 2 · clock.paused = true
 *
 *   const rig = new SkyRig(game, sky);   // takes over the background (a painted dome), captures the def's look as "day"
 *   rig.look(clock, out)                 // the time-of-day look → out (a SkyLook); weather may modify it
 *   rig.apply(look, dt)                  // write it into the sun / moon (CSM), hemisphere, env, fog, clouds, planet, grade,
 *                                        //   volumetrics, the painterly uniforms and the sky dome
 *
 * The day passes on a play-time schedule, not a real 24 h one: each phase has its own length in minutes of play
 * (`DEFAULT_SCHEDULE`: a full day ≈ 26 min — a long day, a quick golden hour and dusk, a 7-minute night). Within a
 * phase the hour runs linearly, and the sun follows a simple arc: rises in the east at 06:00, stands `maxElevation`
 * high in the south at noon, sets in the west at 18:00. At night the key light is the MOON (the sun disc becomes the
 * moon, the CSM light turns pale blue and dim), so the painterly cel bands and shadows keep working in the dark.
 *
 * The look is key-framed on the sun's elevation (`KEYS`); the "day" key is whatever the shard's def paints (read off
 * the live rig when `SkyRig` is built), so at the def's own sun position nothing changes.
 */
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from './Sky';
import { getActiveChunk } from '../chunks/registry';
import { painterlyUniforms, syncPainterlySun } from './painterly';
import { fogUniforms } from './Atmosphere';
import type { RGB } from '../chunks/ChunkDef';

export type DayPhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
export type PhaseListener = (phase: DayPhase, prev: DayPhase) => void;

/** one stretch of the day: the phase, the hours it spans (end may pass 24), and how many minutes of play it lasts */
export interface ScheduleSeg { phase: DayPhase; from: number; to: number; minutes: number }

/** ≈ 26 min of play per day: day 10 · golden 3 · dusk 3.5 · night 7 · dawn 2.5 */
export const DEFAULT_SCHEDULE: ScheduleSeg[] = [
  { phase: 'dawn', from: 4.5, to: 7, minutes: 2.5 },
  { phase: 'day', from: 7, to: 16.5, minutes: 10 },
  { phase: 'golden', from: 16.5, to: 18, minutes: 3 },
  { phase: 'dusk', from: 18, to: 19.75, minutes: 3.5 },
  { phase: 'night', from: 19.75, to: 28.5, minutes: 7 },
];

const D2R = Math.PI / 180;
/** compass degrees (0 = north = +Z, 90 = east = −X) + elevation → unit direction (Sky.ts's convention) */
export function compassDir(azimuth: number, elevation: number, out = new THREE.Vector3()): THREE.Vector3 {
  const az = azimuth * D2R, el = elevation * D2R;
  return out.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

export interface DayClockOpts {
  /** starting hour (0..24) */
  start?: number;
  schedule?: ScheduleSeg[];
  /** the sun's elevation at noon, degrees */
  maxElevation?: number;
  /** added to the sun's azimuth (a shard can swing its sun path) */
  azimuthOffset?: number;
}

export class DayClock {
  /** hour of the day, 0..24 */
  hour: number;
  phase: DayPhase;
  /** play-time multiplier (1 = the schedule's minutes) */
  scale = 1;
  paused = false;
  readonly maxElevation: number;
  readonly azimuthOffset: number;
  private readonly schedule: ScheduleSeg[];
  private listeners: { phase: DayPhase | null; fn: PhaseListener }[] = [];

  constructor(opts: DayClockOpts = {}) {
    this.schedule = opts.schedule ?? DEFAULT_SCHEDULE;
    this.maxElevation = opts.maxElevation ?? 58;
    this.azimuthOffset = opts.azimuthOffset ?? 0;
    this.hour = wrap24(opts.start ?? 16);
    this.phase = this.segAt(this.hour).phase;
  }

  /**
   * The clock for a shard whose def places the sun by hand (`ChunkSky.sun`): the afternoon hour at which the arc puts
   * the sun at that elevation, and the azimuth offset that swings the arc through the def's azimuth — so the clock
   * starts on exactly the def's look.
   */
  static forSun(sun: { azimuth: number; elevation: number }, opts: Omit<DayClockOpts, 'start' | 'azimuthOffset'> = {}): DayClock {
    const maxEl = opts.maxElevation ?? 58;
    const x = Math.PI - Math.asin(Math.min(1, Math.max(-1, sun.elevation / maxEl))); // the descending (afternoon) side
    const hour = 6 + (x * 12) / Math.PI;
    const az = 90 + (hour - 6) * 15;
    return new DayClock({ ...opts, start: hour, azimuthOffset: sun.azimuth - az });
  }

  /** degrees above the horizon (negative at night) */
  get sunElevation(): number { return this.maxElevation * Math.sin((Math.PI * (this.hour - 6)) / 12); }
  /** compass degrees */
  get sunAzimuth(): number { return 90 + (this.hour - 6) * 15 + this.azimuthOffset; }
  /** the moon: roughly opposite the sun, never below 18° while the sun is down */
  get moonElevation(): number { return 18 + 0.35 * Math.max(0, -this.sunElevation); }
  get moonAzimuth(): number { return this.sunAzimuth + 180; }

  /** minutes of play one full day takes at scale 1 */
  get dayMinutes(): number { return this.schedule.reduce((a, s) => a + s.minutes, 0); }

  onPhase(fn: PhaseListener): () => void { return this.on(null, fn); }
  onDawn(fn: PhaseListener): () => void { return this.on('dawn', fn); }
  onDay(fn: PhaseListener): () => void { return this.on('day', fn); }
  onGolden(fn: PhaseListener): () => void { return this.on('golden', fn); }
  onDusk(fn: PhaseListener): () => void { return this.on('dusk', fn); }
  onNight(fn: PhaseListener): () => void { return this.on('night', fn); }

  /** jump to an hour or to the middle-ish of a phase ('dusk' = just after sunset, 'night' = 22:30, 'noon' = 12:00) */
  set(to: number | DayPhase | 'noon' | 'midnight'): void {
    const named: Record<string, number> = { dawn: 5.6, day: 10, noon: 12, golden: 17.1, dusk: 18.6, night: 22.5, midnight: 0 };
    this.hour = wrap24(typeof to === 'number' ? to : named[to] ?? this.hour);
    this.checkPhase();
  }

  update(dt: number): void {
    if (this.paused || dt <= 0) return;
    const seg = this.segAt(this.hour);
    const hoursPerSecond = (seg.to - seg.from) / Math.max(1e-3, seg.minutes * 60);
    this.hour = wrap24(this.hour + dt * this.scale * hoursPerSecond);
    this.checkPhase();
  }

  /** 0..1 progress through the current phase */
  get phaseProgress(): number {
    const s = this.segAt(this.hour);
    let h = this.hour; if (h < s.from) h += 24;
    return (h - s.from) / (s.to - s.from);
  }

  private on(phase: DayPhase | null, fn: PhaseListener): () => void {
    const l = { phase, fn };
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  }

  private checkPhase(): void {
    const p = this.segAt(this.hour).phase;
    if (p === this.phase) return;
    const prev = this.phase;
    this.phase = p;
    for (const l of this.listeners.slice()) if (l.phase === null || l.phase === p) l.fn(p, prev);
  }

  private segAt(hour: number): ScheduleSeg {
    for (const s of this.schedule) {
      if (hour >= s.from && hour < s.to) return s;
      if (hour + 24 >= s.from && hour + 24 < s.to) return s;
    }
    const first = this.schedule[0];
    if (!first) throw new Error('DayClock: empty schedule');
    return first;
  }
}

function wrap24(h: number): number { return ((h % 24) + 24) % 24; }

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
interface Key {
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

const rgbOf = (c: THREE.Color): RGB => [c.r, c.g, c.b];

/**
 * The key frames below the def's "day": golden hour, sunset, the afterglow, the blue hour, night. Painterly, not
 * physical — night is a readable moonlit blue (the Qara Batyr mockup), dusk a warm orange-violet (the Kokbori one).
 */
function nightKeys(day: Key): Key[] {
  const golden: Key = {
    ...day, el: 10,
    sun: [1.0, 0.72, 0.44], sunI: day.sunI * 0.85,
    zenith: [0.12, 0.26, 0.72], horizon: [0.95, 0.74, 0.55], glow: [1.0, 0.62, 0.3],
    hemiSky: [0.55, 0.62, 0.85], hemiGround: [0.32, 0.3, 0.16], hemiI: day.hemiI * 0.9, env: day.env * 0.85,
    fog: [0.86, 0.72, 0.6], fogSun: [1.0, 0.7, 0.42],
    shade: [0.12, 0.13, 0.34], rim: [1.7, 1.15, 0.7],
    cloudSun: [1.0, 0.72, 0.48], cloud: [1.0, 0.93, 0.88], planet: [1.0, 0.92, 0.84],
    shadowTint: [0.9, 0.94, 1.12], highTint: [1.1, 1.0, 0.88], sat: day.sat + 0.04,
    vol: [1.0, 0.72, 0.45], volS: day.volS * 1.2,
  };
  const sunset: Key = {
    ...golden, el: 1.5,
    sun: [1.0, 0.46, 0.22], sunI: day.sunI * 0.45,
    zenith: [0.1, 0.16, 0.45], horizon: [1.0, 0.5, 0.28], ground: [0.2, 0.18, 0.2], glow: [1.0, 0.42, 0.16],
    hemiSky: [0.42, 0.42, 0.66], hemiGround: [0.22, 0.17, 0.12], hemiI: day.hemiI * 0.75, env: day.env * 0.6,
    fog: [0.75, 0.46, 0.38], fogSun: [1.0, 0.45, 0.2],
    shade: [0.12, 0.1, 0.3], rim: [1.8, 0.8, 0.45],
    cloudSun: [1.0, 0.5, 0.3], cloud: [0.95, 0.72, 0.7], planet: [0.95, 0.75, 0.7],
    shadowTint: [0.88, 0.9, 1.15], highTint: [1.12, 0.96, 0.86],
    vol: [1.0, 0.5, 0.25], volS: day.volS * 1.1,
  };
  const afterglow: Key = {
    ...sunset, el: -3,
    sun: [0.8, 0.4, 0.3], sunI: 0,
    zenith: [0.06, 0.09, 0.28], horizon: [0.7, 0.34, 0.26], ground: [0.12, 0.1, 0.14], glow: [0.9, 0.3, 0.14],
    hemiSky: [0.3, 0.32, 0.55], hemiGround: [0.12, 0.1, 0.1], hemiI: day.hemiI * 0.7, env: day.env * 0.35,
    fog: [0.42, 0.3, 0.36], fogSun: [0.9, 0.4, 0.22],
    shade: [0.09, 0.08, 0.24], rim: [0.9, 0.5, 0.45],
    cloudSun: [0.9, 0.42, 0.34], cloud: [0.62, 0.46, 0.52], planet: [0.8, 0.62, 0.66],
    shadowTint: [0.86, 0.9, 1.18], highTint: [1.06, 0.95, 0.92], sat: day.sat - 0.02,
    vol: [0.8, 0.4, 0.3], volS: day.volS * 0.4, rays: 0,
  };
  const blue: Key = {
    ...afterglow, el: -9,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.02, 0.045, 0.14], horizon: [0.14, 0.14, 0.26], ground: [0.05, 0.06, 0.09], glow: [0.35, 0.16, 0.14], stars: 0.35,
    hemiSky: [0.22, 0.28, 0.5], hemiGround: [0.06, 0.07, 0.08], hemiI: day.hemiI * 0.7, env: day.env * 0.18,
    fog: [0.12, 0.13, 0.22], fogSun: [0.3, 0.22, 0.3],
    shade: [0.05, 0.07, 0.2], rim: [0.5, 0.55, 0.9],
    cloudSun: [0.4, 0.35, 0.5], cloud: [0.3, 0.3, 0.42], planet: [0.72, 0.72, 0.85],
    shadowTint: [0.84, 0.94, 1.24], highTint: [0.94, 0.98, 1.14], sat: day.sat - 0.12,
    vol: [0.4, 0.45, 0.7], volS: day.volS * 0.15, rays: 0,
  };
  const night: Key = {
    ...blue, el: -16,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.012, 0.026, 0.085], horizon: [0.06, 0.08, 0.16], ground: [0.03, 0.04, 0.06], glow: [0.1, 0.1, 0.16], stars: 1,
    hemiSky: [0.2, 0.28, 0.55], hemiGround: [0.05, 0.06, 0.08], hemiI: day.hemiI * 0.65, env: day.env * 0.12,
    fog: [0.05, 0.07, 0.14], fogSun: [0.14, 0.18, 0.32],
    shade: [0.04, 0.06, 0.18], rim: [0.45, 0.6, 1.05],
    cloudSun: [0.3, 0.34, 0.5], cloud: [0.2, 0.23, 0.34], planet: [0.62, 0.66, 0.8],
    shadowTint: [0.82, 0.95, 1.28], highTint: [0.9, 0.98, 1.16], lift: [0.0, 0.006, 0.02], sat: day.sat - 0.18,
    vol: [0.35, 0.45, 0.8], volS: day.volS * 0.25, rays: 0,
  };
  return [golden, sunset, afterglow, blue, night];
}

/** the moon as a key light (colour, full intensity) */
const MOON_COLOR: RGB = [0.62, 0.74, 1.0];
const MOON_I = 0.95;

const _a = new THREE.Color(), _b = new THREE.Color();
function lerpRGB(out: THREE.Color, a: RGB, b: RGB, t: number): void { out.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * The sky rig: reads the shard's own look off the live objects (so "day" = the def, exactly), takes over the background
 * with a painted dome that can change (gradient, sun glow, stars, moon glow), and applies a `SkyLook` every frame.
 */
export class SkyRig {
  readonly dome: THREE.Mesh;
  private readonly day: Key;
  private readonly keys: Key[];
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

  constructor(private game: Game, private sky: Sky) {
    const def = getActiveChunk();
    const S = def.sky, G = def.grade, A = def.atmosphere;
    const l = sky.csm.lights[0];
    const P = S.painted ?? { zenith: [0.1, 0.28, 0.85] as RGB, horizon: [0.62, 0.78, 0.98] as RGB, ground: [0.3, 0.36, 0.3] as RGB, glow: [1.0, 0.82, 0.55] as RGB };
    const fog = game.scene.fog as THREE.Fog | null;
    const vs = A.volumetric?.strength ?? 0.55;
    this.day = {
      el: 22,
      sun: l ? rgbOf(l.color) : S.sunColor, sunI: l ? l.intensity : S.sunIntensity,
      zenith: P.zenith, horizon: P.horizon, ground: P.ground, glow: P.glow, stars: 0,
      hemiSky: rgbOf(sky.hemi.color), hemiGround: rgbOf(sky.hemi.groundColor), hemiI: sky.hemi.intensity, env: game.scene.environmentIntensity,
      fog: fog ? rgbOf(fog.color) : P.horizon, fogSun: rgbOf(fogUniforms.fogSunColor.value),
      shade: rgbOf(painterlyUniforms.uPShade.value), rim: rgbOf(painterlyUniforms.uPRimColor.value),
      cloudSun: S.cloudSunColor, cloud: [1, 1, 1], planet: [1, 1, 1],
      shadowTint: G.shadowTint, highTint: G.highTint, lift: G.lift, gain: G.gain, sat: G.saturation, contrast: G.contrast,
      vol: A.volumetricSunColor, volS: vs, rays: 1,
    };
    this.keys = [this.day, ...nightKeys(this.day)];
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

  private readonly gradeScratch: { shadowTint: RGB; highTint: RGB; lift: RGB; gain: RGB } = { shadowTint: [1, 1, 1], highTint: [1, 1, 1], lift: [0, 0, 0], gain: [1, 1, 1] };
  private readonly fogDist: number;
  private readonly fogHeight: number;
  private readonly bright: number;

  /** the time-of-day look at the clock's hour → out */
  look(clock: DayClock, out: SkyLook): SkyLook {
    const el = clock.sunElevation;
    compassDir(clock.sunAzimuth, el, out.sunDir);
    // find the two keys around the elevation (keys run from high to low)
    const K = this.keys;
    let a = K[0], b = K[0], t = 0;
    const first = K[0], last = K[K.length - 1];
    if (!first || !last) throw new Error('SkyRig: no keys');
    if (el >= first.el) { a = b = first; }
    else if (el <= last.el) { a = b = last; }
    else for (let i = 0; i < K.length - 1; i++) {
      const k0 = K[i], k1 = K[i + 1];
      if (k0 && k1 && el <= k0.el && el >= k1.el) { a = k0; b = k1; t = (k0.el - el) / (k0.el - k1.el); break; }
    }
    if (!a || !b) throw new Error('SkyRig: key lookup');
    const s = t * t * (3 - 2 * t);
    // the key light: the sun until it touches the horizon, then (at zero) the moon
    const moonT = smooth(-2, -12, el);
    if (el > -1.5) {
      lerpRGB(out.keyColor, a.sun, b.sun, s);
      out.keyIntensity = lerpN(a.sunI, b.sunI, s) * smooth(-1.5, 1.5, el);
      out.keyDir.copy(out.sunDir);
      out.moon = 0;
    } else {
      out.keyColor.setRGB(...MOON_COLOR);
      out.keyIntensity = MOON_I * moonT;
      compassDir(clock.moonAzimuth, clock.moonElevation, out.keyDir);
      out.moon = 1;
    }
    out.disc = out.moon > 0 ? moonT : smooth(-2.5, 0.5, el);
    lerpRGB(out.zenith, a.zenith, b.zenith, s); lerpRGB(out.horizon, a.horizon, b.horizon, s);
    lerpRGB(out.ground, a.ground, b.ground, s); lerpRGB(out.glow, a.glow, b.glow, s);
    out.stars = lerpN(a.stars, b.stars, s);
    lerpRGB(out.hemiSky, a.hemiSky, b.hemiSky, s); lerpRGB(out.hemiGround, a.hemiGround, b.hemiGround, s);
    out.hemiIntensity = lerpN(a.hemiI, b.hemiI, s);
    out.envIntensity = lerpN(a.env, b.env, s);
    lerpRGB(out.fogColor, a.fog, b.fog, s); lerpRGB(out.fogSunColor, a.fogSun, b.fogSun, s);
    out.fogDist = this.fogDist; out.fogHeightDensity = this.fogHeight;
    lerpRGB(out.shadeTint, a.shade, b.shade, s); lerpRGB(out.rimColor, a.rim, b.rim, s);
    lerpRGB(out.cloudSun, a.cloudSun, b.cloudSun, s); lerpRGB(out.cloudLight, a.cloud, b.cloud, s); lerpRGB(out.planetLight, a.planet, b.planet, s);
    out.planetOpacity = 1;
    lerpRGB(out.shadowTint, a.shadowTint, b.shadowTint, s); lerpRGB(out.highTint, a.highTint, b.highTint, s);
    lerpRGB(out.lift, a.lift, b.lift, s); lerpRGB(out.gain, a.gain, b.gain, s);
    out.saturation = lerpN(a.sat, b.sat, s); out.contrast = lerpN(a.contrast, b.contrast, s); out.brightness = this.bright;
    lerpRGB(out.volColor, a.vol, b.vol, s); out.volStrength = lerpN(a.volS, b.volS, s);
    out.godRays = lerpN(a.rays, b.rays, s);
    return out;
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
    const post = game.post;
    if (post) {
      const g = this.gradeScratch;
      L.shadowTint.toArray(g.shadowTint); L.highTint.toArray(g.highTint); L.lift.toArray(g.lift); L.gain.toArray(g.gain);
      post.grade.set(g);
      post.saturation.saturation = L.saturation;
      post.contrast.contrast = L.contrast;
      post.contrast.brightness = L.brightness;
      // the volumetric light (built in the same buildComposer as `post`): it copies the direction, so every frame is fine
      _b.copy(L.volColor).multiplyScalar(L.moon > 0 ? 0.6 : 1);
      game.volumetrics.setSun(L.keyDir, _b);
      game.volumetrics.setFogColor(L.fogColor);
      this.setVolStrength(L.volStrength);
    }
    this.dome.position.copy(game.camera.position);
  }

  private setVolStrength(s: number): void {
    const A = getActiveChunk().atmosphere.volumetric;
    this.game.volumetrics.setMedium({ height: A?.height ?? -8, falloff: A?.falloff ?? 0.12, density: A?.density ?? 0.0045, strength: s });
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

/** a sky-light level 0..1 (day 1 · dusk ~0.7 · night ~0.4) — the stealth `light` factor reads it */
export function lightLevel(clock: DayClock): number {
  const el = clock.sunElevation;
  return 0.4 + 0.3 * smooth(-14, -2, el) + 0.3 * smooth(-2, 10, el);
}
