import type { Camera } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { AmbienceZones } from '@wildshard/engine/audio/ambience';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { AudioZoneProfile } from '@wildshard/engine/audio/audioProfiles';
import { ownAudioSource } from '@wildshard/engine/audio/ownership';
import { audioRandom } from '@wildshard/engine/audio/util';
import type { FamilyName } from '@wildshard/engine/audio/Voices';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import { SynthBeds, type SynthBedGraph } from './synthBeds';

/**
 * A zoned soundscape's mix as rows (SHARD-PLATFORM M3): the listener, the emitters, the zone weights, every bed's level,
 * the reverb-room sends and the one-shot schedulers of an ambience profile, all described as data over the synth beds
 * (./synthBeds). Every frame moves the listener and the line emitters; at the profile's tick rate the mix evaluates its
 * value rows in order (expressions over the listener, the clock, the ports and the profile's zones, levels and wet sends),
 * sets each bed's level, steers its panners, sets its filter params, opens a room's send the first time its weight is
 * above zero, refreshes the diag and picks the dominant zone. One-shot rows (a swell riding beds' gains, or a voice of
 * oscillator notes) fire on their own timers, gated by an expression. Nothing here knows a shard: the ids, every number
 * and every formula are row data; the profile hands in its ports (ground height, objects that may carry bounds, points,
 * scalar readers). Nothing touches the AudioContext before the first frame after `audio.ready` (the first gesture).
 *
 *   const mix = new AmbienceMix(audio, profile, ROWS, { random: Math.random, scope: 'audio.x', heightAt, sea });
 *   mix.frame(dt, camera)    // every frame
 */

/** An operator of a mix expression. `zone` (a zone id) is the smoothstep from its outer to its inner radius at the
 *  listener; `dist` (a point prefix) the ground distance from the listener to `<p>.x`, `<p>.z`; `ss` a smoothstep (a, b, x);
 *  `in` 1 when a > lo and a < hi; `lt` / `gt` 1 or 0; `if` the second argument when the first is truthy, else the third;
 *  `and` / `or` / `not` truthiness; `+` and `*` fold left. */
export type MixOp = '+' | '-' | '*' | '/' | 'min' | 'max' | 'abs' | 'sin' | 'hypot' | 'ss' | 'in' | 'lt' | 'gt' | 'if' | 'and' | 'or' | 'not' | 'clamp' | 'zone' | 'dist';

/** A mix expression: a number, a named value or an operator over expressions. */
export type MixExpr = number | string | readonly [MixOp, ...MixExpr[]];

/** A named value the mix computes in order (later rows read earlier ones). */
export type MixValueRow = readonly [string, MixExpr];

/** A node the mix builds before the beds: a biquad or a positional panner, into another node; a panner may sit at a point
 *  or follow a zone's shoreline (rays marched in from the zone's outer radius until the ground breaks the sea, refined by
 *  bisection; the nearest point of that closed polyline each frame, at the sea's height). */
export interface MixNodeRow {
  readonly id: string;
  readonly out: string;
  /** a biquad: type, frequency, Q */
  readonly filter?: readonly [BiquadFilterType, number, number];
  /** an equal-power inverse-distance panner: refDistance, rolloffFactor, maxDistance */
  readonly panner?: readonly [number, number, number];
  /** the panner's fixed point (a point port) */
  readonly at?: string;
  /** the panner follows this zone's shoreline: rays, march step, bisection steps; `diag` names the distance (a diag key
   *  and a value, refreshed every frame) */
  readonly follow?: { readonly zone: string; readonly rays: number; readonly step: number; readonly refine: number; readonly diag: string };
}

/** A bounds port: `<id>` is 1 while `objects[from][key]` is a valid { x, z, r, yMin, yMax } (then `<id>.x` … are set), else 0. */
export interface MixBoundsRow { readonly id: string; readonly from: string; readonly key: string }

/** A nearness port over a point list: `<id>.sum` (each point within `radius` weighs 1 − d / radius), `<id>.dx`, `<id>.dz`
 *  (the weighted offsets toward them). */
