import { ZiplineModeSchema, type ZiplineMode } from '@wildshard/format/modes';
import { parseMovers } from '@wildshard/format/movers';
import { MathUtils, Vector3, type AnimationClip, InterpolateLinear, LinearInterpolant, QuaternionLinearInterpolant, Object3D, PropertyBinding } from 'three';
import { lowerMoverMotion, MoverMotionSchema, type MoverMotion, type MoverTrack } from '@wildshard/format/moverMotion';
import * as v from 'valibot';

/** Typed numeric mover declarations: local collider primitives and admitted fixed-step scripts. */
export type MoverData = ReturnType<typeof parseMovers>;
/** Validate identity, primitive limits and numeric data before an author product constructs physics. */
export function movers(data: unknown): MoverData { return parseMovers(data); }

/** Motion options on a real three.js object, with explicit gameplay activation. */
export interface MoverOptions {
  clip?: AnimationClip;
  trigger: MoverMotion['trigger'];
  driver: MoverMotion['driver'];
  speed?: number;
  loop?: MoverTrack['loop'];
}
/** An ordinary scene object with a stop clip and a fixed data-only mover policy. */
export class Mover extends Object3D {
  /** Actual authored body; its stable name binds the clip. */
  readonly body: Object3D;
  /** Options retained for build-time compilation. */
  readonly options: MoverOptions;
  constructor(body: Object3D, options: MoverOptions) {
    super(); this.body = body; this.options = options; this.name = body.name; this.add(body);
  }
  /** Read real clip keys; unrelated objects, unsupported interpolation or incomplete stops refuse. */
  toMotionData(): MoverMotion {
    const clip = this.options.clip;
    let track: MoverTrack | undefined;
    if (clip !== undefined) {
      if (clip.tracks.length === 0 || clip.tracks.length > 2) throw new Error('Mover clip requires position and/or quaternion');
      const times = [...new Set(clip.tracks.flatMap(channel => [...channel.times]))].sort((a, b) => a - b);
      const common = { clip: clip.name, duration: clip.duration, loop: this.options.loop ?? 'once', speed: this.options.speed ?? 1, times };
      let position: MoverTrack['position'], quaternion: MoverTrack['quaternion'];
      for (const channel of clip.tracks) {
        const binding = PropertyBinding.parseTrackName(channel.name);
        if (channel.getInterpolation() !== InterpolateLinear || Boolean(binding.objectName) || Boolean(binding.propertyIndex) || !['', '.', this.body.name, this.body.uuid].includes(binding.nodeName)) throw new Error('Mover clip must linearly bind its own body');
        // Interpolants are the actual three.js clip law, including shortest-arc quaternion interpolation.
        const sample = binding.propertyName === 'quaternion' ? new QuaternionLinearInterpolant(channel.times, channel.values, 4, new Float64Array(4)) : new LinearInterpolant(channel.times, channel.values, channel.getValueSize(), new Float64Array(channel.getValueSize()));
        if (binding.propertyName === 'position' && channel.getValueSize() === 3 && position === undefined) {
          position = times.map(t => { const [x, y, z] = sample.evaluate(t); if (x === undefined || y === undefined || z === undefined) throw new Error('Missing position key'); return [x, y, z]; });
        } else if (binding.propertyName === 'quaternion' && channel.getValueSize() === 4 && quaternion === undefined) {
          quaternion = times.map(t => { const [x, y, z, w] = sample.evaluate(t); if (x === undefined || y === undefined || z === undefined || w === undefined) throw new Error('Missing quaternion key'); return [x, y, z, w]; });
        } else throw new Error('Mover clips animate each position or quaternion channel once');
      }
      track = { ...common, ...(position === undefined ? {} : { position }), ...(quaternion === undefined ? {} : { quaternion }) };

    }
    return v.parse(MoverMotionSchema, { ...(track === undefined ? {} : { track }), trigger: this.options.trigger, driver: this.options.driver });
  }
  /** Bind authored motion to a numeric collider/rest row while retaining the fixed guest continuation ABI. */
  toMoverData(rest: Omit<MoverData[number], 'module' | 'input' | 'track' | 'trigger' | 'driver'>): MoverData[number] {
    const motion = this.toMotionData(), compiled = lowerMoverMotion(motion, rest), row = { ...rest, ...compiled, ...motion };
    parseMovers([row]); return row;
  }
}

