import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';

const LIFT = '2d64743636ae029714cc6aacb8874029e76dd38850c444b4e3a409c4908ff147';
const modules = new Map([[LIFT, new URL('../assets/2d64743636ae029714cc6aacb8874029e76dd38850c444b4e3a409c4908ff147', import.meta.url).href]]);

/**
 * SF51-p (G184): the lantern lifts' mover rows (behaviour/lift.as). None is adopted: the platform gives each its own
 * KinematicMover body (the cage carries the rider, the gates and doors collide as the script says); the cage's drawn
 * object follows its row's published pose from the fixed step (the plugin's per-frame system reads `pose`).
 */
export function liftMoverViews(onDispose: () => void): MoverInstallation {
  const views = new Map<string, MoverView>();
  return { data: MOVERS, modules, views, systemId: 'shard.nd.lifts', onDispose };
}
