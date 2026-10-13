import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { creatureFloor } from '@wildshard/game/shardfile/homeKeeper';
import { SKY_FLOCK_ROWS } from '../data/spawns';
import { DECK } from '../data/layout';
import { ROC_ID } from '../data/rocFight';
import { installSpeciesHomes, type HeldSpeciesControl } from '@wildshard/game/plugin/brain';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES } from '../data/brains';

/** The death plane under the islands: manifest `world.killY` (DECK - 24). The headless test holds the two equal (the
 * manifest itself imports views). */
export const SKY_KILL_Y = DECK - 24;
/** The flock keeper's fixed-step id. */
export const FLOCK_STEP = 'far.flock';
/** The analytic placement floor of a structures-only world (game/shard/manifest `terrainFor`: y = -1000 m). */
export const SKY_ANALYTIC_FLOOR = -1000;

/** What the keeper is lent: the baked native specs by kind and the level seed (the shard identity: the creature manager's
 *  stream is `Rng(seed + 31)` once the level is installed). */
export interface SkyFlockPorts { readonly specs: ReadonlyMap<string, AnimalSimSpec>; readonly seed: number }

/**
 * Sky Reach's 13 declared bodies on the platform's species homes (`installSpeciesHomes`), as the shipping plugin and
 * creature manager run them: the eight flyers spawn at install, the five goats (`late`) on the first fixed step, each body
 * on the first WORLD floor under its island deck + 2 m (a flyer's ray from the level spawn's height, at its flight
 * altitude), with the manager's six draws from `Rng(level seed + 31)` and the goats' wander draws from the same stream. The
 * page's distance bands ('legacy': decisions at 10 Hz, the body every tick at any distance), the world's death plane, no
 * attack cap and no refill. The goat, ray and wisp run their rows; the Storm Roc's raptor body is its own.
 */
export function installSkyFlock(host: SimHost, ports: SkyFlockPorts, saved?: Readonly<SimSnapshot>): {
  /** The Storm Roc's body and brain (its encounter's port). */
  readonly roc: { readonly actor: AnimalSim; readonly body: HeldSpeciesControl };
  /** On restore, reinstall the landed goats after every other install-time registration (a no-op on a fresh boot). */
  land: () => void;
} {
  const rows = new Map(SKY_FLOCK_ROWS.map(row => [row.id, row]));
  const row = (id: string): (typeof SKY_FLOCK_ROWS)[number] => { const found = rows.get(id); if (found === undefined) throw new Error(`Undeclared Sky body ${id}`); return found; };
  /** creatureFloor: the first WORLD hit under the ray's start (a structure), else the analytic floor. */
  const floor = creatureFloor(host, () => SKY_ANALYTIC_FLOOR);
  const groundHeight = (x: number, z: number, fromY: number): number => floor(x, z, fromY).y;
  const brains = speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES);
  const keeper = installSpeciesHomes(host, { step: FLOCK_STEP, seed: ports.seed, specs: ports.specs, species: SKY_CREATURE_ROWS,
    brains, attackers: Infinity, think: { bands: { rate: () => 'legacy' } }, killY: SKY_KILL_Y,
    homes: SKY_FLOCK_ROWS.map(home => ({ id: home.id, kind: home.kind, at: home.at, yaw: home.yaw, respawn: 0, late: ports.specs.get(home.kind)?.flight === undefined })),
    place: id => { const home = row(id); return floor(home.at[0], home.at[1], home.kind === 'skyGoat' ? home.home.y + 2 : DECK + 2); },
    adopt: actor => { actor.groundHeight = groundHeight; }, home: id => row(id).home,
 }, saved);
  const actor = keeper.homes().find(home => home.id === ROC_ID)?.actor, body = actor === null || actor === undefined ? null : brains.held(actor.kind, actor);
  if (actor === null || actor === undefined || body === null) throw new Error('Sky Reach declares its held raptor body');
  return { roc: { actor, body }, land: keeper.settle };
}
