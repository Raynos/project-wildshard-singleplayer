import { parseClientChannels } from '@wildshard/format/clientChannels';
import NALATI_FEATS from '../data/feats.json' with {type:'json'};
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import heldWeapons from '../data/heldWeapons.generated.json' with {type:'json'};
import stealth from '../data/stealth.generated.json' with {type:'json'};
import { compactChannels } from './channelRows';
import speciesData from '../data/species.generated.json' with { type: 'json' };
import skyDome from '../data/skyDome.json' with { type: 'json' };
import weatherDecision from '../behaviour/weather.generated.json' with { type: 'json' };
import pasture from '../behaviour/pasture.generated.json' with { type: 'json' };
import charge from '../data/eliteCharge.generated.json' with { type: 'json' };
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import peopleChannels from '../data/peopleChannels.generated.json' with { type: 'json' };
import weatherChannels from '../data/weatherChannels.generated.json' with {type:'json'};
import herdChannels from '../data/herdChannels.generated.json' with { type: 'json' };
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import audio from '../data/audio.generated.json' with {type:'json'};
import { NALATI_EDGES } from './edges';
import NALATI_RUNTIME_COST from '../data/runtimeCost.json' with { type: 'json' };
import questContent from '../data/questContent.json' with { type: 'json' };
import NALATI_LEDGER from '../data/ledger.json' with { type: 'json' };
import { parseLedgerRules } from '@wildshard/sdk/ledger';
import NALATI_STATE from '../data/state.json' with { type: 'json' };
import items from '../data/items.json' with { type: 'json' };
import NALATI_RUNTIME_SPAWNS from '../data/spawns.json' with { type: 'json' };
import navigation from '../data/navigation.generated.json' with { type: 'json' };
import queryTerrain from '../data/terrain.generated.json' with { type: 'json' };
import lookGraphs from '../data/lookGraphs.json' with { type: 'json' };
import presentationGraphs from '../data/painterlyGraphs.json' with { type: 'json' };
import kokpar from '../data/kokpar.generated.json' with { type: 'json' };
import titanProgram from '../behaviour/titan.generated.json' with { type: 'json' };
import renderTiles from '../data/renderTiles.json' with { type: 'json' };
import kingPose from '../data/goldenKingPose.generated.json' with { type: 'json' };
import admission from '../behaviour/admission.generated.json' with { type: 'json' };
import creatureViews from '../behaviour/creatureViews.generated.json' with { type: 'json' };

// The existing plugin remains the trusted world entry while its audio comes from the shardfile.
// SF48-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand
// on Nalati's real boundary rows (./generators/edges.ts, the committed bake's): N23 already cut each midpoint through the berm as a
// gap at exactly road height (17.6 m of zero samples, 35 m and more deep), so each 8 × 15 m socket footprint is flat at
// y = 0, clear and dry with no change to the world (progress/shard-platform/sf48/grid-entries.json).
const row = (side: keyof typeof NALATI_EDGES): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => ({
  heights: [...NALATI_EDGES[side].heights], colours: NALATI_EDGES[side].colours.map(([r, g, b]): [number, number, number] => [r, g, b]), roadHeight: 0,
});
const base = emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 0x4a1a });
// G384: the creatures' navigation is the platform's WSNM row over the original bytes (generators/navigation.ts), and the
// ground's native lattice is query-only terrain (generators/terrain.ts: no render tiles; the bound runtime keeps rendering
// and collision), both charged to the server's memory and the sim budget at their actual decoded cost.
const files = [...navigation.files, ...queryTerrain.files].sort((a, b) => a.hash.localeCompare(b.hash));
// M2 (G518): the ground's baked L0 render tiles (generators/bake-render-tiles.mjs), bound by the runtime: the painted
// ground draws them in its own material behind the Debug row groundTiles; the files stay out of the sim budgets below
const resident = files.reduce((sum, file) => sum + file.decoded, 0);
const programs = [heldWeapons.program,stealth.program,speciesData.program,weatherDecision,kokpar.program,kokpar.course, admission, pasture, ...Object.values(titanProgram), ridingPrograms.approach, ridingPrograms.breaking, ridingPrograms.riding, charge];
const programBytes = programs.filter((program,index,all)=>all.findIndex(entry=>entry.script.module===program.script.module)===index).reduce((sum, program) => sum + atob(program.bytes).length, 0);
// Retain the legacy witness allowance and account for the one selected v2
// module, shared by attack/rules in the original construction scope.
const projection = titanProgram.attack.v2;
const programMemory = programs.reduce((sum, program) => sum + program.script.pages * 65536 * 2, programBytes)
  + atob(projection.bytes).length + projection.artifact.pages * 65536 * 2;
// the creature view module (behaviour/creatureViews.as): its live and last-good pages on the client
const viewMemory = creatureViews.pages * 65536 * 2;
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base,
  navigation: navigation.navigation, terrain: queryTerrain.terrain, files: [...files, ...renderTiles.files].sort((a, b) => a.hash.localeCompare(b.hash)), critical: [...navigation.critical, ...queryTerrain.critical],
  tiles: renderTiles.tiles, props: renderTiles.props,
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + resident + programMemory },
  budgets: { ...base.budgets, library: { ...base.budgets.library, resident: base.budgets.library.resident + viewMemory }, sim: { resident: files.reduce((sum, file) => sum + file.decoded + file.gpu, 0) + programMemory, compressed: files.reduce((sum, file) => sum + file.compressed, 0) + programBytes } },
  look: { ...base.look, materials: { ...base.look.materials, ...Object.fromEntries(Object.entries({ ...lookGraphs, ...presentationGraphs, 'nalati-sky-dome': skyDome }).map(([id, graph]) => [id, { family: 'graph' as const, graph }])) } },
  accent: 'ember', runtime: { entry: 'runtime/index.ts', cost: NALATI_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'clientChannels', 'terrain', 'props'], spawns: NALATI_RUNTIME_SPAWNS },
  clientChannels: compactChannels([...Object.values(speciesData.poses).flatMap(pose => parseClientChannels(pose.programs)),...kingPose.programs,...herdChannels.clientChannels,...weatherChannels.clientChannels,...peopleChannels.clientChannels]),
  modes: ecology.modes, quests: {...questContent.quests,achievements:NALATI_FEATS}, ledger: parseLedgerRules(NALATI_LEDGER), state: NALATI_STATE, items, audio: audio.audio, spawn: { x: 0, y: 0, z: 232, yaw: 0 },
  edge: { north: row('north'), east: row('east'), south: row('south'), west: row('west') } });
