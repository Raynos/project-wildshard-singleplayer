import * as v from 'valibot';
// Pine Hollow's night thralls' brain (moved from the engine's ai folder, E405 LAYER-PURITY: the engine knows no thrall).
/** a position */
interface BrainPoint { x: number; y: number; z: number }

export interface NightActor {
  position: BrainPoint; alive: boolean; hp: number; maxHp: number; lookWeight: number;
  setMotion: (yaw: number, speed: number, turn: number) => void;
}
export interface NightSpec {
  max: number; region: { x: number; z: number; ax: number; az: number };
  exclude: { x: number; z: number; blend: number }; face: { x: number; z: number }; mill: { x: number; z: number };
  water: number; roamKinds: readonly string[]; race: readonly { kind: string; x: number; z: number }[];
}
export interface NightPorts<T extends NightActor> {
  night: () => number; errand: () => boolean; onErrandDone: () => void; next: () => number;
  height: (x: number, z: number) => number;
  shot: (name: 'thrall_call' | 'thrall_groan' | 'thrall_move', actor: T) => void;
  spawn: (kind: string, x: number, z: number, yaw: number) => T;
  own: (actor: T) => void; release: (actor: T) => void; retire: (actor: T) => void; burst: (actor: T) => void;
}
interface Roamer<T> { a: T; flee: number }
interface Racer<T> { a: T; woke: boolean }
const finite = v.pipe(v.number(), v.finite());
const actorId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const Saved = v.strictObject({ version: v.literal(1), spec: v.pipe(v.string(), v.maxLength(8192)),
  acc: v.pipe(finite, v.minValue(0), v.check(value => value < 1)),
  roam: v.pipe(v.array(v.strictObject({ id: actorId, flee: v.pipe(finite, v.minValue(0), v.maxValue(3.5)) })), v.maxLength(8)),
  race: v.pipe(v.array(v.strictObject({ id: actorId, woke: v.boolean() })), v.maxLength(8)) });
const headingTo = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);
/** Night population lifecycle; content supplies placement, creatures, rendering and quest ports. */
export class NightBrain<T extends NightActor> {
  private roam: Roamer<T>[] = [];
  private race: Racer<T>[] = [];
  private acc = 0;
  private readonly h: NightPorts<T>;
  private readonly spec: NightSpec;
  private readonly contract: string;
  constructor(h: NightPorts<T>, spec: NightSpec) { this.h = h; this.spec = spec; this.contract = JSON.stringify(spec); }

  /** the roamers on the map now (dev / captures) */
  get count(): number { return this.roam.length + this.race.length; }

  /** dev / captures: call the roamers now, around `p`, and the millrace's */
  force(p: BrainPoint): void {
    for (let i = this.roam.length; i < this.spec.max; i++) this.callRoamer(p, true);
    if (this.h.errand() && this.race.length === 0) this.callRace();
  }

