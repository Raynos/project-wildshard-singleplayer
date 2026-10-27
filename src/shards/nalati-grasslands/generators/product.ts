import { parseClientChannels } from '@wildshard/format/clientChannels';
import NALATI_FEATS from '../data/feats.json' with {type:'json'};
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import { compactChannels } from './channelRows';
import { SPECIES_POSES } from './speciesPoses';
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
import kingPose from '../data/goldenKingPose.generated.json' with { type: 'json' };
import admission from '../behaviour/admission.generated.json' with { type: 'json' };
import creatureViews from '../behaviour/creatureViews.generated.json' with { type: 'json' };
import eliteViews from '../behaviour/eliteViews.generated.json' with { type: 'json' };
import titanView from '../behaviour/titanView.generated.json' with { type: 'json' };
import titanFireView from '../behaviour/titanFireView.generated.json' with { type: 'json' };
import titanWhirlsView from '../behaviour/titanWhirlsView.generated.json' with { type: 'json' };

// The declared client plan owns the world and play phases; original runtime binds retain their data authority.
// SF48-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand
// on Nalati's real boundary rows (./generators/edges.ts, the committed bake's): N23 already cut each midpoint through the berm as a
// gap at exactly road height (17.6 m of zero samples, 35 m and more deep), so each 8 × 15 m socket footprint is flat at
// y = 0, clear and dry with no change to the world (progress/shard-platform/sf48/grid-entries.json).
const row = (side: keyof typeof NALATI_EDGES): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => ({
  heights: [...NALATI_EDGES[side].heights], colours: NALATI_EDGES[side].colours.map(([r, g, b]): [number, number, number] => [r, g, b]), roadHeight: 0,
});
const {scene,...audioRows}=audio.audio;
export const AUDIO_SCENE: typeof audio.audio.scene =scene;
const base = emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 0x4a1a });
// G384: the creatures' navigation is the platform's WSNM row over the original bytes (generators/navigation.ts), and the
// ground's native lattice is query-only terrain (generators/terrain.ts: no render tiles; the bound runtime keeps rendering
// and collision), both charged to the server's memory and the sim budget at their actual decoded cost.
const files = [...navigation.files, ...queryTerrain.files].sort((a, b) => a.hash.localeCompare(b.hash));
// M2 (G518): the ground's source-owned L0 render tiles, bound by the runtime: the painted
// ground draws them in its own material behind the Debug row groundTiles; the files stay out of the sim budgets below
const resident = files.reduce((sum, file) => sum + file.decoded, 0);
/** Explicit species costs supplied by an admitted source construction. */
export interface NalatiSpeciesProgramCosts {
  readonly program: { readonly script: { readonly module: string; readonly pages: number }; readonly bytes: string };
  readonly witnessBytes: number;
}

/** Explicit held executable and legacy witness charges from the same admitted source. */
export interface NalatiHeldProgramCosts {
  readonly program: NalatiSpeciesProgramCosts['program'];
  readonly stealthProgram: NalatiSpeciesProgramCosts['program'];
  readonly compiledBytes: number;
  readonly projectionPages: number;
}

const unknownRows = (value: unknown): value is readonly unknown[] => Array.isArray(value);
// Only unwrap the source envelope here. The existing full shard parser below
// admits every file, tile and props field with its unchanged defining schemas.
function renderRows(value: unknown): { files: readonly unknown[]; tiles: readonly unknown[]; props: object } {
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
    || !('files' in value) || !unknownRows(value.files) || !('tiles' in value) || !unknownRows(value.tiles)
    || !('props' in value) || typeof value.props !== 'object' || value.props === null || Array.isArray(value.props)) {
    throw new Error('Missing explicit render rows');
  }
  return { files: value.files, tiles: value.tiles, props: value.props };
}

