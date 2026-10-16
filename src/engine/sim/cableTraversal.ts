import type { SimHost } from '../sim';
import type { Flags } from '../world/interact/flags';
import { CableProfileSchema, parseModes, ZiplineModeSchema, type ModeRows, type ZiplineMode } from '@wildshard/format/modes';
import { MathUtils, Vector3, type Object3D } from 'three';
import * as v from 'valibot';

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
const Landing = v.strictObject({ x: finite, y: finite, z: finite });
const Saved = v.strictObject({ riding: v.boolean(), s: v.pipe(finite, v.minValue(0)), v: bounded(0, 32) });
/** One cable's gravity/drag law and carry/release pose. Uses the caller's update phase and clock. */
export class ZiplineDriver {
  private readonly layout: CableLayout;
  private readonly point = new Vector3();
  private readonly ahead = new Vector3();
  private readonly motion: ZiplineRideState = { s: 0, v: 0 };
  private riding = false;
  private readonly row: ZiplineMode;
  private readonly profile: v.InferOutput<typeof CableProfileSchema> | undefined;
  private readonly onRide: (on: boolean) => void;
  private readonly landing: ZiplineMode['bottom'];
  /** A direct-anchor profile may lend a separate landing deck; otherwise release uses the declared bottom endpoint. */
  constructor(row: ZiplineMode, onRide: (on: boolean) => void = () => undefined,
    profile?: v.InferOutput<typeof CableProfileSchema>, landing?: ZiplineMode['bottom']) {
    this.onRide = onRide;
    // Author geometry lends real vectors; admit their numeric coordinates without prototype markers.
    const point = (value: ZiplineMode['top']) => value instanceof Vector3 ? { x: value.x, y: value.y, z: value.z } : value;
    this.row = v.parse(ZiplineModeSchema, { ...row, top: point(row.top), bottom: point(row.bottom) });
    this.profile = profile === undefined ? this.row.profile : v.parse(CableProfileSchema, profile);
    this.landing = landing === undefined ? this.row.landing ?? this.row.bottom : v.parse(Landing, point(landing));
    this.layout = new CableLayout({ top: new Vector3(row.top.x, row.top.y, row.top.z),
      bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag }, this.profile !== undefined);
  }
  get isRiding(): boolean { return this.riding; }
  get distance(): number { return this.motion.s; }
  /** Current source-clock cable speed; presentation borrows it without owning ride state. */
  get speed(): number { return this.motion.v; }
  get len(): number { return this.layout.len; }
  /** Direct anchors release along the level wire heading; deck rides keep the cable's full direction. */
  get dir(): Vector3 { return this.profile === undefined ? this.layout.dir : this.layout.flat; }
  at(s: number, out: Vector3): Vector3 { return this.layout.at(s, out); }
  start(): void {
    if (this.riding) return;
    this.riding = true; this.motion.s = this.profile?.start ?? 0.4; this.motion.v = this.profile?.landing.velocity ?? 2.5;
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
  /** Update the borrowed rider and report whether the cable still carries them. */
  update(dt: number, player: { position: Vector3; velocity: Vector3 }): boolean {
    if (!this.riding) return false;
    const holding = this.step(this.motion, dt);
    this.rider(this.motion.s, player.position); player.velocity.set(0, 0, 0);
    if (!holding) {
      this.riding = false;
      if (this.profile === undefined) {
        const dir = this.layout.dir;
        player.velocity.set(dir.x * Math.min(6, this.motion.v * 0.4), 1.5, dir.z * Math.min(6, this.motion.v * 0.4));
        this.layout.park(this.point);
      } else this.dismount(this.landing, player.position.y, player.position, player.velocity);
      this.onRide(false);
    }
    return this.riding;
  }
  snapshot(): v.InferOutput<typeof Saved> { return { riding: this.riding, s: this.motion.s, v: this.motion.v }; }
  /** Refusal is atomic; restore never starts a ride, moves a body or publishes a callback. */
  restore(value: unknown): void {
    const saved = v.parse(Saved, value);
    if (saved.v > this.row.maxSpeed) throw new Error('Zipline continuation exceeds its admitted speed');
    this.riding = saved.riding; this.motion.s = saved.s; this.motion.v = saved.v;
  }
}

/** A ride prompt shaped like the engine's interactable: hidden (radius 0) while its ride runs. */
export interface ZiplinePrompt { readonly position: Vector3; readonly radius: number; readonly label: string; readonly onInteract: () => void }
/** The cable a trolley rides: a point at arc distance `s` and the heading it turns across (CableLayout, ZiplineDriver). */
export interface TrolleyCable { readonly at: (s: number, out: Vector3) => Vector3; readonly dir: Vector3 }
/**
 * A cable's drawn trolley and its ride prompt. It rests at `rest` metres down the
 * cable, turned across its heading, and follows a cable distance with a small roll; the caller keeps the ride clock (a
 * driver's own or a `step` state), the mesh, its material and the player. No clock or service is installed.
 */
export class ZiplineTrolley {
  readonly prompt: ZiplinePrompt;
  readonly object: Object3D;
  private readonly cable: TrolleyCable;
  private readonly rest: number;
  constructor(cable: TrolleyCable, rest: number, object: Object3D, at: { readonly position: Vector3; readonly radius: number; readonly label: string }, riding: () => boolean, start: () => void) {
    this.cable = cable; this.rest = rest; this.object = object;
    this.prompt = { position: at.position, get radius() { return riding() ? 0 : at.radius; }, label: at.label, onInteract: start };
    this.park();
  }
  park(): void { this.cable.at(this.rest, this.object.position); this.object.rotation.set(0, Math.atan2(this.cable.dir.x, this.cable.dir.z) + Math.PI / 2, 0); }
  /** the trolley at cable distance `s`, rolling a little along the wire */
  follow(s: number): void { this.cable.at(s, this.object.position); this.object.rotation.z = Math.sin(s * 0.7) * 0.05; }
}

/** Borrowed rider state, never a per-shard movement callback. */
interface CableRider { readonly position: Vector3; readonly velocity: Vector3; carried?: boolean }
/** Native carry also lends the existing reward pose, without a second player or clock. */
export interface NativeCableRider { readonly position: Vector3; readonly velocity: Vector3; carried: boolean; yaw: number; pitch: number }
interface CableEntry {
  readonly row: ZiplineMode; readonly driver: ZiplineDriver;
  readonly events: boolean[]; roll: number; rider?: CableRider; native?: NativeCableRider;
  view?: { trolley: ZiplineTrolley; rider: CableRider; camera?: { rotation: { z: number } } };
}
/**
 * Declared cable owners keyed by admitted mode identity. The caller retains its clock and save envelope; this owner
 * advances the original ZiplineDriver, carries/releases the borrowed player, and publishes the row's completion flag.
 * state/start is the quest mechanic registry: unknown identities refuse, with no fallback or second driver.
 */
export class CableTraversal {
  private readonly entries = new Map<string, CableEntry>();
  private readonly flags: Pick<Flags, 'set' | 'has'>;
  private readonly rider = { position: new Vector3(), velocity: new Vector3() };
  constructor(rows: ModeRows['traverse'], flags: Pick<Flags, 'set' | 'has'>) {
    this.flags = flags;
    for (const row of parseModes({ traverse: rows }).traverse) if (row.kind === 'zipline') {
      this.entries.set(row.id, { row, driver: new ZiplineDriver(row), events: [], roll: 0 });
    }
  }
  private entry(id: string): CableEntry {
    const entry = this.entries.get(id);
    if (entry === undefined) throw new Error(`Unknown cable mode: ${id}`);
    return entry;
  }
  /** The live driver state; a completed legacy save may retain only its declared completion flag. */
  state(id: string): { riding: boolean; atEnd: boolean } {
    const { driver, row } = this.entry(id);
    return { riding: driver.isRiding, atEnd: !driver.isRiding && (driver.distance >= driver.len - (row.profile?.release ?? 1.6)
      || row.lifecycle !== undefined && this.flags.has(row.lifecycle.endFlag)) };
  }
  start(id: string): void {
    const entry = this.entry(id);
    if (entry.driver.isRiding) return;
    if (entry.events.length >= 2) throw new Error('Cable presentation transitions were not consumed');
    entry.driver.start(); entry.roll = 0; this.transition(entry, true);
    if (entry.row.lifecycle?.carry === 'start' && entry.rider !== undefined) entry.rider.carried = true;
  }
  private transition(entry: CableEntry, riding: boolean): void {
    if (entry.events.length >= 2) throw new Error('Cable presentation transitions were not consumed');
    entry.events.push(riding);
  }
  /** The admitted row, for geometry/landing preflight without a second authored declaration. */
  declaration(id: string): Readonly<ZiplineMode> { return this.entry(id).row; }
  /** The native mode host lends the real carry/reward pose once, before any quest or restore runs. */
  bindNative(host: SimHost): void {
    for (const entry of this.entries.values()) {
      if (entry.native !== undefined || entry.view !== undefined) throw new Error('Cable native owner is already bound');
      const rider: NativeCableRider = { position: entry.row.lifecycle?.native === 'position' ? host.player.position : new Vector3(),
        velocity: new Vector3(), pitch: 0, carried: false,
        get yaw(): number { return host.player.yaw; }, set yaw(value: number) { host.player.yaw = value; } };
      entry.native = rider; entry.rider = rider;
    }
  }
  /** The actual installed carry pose; other platform mechanics borrow it rather than copying its state. */
  nativeRider(id: string): NativeCableRider {
    const rider = this.entry(id).native;
    if (rider === undefined) throw new Error(`Cable native owner is not bound: ${id}`);
    return rider;
  }
  /** Borrow the actual native carry state, including another mechanic that may own it while the cable is idle. */
  bindRider(id: string, rider: CableRider): void { this.entry(id).rider = rider; }
  /** View-only transitions, in command/update order; native callers do not accumulate presentation events. */
  takeTransitions(id: string): readonly boolean[] { return this.entry(id).events.splice(0); }
  /** Bind a borrowed trolley, prompt and optional camera to the existing continuation, never a private controller. */
  bindView(id: string, object: Object3D, rider: CableRider,
    prompt: { position: Vector3; radius: number; label: string }, camera?: { rotation: { z: number } }): ZiplinePrompt {
    const entry = this.entry(id), driver = entry.driver;
    if (entry.view !== undefined) throw new Error(`Cable view already bound: ${id}`);
    const trolley = new ZiplineTrolley(driver, entry.row.presentation?.park ?? 0.6, object, prompt,
      () => driver.isRiding, () => { this.start(id); });
    entry.rider = rider;
    entry.view = { trolley, rider, ...(camera === undefined ? {} : { camera }) };
    return trolley.prompt;
  }
  private advance(entry: CableEntry, dt: number, rider: CableRider): boolean {
    const holding = entry.driver.update(dt, rider);
    if (rider.carried !== undefined) rider.carried = holding;
    return holding;
  }
  private release(entry: CableEntry): void {
    if (entry.row.lifecycle !== undefined) this.flags.set(entry.row.lifecycle.endFlag);
    this.transition(entry, false);
  }
  /** Page update at the caller's original phase, including the last release-frame wind roll. */
  update(id: string, dt: number): void {
    const entry = this.entry(id), view = entry.view;
    if (view === undefined) throw new Error(`Cable view is not bound: ${id}`);
    if (!entry.driver.isRiding) return;
    const holding = this.advance(entry, dt, view.rider);
    view.trolley.follow(entry.driver.distance);
    const wind = entry.row.presentation?.wind;
    if (wind !== undefined && view.camera !== undefined) {
      entry.roll += dt;
      view.camera.rotation.z += Math.sin(entry.roll * wind.frequency) * wind.amplitude * (entry.driver.speed / entry.row.maxSpeed);
    }
    if (!holding) { view.trolley.park(); this.release(entry); }
  }
  /** Native update on its existing quest step. Motor teleports and walking impulses preserve the declared carry law. */
  updateNative(id: string, dt: number, host: SimHost): void {
    const entry = this.entry(id), rider = entry.rider ?? this.rider;
    entry.events.length = 0;
    if (!entry.driver.isRiding) return;
    const holding = this.advance(entry, dt, rider);
    if (entry.row.lifecycle?.native === 'motor') {
      host.player.motor.resetAt(rider.position); host.player.position.copy(rider.position);
      host.playerFall.vy = 0; host.playerFall.grounded = false;
      if (!holding) host.impulsePlayer(rider.velocity);
    }
    if (!holding) this.release(entry);
    entry.events.length = 0;
  }
  /** Existing owner envelopes keep their bytes; no new save owner or live restore effects. */
  snapshot(id: string): ReturnType<ZiplineDriver['snapshot']> { return this.entry(id).driver.snapshot(); }
  restore(id: string, value: unknown): void { const entry = this.entry(id); entry.driver.restore(value); entry.events.length = 0; }
}
