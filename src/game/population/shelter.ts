import type { SimHost } from '@wildshard/engine/sim';
import { populationRoster } from './roster';
import { populationEnvironment } from './environment';
import { nativeWeatherContinuation } from '../plugin/weather';
import { parsePopulationShelter, type HerdShelterRows } from '@wildshard/format/herdShelter';
import * as v from 'valibot';

/**
 * Grazing herds that shelter from the rain (SHARD-PLATFORM M3, a weather rule as data): through the rain every grazing
 * herd's wanders walk in under a big tree near it (its centre is held there from outside the AI: AnimalManager's own
 * wander logic walks stragglers back to it, through the `creature.wander-goal` answer `wanderGoal` gives) and, once the
 * rain is over, back home a while; then the herd is its own again. The shard gives the kinds that shelter, what counts as
 * a big tree, how far a herd looks for one and how long its old home is held, and the crown cover (a tree under thicker
 * cover is a better shelter).
 */

interface Shelter { home: { x: number; z: number }; spot: { x: number; z: number } | null; hold: number }
interface Herd {
  kind: string; cx: number; cz: number;
  readonly members: readonly { alive: boolean; position: { x: number; z: number } }[];
}
interface Tree { x: number; z: number; r: number; height: number; cover: number }
const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, z: finite });
const saved = v.strictObject({ version: v.literal(1), shelters: v.array(v.nullable(v.strictObject({
  home: point, spot: v.nullable(point), hold: v.pipe(finite, v.minValue(0))
}))) });

/** The herds' shelters through a shower (see the module's comment). */
export class HerdShelter<T extends Tree> {
  private readonly kinds: ReadonlySet<string>;
  private readonly big: readonly T[];
  private shelters = new Map<Herd, Shelter>();

  /** `animals` lends the herds; each tree carries its fixed crown-cover sample; `look` supplies the rule's numbers. */
  constructor(private readonly animals: { readonly herds: readonly Herd[] }, trees: readonly T[], private readonly look: HerdShelterRows) {
    if (trees.length > 16384) throw new Error('Population shelter tree bound exceeded');
    this.kinds = new Set(look.kinds);
    this.big = trees.filter((t) => t.height >= look.bigTree);
  }

  private pick(hd: Herd): { x: number; z: number } | null {
    let best: T | null = null, score = Infinity;
    for (let index = 0; index < 16384; index++) {
      const t = this.big[index];
      if (t === undefined) break;
      const d = Math.hypot(t.x - hd.cx, t.z - hd.cz);
      if (d > this.look.reach) continue;
      const s = d - this.look.heightBias * t.height - this.look.coverBias * t.cover;
      if (s < score) { score = s; best = t; }
    }
    if (best === null) return null;
    const dx = hd.cx - best.x, dz = hd.cz - best.z, dl = Math.hypot(dx, dz) || 1;
    return { x: best.x + dx / dl * (best.r + this.look.clear), z: best.z + dz / dl * (best.r + this.look.clear) };
  }

  /** Each frame: through the rain every sheltering herd's centre is held under its tree; after it the hold counts down. */
  update(dt: number, rain: number): void {
    const raining = rain > this.look.wet;
    for (const hd of this.animals.herds) {
      if (!this.kinds.has(hd.kind)) continue;
      let s = this.shelters.get(hd);
      if (raining) {
        if (s === undefined) { s = { home: { x: hd.cx, z: hd.cz }, spot: this.pick(hd), hold: this.look.homeHold }; this.shelters.set(hd, s); }
        s.hold = this.look.homeHold;
        if (s.spot !== null) { hd.cx = s.spot.x; hd.cz = s.spot.z; }
      } else if (s !== undefined && rain < this.look.dry) {
        s.hold -= dt;
        if (s.hold <= 0) this.shelters.delete(hd);
      }
    }
  }