/** Compose the complete header with caller-owned costs; retain original module deduplication and page charges. */
export function nalatiProductRows(species: NalatiSpeciesProgramCosts, held: NalatiHeldProgramCosts, render: unknown): ReturnType<typeof parseShardfile> {
  const renderTiles = parseShardfile({ ...base, ...renderRows(render) });
  if (!Number.isSafeInteger(species.witnessBytes) || species.witnessBytes < 0
    || !Number.isSafeInteger(species.program.script.pages) || species.program.script.pages < 1) throw new Error('Invalid species program costs');
  if (!Number.isSafeInteger(held.compiledBytes) || held.compiledBytes < 0
    || [held.projectionPages, held.program.script.pages, held.stealthProgram.script.pages].some(pages => !Number.isSafeInteger(pages) || pages < 1)) throw new Error('Invalid held program costs');
  const programs = [held.program,held.stealthProgram,species.program,weatherDecision,kokpar.program,kokpar.course, admission, pasture, titanProgram.attack,titanProgram.fire,titanProgram.wind,titanProgram.rules, ridingPrograms.approach, ridingPrograms.breaking, ridingPrograms.riding, charge];
  const programBytes = programs.filter((program,index,all)=>all.findIndex(entry=>entry.script.module===program.script.module)===index).reduce((sum, program) => sum + atob(program.bytes).length, weatherDecision.compiled.bytes+kokpar.compiled.bytes+admission.compiled.witnessBytes+titanProgram.compiled.witnessBytes+species.witnessBytes+ridingPrograms.compiled.witnessBytes+charge.compiled.bytes);
  // Retain the legacy witness allowance and account for the one selected v2
  // module, shared by attack/rules in the original construction scope.
  const projection = titanProgram.attack.v2;
  const ridingProjection=ridingPrograms.approach.v2;
  const pastureProjection=pasture.v2;
  const admissionProjection=admission.v2;
  const programMemory = programs.reduce((sum, program) => sum + program.script.pages * 65536 * 2, programBytes)
    + titanProgram.compiled.attack.bytes + projection.artifact.pages * 65536 * 2
    + held.compiledBytes + held.projectionPages * 65536 * 2
    + ridingPrograms.compiled.bytes+ridingProjection.artifact.pages*65536*2
    + titanProgram.compiled.pasture.bytes+pastureProjection.artifact.pages*65536*2
    + admission.compiled.bytes+admissionProjection.artifact.pages*65536*2;
  // the creature, elite and Titan view modules (behaviour/creatureViews.as, eliteViews.as, titanView.as, titanFireView.as, titanWhirlsView.as): their live and last-good pages on the client
  const viewMemory = (creatureViews.pages + eliteViews.pages + titanView.pages + titanFireView.pages + titanWhirlsView.pages) * 65536 * 2;
  return parseShardfile({ ...base,
    navigation: navigation.navigation, terrain: queryTerrain.terrain, files: [...files, ...renderTiles.files].sort((a, b) => a.hash.localeCompare(b.hash)), critical: [...navigation.critical, ...queryTerrain.critical],
    tiles: renderTiles.tiles, props: renderTiles.props,
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + resident + programMemory },
    budgets: { ...base.budgets, library: { ...base.budgets.library, resident: base.budgets.library.resident + viewMemory }, sim: { resident: files.reduce((sum, file) => sum + file.decoded + file.gpu, 0) + programMemory, compressed: files.reduce((sum, file) => sum + file.compressed, 0) + programBytes + held.compiledBytes + ridingPrograms.compiled.bytes+titanProgram.compiled.pasture.bytes+admission.compiled.bytes } },
    look: { ...base.look, materials: { ...base.look.materials, ...Object.fromEntries(Object.entries({ ...lookGraphs, ...presentationGraphs, 'nalati-sky-dome': skyDome }).map(([id, graph]) => [id, { family: 'graph' as const, graph }])) } },
    accent: 'ember', runtime: { kind: 'client-plan', cost: NALATI_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'clientChannels', 'terrain', 'props'], spawns: NALATI_RUNTIME_SPAWNS },
    clientChannels: compactChannels([...Object.values(SPECIES_POSES).flatMap(pose => parseClientChannels(pose.programs)),...kingPose.programs,...herdChannels.clientChannels,...weatherChannels.clientChannels,...peopleChannels.clientChannels]),
    modes: ecology.modes, quests: {...questContent.quests,achievements:NALATI_FEATS}, ledger: parseLedgerRules(NALATI_LEDGER), state: NALATI_STATE, items, audio: {...audioRows,sceneFile:'audio/scene.json'}, spawn: { x: 0, y: 0, z: 232, yaw: 0 },
    edge: { north: row('north'), east: row('east'), south: row('south'), west: row('west') } });
}

// oxlint-disable-next-line import/no-default-export -- Offline callers supply the same explicit admitted species costs.
export default nalatiProductRows;
