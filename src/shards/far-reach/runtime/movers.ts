import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';
import type { BuiltWorld } from '../world/build';

const modules = new Map([['9453386c27dba27025de07a77332893489dc0042345dac6cd8e6bf7cfce1703d', new URL('../assets/9453386c27dba27025de07a77332893489dc0042345dac6cd8e6bf7cfce1703d', import.meta.url).href]]);
/** Legacy presentation reads script fields; no context, world allocation or tick installer lives in this shard recipe. */
export function skyMoverViews(built: BuiltWorld, permissions: () => number, raised: () => void, onDispose: () => void): MoverInstallation {
  const views = new Map<string, MoverView>(MOVERS.map((row) => [row.id, { pose: (pose, fields) => {
    if (row.id !== 'far.winch.bridge') return;
    const previouslyRaised = built.state.raised;
    built.fallen.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z, 'YXZ');
    built.state.raised = pose.enabled; built.state.raising = fields[6] === 1;
    if (!previouslyRaised && built.state.raised) raised();
  } }]));
  return { data: MOVERS, modules, views, systemId: 'far.movers', permissions: () => new Map([['far.winch.bridge', permissions()]]), onDispose };
}