  /** Where herd `herd` wanders now: under its tree in the rain, back home after it; null when it is its own. */
  wanderGoal(herd: number, rain: number): { x: number; z: number; r: number } | null {
    const hd = this.animals.herds[herd];
    if (hd === undefined) return null;
    const s = this.shelters.get(hd);
    if (s === undefined) return null;
    if (rain > this.look.wet) return s.spot !== null ? { x: s.spot.x, z: s.spot.z, r: this.look.spotR } : null;
    return { x: s.home.x, z: s.home.z, r: this.look.homeR };   // the rain is over: back out to graze
  }

  /** Native v1 continuation in herd order; points never alias live state. */
  snapshot(): v.InferOutput<typeof saved> {
    return { version: 1, shelters: this.animals.herds.map(herd => {
      const shelter = this.shelters.get(herd);
      return shelter === undefined ? null : { home: { ...shelter.home }, spot: shelter.spot === null ? null : { ...shelter.spot }, hold: shelter.hold };
    }) };
  }

  /** Admit every legacy slot before replacing state, without moving a herd. */
  restore(value: unknown): void {
    const parsed = v.parse(saved, value), herds = this.animals.herds, next = new Map<Herd, Shelter>();
    if (parsed.shelters.length !== herds.length) throw new Error('Incompatible population rain-herd continuation');
    parsed.shelters.forEach((shelter, index) => {
      if (shelter === null) return;
      const herd = herds[index];
      if (herd === undefined || !this.kinds.has(herd.kind) || shelter.hold > this.look.homeHold) throw new Error('Incompatible Population shelter continuation');
      next.set(herd, shelter);
    });
    this.shelters = next;
  }

  /** Dev evidence: every sheltering kind's member's distance to the nearest big tree — the mean, how many stand within 6 m. */
  stats(): { n: number; mean: number; under6: number; sheltering: number } {
    const d: number[] = [];
    for (const hd of this.animals.herds) if (this.kinds.has(hd.kind)) for (const m of hd.members) if (m.alive) {
      let best = Infinity;
      for (const t of this.big) best = Math.min(best, Math.hypot(t.x - m.position.x, t.z - m.position.z));
      d.push(best);
    }
    return { n: d.length, mean: Math.round(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length) * 10) / 10, under6: d.filter((distance) => distance < 6).length, sheltering: [...this.shelters.values()].filter((s) => s.spot !== null).length };
  }
}

/** Native tree tuples are the page's exact crown-cover samples, kept in forest order. */
export type NativeShelterTree = readonly [x: number, z: number, radius: number, height: number, cover: number];

/** Install shelter over concrete roster, environment and weather ids. No shard
 * callback or deferred shard resolver is retained. Goals are plain observations,
 * published at the existing shelter step before the roster's AI decisions. */
export function installNativeHerdShelter(host: SimHost, trees: readonly NativeShelterTree[], input: unknown): HerdShelter<{ x: number; z: number; r: number; height: number; cover: number }> {
  const rows = parsePopulationShelter(input), environment = populationEnvironment(host, rows.environment);
  if (trees.length > 16384) throw new Error('Shelter tree bound exceeded');
  const source = { get herds() {
    const current = populationRoster(host, rows.roster).hunt.herds;
    if (current.length > rows.herdLimit) throw new Error('Shelter herd bound exceeded');
    return current;
  } };
  const shelter = new HerdShelter(source, trees.map(([x, z, r, height, cover]) => ({ x, z, r, height, cover })), rows.look);
  const publish = (): void => {
    const rain = nativeWeatherContinuation(host, rows.weather).rain, goals = environment.wanderGoals;
    goals.length = source.herds.length;
    for (let i = 0; i < goals.length; i++) goals[i] = shelter.wanderGoal(i, rain);
  };
  host.onStep(rows.step, dt => { shelter.update(dt, nativeWeatherContinuation(host, rows.weather).rain); publish(); }, {
    snapshot: () => shelter.snapshot(), restore: value => { shelter.restore(value); publish(); },
  });
  return shelter;
}
