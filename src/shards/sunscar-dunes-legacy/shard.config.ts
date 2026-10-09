import { SIGNAL_DUNES_RUNTIME_COST } from './budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { AUDIO } from './data/audio';
import tiles from './data/tiles.json' with { type: 'json' };
import { SIGNAL_LEDGER } from './data/ledger';
import { WHIP_ITEMS } from './data/items';
import { SIGNAL_SPAWNS } from './data/spawns';
import { SIGNAL_QUESTS } from './quests/signal';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF50-p / M3 (the runtime-owner binding): "The signal" quest, its ledger facts, the bullwhip and the creatures' homes and
// the Matriarch's body (runtime.spawns) are declared rows here; the trusted runtime owns the world and play scope and binds
// them (runtime.binds; @wildshard/game/shardfile/hybridRows).
// SF50-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH, kind
// ground) stand on Signal Dunes' real boundary rows: the engine's entry roads already hold each midpoint at exactly road
// height, so each 8 × 15 m socket footprint is flat at y = 0, clear and dry with no change to the world.
// M3 / G227 ("the shardfile is the bake"): the dune field is compiled into the shardfile's 62.5 m terrain tiles
// (generators/tiles.ts, scripts/bake-hybrid-tiles.mjs → ./data/tiles.json + ./assets/<sha256>), bound by the runtime
// (`runtime.binds: ['terrain']`: the data client installs none of it). The edge rows are the same bake's, so seams,
// collider and tiles agree exactly (within 8 cm of the old WSTR-read rows).
// The sim budget is exactly the critical collider's cost (the tiles are render residency, charged per tile).
const collider = tiles.files.filter((file) => tiles.critical.includes(file.hash));
const sim = { resident: collider.reduce((sum, file) => sum + file.decoded + file.gpu, 0), compressed: collider.reduce((sum, file) => sum + file.compressed, 0) };
const base = emptyShardfile({ slug: 'sunscar-dunes-legacy', name: 'Signal Dunes', author: 'Wildshard', revision: 1, seed: 5363 });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, budgets: { ...base.budgets, sim }, accent: 'orchid', runtime: { entry: 'runtime/index.ts', cost: SIGNAL_DUNES_RUNTIME_COST, binds: ['quests', 'ledger', 'items', 'spawns', 'terrain'], spawns: SIGNAL_SPAWNS }, audio: AUDIO,
  quests: SIGNAL_QUESTS, ledger: SIGNAL_LEDGER, items: WHIP_ITEMS,
  terrain: tiles.terrain, tiles: tiles.tiles, files: tiles.files, critical: tiles.critical, edge: tiles.edge });