export interface MixNearRow { readonly id: string; readonly radius: number }

/** A stereo panner the beds expose, steered toward a nearness port's side of the listener (± width) while it has weight. */
export interface MixSteerRow { readonly pan: string; readonly toward: string; readonly width: number; readonly tau: number }

/** A reverb room: a convolver on the generated IR, fed from the send bus through a gain that follows `level` once its
 *  `weight` value is above 0.001 (built then); `feeds` names other nodes that also feed it. */
export interface MixRoomRow { readonly id: string; readonly ir: FamilyName; readonly weight: string; readonly level: MixExpr; readonly feeds?: readonly string[] }

/** A swell on beds: per bed [id, base, peak]; size = (size[0] + r·size[1]) · (1 − night·nightDrop), rise = build[0] +
 *  r·build[1], wash = wash[0] + r·wash[1]; a linear rise to `crest` of the way at `early`·rise, the peak at rise, then back
 *  to base from rise + hold with the time constant wash / decay. */
export interface MixSwellRow {
  readonly beds: readonly (readonly [string, number, number])[];
  readonly size: readonly [number, number];
  readonly nightDrop: number;
  readonly build: readonly [number, number];
  readonly wash: readonly [number, number];
  readonly crest: number;
  readonly early: number;
  readonly hold: number;
  readonly decay: number;
}

/** One oscillator note of a phrase: f1 = f0·drop reached at `glide`; an exponential envelope to `peak` at `attack`, down at
 *  `end`; stopped at the sum of `stop`'s offsets; through a low-pass when `lowpass` is set. */
export interface MixNoteRow {
  readonly wave?: OscillatorType;
  readonly drop: number;
  readonly glide: number;
  readonly attack: number;
  readonly peak: number;
  readonly end: number;
  readonly stop: readonly number[];
  readonly lowpass?: number;
}

/** A phrase: taken when a draw is under `chance` (or always without one); its first pitch = pitch[0] + r·pitch[1]; notes
 *  `gap` apart while k < count[0] + ⌊r·count[1]⌋ (redrawn before each note; no draw when count[1] is 0), each pitch ×
 *  `step` after the last. */
export interface MixPhraseRow {
  readonly chance?: number;
  readonly pitch: readonly [number, number];
  readonly count: readonly [number, number];
  readonly gap: number;
  readonly step: number;
  readonly note: MixNoteRow;
}

/** A voice: into a bed or a named node, through a random stereo pan (r·pan[0] − pan[1]) and a gain (g[0]·(g[1] + r·g[2]))
 *  when given; the notes' peaks scaled by `scale`; the first phrase taken plays. */
export interface MixVoiceRow {
  readonly to: string;
  readonly tap: string;
  readonly pan?: readonly [number, number];
  readonly gain?: readonly [number, number, number];
  readonly scale?: MixExpr;
  readonly phrases: readonly MixPhraseRow[];
}

/** A one-shot scheduler, started at its synth-bed mark: every (every[0] + r·every[1]·(1 + night·every[2])) seconds an
 *  ambient tick `tick`; when `when` holds (once the mix has run) the swell or the voice plays. */
export interface MixOneShotRow {
  readonly mark: string;
  readonly tick: string;
  readonly every: readonly [number, number, number];
  readonly when?: MixExpr;
  readonly swell?: MixSwellRow;
  readonly voice?: MixVoiceRow;
}

/** A profile's whole mix as rows. */
export interface AmbienceMixRows<Z extends string = string> {
  /** the families rendered before the graph is built, and the ones prewarmed once it is */
  readonly warm: readonly FamilyName[];
  readonly prewarm: readonly FamilyName[];
  /** the master low-pass's underwater cutoff (Hz) and ramp (s) */
  readonly underwater: readonly [number, number];
  readonly nodes: readonly MixNodeRow[];
  readonly beds: SynthBedGraph;
  readonly bounds: readonly MixBoundsRow[];
  readonly near: readonly MixNearRow[];
  readonly values: readonly MixValueRow[];
  /** every bed's level: [bed id, expression] */
  readonly levels: readonly MixValueRow[];
  readonly steer: readonly MixSteerRow[];
  /** filter params set every mix: [node, expression] → its frequency */
  readonly cutoffs: readonly MixValueRow[];
  readonly rooms: { readonly from: string; readonly to: string; readonly list: readonly MixRoomRow[] };
  readonly diag: readonly MixValueRow[];
  /** the dominant zone: the first row whose expression holds (the last should always hold) */
  readonly zones: readonly (readonly [Z, MixExpr])[];
  readonly oneShots: readonly MixOneShotRow[];
}