  update(dt: number, p: BrainPoint): void {
    const night = this.h.night();
    // the dawn: every roamer runs for the deep trees and is gone
    for (const r of this.roam) {
      if (!r.a.alive) continue;
      if (r.flee > 0) {
        r.flee += dt;
        r.a.setMotion(headingTo(p.x, p.z, r.a.position.x, r.a.position.z), 8, 3);
        if (r.flee > 3.5) { this.h.burst(r.a); this.h.retire(r.a); r.flee = -1; }
      } else if (night < 0.35) { this.h.own(r.a); r.flee = 0.01; this.h.shot('thrall_move', r.a); }
    }
    this.roam = this.roam.filter((r) => r.flee >= 0 && r.a.alive);
    // the millrace: they stand listening until you come close or hit one
    for (const r of this.race) {
      const a = r.a;
      if (!a.alive || r.woke) continue;
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      a.setMotion(headingTo(a.position.x, a.position.z, this.spec.face.x, this.spec.face.z), 0, 1.5);
      a.lookWeight = 0;
      if (d < 20 || a.hp < a.maxHp) { r.woke = true; this.h.release(a); this.h.shot('thrall_groan', a); }
    }
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc = 0;
    // the millrace: all three down → the errand is done
    if (this.race.length > 0) {
      if (this.race.every((r) => !r.a.alive)) { this.race = []; this.h.onErrandDone(); }
    } else if (this.h.errand() && night > 0.5 && Math.hypot(p.x - this.spec.mill.x, p.z - this.spec.mill.z) < 75) this.callRace();
    // the roamers: called at night near the old-growth, let go when you are far
    const region = this.spec.region;
    const near = ((p.x - region.x) / (region.ax * 1.6)) ** 2 + ((p.z - region.z) / (region.az * 1.6)) ** 2 < 1;
    for (const r of this.roam) if (r.a.alive && r.flee === 0 && Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z) > 230) { this.h.retire(r.a); r.flee = -1; }
    this.roam = this.roam.filter((r) => r.flee >= 0 && r.a.alive);
    if (night > 0.55 && near && this.roam.length < this.spec.max) this.callRoamer(p, false);
  }

  private callRoamer(p: BrainPoint, anywhere: boolean): void {
    for (let tries = 0; tries < 12; tries++) {
      const ang = this.h.next() * Math.PI * 2, rr = Math.sqrt(this.h.next()) * 0.8;
      const x = this.spec.region.x + Math.sin(ang) * this.spec.region.ax * rr, z = this.spec.region.z + Math.cos(ang) * this.spec.region.az * rr;
      const dp = Math.hypot(x - p.x, z - p.z);
      if (!anywhere && (dp < 45 || dp > 150)) continue;
      if (anywhere && (dp < 18 || dp > 60)) continue;
      if (Math.hypot(x - this.spec.exclude.x, z - this.spec.exclude.z) < this.spec.exclude.blend + 8) continue;
      if (Math.abs(x) > 235 || Math.abs(z) > 235 || this.h.height(x, z) < this.spec.water + 0.6) continue;
      const kind = this.spec.roamKinds[this.roam.length % this.spec.roamKinds.length];
      if (kind === undefined) return;
      const a = this.h.spawn(kind, x, z, headingTo(x, z, p.x, p.z));
      this.roam.push({ a, flee: 0 });
      this.h.shot('thrall_call', a);
      return;
    }
  }

  private callRace(): void {
    this.spec.race.forEach(({ kind, x, z }) => {
      const a = this.h.spawn(kind, x, z, headingTo(x, z, this.spec.face.x, this.spec.face.z));
      this.h.own(a);
      this.race.push({ a, woke: false });
    });
  }

  /** Actors belong to the caller; continuation stores their identities and only this scheduler's lifecycle clocks. */
  snapshot(idOf: (actor: T) => string): v.InferOutput<typeof Saved> {
    return { version: 1, spec: this.contract, acc: this.acc,
      roam: this.roam.map(row => ({ id: idOf(row.a), flee: row.flee })),
      race: this.race.map(row => ({ id: idOf(row.a), woke: row.woke })) };
  }

  /** Validate every actor before a silent atomic commit. No spawn, retire, control, sound, RNG or quest effect runs here. */
  prepareRestore(value: unknown, actor: (id: string) => T | null): () => void {
    const saved = v.parse(Saved, value);
    if (saved.spec !== this.contract || saved.roam.length > this.spec.max
      || (saved.race.length > 0 && saved.race.length !== this.spec.race.length)) throw new RangeError('Incompatible Pine night population');
    const ids = [...saved.roam.map(row => row.id), ...saved.race.map(row => row.id)];
    if (new Set(ids).size !== ids.length) throw new RangeError('Duplicate Pine night actor');
    const resolve = (id: string): T => { const a = actor(id); if (a === null) throw new RangeError(`Missing Pine night actor ${id}`); return a; };
    const roam = saved.roam.map(row => ({ a: resolve(row.id), flee: row.flee }));
    const race = saved.race.map(row => ({ a: resolve(row.id), woke: row.woke }));
    if (new Set([...roam.map(row => row.a), ...race.map(row => row.a)]).size !== ids.length) throw new RangeError('Aliased Pine night actors');
    return () => { this.roam = roam; this.race = race; this.acc = saved.acc; };
  }
}
