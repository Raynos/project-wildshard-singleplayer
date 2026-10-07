import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';
import source from '../shard.config';
import { LIFT_MODULE } from '../data/liftModule';
import type { BuiltWorld } from '../world/build';

const BRIDGES = '1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd';
const modules = new Map([[BRIDGES, new URL('../assets/1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', import.meta.url).href],
  [LIFT_MODULE.hash, new URL('../assets/f8f90ba2e03401910448a2af1e8b02420bc7b2e1003076bc6241d9cb0c688a22', import.meta.url).href]]);
/** SF49-g (G183): the Rising Islets' rows and their road gates (the platform carries their riders; the plugin draws them). */
const isIslet = (id: string): boolean => id.startsWith('far.islet.');
/**
 * SF8c socketLift: the bridges stay this recipe's rows; the islets and their gates are the shardfile's compiled `movers`
 * (shard.config.ts), the exact rows `wildshard validate` proves, installed once on this one host (no second body or host).
 */
export const SKY_MOVERS = [...MOVERS.filter((row) => !isIslet(row.id)), ...source.movers];
/**
 * Legacy presentation reads script fields; no context, world allocation or tick installer lives in this shard recipe.
 * The bridges are adopted (their pieces collide); the islets are not, so the platform gives each its KinematicMover body,
 * which carries the rider, and the plugin draws them from the published poses.
 */
export function skyMoverViews(built: BuiltWorld, permissions: () => number, raised: () => void, onDispose: () => void): MoverInstallation {
  const data = SKY_MOVERS;
  const views = new Map<string, MoverView>(data.filter((row) => !isIslet(row.id)).map((row) => [row.id, { pose: (pose, fields) => {
    if (row.id !== 'far.winch.bridge') return;
    const previouslyRaised = built.state.raised;
    built.fallen.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z, 'YXZ');
    built.state.raised = pose.enabled; built.state.raising = fields[6] === 1;
    if (!previouslyRaised && built.state.raised) raised();
  } }]));
  return { data, modules, views, systemId: 'far.movers', permissions: () => new Map([['far.winch.bridge', permissions()]]), onDispose };
}
