import * as v from 'valibot';
import type { PopulationWaveSpec, PopulationWaveTuning } from './waveRows';
import { parseDirectorStages } from '@wildshard/format/directorStages';
import { DirectorScriptStageLane, prepareEmbeddedDirector, type DirectorLane } from '@wildshard/game/plugin/director';
import { sampleCreatureGroup, type CreatureGroupGround, type CreatureGroupStream } from '@wildshard/game/plugin/brain';

/** a position */
interface BrainPoint { x: number; y: number; z: number }

/** Native body observations and motor port; the director never allocates or retires a body itself. */
export interface PopulationActor {
  position: BrainPoint; alive: boolean; hp: number; maxHp: number; lookWeight: number;
  setMotion: (yaw: number, speed: number, turn: number) => void;
}
/** Ordered native population effects, including the original placement RNG authority. */
export interface PopulationWavePorts<T extends PopulationActor> {
  night: () => number; errand: () => boolean; onErrandDone: () => void;
  /** the placement stream and the ground the roamer draw reads (sampleCreatureGroup's engine services) */
  readonly stream: CreatureGroupStream; readonly ground: CreatureGroupGround;
  shot: (name: string, actor: T) => void;
  spawn: (kind: string, x: number, z: number, yaw: number) => T;
  own: (actor: T) => void; release: (actor: T) => void; retire: (actor: T) => void; burst: (actor: T) => void;
}
interface Roamer<T> { a: T; flee: number }
interface Racer<T> { a: T; woke: boolean }
const finite = v.pipe(v.number(), v.finite());
const actorId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const Saved = v.strictObject({ version: v.literal(2), director: v.pipe(v.string(), v.maxLength(1000000)), spec: v.pipe(v.string(), v.maxLength(8192)),
  acc: v.pipe(finite, v.minValue(0), v.check(value => value < 1)),
  roam: v.pipe(v.array(v.strictObject({ id: actorId, flee: v.pipe(finite, v.minValue(0), v.maxValue(3.5)) })), v.maxLength(8)),
  race: v.pipe(v.array(v.strictObject({ id: actorId, woke: v.boolean() })), v.maxLength(8)) });
const headingTo = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);
/** Pine custom encounter wiring. Counted as shard code; night.as owns its decisions. */
export class PopulationWaveDirector<T extends PopulationActor> {
  private roam: Roamer<T>[] = [];
  private race: Racer<T>[] = [];
  private acc = 0;
  private readonly h: PopulationWavePorts<T>;
  private readonly spec: PopulationWaveSpec;
  private readonly contract: string;
  private readonly stages: DirectorScriptStageLane;
  private phase = -1;
  private night = 0;
  private due = false;
  private roamer: Roamer<T> | null = null;
  private racer: Racer<T> | null = null;
  private point: BrainPoint = { x: 0, y: 0, z: 0 };
  constructor(lane: DirectorLane, h: PopulationWavePorts<T>, spec: PopulationWaveSpec, stages: unknown, private readonly tuning: PopulationWaveTuning) {
    if (!Number.isInteger(spec.max) || spec.max < 1 || spec.max > tuning.actorLimit || tuning.actorLimit > 8 || spec.race.length > tuning.actorLimit || spec.roamKinds.length === 0) throw new RangeError('Invalid population wave bounds');
    this.h = h; this.spec = spec; this.contract = JSON.stringify(spec);
    const roamer = (): Roamer<T> => { if (this.roamer === null) throw new Error('Missing population roamer'); return this.roamer; };
    const racer = (): Racer<T> => { if (this.racer === null) throw new Error('Missing population racer'); return this.racer; };
    this.stages = new DirectorScriptStageLane(parseDirectorStages(stages), lane, { observe: () => this.observe(), emits: {
      source: 'matching', actions: new Map<string, (value: number) => void>([
        ['roam.move', value => { const r = roamer(); r.flee = value; r.a.setMotion(headingTo(this.point.x, this.point.z, r.a.position.x, r.a.position.z), this.tuning.escape.speed, this.tuning.escape.turn); }],
        ['roam.dawn', () => { const r = roamer(); this.h.own(r.a); r.flee = 0.01; this.h.shot(this.tuning.voices.flee, r.a); }],
        ['roam.retire', () => { const r = roamer(); this.h.burst(r.a); this.h.retire(r.a); r.flee = -1; }],
        ['race.listen', () => {
          const r = racer(); r.a.setMotion(headingTo(r.a.position.x, r.a.position.z, this.spec.face.x, this.spec.face.z), 0, this.tuning.listenTurn);
          r.a.lookWeight = 0;
        }],
        ['race.wake', () => { const r = racer(); r.woke = true; this.h.release(r.a); this.h.shot(this.tuning.voices.wake, r.a); }],
        ['population.clock', value => { this.acc = value; }],
        ['population.due', () => { this.due = true; }],
        ['race.finish', () => { this.race = []; this.h.onErrandDone(); }],
        ['race.spawn', () => { this.callRace(); }],
        ['roam.far', () => { const r = roamer(); this.h.retire(r.a); r.flee = -1; }],
        ['roam.spawn', () => { this.callRoamer(this.point, false); }],
      ]),
    } });
  }