/** Floor endpoint vectors; explicit construction data, never scene or renderer ownership. */
export interface ZiplineSpec { top: Vector3; bottom: Vector3; /** sag in metres at mid-span per 100 m (default 1.6) */ sag?: number }

/** Platform deck offset and cable/landing attachment heights in metres. */
const DECK_H = 0.5, CABLE_ABOVE = 3.6, LANDING_ABOVE = 3.2;
const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** the zipline's layout on its ends: the launch deck, the cable's two ends and its sag (world) */
export class CableLayout {
  /** the cable's two ends (world) */
  readonly a = new Vector3();
  readonly b = new Vector3();
  readonly len: number;
  readonly sag: number;
  readonly dir = new Vector3();
  /** the flat direction down the line */
  readonly flat: Vector3;
  readonly deck = { x: 0, z: 0, yaw: 0, y: 0, hw: 1.2, hd: 1.8 };

  readonly spec: ZiplineSpec;

  constructor(spec: ZiplineSpec, direct = false) {
    this.spec = spec;
    const flat = this.flat = V(spec.bottom.x - spec.top.x, 0, spec.bottom.z - spec.top.z).normalize();
    // the deck: 3.6 m long, its outer edge at `top`, running back up the slope
    this.deck.yaw = Math.atan2(flat.x, flat.z);
    this.deck.x = spec.top.x - flat.x * this.deck.hd; this.deck.z = spec.top.z - flat.z * this.deck.hd; this.deck.y = spec.top.y + DECK_H;
    if (direct) { this.a.copy(spec.top); this.b.copy(spec.bottom); }
    else {
      this.a.set(spec.top.x + flat.x * 0.4, this.deck.y + CABLE_ABOVE, spec.top.z + flat.z * 0.4);
      this.b.set(spec.bottom.x, spec.bottom.y + LANDING_ABOVE, spec.bottom.z);
    }
    this.len = this.a.distanceTo(this.b);
    this.sag = (spec.sag ?? 1.6) * (this.len / 100);
    this.dir.subVectors(this.b, this.a).normalize();
  }

  /** a point on the cable at arc position s (0 … len), sagging as a parabola */
  at(s: number, out: Vector3): Vector3 {
    const t = MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.a, this.b, t).setY(this.a.y + (this.b.y - this.a.y) * t - this.sag * 4 * t * (1 - t));
  }

  /** where the trolley parks at the top, and its turn about +Y */
  park(out: Vector3): number { this.at(0.6, out); return Math.atan2(this.dir.x, this.dir.z) + Math.PI / 2; }
}



/** Mutable cable continuation; native callers retain their own surrounding state. */
export interface ZiplineRideState { s: number; v: number }
const finite = v.pipe(v.number(), v.finite());
const bounded = (low: number, high: number) => v.pipe(finite, v.minValue(low), v.maxValue(high));
const RideProfile = v.strictObject({ anchors: v.literal('direct'), start: bounded(0, 10), release: bounded(0, 10),
  landing: v.strictObject({ back: bounded(0, 10), deck: bounded(0, 2), velocity: bounded(0, 16) }) });
