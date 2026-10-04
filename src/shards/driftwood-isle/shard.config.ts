import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { DRIFTWOOD_AUDIO } from './data/audio';
import { DRIFTWOOD_EDGE_HEIGHTS } from './data/edges';
import { DRIFTWOOD_RUNTIME_COST } from './data/runtimeCost';
import { WORLD_DROP } from './world/sea';

// SF46 step 1: content and the existing look stay in the declared trusted entry until the grid-ready bake lands.
// SF46 edges (G93 / G99 / G164): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand on
// Driftwood's real boundary rows (./data/edges.ts, the authored bake's) lowered with the whole world by WORLD_DROP; across
// each 8 m opening (and the sample either side its interpolation reads) the row is the platform's entry socket at road
// height, which the pier / jetty's sea-end ramp meets 15 m in (world/sea.ts).
const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 1, seed: 0x5ea1 });
const opening = Math.max(...base.entryways.map((row) => row.width)) / 2;
const lowered = (heights: readonly number[]): number[] => {
  const stride = 500 / (heights.length - 1);
  return heights.map((h, i) => (Math.abs(-250 + i * stride) <= opening + stride ? 0 : h - WORLD_DROP));
};
const row = (authored: readonly number[]): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => {
  const heights = lowered(authored);
  return { heights, colours: heights.map((): [number, number, number] => [0.5, 0.5, 0.5]), roadHeight: 0 };
};
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...base,
  accent: 'marigold',
  runtime: { entry: 'runtime/hybrid.ts', cost: DRIFTWOOD_RUNTIME_COST },
  edge: { north: row(DRIFTWOOD_EDGE_HEIGHTS.north), east: row(DRIFTWOOD_EDGE_HEIGHTS.east), south: row(DRIFTWOOD_EDGE_HEIGHTS.south), west: row(DRIFTWOOD_EDGE_HEIGHTS.west) },
  audio: DRIFTWOOD_AUDIO,
  spawn: { x: 0, y: 1.2, z: -194, yaw: Math.PI },
});
