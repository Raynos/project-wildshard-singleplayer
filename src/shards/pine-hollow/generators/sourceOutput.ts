import { pinePhysicsBytes, pinePhysicsSources } from './physics';
import { PINE_NATIVE_QUEST } from './nativeQuest';
import { TREE_REST_FILE, TREE_SET } from './treeSet';
import { NativeQuestCompositionSchema, NativeQuestServiceSpotsSchema, parseNativeQuestServiceSpots } from '@wildshard/format/nativeQuestComposition';
import forestWeather from '../data/forestWeather.json' with { type: 'json' };
import { forestStory } from './forestStory';
import { questPage } from './pageComposition';
import { pineSpots } from './spots';
import { rangedPage } from './rangedPage';
import { forestPage, LANDMARK_VIEW_BLOB } from './forestPage';
import { roamingCombatBlob } from './roamingCombat';
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import { CHAPTER_DIRECTOR } from './chapterDirector';
import { PINE_HULL_BOOK } from './riggedHulls';
import { pineCoatPages } from './coatPages';
import { pageLife } from './pageLife';
import { pineAmbientPerches } from './perchInputs';
import { returnGuest, returnRegistries } from './returnPrograms';
import logKit from '../data/logKit.json' with { type: 'json' };
import { PLACE_SETS } from './placeSets';
import { parseCoverAppearance } from '@wildshard/format/coverAppearance';
import coverAppearance from '../data/coverAppearance.json' with { type: 'json' };
import { parseQuestServiceActions, QuestServiceActionsSchema } from '@wildshard/format/questSteps';
import { pineKeyedSky } from './bake-keyed-sky.mjs';
import { ELITE_FEATURE_ROWS } from './eliteFeatureRows';
import { pineJournal } from './journal';
import { parseEliteFeature, spawnRegistries } from '@wildshard/sdk/rows';
import strings from '../data/strings.json' with { type: 'json' };
import clientPlan from '../data/clientPlan.json' with { type: 'json' };
import { worldScenes } from './worldScenes';
import { HELD_FINISHES, HELD_GEAR, HELD_TOOL_LIFETIME } from './heldGear';
import heldLoadout from '../data/loadout.json' with { type: 'json' };
import heldTuning from '../data/heldTuning.json' with {type:'json'};
import shelterLook from '../data/populationShelter.json' with { type: 'json' };
import { POPULATION_ENVIRONMENT } from './populationEnvironment';
import { POPULATION_ROSTER } from './population';
import { NIGHT_SPAWN, nightRegistries } from './nightSpawn';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';
import persistence from '../data/persistence.json' with {type:'json'};
import PINE_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import headlessEntries from '../data/entryWalk.json' with { type: 'json' };
import headlessAssembly from '../data/headlessAssembly.json' with { type: 'json' };
import { wildlifeDraw } from './wildlifeDraw';
import { pineBirds } from './birdInputs';
import directorData from '../data/director.json' with { type: 'json' };
import directorStages from '../data/watchStages.json' with { type: 'json' };
import { cabinAmbienceRows } from './ambience';
import { PINE_PANELS } from './panels';
import { TRADER_STALL as traderStall } from './questShop';
import { THRALL_CLIPS } from './thrallClips';
import thrallLook from '../data/thrallLook.json' with { type: 'json' };
import { PINE_QUEST_PAYLOAD } from './questRuntime';
import { PAGE_STORY } from './pageStory';
import weatherProgram from '../data/weather.json' with { type: 'json' };
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { KING_DECISION, KING_MOVES } from './kingDecision';
import { KNIFE_LOOK } from './knifeLook';
import toolPlayback from '../data/heldToolPlayback.json' with { type: 'json' };
import { contractCatalogue } from './contractRows';
import { CONTRACT_PROGRAM_SCRIPT, contractProgramRegistries } from './contractProgram';
import { ContractCatalogueSchema } from '@wildshard/format/contracts';
import { PanelDefinitionSchema } from '@wildshard/format/panelTemplate';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { PINE_SPECIES_PROGRAMS } from './speciesPrograms';
import * as v from 'valibot';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { PINE_LANTERN_PAGE } from './questPageInteractions';
import { PINE_QUEST_SERVICES, PINE_MILL_DOOR } from './questConsequences';
import {emitDefinedSections} from '@wildshard/sdk/sections';
import {isJsonData} from '@wildshard/format/json';
import {SECTIONS,CabinAmbienceSchema,CabinSeedsSchema,parseFloorRows,PoolGroundSchema,PinePhysicsSchema} from './sections';
import { nameBlob, emitNamedBlobs, type BlobSourceOptions, type NamedBlobKind } from '@wildshard/sdk/blobs';
import { pineTreeRest } from './bake-tree-rest.mjs';
import { readPineSources, type PineSources } from './pineSources';
import { heroMaterialFiles } from './heroMaterialFiles.mjs';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { formatJsonSchema, namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { parseAchievementCounterData, AchievementCounterDataSchema } from '@wildshard/format/achievementCounters';
import { PINE_FEAT_COUNTERS } from './questInventory';
import { CABIN_LIFE } from './cabinLook';
import { CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { pineFigureCatalogue } from './figureCatalogue';
import { pineNpcSkins } from './npcSkinInputs';
import { WEAPON_FINISHES } from './weaponFinishes';
import { pineLookMaterials } from './lookMaterials';
import { pineProps } from './bake-pine-props.mjs';
import { TIMBER_ROWS as timbers } from './product';
import { pineFloorLayout } from './bake-pine-floor.mjs';
import { PINE_OUTPUT, CROSSBOW_BLOB } from './outputInputs';
import { phoneBirdsAtlasOutput } from './birdAtlas';
import { pineClientBlobs } from './clientInputs';
import { pineCreatureBlobs, pineKingKit, pineRigBlobs } from './publicInputs';
import { grazerRows } from './grazers';
import { NATIVE_VIEW, SPECIES_LOOKS } from './nativeView';
import { pineDensityBlob } from './forestRows';
import manifest from '../manifest.json' with { type: 'json' };
import publicInputs from '../data/publicInputs.json' with { type: 'json' };
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

// GR8: called, not read from a scheduler job's output
const spots = pineSpots();

// GR8: called, not read from a scheduler job's output
const lookMaterials = pineLookMaterials();

// GR8: the grazer rows are called, not read from a scheduler job's output
const grazers = grazerRows();

/** Preserve logical names and tier selection while packing named geometry losslessly. */
function meshoptSource<T extends { kind: string; options?: BlobSourceOptions }>(row: T) {
  return row.kind === 'glb' ? { ...row, options: { ...row.options, meshopt: true } } : row;
}
/** The kinds a product names its source blobs by. */
const BLOB_KINDS: readonly NamedBlobKind[] = ['audio', 'bin', 'glb', 'image', 'json', 'ktx2', 'tile', 'wasm'];
/** A source blob with its kind checked (scene rows read from JSON carry it as a string). */
function sourceBlob<T extends { kind: string }>(row: T): Omit<T, 'kind'> & { kind: NamedBlobKind } {
  const kind = BLOB_KINDS.find(item => item === row.kind);
  if (kind === undefined) throw new Error(`Unknown Pine source blob kind ${row.kind}`);
  return { ...row, kind };
}

v.parse(CabinSeedsSchema, timbers.cabinSeeds);
v.parse(PoolGroundSchema, timbers.poolGround);
const cabinAppearance = { CABIN_LIFE,CABIN_LIGHT,HEARTH_LOOKS };
const counterRows = { ...PINE_FEAT_COUNTERS, feats: PINE_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const paintedRows=PINE_OUTPUT.custom['custom/paintedTextures'];
const coverTextureIds=new Set([...coverAppearance.kinds.map(row=>row.texture),'endGrain','glow']);
const coverTextures=Object.fromEntries(Object.entries(paintedRows.textures).filter(([key])=>coverTextureIds.has(key)));
const collectionTextures=Object.fromEntries(Object.entries(paintedRows.textures).filter(([key])=>!coverTextureIds.has(key)));
const forestDensity = pineDensityBlob(manifest);

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
/** A draft-07 schema with the format's named-check annotations dropped (scripts/bake-section-schemas.mjs `structural`). */
function structural(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structural);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'x-wildshard-checks' && key !== 'x-wildshard-string-length').map(([key, child]) => [key, structural(child)]));
}
/** Each custom section's wire schema, as the section-schema bake publishes it (GR8: computed in the program). */
const WIRE_SCHEMAS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => {
  const wire = structural(formatJsonSchema(schema, 'draft-07'));
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire)) throw new Error(`Invalid Pine wire schema ${name}`);
  return [name, Object.fromEntries(Object.entries(wire))];
}));
/** Sections whose rows only the program's producers make (GR8): `prepareOutput` passes them; the static output omits them. */
const PREPARED_SECTIONS = new Set(['custom/kingKit']);
/** The custom sections; `prepareOutput` passes the rows that name compiled modules (the quest runtime's lead). */
function emitCustom(sources: PineSources, overrides: ReadonlyMap<string, unknown> = new Map()): ReturnType<typeof emitDefinedSections> { return emitDefinedSections(Object.entries(schemas).filter(([name])=>overrides.has(name)||!PREPARED_SECTIONS.has(name)).map(([name,schema])=>{
 const value=overrides.has(name)?overrides.get(name):name==='custom/nativeView'?{ ...NATIVE_VIEW, ...logKit }:name==='custom/cabinAppearance'?cabinAppearance:name==='custom/questRuntime'?PINE_QUEST_PAYLOAD:name==='custom/grazers'?grazers:name==='custom/thrallLook'?{pose:THRALL_CLIPS,...thrallLook}:name==='custom/runtimeGraphs'?lookMaterials.runtime:name==='custom/cabinAmbience'?cabinAmbienceRows(sources):name==='custom/paintedTextures'?{textures:collectionTextures,chalk:paintedRows.chalk}:name==='custom/heldToolPlayback'?{...toolPlayback,look:KNIFE_LOOK}:(PINE_OUTPUT.custom as Readonly<Record<string,unknown>>)[name],jsonSchema=WIRE_SCHEMAS[name];
 if(!isJsonData(value)||jsonSchema===undefined)throw new Error(`Missing generated Pine section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
})); }
const held = PINE_OUTPUT.custom;
const coatRow = (key:string) => { const row=held['custom/paintedTextures'].textures[key]; if(row===undefined)throw new Error(`Missing coat texture ${key}`);return row; };
const heldEquipment = { ...heldTuning,
 playback: held['custom/heldPlayback'], inputs: held['custom/heldInputs'], sights: held['custom/heldSights'], action: held['custom/leverPlayback'],
 firearm: { ...held['custom/leverDetails'], asset: { url:publicInputs.weapons.rifle, parts:['steel','forend','stock','lever','hammer','bolt'] } },
 launcher: held['custom/crossbowPool'], hands: held['custom/handsPool'],
 tool: { ...held['custom/heldToolPlayback'], ...HELD_TOOL_LIFETIME, look:KNIFE_LOOK, url:publicInputs.weapons.knife },
 coatTextures: { map:coatRow('coatMap'), normalMap:coatRow('coatNormal'), armMap:coatRow('coatArm') },
};

/** Pine's output before the program's producers add theirs (`prepareOutput`). */
export interface PineStaticOutput { platform: ReturnType<typeof emitPlatformSections>; custom: ReturnType<typeof emitDefinedSections>; namedFiles: ReturnType<typeof emitNamedBlobs>["files"]; assets: ReturnType<typeof emitNamedBlobs>["assets"]; blobs: NonNullable<ProjectOutput['blobs']>; }

/** D65: the output rows over the program's sources (the scene, page and story rows, the props, the floor, the keyed sky);
 *  the platform rows go to `prepareOutput`, which adds the compiled return and spawn scripts. */
async function outputRows(sources: PineSources, readImagePixels: ProjectGenerationContext['readImagePixels']): Promise<{ output: PineStaticOutput; platformRows: Map<PlatformDataSectionName, unknown> }> {
  const props = await pineProps(sources), { rows: keyedSky, blobs: skyKeys } = await pineKeyedSky(sources, readImagePixels);
  const { FOREST_STORY_BLOB } = forestStory(sources), { PINE_QUEST_PAGE_BLOB } = questPage(sources), { RANGED_PAGE_BLOBS } = await rangedPage(sources), { FOREST_PAGE_BLOB } = forestPage(sources);
  const { WORLD_SCENES, SCENE_BLOBS, SCENE_MODEL_BLOBS, SCENE_PACKED_MODELS } = await worldScenes(sources);
  const clientJson: ReturnType<typeof emitNamedBlobs>=emitNamedBlobs([nameBlob(forestDensity.name, 'bin', forestDensity.bytes, { critical: true, decoded: forestDensity.decoded }), nameBlob('world/forest-weather.json', 'json', new TextEncoder().encode(encodeCanonicalJson(forestWeather))), FOREST_STORY_BLOB, PINE_QUEST_PAGE_BLOB, CROSSBOW_BLOB, ...SCENE_PACKED_MODELS, ...skyKeys.map(([name, bytes]) => nameBlob(name, 'bin', bytes)), nameBlob('data/physics.generated.json', 'json', pinePhysicsBytes(), { jsonSchema: namedJsonSchema(PinePhysicsSchema) }), nameBlob('quests/native-story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_NATIVE_QUEST)), { jsonSchema: namedJsonSchema(NativeQuestCompositionSchema) }), nameBlob('quests/native-spots.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseNativeQuestServiceSpots({ rows: spots.rows, people: spots.people, board: spots.board, pickup: spots.rifle, cable: spots.zip, signals: spots.lanterns }))), { jsonSchema: namedJsonSchema(NativeQuestServiceSpotsSchema) }), ...RANGED_PAGE_BLOBS, FOREST_PAGE_BLOB, LANDMARK_VIEW_BLOB,
nameBlob('look/cover-appearance.json','json',new TextEncoder().encode(encodeCanonicalJson(parseCoverAppearance({...coverAppearance,textures:coverTextures})))),...SCENE_BLOBS,nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(persistence))),
  nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...headlessAssembly, constants: { terrain: PINE_TERRAIN, entries: headlessEntries, environment: POPULATION_ENVIRONMENT } }))),
  nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CHAPTER_DIRECTOR))),
  nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: directorData.module, bytes: '', file: 'behaviour/director.wasm' }, stages: directorStages, bindings: null, seed: 357 }))),
  nameBlob('actors/roster.json', 'json', new TextEncoder().encode(encodeCanonicalJson(POPULATION_ROSTER))),
  nameBlob('world/ambience.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(CabinAmbienceSchema, cabinAmbienceRows(sources))))),
  nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_PANELS)), { jsonSchema: namedJsonSchema(v.record(v.string(), PanelDefinitionSchema)) }),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall))),
  nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weatherProgram)))),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestServiceActions(PINE_QUEST_SERVICES))), { jsonSchema: namedJsonSchema(QuestServiceActionsSchema) }),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows))), { jsonSchema: namedJsonSchema(AchievementCounterDataSchema) }),
  nameBlob('quests/mill-door.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(PINE_MILL_DOOR)))),
nameBlob('quests/lanterns.json','json',new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(PINE_LANTERN_PAGE)))),nameBlob('world/floor.json','json',new TextEncoder().encode(JSON.stringify(parseFloorRows(pineFloorLayout(sources)), (_key: string, value: unknown) => typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value))), nameBlob('world/prop-shapes.json','json',new TextEncoder().encode(JSON.stringify(timbers.propShapes))), nameBlob('world/props.json','json',new TextEncoder().encode(JSON.stringify(props))), nameBlob('loadout/finishes.json','json',new TextEncoder().encode(JSON.stringify(WEAPON_FINISHES)))]);
  const PLATFORM_ROWS = new Map<PlatformDataSectionName, unknown>([['explore/catalogue', EXPLORER_CATALOGUE],['world/trees', TREE_SET],['look/rigged-hulls', PINE_HULL_BOOK], ['look/hull-book', SPECIES_LOOKS], ['look/keyed-sky', keyedSky], ['client/plan', { ...clientPlan, features: [...clientPlan.features, { kind: 'audio.cues', id: 'roaming', stage: 'world', clock: 'owner', rows: NATIVE_VIEW.KING_CUES }, { kind: 'world.sets', rows: PLACE_SETS.map(({ id, place, name, x, z, r }) => ({ id, place, name, x, z, r, file: 'declared forest page', pois: [] })) }] }], ['ui/strings', strings], ['world/scenes', WORLD_SCENES], ['held/finishes', HELD_FINISHES], ['held/gear', HELD_GEAR], ['held/loadout', heldLoadout], ['held/equipment', heldEquipment], ['actors/species-programs', PINE_SPECIES_PROGRAMS], ['sim/scripts', KING_DECISION], ['actors/moves', KING_MOVES]]);
  return { platformRows: PLATFORM_ROWS, output: { ...PINE_OUTPUT, platform: emitPlatformSections(PLATFORM_ROWS), custom: emitCustom(sources), namedFiles: clientJson.files, assets: clientJson.assets, blobs: [...pinePhysicsSources(), ...SCENE_MODEL_BLOBS].map(meshoptSource).map(sourceBlob) } };
}

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export async function staticOutput(sources: PineSources, readImagePixels: ProjectGenerationContext['readImagePixels']): Promise<PineStaticOutput> {
  return (await outputRows(sources, readImagePixels)).output;
}


/** Compile a declared return guest through injected capabilities, without source-tree byte handoffs (GR8: the retired
 *  bake-life.mjs / bake-shelter.mjs rows live in returnPrograms.ts; the compiled row names the module). */
async function returnModule(ctx: ProjectGenerationContext, name: 'shelter' | 'life') {
  const compiler = ctx.compileDecisionRows;
  if (compiler === undefined) throw new Error('Pine return modules need decision-row compilation');
  const guest = returnGuest(name);
  const files = await ctx.cached({ id: `${name}-program`, inputs: guest.sources }, async inputs => {
    const authored = new Map([...inputs].map(([file, bytes]) => [file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)]));
    const built = await compiler([guest.row], returnRegistries(guest.row), authored, { asLineCeiling: 2130 });
    const row = built.rows[0], blob = built.blobs[0];
    if (row === undefined || blob === undefined || built.rows.length !== 1 || built.blobs.length !== 1 ||
      row.id !== guest.row.id || row.pages !== guest.row.pages) throw new Error(`Pine ${name} metadata is stale`);
    return new Map([[`${name}.wasm`, blob.bytes], [`${name}.json`, new TextEncoder().encode(encodeCanonicalJson(row))]]);
  });
  const bytes = files.get(`${name}.wasm`), row = files.get(`${name}.json`);
  if (bytes === undefined || row === undefined || files.size !== 2) throw new Error(`Missing ${name} bytes`);
  const script: unknown = JSON.parse(new TextDecoder().decode(row));
  const blob = nameBlob(`behaviour/pine.${name}.wasm`, 'wasm', bytes, { critical: true, script: { abi: 1, pages: 1 } });
  if (typeof script !== 'object' || script === null || !('module' in script) || script.module !== blob.file.path) throw new Error(`Pine ${name} module differs from metadata`);
  return { ...blob, script };
}

/** GR8 (B5, G20a): compile the contract guest from its authored sources, as the retired bake-contracts.mjs did, and
 *  name its Wasm as a return module (the ninth decision module): quests/contracts.json carries the row with no bytes,
 *  and the board borrows the loan through ownContractCatalogue. */
async function contractModule(ctx: ProjectGenerationContext) {
  const compiler = ctx.compileDecisionRows;
  if (compiler === undefined) throw new Error('Pine contracts need decision-row compilation');
  const sources = ['behaviour/contracts.as', 'behaviour/contractsRandom.as', 'behaviour/contractsRules.as'];
  const files = await ctx.cached({ id: 'contract-program', inputs: sources }, async inputs => {
    const authored = new Map([...inputs].map(([file, bytes]) => [file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)]));
    const built = await compiler([CONTRACT_PROGRAM_SCRIPT], contractProgramRegistries(), authored, { asLineCeiling: 256, singleSignal: true });
    const row = built.rows[0], blob = built.blobs[0];
    if (row === undefined || blob === undefined || built.rows.length !== 1 || built.blobs.length !== 1 || blob.file.path !== row.module) throw new Error('Missing compiled contract programme');
    return new Map([['contracts.wasm', blob.bytes], ['contracts.json', new TextEncoder().encode(encodeCanonicalJson(row))]]);
  });
  const bytes = files.get('contracts.wasm'), row = files.get('contracts.json');
  if (bytes === undefined || row === undefined || files.size !== 2) throw new Error('Missing contract programme bytes');
  const script: unknown = JSON.parse(new TextDecoder().decode(row));
  const blob = nameBlob('behaviour/pine.contracts.wasm', 'wasm', bytes, { critical: true, script: { abi: 1, pages: 1 } });
  if (typeof script !== 'object' || script === null || !('module' in script) || script.module !== blob.file.path) throw new Error('Pine contract module differs from its row');
  const catalogue = nameBlob('quests/contracts.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...contractCatalogue(), program: { script, bytes: '' } })), { jsonSchema: namedJsonSchema(ContractCatalogueSchema) });
  return { script, files: emitNamedBlobs([blob, catalogue]) };
}

/** GR8: the night population guest, compiled as the retired bake-pine-night-director.mjs did; its compiled row goes
 *  into actors/spawn-scripts with no bytes and its Wasm is the named critical module. */
async function nightModule(ctx: ProjectGenerationContext) {
  const compiler = ctx.compileDecisionRows;
  if (compiler === undefined) throw new Error('Pine night needs decision-row compilation');
  const files = await ctx.cached({ id: 'night-program', inputs: ['behaviour/night.as'] }, async inputs => {
    const authored = new Map([...inputs].map(([file, bytes]) => [file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)]));
    const built = await compiler([NIGHT_SPAWN.script], nightRegistries(), authored, { asLineCeiling: 2130 });
    const row = built.rows[0], blob = built.blobs[0];
    if (row === undefined || blob === undefined || built.rows.length !== 1 || built.blobs.length !== 1 || blob.file.path !== row.module) throw new Error('Missing compiled Pine night programme');
    return new Map([['night.wasm', blob.bytes], ['night.json', new TextEncoder().encode(encodeCanonicalJson(row))]]);
  });
  const bytes = files.get('night.wasm'), row = files.get('night.json');
  if (bytes === undefined || row === undefined || files.size !== 2) throw new Error('Missing Pine night bytes');
  const script: unknown = JSON.parse(new TextDecoder().decode(row));
  const blob = nameBlob('behaviour/night.wasm', 'wasm', bytes, { critical: true, script: { abi: 1, pages: 1 } });
  if (typeof script !== 'object' || script === null || !('module' in script) || script.module !== blob.file.path) throw new Error('Pine night module differs from its row');
  return { blob, row: { ...NIGHT_SPAWN, script, bytes: '' } };
}

/** GR8: the clock director, compiled as the retired bake-pine-clock-director.mjs did, against its declared module hash. */
async function clockDirector(ctx: ProjectGenerationContext) {
  const files = await ctx.cached({ id: 'clock-director', inputs: ['behaviour/director.as'] }, async inputs => {
    const source = inputs.get('behaviour/director.as');
    if (source === undefined) throw new Error('Missing Pine clock director source');
    const bytes = await ctx.compileScript(new TextDecoder('utf-8', { fatal: true }).decode(source), { maximumPages: 1, sources: { 'wildshard-director.ts': generateDirectorAbi(directorData) } });
    return new Map([['director.wasm', bytes]]);
  });
  const bytes = files.get('director.wasm');
  if (bytes === undefined || files.size !== 1) throw new Error('Missing Pine clock director bytes');
  const blob = nameBlob('behaviour/director.wasm', 'wasm', bytes, { script: { abi: 0 } });
  if (blob.file.hash !== directorData.module) throw new Error('Pine clock author module hash differs; update its declaration deliberately');
  return blob;
}

/** GR8: the four elite fights' guests, compiled as the retired bake-elite-behaviours.mjs did (one fight at a time, each
 *  with its program's spawn registries); actors/elites.json and actors/spawn-scripts carry the compiled rows, no bytes. */
async function eliteModules(ctx: ProjectGenerationContext) {
  const compiler = ctx.compileDecisionRows;
  if (compiler === undefined) throw new Error('Pine elites need decision-row compilation');
  const sources = ['common', 'ironhide', 'ghost', 'blackpaw', 'imperial'].map(name => `behaviour/elites/${name}.as`);
  const ids = ELITE_FEATURE_ROWS.fights.map(fight => fight.def.id);
  const files = await ctx.cached({ id: 'elite-programs', inputs: sources }, async inputs => {
    const authored = new Map([...inputs].map(([file, bytes]) => [file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)]));
    const out = new Map<string, Uint8Array>();
    for (const fight of ELITE_FEATURE_ROWS.fights) {
      const rows = parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights: [fight] }).fights[0];
      if (rows === undefined) throw new Error(`Missing Pine elite ${fight.def.id}`);
      const built = await compiler([rows.program.script], spawnRegistries(rows.program), authored, { asLineCeiling: 2130 });
      const row = built.rows[0], blob = built.blobs[0];
      if (row === undefined || blob === undefined || built.rows.length !== 1 || built.blobs.length !== 1 || blob.file.path !== row.module) throw new Error(`Missing compiled Pine elite ${fight.def.id}`);
      out.set(`${fight.def.id}.wasm`, blob.bytes).set(`${fight.def.id}.json`, new TextEncoder().encode(encodeCanonicalJson(row)));
    }
    return out;
  });
  if (files.size !== ids.length * 2) throw new Error('Pine elite program inventory differs');
  const blobs = [], fights = [];
  for (const fight of ELITE_FEATURE_ROWS.fights) {
    const bytes = files.get(`${fight.def.id}.wasm`), row = files.get(`${fight.def.id}.json`);
    if (bytes === undefined || row === undefined) throw new Error(`Missing Pine elite ${fight.def.id} bytes`);
    const script: unknown = JSON.parse(new TextDecoder().decode(row));
    const blob = nameBlob(`behaviour/elites/${fight.def.id}.wasm`, 'wasm', bytes, { critical: true, script: { abi: 1, pages: 1 } });
    if (typeof script !== 'object' || script === null || !('module' in script) || script.module !== blob.file.path) throw new Error(`Pine elite ${fight.def.id} module differs from its row`);
    blobs.push(blob); fights.push({ ...fight, program: { ...fight.program, script, bytes: '' } });
  }
  const feature = parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights });
  blobs.push(nameBlob('actors/elites.json', 'json', new TextEncoder().encode(encodeCanonicalJson(feature))));
  return { files: emitNamedBlobs(blobs), programs: feature.fights.map(fight => fight.program) };
}

/** Preserve the original named inventory and its ordering while compiling both existing slots. */
export async function prepareOutput(ctx: ProjectGenerationContext): Promise<PineStaticOutput> {
  const sources = await readPineSources(ctx), { output, platformRows } = await outputRows(sources, ctx.readImagePixels);
  const shelter = await returnModule(ctx, 'shelter');
  const life = await returnModule(ctx, 'life'), birds = await phoneBirdsAtlasOutput(ctx), client = await pineClientBlobs(ctx), creatures = await pineCreatureBlobs(ctx), rigs = await pineRigBlobs(ctx), contracts = await contractModule(ctx), night = await nightModule(ctx), clock = await clockDirector(ctx), elites = await eliteModules(ctx), journal = emitNamedBlobs((await pineJournal(ctx)).blobs), king = await pineKingKit(ctx), kingFiles = emitNamedBlobs([king.blob, roamingCombatBlob(king.rows)]), flock = await pineBirds(ctx), people = await pineNpcSkins(ctx), coats = await pineCoatPages(ctx);
  // GR8 G32: the forest trees' rest pool, a critical product file (was the pine-tree-rest job's public GLB)
  const trees = emitNamedBlobs([nameBlob(TREE_REST_FILE, 'glb', await pineTreeRest(sources), { critical: true })]);
  // GR8: the hero material payloads, compacted (heroMaterialFiles.mjs), named as product files the material aliases name;
  // opaque bytes (some carry ASTC KTX2 the product's GLB intake refuses), as uncharged as their retired public files were
  const heroMaterials = emitNamedBlobs(heroMaterialFiles(sources).map(([name, bytes, tier, variantOf]) => nameBlob(name, 'bin', bytes, { variantOf, ...(tier === undefined ? {} : { tier }) })));
  const peopleFile = emitNamedBlobs([nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(pineFigureCatalogue(people.rows))))]);
  const drawFile = emitNamedBlobs([nameBlob('look/wildlife-draw.json', 'json', new TextEncoder().encode(encodeCanonicalJson(wildlifeDraw(flock.ranges))))]);
  const lifeProgram = { script: life.script, bytes: '' };
  const programs = emitNamedBlobs([nameBlob('actors/page-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...pageLife(await pineAmbientPerches(ctx)), program: lifeProgram }))),
    nameBlob('actors/shelter.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ step: 'pine.rain-shelter', environment: 'pine.habitat', roster: 'pine.roster', weather: 'pine.air', herdLimit: 512, look: shelterLook, program: { script: shelter.script, bytes: '' } })))]);
  const namedFiles = [...output.namedFiles, ...trees.files, ...heroMaterials.files, life.file, ...birds.files, ...client.files, ...creatures.files, ...rigs.files, ...programs.files, ...contracts.files.files, ...elites.files.files, ...journal.files, ...kingFiles.files, ...flock.files.files, ...drawFile.files, ...people.files.files, ...peopleFile.files, ...coats.files, night.blob.file, clock.file].sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  const assets = new Map([...output.assets, ...trees.assets, ...heroMaterials.assets, ...birds.assets, ...client.assets, ...creatures.assets, ...rigs.assets, ...programs.assets, ...contracts.files.assets, ...elites.files.assets, ...journal.assets, ...kingFiles.assets, ...flock.files.assets, ...drawFile.assets, ...people.files.assets, ...peopleFile.assets, ...coats.assets, [night.blob.file.hash, night.blob.bytes], [clock.file.hash, clock.bytes]]);
  assets.set(life.file.hash, life.bytes);
  const sortedAssets = [...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const platform = emitPlatformSections(new Map<PlatformDataSectionName, unknown>([...platformRows, ['actors/return-scripts', [life.script, shelter.script, contracts.script]], ['actors/spawn-scripts', [night.row, ...elites.programs]]]));
  const customRows = emitCustom(sources, new Map<string, unknown>([['custom/questRuntime', { ...PINE_QUEST_PAYLOAD, lead: { ...PINE_QUEST_PAYLOAD.lead, program: lifeProgram } }], ['custom/kingKit', king.rows]]));
  return { ...output, platform, custom: customRows, namedFiles: [...namedFiles, shelter.file], assets: new Map([...sortedAssets, [shelter.file.hash, shelter.bytes]]) };
}