/** A point port. */
export interface MixPoint { readonly x: number; readonly y?: number; readonly z: number }

/** What the profile hands the mix: its random stream (the synth pool and the one-shots draw from it), its scope's name,
 *  the ground and the sea, objects bounds ports read, point lists for nearness, fixed points and scalar readers. */
export interface AmbienceMixPorts {
  readonly random: () => number;
  readonly scope: string;
  readonly heightAt: (x: number, z: number) => number;
  readonly sea: number;
  readonly objects?: Readonly<Record<string, object | null | undefined>>;
  readonly near?: Readonly<Record<string, readonly { x: number; z: number }[] | undefined>>;
  readonly points?: Readonly<Record<string, MixPoint>>;
  readonly inputs?: Readonly<Record<string, () => number>>;
  /** runs first in the build (e.g. the profile's synth bed hands over to the zoned graph) */
  readonly onBuild?: () => void;
}

const ss = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BOUNDS_KEYS = ['x', 'z', 'r', 'yMin', 'yMax'] as const;

/** Builds and runs a profile's mix from rows. */
export class AmbienceMix<Z extends string = string> {
  /** 0 = day … 1 = night (the clock drives it) */
  night = 0;
  /** the dominant zone */
  zone: Z;
  /** the live mix, refreshed at the tick rate (the same object, keys in row order) */
  readonly diag: Record<string, number> = {};
  /** the one-shot schedulers and anything the profile registers: disposed with the profile */
  readonly scope: Scope;
  /** the profile's zoned beds */
  readonly zones: AmbienceZones;
  private readonly audio: Audio;
  private readonly profile: AudioZoneProfile;
  private readonly rows: AmbienceMixRows<Z>;
  private readonly ports: AmbienceMixPorts;
  private readonly synth: SynthBeds;
  private readonly values = new Map<string, number>();
  private readonly nodes = new Map<string, AudioNode>();
  private readonly panners = new Map<string, PannerNode>();
  private readonly filters = new Map<string, BiquadFilterNode>();
  private readonly shores = new Map<string, Float32Array>();
  private readonly sends = new Map<string, GainNode>();
  private pans = new Map<string, StereoPannerNode>();
  private sendIn: GainNode | undefined;
  private built = false; private warming = false; private mixed = false;
  private underwater = false;
  private tick = 0; private t = 0;
  private readonly q = new Float32Array(2);

  constructor(audio: Audio, profile: AudioZoneProfile, rows: AmbienceMixRows<Z>, ports: AmbienceMixPorts, zone: Z) {
    this.audio = audio; this.profile = profile; this.rows = rows; this.ports = ports; this.zone = zone;
    this.scope = new Scope(ports.scope);
    this.zones = new AmbienceZones(audio, audioRandom);
    this.synth = new SynthBeds(audio, this.zones, ports.random);
    for (const [k] of rows.diag) this.diag[k] = 0;
    for (const z of profile.zones) for (const k of ['x', 'z', 'inner', 'outer', 'gain'] as const) this.values.set(`${z.id}.${k}`, z[k]);
    for (const [k, v] of Object.entries(profile.levels)) this.values.set(`level.${k}`, v);
    for (const [k, v] of Object.entries(profile.wet)) this.values.set(`wet.${k}`, v);
    for (const [id, p] of Object.entries(ports.points ?? {})) { this.values.set(`${id}.x`, p.x); this.values.set(`${id}.z`, p.z); if (p.y !== undefined) this.values.set(`${id}.y`, p.y); }
    this.values.set('sea', ports.sea);
    for (const n of rows.nodes) if (n.follow) this.shores.set(n.id, this.traceShore(n.follow.zone, n.follow.rays, n.follow.step, n.follow.refine));
  }

