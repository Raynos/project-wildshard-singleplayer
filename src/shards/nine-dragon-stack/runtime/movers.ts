import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';
import { LIFT_MODULE } from '../data/liftModule';
import source from '../shard.config';

const modules = new Map([[LIFT_MODULE.hash, new URL('../assets/734a577c8466d8bac0530cdef2929cc00e9ddd9120a453d0b0b4576e336b5cda', import.meta.url).href]]);
const declared = new Set(source.movers.map((row) => row.id));
/**
 * SF8c socketLift: the cage and its stationary road gate are the shardfile's compiled `movers` (shard.config.ts), the exact
 * rows `wildshard validate` proves, installed once on this one host (no second body or host); the cage's own gates and its
 * two shaft doors stay this recipe's rows on the same module, sent the same commands (world/liftRide.ts).
 */
export const ND_MOVERS = [...source.movers, ...MOVERS.filter((row) => !declared.has(row.id))];

/**
 * SF51-p (G184): the lantern lifts' mover rows (behaviour/lift.as). None is adopted: the platform gives each its own
 * KinematicMover body (the cage carries the rider, the gates and doors collide as the script says); the cage's drawn
 * object follows its row's published pose from the fixed step (the plugin's per-frame system reads `pose`).
 */
export function liftMoverViews(onDispose: () => void): MoverInstallation {
  const views = new Map<string, MoverView>();
  return { data: ND_MOVERS, modules, views, systemId: 'shard.nd.lifts', onDispose };
}
