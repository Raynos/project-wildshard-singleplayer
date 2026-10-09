import type { MoverInstallation, MoverView } from '@wildshard/game/shardfile/moverRuntime';
import { MOVERS } from '../data/movers';
import type { DriftwoodWorld } from '../world/build';

const modules = new Map([
  ['9a5171bc3dd84488aae9de29ebd07fdb12dfbd2500c45cf91cf37e5bbbc712f0', new URL('../assets/9a5171bc3dd84488aae9de29ebd07fdb12dfbd2500c45cf91cf37e5bbbc712f0', import.meta.url).href],
  ['1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', new URL('../assets/1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', import.meta.url).href],
]);
/** Legacy view recipes only; game/shardfile/moverRuntime owns script admission, world ports and all context access. */
export function driftwoodMoverViews(built: DriftwoodWorld): MoverInstallation | null {
  const { boat, bridgeDeck } = built; if (boat === null || bridgeDeck === null) return null;
  boat.moverDriven = true;
  const views = new Map<string, MoverView>([
    ['driftwood.boat', { pose: (pose) => { boat.setMoverPose(pose); } }],
    ['driftwood.bridge', { pose: () => { /* The existing model interpolates the engine-owned chain after physics. */ }, chain: bridgeDeck }],
  ]);
  return { data: MOVERS, modules, views, systemId: 'shard.driftwood.movers' };
}