const Saved = v.strictObject({ riding: v.boolean(), s: v.pipe(finite, v.minValue(0)), v: bounded(0, 32) });
/** One cable's gravity/drag law and carry/release pose. Uses the caller's update phase and clock. */
export class ZiplineDriver {
  private readonly layout: CableLayout;
  private readonly point = new Vector3();
  private readonly ahead = new Vector3();
  private readonly motion: ZiplineRideState = { s: 0, v: 0 };
  private riding = false;
  private readonly row: ZiplineMode;
  private readonly profile: v.InferOutput<typeof RideProfile> | undefined;
  private readonly onRide: (on: boolean) => void;
  constructor(row: ZiplineMode, onRide: (on: boolean) => void,
    profile?: v.InferOutput<typeof RideProfile>) {
    this.onRide = onRide;
    // Author geometry lends real vectors; admit their numeric coordinates without prototype markers.
    const point = (value: ZiplineMode['top']) => value instanceof Vector3 ? { x: value.x, y: value.y, z: value.z } : value;
    this.row = v.parse(ZiplineModeSchema, { ...row, top: point(row.top), bottom: point(row.bottom) });
    this.profile = profile === undefined ? undefined : v.parse(RideProfile, profile);
    this.layout = new CableLayout({ top: new Vector3(row.top.x, row.top.y, row.top.z),
      bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag }, this.profile !== undefined);
  }
  get isRiding(): boolean { return this.riding; }
  get distance(): number { return this.motion.s; }
  get len(): number { return this.layout.len; }
  /** Direct anchors release along the level wire heading; deck rides keep the cable's full direction. */
  get dir(): Vector3 { return this.profile === undefined ? this.layout.dir : this.layout.flat; }
  at(s: number, out: Vector3): Vector3 { return this.layout.at(s, out); }
  start(): void {
    if (this.riding) return;
    this.riding = true; this.motion.s = this.profile?.start ?? 0.4; this.motion.v = 2.5;
    this.onRide(true);
  }
  /** Advance the same bounded law in a native caller's existing continuation, without commands or clock ownership. */
  step(ride: ZiplineRideState, dt: number): boolean {
    const slope = -(this.layout.at(ride.s + 0.5, this.ahead).y - this.layout.at(ride.s, this.point).y) / 0.5;
    ride.v = Math.min(this.row.maxSpeed, Math.max(1.5, ride.v + (this.row.gravity * slope * 0.9 - this.row.drag * ride.v * ride.v) * dt));
    ride.s += ride.v * dt;
    return ride.s < this.layout.len - (this.profile?.release ?? 1.6);
  }
  rider(s: number, out: Vector3): Vector3 { this.layout.at(s, out); out.y -= this.row.hang; return out; }
  /** A declared landing keeps the original floor minimum and walking release velocity. */
  dismount(landing: { readonly x: number; readonly y: number; readonly z: number }, y: number, out: Vector3, velocity: Vector3): void {
    const row = this.profile?.landing;
    if (row === undefined) throw new Error('Cable ride has no declared landing release');
    out.set(landing.x - this.dir.x * row.back, Math.max(y, landing.y + row.deck), landing.z - this.dir.z * row.back);
    velocity.set(this.dir.x * row.velocity, 0, this.dir.z * row.velocity);
  }
  update(dt: number, player: { position: Vector3; velocity: Vector3 }): void {
    if (!this.riding) return;
    const holding = this.step(this.motion, dt);
    this.rider(this.motion.s, player.position); player.velocity.set(0, 0, 0);
    if (!holding) {
      this.riding = false;
      if (this.profile === undefined) {
        const dir = this.layout.dir;
        player.velocity.set(dir.x * Math.min(6, this.motion.v * 0.4), 1.5, dir.z * Math.min(6, this.motion.v * 0.4));
        this.layout.park(this.point);
      } else this.dismount(this.layout.spec.bottom, player.position.y, player.position, player.velocity);
      this.onRide(false);
    }
  }
  snapshot(): v.InferOutput<typeof Saved> { return { riding: this.riding, s: this.motion.s, v: this.motion.v }; }
  /** Refusal is atomic; restore never starts a ride, moves a body or publishes a callback. */
  restore(value: unknown): void {
    const saved = v.parse(Saved, value);
    if (saved.v > this.row.maxSpeed) throw new Error('Zipline continuation exceeds its admitted speed');
    this.riding = saved.riding; this.motion.s = saved.s; this.motion.v = saved.v;
  }
}
