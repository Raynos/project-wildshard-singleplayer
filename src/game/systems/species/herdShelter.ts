import type { AnimalManager, Herd } from '@wildshard/engine/entities/AnimalManager';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';

/**
 * Grazing herds that shelter from the rain (SHARD-PLATFORM M3, a weather rule as data): through the rain every grazing
 * herd's wanders walk in under a big tree near it (its centre is held there from outside the AI: AnimalManager's own
 * wander logic walks stragglers back to it, through the `creature.wander-goal` answer `wanderGoal` gives) and, once the
 * rain is over, back home a while; then the herd is its own again. The shard gives the kinds that shelter, what counts as
 * a big tree, how far a herd looks for one and how long its old home is held, and the crown cover (a tree under thicker
 * cover is a better shelter).
 */

/** The rule as data. */
export interface HerdShelterLook {
  /** the herd kinds that shelter (a bear sits it out) */
  readonly kinds: readonly string[];
  /** a tree this tall (m) is a shelter */
  readonly bigTree: number;
  /** a herd looks this far (m) for one */
  readonly reach: number;
  /** seconds the old home is held after the rain, so the herd walks back out */
  readonly homeHold: number;
  /** metres past the trunk's radius the herd stands (under the crown, clear of the trunk) */
  readonly clear: number;
  /** the wander radius under the tree, and back home */
  readonly spotR: number;
  readonly homeR: number;
  /** rain over this shelters; under `dry` the hold counts down */
  readonly wet: number;
  readonly dry: number;
}

interface Shelter { home: { x: number; z: number }; spot: { x: number; z: number } | null; hold: number }

/** The herds' shelters through a shower (see the module's comment). */
export class HerdShelter {
  private readonly kinds: ReadonlySet<string>;
  private readonly big: readonly TreeInstance[];
  private readonly shelters = new Map<Herd, Shelter>();

  /** `animals` the herds, `trees` the forest, `coverAt` the crown cover 0..1 at (x, z), `look` the rule's numbers. */
  constructor(private readonly animals: AnimalManager, trees: readonly TreeInstance[], private readonly coverAt: (x: number, z: number) => number, private readonly look: HerdShelterLook) {
    this.kinds = new Set(look.kinds);
    this.big = trees.filter((t) => t.height >= look.bigTree);
  }

  private pick(hd: Herd): { x: number; z: number } | null {
    let best: TreeInstance | null = null, score = Infinity;
    for (const t of this.big) {
      const d = Math.hypot(t.x - hd.cx, t.z - hd.cz);
      if (d > this.look.reach) continue;
      const s = d - 0.8 * t.height - 12 * this.coverAt(t.x, t.z);
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

  /** Dev evidence: every sheltering kind's member's distance to the nearest big tree — the mean, how many stand within 6 m. */
  stats(): { n: number; mean: number; under6: number; sheltering: number } {
    const d: number[] = [];
    for (const hd of this.animals.herds) if (this.kinds.has(hd.kind)) for (const m of hd.members) if (m.alive) {
      let best = Infinity;
      for (const t of this.big) best = Math.min(best, Math.hypot(t.x - m.position.x, t.z - m.position.z));
      d.push(best);
    }
    return { n: d.length, mean: Math.round(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length) * 10) / 10, under6: d.filter((v) => v < 6).length, sheltering: [...this.shelters.values()].filter((s) => s.spot !== null).length };
  }
}