  private observe(): Readonly<Record<string, number>> {
    const a = this.roamer?.a ?? this.racer?.a, p = this.point, region = this.spec.region;
    return { phase: this.phase, alive: Number(a?.alive ?? false), flee: this.roamer?.flee ?? 0,
      woke: Number(this.racer?.woke ?? false), distance: a === undefined ? 0 : Math.hypot(p.x - a.position.x, p.z - a.position.z),
      hurt: Number(a !== undefined && a.hp < a.maxHp), night: this.night,
      errand: Number(this.phase === 4 && this.race.length === 0 && this.h.errand()),
      'race-count': this.race.length, 'race-dead': Number(this.race.every(row => !row.a.alive)),
      'near-mill': Number(Math.hypot(p.x - this.spec.mill.x, p.z - this.spec.mill.z) < this.tuning.raceRange),
      'near-growth': Number(((p.x - region.x) / (region.ax * this.tuning.regionScale)) ** 2 + ((p.z - region.z) / (region.az * this.tuning.regionScale)) ** 2 < 1),
      'roam-count': this.roam.length, maximum: this.spec.max };
  }

  private deliver(phase: number): void { this.phase = phase; this.stages.changed(); }

  /** the roamers on the map now (dev / captures) */
  get count(): number { return this.roam.length + this.race.length; }

  /** dev / captures: call the roamers now, around `p`, and the millrace's */
  force(p: BrainPoint): void {
    const remaining = this.spec.max - this.roam.length;
    for (let i = 0; i < this.tuning.forceLimit; i++) { if (i >= remaining) break; this.callRoamer(p, true); }
    if (this.h.errand() && this.race.length === 0) this.callRace();
  }

  /** Preserve the shipping phase order; the AS handler alone owns thresholds, wake/flee decisions and the periodic clock. */
  advance(dt: number, p: BrainPoint): void {
    this.point = p; this.night = this.h.night(); this.due = false; this.phase = 0;
    this.stages.update(dt);
    for (let i = 0; i < this.tuning.actorLimit; i++) { const row = this.roam[i]; if (row === undefined) break; this.roamer = row; this.deliver(1); }
    this.roamer = null; this.compactRoam();
    for (let i = 0; i < this.tuning.actorLimit; i++) { const row = this.race[i]; if (row === undefined) break; this.racer = row; this.deliver(2); }
    this.racer = null; this.deliver(3);
    if (!this.populationDue()) return;
    this.deliver(4);
    for (let i = 0; i < this.tuning.actorLimit; i++) { const row = this.roam[i]; if (row === undefined) break; this.roamer = row; this.deliver(5); }
    this.roamer = null; this.compactRoam();
    this.deliver(6);
  }

