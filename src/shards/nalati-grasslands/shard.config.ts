import { NALATI_MODES } from './data/modes';
import { NALATI_FAR_HERD_CHANNELS } from './data/clientMotion';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { NALATI_AUDIO } from './data/audio';
import { NALATI_EDGES } from './data/edges';
import { NALATI_RUNTIME_COST } from './data/runtimeCost';
import { NALATI_QUEST_DATA } from './data/quests';
import { NALATI_LEDGER } from './data/ledger';
import { NALATI_STATE } from './data/state';
import { NALATI_ITEMS } from './data/items';
import { NALATI_RUNTIME_SPAWNS } from './data/spawns';
import navigation from './data/navigation.generated.json' with { type: 'json' };

// The existing plugin remains the trusted world entry while its audio comes from the shardfile.
// SF48-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand
// on Nalati's real boundary rows (./data/edges.ts, the committed bake's): N23 already cut each midpoint through the berm as a
// gap at exactly road height (17.6 m of zero samples, 35 m and more deep), so each 8 × 15 m socket footprint is flat at
// y = 0, clear and dry with no change to the world (progress/shard-platform/sf48/grid-entries.json).
const row = (side: keyof typeof NALATI_EDGES): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => ({
  heights: [...NALATI_EDGES[side].heights], colours: NALATI_EDGES[side].colours.map(([r, g, b]): [number, number, number] => [r, g, b]), roadHeight: 0,
});
const base = emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 0x4a1a });
// G384: the creatures' navigation is the platform's WSNM row over the original bytes (generators/navigation.ts), charged
// to the server's memory and the sim budget at its actual decoded cost.
const resident = navigation.files.reduce((sum, file) => sum + file.decoded, 0);
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base,
  navigation: navigation.navigation, files: navigation.files, critical: navigation.critical,
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + resident },
  budgets: { ...base.budgets, sim: { resident: navigation.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0), compressed: navigation.files.reduce((sum, file) => sum + file.compressed, 0) } },
  accent: 'ember', runtime: { entry: 'runtime/index.ts', cost: NALATI_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'clientChannels'], spawns: NALATI_RUNTIME_SPAWNS },
  clientChannels: NALATI_FAR_HERD_CHANNELS,
  modes: NALATI_MODES, quests: NALATI_QUEST_DATA, ledger: NALATI_LEDGER, state: NALATI_STATE, items: NALATI_ITEMS, audio: NALATI_AUDIO, spawn: { x: 0, y: 0, z: 232, yaw: 0 },
  edge: { north: row('north'), east: row('east'), south: row('south'), west: row('west') } });
