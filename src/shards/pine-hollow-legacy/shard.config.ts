import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { PINE_AUDIO } from './data/audio';
import { PINE_ITEMS } from './data/items';
import { PINE_LEDGER } from './data/ledger';
import { PINE_QUESTS } from './data/quests';
import { PINE_RUNTIME_SPAWNS } from './data/spawns';
import { PINE_STATE } from './data/state';
import { PINE_EDGE_HEIGHTS } from './data/edges';
import { PINE_RUNTIME_COST } from './data/runtimeCost';

// The trusted legacy entry keeps the live world; SF29 binds its existing audio to these rows.
// SF47-g edges (G93 / G99 / G103 / G131): the starter's four 8 m midpoint entryways (kind ground: Pine's terrain is the
// floor, flat at y = 0 through each canyon gap) stand on Pine's real boundary rows (./data/edges.ts, the committed bake's).
// The grid's terrain.bin reader paints no palette for Pine, so the colours stay its neutral grey.
const row = (heights: readonly number[]): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } =>
  ({ heights: [...heights], colours: heights.map((): [number, number, number] => [0.25, 0.25, 0.25]), roadHeight: 0 });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...emptyShardfile({ slug: 'pine-hollow-legacy', name: 'Pine Hollow', author: 'Wildshard', revision: 1, seed: 1337 }),
  accent: 'moss',
  edge: { north: row(PINE_EDGE_HEIGHTS.north), east: row(PINE_EDGE_HEIGHTS.east), south: row(PINE_EDGE_HEIGHTS.south), west: row(PINE_EDGE_HEIGHTS.west) },
  runtime: { entry: 'runtime/index.ts', cost: PINE_RUNTIME_COST, binds: ['quests', 'ledger', 'items', 'spawns', 'state'], spawns: PINE_RUNTIME_SPAWNS },
  quests: PINE_QUESTS, ledger: PINE_LEDGER, items: PINE_ITEMS, state: PINE_STATE, audio: PINE_AUDIO, spawn: { x: 0, y: 0, z: -235, yaw: Math.PI },
});