  /** a zone's shoreline: rays from its centre, each marched in from its outer radius until the ground breaks the sea */
  private traceShore(id: string, rays: number, step: number, refine: number): Float32Array {
    const zone = this.profile.zones.find((z) => z.id === id);
    if (!zone) throw new Error(`ambienceMix: no zone '${id}'`);
    const { heightAt: H, sea } = this.ports, out = new Float32Array(rays * 2);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      let r = zone.outer, hit = -1;
      for (; r > step; r -= step) if (H(zone.x + cx * r, zone.z + cz * r) > sea) { hit = r; break; }
      if (hit > 0) { let lo = hit, hi = hit + step; for (let k = 0; k < refine; k++) { const m = (lo + hi) / 2; if (H(zone.x + cx * m, zone.z + cz * m) > sea) lo = m; else hi = m; } r = lo; }
      else r = zone.inner;
      out[i * 2] = zone.x + cx * r; out[i * 2 + 1] = zone.z + cz * r;
    }
    return out;
  }

  /** the nearest point on a closed polyline to (x, z) → out[0..1]; returns the distance */
  private nearest(s: Float32Array, x: number, z: number, out: Float32Array): number {
    const n = s.length / 2; let best = Infinity;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = s[i * 2] ?? 0, az = s[i * 2 + 1] ?? 0, bx = s[j * 2] ?? 0, bz = s[j * 2 + 1] ?? 0;
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
      const qx = ax + ex * u, qz = az + ez * u, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; out[0] = qx; out[1] = qz; }
    }
    return Math.sqrt(best);
  }

  private node(id: string): AudioNode {
    const n = this.zones.beds.get(id)?.gain ?? this.nodes.get(id);
    if (n === undefined) throw new Error(`ambienceMix: no node '${id}'`);
    return n;
  }

  private build(): void {
    this.built = true;
    const a = this.audio, c = a.ctx, rows = this.rows;
    this.ports.onBuild?.();
    const [cutoff, ramp] = rows.underwater; a.underwaterCutoff = cutoff; a.underwaterRamp = ramp;
    a.voices.prewarm([...rows.prewarm]);
    this.nodes.set('ambient', a.ambient); this.nodes.set('world', a.world); this.nodes.set('sfx', a.sfx);
    for (const n of rows.nodes) {
      const out = this.node(n.out);
      if (n.filter) { const f = this.synth.biquad(...n.filter); f.connect(out); this.nodes.set(n.id, f); this.filters.set(n.id, f); }
      else if (n.panner) {
        const p = c.createPanner(), [ref, rolloff, max] = n.panner;
        p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = max;
        if (n.at !== undefined) { p.positionX.value = this.value(`${n.at}.x`); p.positionY.value = this.value(`${n.at}.y`); p.positionZ.value = this.value(`${n.at}.z`); }
        p.connect(out); this.nodes.set(n.id, p); this.panners.set(n.id, p);
      }
    }
    const outs: Record<string, AudioNode> = Object.fromEntries(this.nodes);
    const marks: Record<string, () => void> = {};
    for (const row of rows.oneShots) marks[row.mark] = () => { this.scheduleOneShot(row); };
    this.pans = this.synth.assemble(rows.beds, outs, marks).pans;
    const sendIn = c.createGain(); sendIn.gain.value = 1; this.node(rows.rooms.from).connect(sendIn); this.sendIn = sendIn;
  }

  /** a room's send (and convolver), built the first time it is needed */
  private send(room: MixRoomRow): GainNode | undefined {
    const have = this.sends.get(room.id); if (have) return have;
    const a = this.audio, ir = a.voices.buffer(room.ir);
    if (!ir || !this.sendIn) return undefined;
    const c = a.ctx, g = c.createGain(); g.gain.value = 0;
    const conv = c.createConvolver(); conv.normalize = false; conv.buffer = ir;
    this.sendIn.connect(g).connect(conv).connect(this.node(this.rows.rooms.to));
    for (const f of room.feeds ?? []) this.nodes.get(f)?.connect(g);
    this.sends.set(room.id, g);
    return g;
  }

  // ─────────────── timers (not per frame) ───────────────
  private scheduleOneShot(row: MixOneShotRow): void {
    const [base, spread, night] = row.every;
    this.scope.timeout((base + this.ports.random() * spread * (1 + this.night * night)) * 1000, () => {
      ambientTick(row.tick, () => {
        this.values.set('night', this.night); this.values.set('underwater', this.underwater ? 1 : 0);
        if (row.when === undefined || (this.mixed && this.truthy(this.eval(row.when)))) {
          if (row.swell) this.swell(row.swell);
          if (row.voice) this.voice(row.voice);
        }
        this.scheduleOneShot(row);
      });
    });
  }

  private swell(row: MixSwellRow): void {
    const gains: AudioParam[] = [];
    for (const [id] of row.beds) { const b = this.zones.beds.get(id); if (!b) return; gains.push(b.gain.gain); }
    const r = this.ports.random, t = this.audio.ctx.currentTime, size = (row.size[0] + r() * row.size[1]) * (1 - row.nightDrop * this.night);
    const build = row.build[0] + r() * row.build[1], wash = row.wash[0] + r() * row.wash[1];
    for (const [i, [, base, peak]] of row.beds.entries()) {
      const g = gains[i]; if (!g) continue;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(base + (peak - base) * size * row.crest, t + build * row.early);
      g.linearRampToValueAtTime(base + (peak - base) * size, t + build);
      g.setTargetAtTime(base, t + build + row.hold, wash / row.decay);
    }
  }

  private voice(row: MixVoiceRow): void {
    const dest = this.zones.beds.get(row.to)?.gain ?? this.nodes.get(row.to); if (!dest) return;
    const c = this.audio.ctx, t = c.currentTime, r = this.ports.random;
    tap.sound?.(row.tap);
    let into: AudioNode = dest;
    if (row.pan || row.gain) {
      let head: AudioNode = dest;
      if (row.pan) { const pan = c.createStereoPanner(); pan.pan.value = r() * row.pan[0] - row.pan[1]; pan.connect(head); head = pan; }
      if (row.gain) { const out = c.createGain(); out.gain.value = row.gain[0] * (row.gain[1] + r() * row.gain[2]); out.connect(head); head = out; }
      into = head;
    }
    const scale = row.scale === undefined ? undefined : this.eval(row.scale);
    for (const ph of row.phrases) {
      if (ph.chance !== undefined && !(r() < ph.chance)) continue;
      let f = ph.pitch[0] + r() * ph.pitch[1];
      for (let k = 0; k < ph.count[0] + (ph.count[1] > 0 ? Math.floor(r() * ph.count[1]) : 0); k++) { this.note(t + k * ph.gap, f, ph.note, scale, into); f *= ph.step; }
      return;
    }
  }

  private note(t0: number, f0: number, n: MixNoteRow, scale: number | undefined, into: AudioNode): void {
    const c = this.audio.ctx, o = ownAudioSource(c.createOscillator());
    if (n.wave !== undefined) o.type = n.wave;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * n.drop, t0 + n.glide);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(scale === undefined ? n.peak : n.peak * scale, t0 + n.attack); e.gain.exponentialRampToValueAtTime(0.0001, t0 + n.end);
    if (n.lowpass === undefined) o.connect(e);
    else { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = n.lowpass; o.connect(f).connect(e); }
    e.connect(into);
    let stop = t0; for (const s of n.stop) stop += s;
    o.start(t0); o.stop(stop);
  }

  // ─────────────── per frame ───────────────
  /** the listener and the line emitters every frame; the mix at the profile's tick rate */
  frame(dt: number, camera: Camera): void {
    const a = this.audio;
    if (!a.ready) return;
    if (!this.built) {
      // the raw material renders in the background first (a few ms a slice), then the graph is built in one go
      if (!this.warming) { this.warming = true; a.voices.prewarm([...this.rows.warm]); }
      if (!this.rows.warm.every((f) => a.voices.has(f))) return;
      this.build();
    }
    this.t += dt;
    const m = camera.matrixWorld.elements;
    const x = m[12], y = m[13], z = m[14];
    this.values.set('x', x); this.values.set('y', y); this.values.set('z', z);
    const l = a.ctx.listener;
    l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    l.forwardX.value = -m[8]; l.forwardY.value = -m[9]; l.forwardZ.value = -m[10];
    l.upX.value = m[4]; l.upY.value = m[5]; l.upZ.value = m[6];
    a.voices.setListener(x, y, z, Math.atan2(m[8], m[10])); // forward = (−sin, −cos)
    for (const n of this.rows.nodes) {
      const shore = this.shores.get(n.id), p = this.panners.get(n.id);
      if (!shore || !n.follow) continue;
      const d = this.nearest(shore, x, z, this.q);
      if (p) { p.positionX.value = this.q[0] ?? 0; p.positionY.value = this.ports.sea; p.positionZ.value = this.q[1] ?? 0; }
      this.diag[n.follow.diag] = d; this.values.set(n.follow.diag, d);
    }
    this.tick += dt;
    if (this.tick >= 1 / this.profile.tickHz) { this.tick = 0; this.mix(); }
  }

  /** head under / over the surface: the mix runs at once */
  setUnderwater(on: boolean): void { this.underwater = on; if (this.built) this.mix(); }

  private value(name: string): number {
    const v = this.values.get(name);
    if (v !== undefined) return v;
    if (name.startsWith('bed.')) return this.zones.beds.get(name.slice(4))?.level ?? 0;
    throw new Error(`ambienceMix: no value '${name}'`);
  }

  private truthy(v: number): boolean { return v !== 0 && !Number.isNaN(v); }

  private arg(e: readonly MixExpr[], i: number): number {
    const x = e[i];
    if (x === undefined) throw new Error('ambienceMix: missing argument');
    return this.eval(x);
  }

  private eval(e: MixExpr): number {
    if (typeof e === 'number') return e;
    if (typeof e === 'string') return this.value(e);
    const op = e[0], A = (i: number): number => this.arg(e, i);
    switch (op) {
      case '+': { let v = A(1); for (let i = 2; i < e.length; i++) v += A(i); return v; }
      case '*': { let v = A(1); for (let i = 2; i < e.length; i++) v *= A(i); return v; }
      case '-': return A(1) - A(2);
      case '/': return A(1) / A(2);
      case 'min': return Math.min(A(1), A(2));
      case 'max': return Math.max(A(1), A(2));
      case 'clamp': return Math.max(A(2), Math.min(A(3), A(1)));
      case 'abs': return Math.abs(A(1));
      case 'sin': return Math.sin(A(1));
      case 'hypot': return Math.hypot(A(1), A(2));
      case 'ss': return ss(A(1), A(2), A(3));
      case 'in': { const v = A(1); return v > A(2) && v < A(3) ? 1 : 0; }
      case 'lt': return A(1) < A(2) ? 1 : 0;
      case 'gt': return A(1) > A(2) ? 1 : 0;
      case 'if': return this.truthy(A(1)) ? A(2) : A(3);
      case 'and': { for (let i = 1; i < e.length; i++) if (!this.truthy(A(i))) return 0; return 1; }
      case 'or': { for (let i = 1; i < e.length; i++) if (this.truthy(A(i))) return 1; return 0; }
      case 'not': return this.truthy(A(1)) ? 0 : 1;
      case 'dist': case 'zone': {
        const p = e[1];
        if (typeof p !== 'string') throw new Error(`ambienceMix: ${op} takes a name`);
        const d = Math.hypot(this.value('x') - this.value(`${p}.x`), this.value('z') - this.value(`${p}.z`));
        return op === 'dist' ? d : ss(this.value(`${p}.outer`), this.value(`${p}.inner`), d);
      }
      default: throw new Error('ambienceMix: unknown operator');
    }
  }

  /** the ports and rows → every bed's target level, panners, filters, reverb sends, the diag and the zone */
  private mix(): void {
    const a = this.audio, rows = this.rows, V = this.values, t = a.ctx.currentTime, tau = this.profile.smoothSeconds;
    const x = this.value('x'), z = this.value('z');
    V.set('night', this.night); V.set('underwater', this.underwater ? 1 : 0); V.set('t', this.t);
    V.set('ground', this.ports.heightAt(x, z));
    for (const [k, read] of Object.entries(this.ports.inputs ?? {})) V.set(k, read());
    for (const b of rows.bounds) {
      const box = boundsOf(this.ports.objects?.[b.from], b.key);
      V.set(b.id, box ? 1 : 0);
      if (box) for (const k of BOUNDS_KEYS) V.set(`${b.id}.${k}`, box[k]);
    }
    for (const n of rows.near) {
      let pd = 0, pdx = 0, pdz = 0;
      const r2 = n.radius * n.radius;
      for (const p of this.ports.near?.[n.id] ?? []) { const dx = p.x - x, dz = p.z - z, dd = dx * dx + dz * dz; if (dd < r2) { const w = 1 - Math.sqrt(dd) / n.radius; pd += w; pdx += dx * w; pdz += dz * w; } }
      V.set(`${n.id}.sum`, pd); V.set(`${n.id}.dx`, pdx); V.set(`${n.id}.dz`, pdz);
    }
    for (const [k, e] of rows.values) V.set(k, this.eval(e));
    for (const [id, e] of rows.levels) { const v = this.eval(e), b = this.zones.beds.get(id); if (!b) continue; b.level = v; b.gain.gain.setTargetAtTime(v, t, tau); }
    for (const s of rows.steer) {
      const p = this.pans.get(s.pan), pd = this.value(`${s.toward}.sum`);
      if (!p || !(pd > 0)) continue;
      const pdx = this.value(`${s.toward}.dx`), pdz = this.value(`${s.toward}.dz`), rx = -a.ctx.listener.forwardZ.value, rz = a.ctx.listener.forwardX.value;
      p.pan.setTargetAtTime(Math.max(-s.width, Math.min(s.width, (pdx * rx + pdz * rz) / (Math.hypot(pdx, pdz) + 1e-3) * s.width)), t, s.tau);
    }
    for (const [id, e] of rows.cutoffs) this.filters.get(id)?.frequency.setTargetAtTime(this.eval(e), t, tau);
    for (const room of rows.rooms.list) {
      const w = this.value(room.weight), g = w > 0.001 ? this.send(room) : this.sends.get(room.id);
      g?.gain.setTargetAtTime(this.eval(room.level), t, tau);
    }
    for (const [k, e] of rows.diag) this.diag[k] = this.eval(e);
    for (const [zone, e] of rows.zones) if (this.truthy(this.eval(e))) { this.zone = zone; break; }
    this.mixed = true;
  }

  /** the schedulers stop (the mixer's unloadLevel fades what is left) */
  dispose(): void { this.scope.dispose(); }
}

/** a Bounds-shaped `key` on an object, if it has one (duck-typed: works before and after a model lands it) */
function boundsOf(o: object | null | undefined, key: string): Record<(typeof BOUNDS_KEYS)[number], number> | undefined {
  if (!o || !(key in o)) return undefined;
  const v: unknown = Reflect.get(o, key);
  if (typeof v !== 'object' || v === null) return undefined;
  const n = (k: string): number => { const x: unknown = Reflect.get(v, k); return typeof x === 'number' ? x : Number.NaN; };
  const b = { x: n('x'), z: n('z'), r: n('r'), yMin: n('yMin'), yMax: n('yMax') };
  return Number.isFinite(b.x + b.z + b.r + b.yMin + b.yMax) && b.r > 0 ? b : undefined;
}
