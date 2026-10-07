import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';
import type { BuiltWorld } from '../world/build';

const BRIDGES = '1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', ISLET = '9e858467b8536bad90ccb55aa5213c5ad8e8a1f48ed0963f20cb250014bc90a7';
const modules = new Map([[BRIDGES, new URL('../assets/1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', import.meta.url).href],
  [ISLET, new URL('../assets/9e858467b8536bad90ccb55aa5213c5ad8e8a1f48ed0963f20cb250014bc90a7', import.meta.url).href]]);
/** SF49-g (G183): the Rising Islets' rows; they install only while the entries row is on. */
const isIslet = (id: string): boolean => id.startsWith('far.islet.');
/**
 * Legacy presentation reads script fields; no context, world allocation or tick installer lives in this shard recipe.
 * The bridges are adopted (their pieces collide); the islets are not, so the platform gives each its KinematicMover body,
 * which carries the rider, and the plugin draws them from the published poses.
 */
export function skyMoverViews(built: BuiltWorld, permissions: () => number, raised: () => void, onDispose: () => void, entries = false): MoverInstallation {
  const data = entries ? MOVERS : MOVERS.filter((row) => !isIslet(row.id));
  const views = new Map<string, MoverView>(data.filter((row) => !isIslet(row.id)).map((row) => [row.id, { pose: (pose, fields) => {
    if (row.id !== 'far.winch.bridge') return;
    const previouslyRaised = built.state.raised;
    built.fallen.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z, 'YXZ');
    built.state.raised = pose.enabled; built.state.raising = fields[6] === 1;
    if (!previouslyRaised && built.state.raised) raised();
  } }]));
  return { data, modules, views, systemId: 'far.movers', permissions: () => new Map([['far.winch.bridge', permissions()]]), onDispose };
}