  private populationDue(): boolean { return this.due; }

  private compactRoam(): void {
    let live = 0;
    for (let i = 0; i < this.tuning.actorLimit; i++) {
      const row = this.roam[i]; if (row === undefined) break;
      if (row.flee >= 0 && row.a.alive) this.roam[live++] = row;
    }
    this.roam.length = live;
  }

  /** One roamer in the old growth (sampleCreatureGroup rows): an elliptical area draw on compass bearings, 12 tries, kept
   *  inside a band around the player, off the King's clearing, within the map and above the water line, facing the player. */
  private callRoamer(p: BrainPoint, anywhere: boolean): void {
    const { region, exclude } = this.spec, kind = this.spec.roamKinds[this.roam.length % this.spec.roamKinds.length];
    if (kind === undefined) return;
    const at = sampleCreatureGroup({ kind, count: 1, herd: -1, variant: null, face: p,
      source: { kind: 'radial', centre: region, axes: [region.ax, region.az], bearing: 'compass', radius: [0, this.tuning.placement.radius], radiusLaw: 'area', attempts: this.tuning.placement.attempts },
      accept: { band: { x: p.x, z: p.z, min: (anywhere ? this.tuning.placement.near : this.tuning.placement.far)[0] ?? 0, max: (anywhere ? this.tuning.placement.near : this.tuning.placement.far)[1] ?? 0 }, clear: [{ x: exclude.x, z: exclude.z, r: exclude.blend + this.tuning.placement.excludeClear }],
        bound: this.tuning.placement.bound, minHeight: this.spec.water + this.tuning.placement.waterClear } }, this.h.stream, this.h.ground)[0];
    if (at === undefined) return;
    const a = this.h.spawn(kind, at.x, at.z, at.yaw);
    this.roam.push({ a, flee: 0 });
    this.h.shot(this.tuning.voices.call, a);
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
    return { version: 2, director: this.stages.snapshot(), spec: this.contract, acc: this.acc,
      roam: this.roam.map(row => ({ id: idOf(row.a), flee: row.flee })),
      race: this.race.map(row => ({ id: idOf(row.a), woke: row.woke })) };
  }

  /** Validate every actor before a silent atomic commit. No spawn, retire, control, sound, RNG or quest effect runs here. */
  prepareRestore(value: unknown, actor: (id: string) => T | null): () => void {
    const saved = v.parse(Saved, value);
    if (saved.spec !== this.contract || saved.roam.some(row => row.flee > this.tuning.fleeLimit) || saved.roam.length > this.spec.max
      || (saved.race.length > 0 && saved.race.length !== this.spec.race.length)) throw new RangeError('Incompatible population night population');
    const ids = [...saved.roam.map(row => row.id), ...saved.race.map(row => row.id)];
    if (new Set(ids).size !== ids.length) throw new RangeError('Duplicate population night actor');
    const resolve = (id: string): T => { const a = actor(id); if (a === null) throw new RangeError(`Missing population night actor ${id}`); return a; };
    const roam = saved.roam.map(row => ({ a: resolve(row.id), flee: row.flee }));
    const race = saved.race.map(row => ({ a: resolve(row.id), woke: row.woke }));
    if (new Set([...roam.map(row => row.a), ...race.map(row => row.a)]).size !== ids.length) throw new RangeError('Aliased population night actors');
    return () => { this.stages.restore(saved.director); this.roam = roam; this.race = race; this.acc = saved.acc; };
  }
}

/** Prepare a fresh independent population decision lane from its admitted declaration and built module bytes. */
export function preparePopulationModule(declaration: unknown, module: { readonly module: string; readonly bytes: string }, seed: number): Promise<() => DirectorLane> {
  return prepareEmbeddedDirector(declaration, module, seed);
}
