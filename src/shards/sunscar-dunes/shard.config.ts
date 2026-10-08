import { SIGNAL_DUNES_RUNTIME_COST } from './budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { AUDIO } from './data/audio';
import { SIGNAL_DUNES_EDGES } from './data/edges';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF50-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH, kind
// ground) stand on Signal Dunes' real boundary rows (./data/edges.ts, the committed bake's): the engine's entry roads already
// hold each midpoint at exactly road height (17.6 m of zero samples at the edge, flat 47 m in), so each 8 × 15 m
// socket footprint is flat at y = 0, clear and dry with no change to the world.
const row = (side: keyof typeof SIGNAL_DUNES_EDGES): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => ({
  heights: [...SIGNAL_DUNES_EDGES[side].heights], colours: SIGNAL_DUNES_EDGES[side].colours.map(([r, g, b]): [number, number, number] => [r, g, b]), roadHeight: 0,
});
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...emptyShardfile({ slug: 'sunscar-dunes', name: 'Signal Dunes', author: 'Wildshard', revision: 1, seed: 5363 }), accent: 'orchid', runtime: { entry: 'runtime/index.ts', cost: SIGNAL_DUNES_RUNTIME_COST }, audio: AUDIO,
  edge: { north: row('north'), east: row('east'), south: row('south'), west: row('west') } });
