/**
 * CompendiumTracker — the game hooks that feed CompendiumState, polled a few times a second (never per frame):
 *
 *   • an animal within HEAR m (the compass paw's range)                          → discovered
 *   • an animal in view: within SPOT m, inside the view cone, line of sight clear → seen (SEEN + 1 per individual)
 *   • a kill (`killed(animal)`, from AnimalManager.onKill)                        → taken, BEST = massKg × scale³
 *   • a place: within its radius × REACH                                          → discovered; inside its radius → seen
 *
 *   const tracker = new CompendiumTracker(state, { canSee: (from, to) => … });
 *   game.onUpdate((dt) => tracker.update(dt, camera, animals.animals));
 *   animals.onKill = (a) => { …; tracker.killed(a); };
 */
import type { CompendiumState } from './state';

interface V3 { x: number; y: number; z: number }
/** what the tracker reads off an Animal (src/entities/Animal.ts) */
export interface TrackedAnimal { kind: string; variant: string; alive: boolean; hidden: boolean; position: V3; scale: number }
/** the eye: position + unit view direction */
export interface TrackerEye { position: V3; forward: V3 }

export const HEAR = 120;
export const SPOT = 70;
/** half-angle of the spotting cone (rad): about a phone's horizontal field of view */
export const SPOT_CONE = 0.62;
/** a place is "heard of" from its radius × REACH */
export const REACH = 3;
const PERIOD = 0.25;

export interface TrackerOptions {
  /** a clear line from the eye to the animal (physics ray); absent = always clear */
  canSee?: (from: V3, to: V3) => boolean;
}

export class CompendiumTracker {
  private acc = 0;
  /** individuals already counted as seen this session (a herd you stare at is not 40 sightings) */
  private spotted = new WeakSet<TrackedAnimal>();
  private heard = new WeakSet<TrackedAnimal>();
  /** places the eye is standing in */
  private inside = new Set<string>();
  private readonly cosCone = Math.cos(SPOT_CONE);
  private readonly to = { x: 0, y: 0, z: 0 };

  constructor(private state: CompendiumState, private opts: TrackerOptions = {}) {}

  /** body mass of a kill: the entry's scale-1 mass × the individual's scale³ */
  massOf(a: TrackedAnimal): number {
    const e = this.state.matching(a.kind, a.variant).find((m) => m.massKg !== undefined);
    return e?.massKg !== undefined ? e.massKg * a.scale ** 3 : 0;
  }

  killed(a: TrackedAnimal): void {
    this.spotted.add(a);
    this.state.animalKilled(a.kind, a.variant, this.massOf(a));
  }

  update(dt: number, eye: TrackerEye, animals: readonly TrackedAnimal[]): void {
    this.acc += dt;
    if (this.acc < PERIOD) return;
    this.acc = 0;
    const p = eye.position, f = eye.forward;
    for (const a of animals) {
      if (!a.alive || a.hidden) continue;
      const dx = a.position.x - p.x, dy = a.position.y + 0.8 - p.y, dz = a.position.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > HEAR) continue;
      if (!this.heard.has(a)) { this.heard.add(a); this.state.animalNear(a.kind, a.variant); }
      if (d > SPOT || this.spotted.has(a) || d < 1e-3) continue;
      if ((dx * f.x + dy * f.y + dz * f.z) / d < this.cosCone) continue;
      this.to.x = a.position.x; this.to.y = a.position.y + 0.8; this.to.z = a.position.z;
      if (this.opts.canSee && !this.opts.canSee(p, this.to)) continue;
      this.spotted.add(a);
      this.state.animalSpotted(a.kind, a.variant);
    }
    for (const e of this.state.def.entries) {
      const pl = e.place;
      if (!pl) continue;
      const d = Math.hypot(pl.x - p.x, pl.z - p.z);
      const inside = d < pl.r;
      // a visit counts on the way in (VISITS + 1 each time you arrive, not each poll you stand there)
      if (inside && !this.inside.has(e.id)) this.state.placeVisited(e.id);
      else if (!inside && d < pl.r * REACH && !this.state.reached(e.id, 'discovered')) this.state.placeNear(e.id);
      if (inside) this.inside.add(e.id); else if (d > pl.r + 4) this.inside.delete(e.id); // 4 m of hysteresis at the edge
    }
  }
}
