import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { DRIFTWOOD_AUDIO } from './data/audio';
import { DRIFTWOOD_EDGE_HEIGHTS } from './data/edges';

// SF46 step 1: content and the existing look stay in the declared trusted entry until the grid-ready bake lands.
// SF46 edges (G93 / G99 / G134): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand on
// Driftwood's real boundary rows (./data/edges.ts); the hybrid world lowers the sea to 0 and starts each pier / jetty past
// the 15 m asphalt socket (world/sea.ts).
const row = (heights: readonly number[]): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } =>
  ({ heights: [...heights], colours: heights.map((): [number, number, number] => [0.5, 0.5, 0.5]), roadHeight: 0 });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...emptyShardfile({ slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 1, seed: 0x5ea1 }),
  accent: 'marigold',
  runtime: { entry: 'runtime/hybrid.ts' },
  edge: { north: row(DRIFTWOOD_EDGE_HEIGHTS.north), east: row(DRIFTWOOD_EDGE_HEIGHTS.east), south: row(DRIFTWOOD_EDGE_HEIGHTS.south), west: row(DRIFTWOOD_EDGE_HEIGHTS.west) },
  audio: DRIFTWOOD_AUDIO,
  spawn: { x: 0, y: 1.2, z: -194, yaw: Math.PI },
});
