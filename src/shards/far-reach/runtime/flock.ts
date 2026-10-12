import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { castRay } from '@wildshard/engine/physics/query';
import type { SimHost } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { installHomeKeeper } from '@wildshard/game/shardfile/homeKeeper';
import { SKY_FLOCK_ROWS } from '../data/spawns';
import { DECK } from '../data/layout';
import { ROC_ID } from '../data/rocFight';
import { flockBrain } from './flockBrains';
import type { StormRocBrain } from './stormRocBrain';

/** The death plane under the islands: manifest `world.killY` (DECK - 24). The headless test holds the two equal (the
 * manifest itself imports views). */
export const SKY_KILL_Y = DECK - 24;
/** The flock keeper's fixed-step id. */
export const FLOCK_STEP = 'far.flock';
/** The analytic placement floor of a structures-only world (game/shard/manifest `terrainFor`: y = -1000 m). */
export const SKY_ANALYTIC_FLOOR = -1000;

/** What the keeper is lent: the baked native specs and each kind's variant scale range (the species rows). */
export interface SkyFlockPorts {
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  readonly ranges: ReadonlyMap<string, readonly [number, number]>;
  /** The level seed (shard identity): the creature manager's stream is `Rng(seed + 31)` once the level is installed. */
  readonly seed: number;
}

/**
 * Sky Reach's 13 declared bodies on the platform's home keeper (`installHomeKeeper`), as the shipping plugin and creature
 * manager run them: the eight flyers spawn at install, the five goats (`late`) on the first fixed step, each body on the
 * first WORLD floor under its island deck + 2 m (a flyer's ray from the level spawn's height, at its flight altitude),
 * with the manager's six draws from `Rng(level seed + 31)` and the goats' wander draws from the same stream. The page's
 * distance bands ('legacy': decisions at 10 Hz, the body every tick at any distance), the world's death plane, no attack
 * cap (every policy grants itself) and no refill. A stunned body holds instead of deciding (AnimalManager.think).
 */
export function installSkyFlock(host: SimHost, ports: SkyFlockPorts, saved?: Readonly<SimSnapshot>): {
  /** The Storm Roc's body and brain (its encounter's port). */
  readonly roc: { readonly actor: AnimalSim; readonly body: StormRocBrain<AnimalSim> };
  /** On restore, reinstall the landed goats after every other install-time registration (a no-op on a fresh boot). */
  land: () => void;
} {
  const rows = new Map(SKY_FLOCK_ROWS.map(row => [row.id, row]));
  /** creatureFloor: the first WORLD hit under the ray's start (a structure), else the analytic floor. */
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const;
  const floor = (x: number, z: number, fromY: number): { y: number; structure: boolean } => {
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - SKY_ANALYTIC_FLOOR + 1), sees);
    return hit === null ? { y: SKY_ANALYTIC_FLOOR, structure: false } : { y: hit.point.y, structure: true };
  };
  const groundHeight = (x: number, z: number, fromY: number): number => floor(x, z, fromY).y;
  const held: { roc: { actor: AnimalSim; body: StormRocBrain<AnimalSim> } | null } = { roc: null };
  const keeper = installHomeKeeper(host, { step: FLOCK_STEP, seed: ports.seed, specs: ports.specs, scales: ports.ranges, attackers: Infinity,
    homes: SKY_FLOCK_ROWS.map(row => ({ id: row.id, kind: row.kind, at: row.at, yaw: row.yaw, respawn: 0, late: ports.specs.get(row.kind)?.flight === undefined })),
    think: { bands: { rate: () => 'legacy' } }, killY: SKY_KILL_Y,
    place: id => { const row = rows.get(id); if (row === undefined) throw new Error(`Undeclared Sky body ${id}`);
      return floor(row.at[0], row.at[1], row.kind === 'skyGoat' ? row.home.y + 2 : DECK + 2); },
    adopt: actor => { actor.groundHeight = groundHeight; },
    policy: (kind, actor, _claim, rng) => {
      const home = rows.get(actor.entityId)?.home, label = ports.specs.get(kind)?.label;
      if (home === undefined || label === undefined) throw new Error(`Undeclared Sky body ${actor.entityId}`);
      const brain = flockBrain(kind, label, actor, home, { host, rng });
      if (brain.roc !== null && actor.entityId === ROC_ID) held.roc = { actor, body: brain.roc };
      return { ...brain, decide: dt => {
        if (!actor.stunned) { brain.decide(dt); return; }
        actor.setMotion(actor.yaw, 0, 1); actor.lookTarget.copy(host.player.position); actor.lookWeight = 1;
      } };
    } }, saved);
  const roc = held.roc; if (roc === null) throw new Error('Sky Reach declares the Storm Roc\'s body');
  return { roc, land: keeper.settle };
}
