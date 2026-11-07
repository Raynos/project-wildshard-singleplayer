import { pinePhysicsOwners, pinePhysicsOwnersBytes, pinePhysicsSources, pineWorldPhysics } from './physics';
import { TREE_REST_FILE, TREE_SET } from './treeSet';
import forestWeather from '../data/forestWeather.json' with { type: 'json' };
import { forestStory } from './forestStory';
import { questPage, questPageBlob } from './pageComposition';
import { pineSpots } from './spots';
import { rangedPage } from './rangedPage';
import { forestPage } from './forestPage';
import { roamingCombatBlob } from './roamingCombat';
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import { CHAPTER_DIRECTOR } from './chapterDirector';
import { PINE_HULL_BOOK } from './riggedHulls';
import { pineCoatPages } from './coatPages';
import { pageLife } from './pageLife';
import { pineAmbientPerches } from './perchInputs';
import { returnGuest, returnRegistries } from './returnPrograms';
import { PLACE_SETS } from './placeSets';
import coverAppearance from '../data/coverAppearance.json' with { type: 'json' };
import { pineKeyedSky } from './bake-keyed-sky.mjs';
import { ELITE_FEATURE_ROWS } from './eliteFeatureRows';
import { pineJournal } from './journal';
import { achievementCounterRows, coverAppearanceRows, nativeQuestServiceSpotRows, parseEliteFeature, questPageInteractionRows, questServiceRows, spawnRegistries, weatherProgramRows } from '@wildshard/sharddev/rows';
import strings from '../data/strings.json' with { type: 'json' };
import clientPlan from '../data/clientPlan.json' with { type: 'json' };
import { worldScenes } from './worldScenes';
import { HELD_FINISHES, HELD_GEAR, HELD_TOOL_LIFETIME } from './heldGear';
import heldLoadout from '../data/loadout.json' with { type: 'json' };
import heldTuning from '../data/heldTuning.json' with {type:'json'};
import shelterLook from '../data/populationShelter.json' with { type: 'json' };
import { POPULATION_ROSTER } from './population';
import { NIGHT_SPAWN, nightRegistries } from './nightSpawn';
import { generateDirectorAbi } from '@wildshard/sharddev/directorAbi';
import persistence from '../data/persistence.json' with {type:'json'};
import { wildlifeDraw } from './wildlifeDraw';
import { pineBirds } from './birdInputs';
import directorData from '../data/director.json' with { type: 'json' };
import directorStages from '../data/watchStages.json' with { type: 'json' };
import { PINE_PANELS } from './panels';
import { TRADER_STALL as traderStall } from './questShop';
import { PINE_QUEST_PAYLOAD } from './questRuntime';
import { PAGE_STORY } from './pageStory';
import weatherProgram from '../data/weather.json' with { type: 'json' };
import { KING_DECISION, KING_MOVES } from './kingDecision';
import { KNIFE_LOOK } from './knifeLook';
import { contractCatalogue } from './contractRows';
import { CONTRACT_PROGRAM_SCRIPT, contractProgramRegistries } from './contractProgram';
import { emitPlatformSections, type PlatformSectionName } from '@wildshard/sharddev/platformSections';
import { parseSectionValue } from '@wildshard/sharddev/sections';
import { PINE_SPECIES_PROGRAMS } from './speciesPrograms';
import { PINE_LANTERN_PAGE } from './questPageInteractions';
import { PINE_QUEST_SERVICES, PINE_MILL_DOOR } from './questConsequences';
import {CabinSeedsSchema,parseFloorRows,PoolGroundSchema} from './sections';
import { nameBlob, emitNamedBlobs, nativeAssemblyFiles, type BlobSourceOptions, type NamedBlob, type NamedBlobKind, type NativeAssemblyPlan, type ServerBlob } from '@wildshard/sharddev/blobs';
import { pineTreeRest } from './bake-tree-rest.mjs';
import { NAVMESH_SOURCE, TERRAIN_SOURCE, type PineSources } from './pineSources';
import { readPineSources } from './programSources';
import { heroMaterialFiles, materialTier, materialVariantOf } from './heroMaterialFiles.mjs';
import type { ProjectOutput } from '@wildshard/sharddev/projectOutput';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { registeredJsonSchema } from '@wildshard/sharddev/formatJsonSchema';
import { PINE_FEAT_COUNTERS } from './questInventory';
import { cabinScene, lendCabinPacking } from './cabinSceneContribution';
import { pineFigureCatalogue } from './figureCatalogue';
import { pineNpcSkins } from './npcSkinInputs';
import { timberWorld } from './timberWorldRows';
import { pineFloorLayout } from './bake-pine-floor.mjs';
import { PINE_OUTPUT, CROSSBOW_BLOB } from './outputInputs';
import { phoneBirdsAtlasOutput } from './birdAtlas';
import { pineClientBlobs } from './clientInputs';
import { pineCreatureBlobs, pineKingKit, pineRigBlobs } from './publicInputs';
import { NATIVE_VIEW, SPECIES_LOOKS } from './nativeView';
import { pineDensityBlob } from './forestRows';
import manifest from '../manifest.json' with { type: 'json' };
import publicInputs from '../data/publicInputs.json' with { type: 'json' };
import type { ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import { cachedTreeRest, cachedCompactShapes } from './phoneGeometryCache';
import { PINE_NATIVE_QUEST } from './nativeQuest';
import { POPULATION_ENVIRONMENT } from './populationEnvironment';
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import ENTRIES from '../data/entryWalk.json' with { type: 'json' };

// GR8: called, not read from a scheduler job's output
const spots = pineSpots();

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

const counterRows = { ...PINE_FEAT_COUNTERS, feats: PINE_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const paintedRows=PINE_OUTPUT.custom['custom/paintedTextures'];
const coverTextureIds=new Set([...coverAppearance.kinds.map(row=>row.texture),'endGrain','glow']);
const coverTextures=Object.fromEntries(Object.entries(paintedRows.textures).filter(([key])=>coverTextureIds.has(key)));
const forestDensity = pineDensityBlob(manifest);

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
export interface PineStaticOutput { platform: ReturnType<typeof emitPlatformSections>; namedFiles: ReturnType<typeof emitNamedBlobs>["files"]; assets: ReturnType<typeof emitNamedBlobs>["assets"]; blobs: NonNullable<ProjectOutput['blobs']>; late?: NonNullable<ProjectOutput['late']>; server?: readonly ServerBlob[]; }

/** D65: the output rows over the program's sources (the scene, page and story rows, the props, the floor, the keyed sky);
 *  the platform rows go to `prepareOutput`, which adds the compiled return and spawn scripts. */
async function outputRows(sources: PineSources, readImagePixels: ProjectGenerationContext['readImagePixels'], encodeGainKey?: ProjectGenerationContext['encodeGainKey']): Promise<{ output: PineStaticOutput; platformRows: Map<PlatformSectionName, unknown> }> {
  const { rows: keyedSky, blobs: skyKeys } = await pineKeyedSky(sources, readImagePixels, encodeGainKey);
  const world = timberWorld(sources), timbers = { cabinSeeds: world.cabins.seeds, poolGround: world.poolGround };
  parseSectionValue(CabinSeedsSchema, timbers.cabinSeeds);
  parseSectionValue(PoolGroundSchema, timbers.poolGround);
  const { FOREST_STORY_BLOB } = forestStory(sources), { PINE_QUEST_PAGE_BLOB } = questPage(sources), { RANGED_PAGE_BLOBS } = await rangedPage(sources), { FOREST_PAGE_BLOB } = await forestPage(sources);
  const { WORLD_SCENES, SCENE_BLOBS, SCENE_PACKED_MODELS } = await worldScenes(sources);
  const clientJson: ReturnType<typeof emitNamedBlobs>=emitNamedBlobs([nameBlob(forestDensity.name, 'bin', forestDensity.bytes, { critical: true, decoded: forestDensity.decoded }), nameBlob('world/forest-weather.json', 'json', new TextEncoder().encode(encodeCanonicalJson(forestWeather)), { jsonSchema: registeredJsonSchema('world/forest-weather.json') }), FOREST_STORY_BLOB, PINE_QUEST_PAGE_BLOB, CROSSBOW_BLOB, ...SCENE_PACKED_MODELS, ...skyKeys.map(([name, bytes]) => nameBlob(name, 'bin', bytes)), nameBlob('data/physics.generated.json', 'json', pinePhysicsOwnersBytes(), { jsonSchema: registeredJsonSchema('data/physics.generated.json') }), nameBlob('quests/native-spots.json', 'json', new TextEncoder().encode(encodeCanonicalJson(nativeQuestServiceSpotRows({ rows: spots.rows, people: spots.people, board: spots.board, pickup: spots.rifle, cable: spots.zip, signals: spots.lanterns }))), { jsonSchema: registeredJsonSchema('quests/native-spots.json') }), ...RANGED_PAGE_BLOBS, FOREST_PAGE_BLOB,
nameBlob('look/cover-appearance.json','json',new TextEncoder().encode(encodeCanonicalJson(coverAppearanceRows({...coverAppearance,textures:coverTextures}))),{jsonSchema:registeredJsonSchema('look/cover-appearance.json')}),...SCENE_BLOBS,nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(persistence)),{jsonSchema:registeredJsonSchema('quests/persistence.json')}),
  nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CHAPTER_DIRECTOR)), { jsonSchema: registeredJsonSchema('quests/chapter-director.json') }),
  nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: directorData.module, bytes: '', file: 'behaviour/director.wasm' }, stages: directorStages, bindings: null, seed: 357 })), { jsonSchema: registeredJsonSchema('directors/main.json') }),
  nameBlob('actors/roster.json', 'json', new TextEncoder().encode(encodeCanonicalJson(POPULATION_ROSTER)), { jsonSchema: registeredJsonSchema('actors/roster.json') }),
  nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_PANELS)), { jsonSchema: registeredJsonSchema('quests/panels.json') }),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall)), { jsonSchema: registeredJsonSchema('quests/stall.json') }),
  nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(weatherProgramRows(weatherProgram))), { jsonSchema: registeredJsonSchema('world/weather.json') }),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(questServiceRows(PINE_QUEST_SERVICES))), { jsonSchema: registeredJsonSchema('quests/services.json') }),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY)), { jsonSchema: registeredJsonSchema('quests/story.json') }),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(achievementCounterRows(counterRows))), { jsonSchema: registeredJsonSchema('quests/achievements.json') }),
  nameBlob('quests/mill-door.json', 'json', new TextEncoder().encode(encodeCanonicalJson(questPageInteractionRows(PINE_MILL_DOOR))), { jsonSchema: registeredJsonSchema('quests/mill-door.json') }),
nameBlob('quests/lanterns.json','json',new TextEncoder().encode(encodeCanonicalJson(questPageInteractionRows(PINE_LANTERN_PAGE))),{jsonSchema:registeredJsonSchema('quests/lanterns.json')}),nameBlob('world/floor.json','json',new TextEncoder().encode(JSON.stringify(parseFloorRows(pineFloorLayout(sources)), (key: string, value: unknown) => key === 'matrix' ? undefined : typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value)), { jsonSchema: registeredJsonSchema('world/floor.json') })]);
  const PLATFORM_ROWS = new Map<PlatformSectionName, unknown>([['explore/catalogue', EXPLORER_CATALOGUE],['world/physics', pineWorldPhysics()],['world/trees', TREE_SET],['look/rigged-hulls', PINE_HULL_BOOK], ['look/hull-book', SPECIES_LOOKS], ['look/keyed-sky', keyedSky], ['client/plan', { ...clientPlan, features: [...clientPlan.features, { kind: 'audio.cues', id: 'roaming', stage: 'world', clock: 'owner', rows: NATIVE_VIEW.KING_CUES }, { kind: 'world.sets', rows: PLACE_SETS.map(({ id, place, name, x, z, r }) => ({ id, place, name, x, z, r, file: 'declared forest page', pois: [] })) }] }], ['ui/strings', strings], ['world/scenes', WORLD_SCENES], ['held/finishes', HELD_FINISHES], ['held/gear', HELD_GEAR], ['held/loadout', heldLoadout], ['held/equipment', heldEquipment], ['actors/species-programs', PINE_SPECIES_PROGRAMS], ['sim/scripts', KING_DECISION], ['actors/moves', KING_MOVES]]);
  return { platformRows: PLATFORM_ROWS, output: { platform: emitPlatformSections(PLATFORM_ROWS), namedFiles: clientJson.files, assets: clientJson.assets, blobs: pinePhysicsSources().map(meshoptSource).map(sourceBlob) } };
}

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export async function staticOutput(sources: PineSources, readImagePixels: ProjectGenerationContext['readImagePixels']): Promise<PineStaticOutput> {
  return (await outputRows(sources, readImagePixels)).output;
}


/** Compile a declared return guest through injected capabilities, without source-tree byte handoffs (GR8: the retired
 *  bake-life.mjs / bake-shelter.mjs rows live in returnPrograms.ts; the compiled row names the module). Exported for its
 *  producer proof (test/pine-life-authoring), which compiles the guest alone, not the whole output. */
export async function returnModule(ctx: ProjectGenerationContext, name: 'shelter' | 'life'): Promise<Omit<NamedBlob, 'script'> & { readonly script: object }> {
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
  const catalogue = nameBlob('quests/contracts.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...contractCatalogue(), program: { script, bytes: '' } })), { jsonSchema: registeredJsonSchema('quests/contracts.json') });
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
  blobs.push(nameBlob('actors/elites.json', 'json', new TextEncoder().encode(encodeCanonicalJson(feature)), { jsonSchema: registeredJsonSchema('actors/elites.json') }));
  return { files: emitNamedBlobs(blobs), programs: feature.fights.map(fight => fight.program) };
}

/** P1-E3.1b (J90, J91): the plan a headless host builds Pine from, in the world's install order, and the files only it reads. */
const NATIVE_ASSEMBLY: NativeAssemblyPlan = { kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 } },
  terrain: { kind: 'baked', file: 'server/terrain.bin', rows: { res: TERRAIN.res, size: TERRAIN.size, seed: TERRAIN.seed } }, navigation: { file: 'server/navmesh.bin' },
  bake: { rows: { section: 'world/physics' }, reader: { label: 'Pine', resolution: TERRAIN.res, size: TERRAIN.size, parked: true, rig: 'segments', shapes: [1, 2, 6, 9], provenance: 'piece' },
    ground: 'data/physics-ground.bin', colliders: ['data/physics-colliders.bin'], read: 'bake', owners: { file: 'data/physics.generated.json' }, pick: ['kingHit', 'shelterTrees'] },
  collision: { resolution: TERRAIN.res, provenance: { field: 'pineWorldOwner', step: 'pine.world-tags', fallback: 'wood' } },
  entries: { walk: ENTRIES, fresh: { omit: ['edge'] } },
  features: [{ host: 'commands' }, { host: 'decisions' }, { host: 'day.keyed-sky' }, { host: 'collision' },
    { host: 'boss.ground', encounter: { file: 'combat/roaming.json', path: ['projection', 'encounter'] },
      binding: { population: POPULATION_ROSTER.step, weakPoint: { radius: pinePhysicsOwners().kingHit.radius }, reward: { inventory: 'pack', grants: [{ item: 'amber-resin', count: 3 }] } } },
    { host: 'loadout' }, { host: 'combat.motion', speed: 7.2 },
    { host: 'item.ranged', kind: 'bolt', weapon: 'weapon.crossbow' }, { host: 'item.ranged', kind: 'cycle', weapon: 'weapon.lever' }, { host: 'item.ranged', kind: 'bow', weapon: 'weapon.longbow' },
    { host: 'ammunition', step: 'pine.ammunition', refill: 'iron' },
    { host: 'quest.composition', rows: { file: 'server/quest-policy.json' }, spots: { file: 'quests/native-spots.json' }, counters: { file: 'quests/achievements.json' },
      document: { file: 'quests/runtime.json' }, contracts: { file: 'quests/contracts.json' }, barter: true, director: true },
    { host: 'weather.program', program: { file: 'world/weather.json' } }, { host: 'population.environment', rows: { file: 'server/habitat.json' } },
    { host: 'population.shelter', rows: { file: 'actors/shelter.json' } }, { host: 'population.roster', rows: { file: 'actors/roster.json' } },
    { host: 'population.elites', file: 'actors/elites.json' }, { host: 'population.spawn-script', id: 'pine.night' }, { host: 'population.elites-ready' }] };
/** The server-class files: named in `admission.server`, never in the client's files, packs or Shardfile. */
function serverFiles(sources: PineSources): ServerBlob[] {
  return nativeAssemblyFiles(NATIVE_ASSEMBLY, new Map<string, unknown>([['server/quest-policy.json', PINE_NATIVE_QUEST], ['server/habitat.json', POPULATION_ENVIRONMENT]]),
    new Map([['server/terrain.bin', sources.bytes(TERRAIN_SOURCE)], ['server/navmesh.bin', sources.bytes(NAVMESH_SOURCE)]]));
}

/** Preserve the original named inventory and its ordering while compiling both existing slots. */
export async function prepareOutput(ctx: ProjectGenerationContext): Promise<PineStaticOutput> {
  // the return modules need the build's compiler: refuse before the whole static output is built, not after it
  if (ctx.compileDecisionRows === undefined) throw new Error('Pine return modules need decision-row compilation');
  const sources = await readPineSources(ctx);
  lendCabinPacking(sources, shapes => cachedCompactShapes(ctx, shapes));
  const { output, platformRows } = await outputRows(sources, ctx.readImagePixels, ctx.encodeGainKey);
  const shelter = await returnModule(ctx, 'shelter');
  const life = await returnModule(ctx, 'life'), birds = await phoneBirdsAtlasOutput(ctx), client = await pineClientBlobs(ctx), creatures = await pineCreatureBlobs(ctx), rigs = await pineRigBlobs(ctx), contracts = await contractModule(ctx), night = await nightModule(ctx), clock = await clockDirector(ctx), elites = await eliteModules(ctx), journal = emitNamedBlobs((await pineJournal(ctx)).blobs), king = await pineKingKit(ctx), kingFiles = emitNamedBlobs([king.blob, roamingCombatBlob(king.rows)]), flock = await pineBirds(ctx), people = await pineNpcSkins(ctx), coats = await pineCoatPages(ctx);
  // GR8 G32: the forest trees' rest pool, a critical product file (was the pine-tree-rest job's public GLB)
  // iPhone downloads I2: the rest pool's 84 named shapes each on their own 16-bit grid (compactPhoneGlb `each`); the rest
  // pool reads every node back to identity-space float32 (identitySpaceGeometry)
  const trees = emitNamedBlobs([nameBlob(TREE_REST_FILE, 'glb', await cachedTreeRest(ctx, await pineTreeRest(sources)), { critical: true })]);
  // GR8: the hero material payloads, compacted (heroMaterialFiles.mjs), named as product files the material aliases name;
  // opaque bytes (some carry ASTC KTX2 the product's GLB intake refuses), as uncharged as their retired public files were
  const heroMaterials = emitNamedBlobs(heroMaterialFiles(sources).map(([name, bytes, tier, variantOf]) => nameBlob(name, 'bin', bytes, { variantOf, ...(tier === undefined ? {} : { tier }) })));
  // GR8 G37: the timber world's prop and cabin material payloads, named as the aliases name them, each for its device tier
  const timberMaterials = emitNamedBlobs(Object.entries(timberWorld(sources).propMaterials).map(([url, name]) => {
    const tier = materialTier(sources, url);
    return nameBlob(name, 'bin', sources.bytes(name), { variantOf: materialVariantOf(url), ...(tier === undefined ? {} : { tier }) });
  }));
  const peopleFile = emitNamedBlobs([nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(pineFigureCatalogue(people.rows))), { jsonSchema: registeredJsonSchema('people/catalogue.json') })]);
  const drawFile = emitNamedBlobs([nameBlob('look/wildlife-draw.json', 'json', new TextEncoder().encode(encodeCanonicalJson(wildlifeDraw(flock.ranges))), {jsonSchema:registeredJsonSchema('look/wildlife-draw.json')})]);
  const lifeProgram = { script: life.script, bytes: '' };
  // D97: the quest page's chapter runs the compiled lead as the quest runtime does (the static page names its unset module)
  const page = emitNamedBlobs([questPageBlob(questPage(sources).PINE_QUEST_PAGE, lifeProgram)]), stale = output.namedFiles.find(file => file.name === 'quests/page-composition.json');
  if (stale === undefined) throw new Error('Pine quest page is missing from the static output');
  const programs = emitNamedBlobs([nameBlob('quests/runtime.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...PINE_QUEST_PAYLOAD, lead: { ...PINE_QUEST_PAYLOAD.lead, program: lifeProgram } })), { jsonSchema: registeredJsonSchema('quests/runtime.json') }),
    nameBlob('actors/page-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...pageLife(await pineAmbientPerches(ctx)), program: lifeProgram })), { jsonSchema: registeredJsonSchema('actors/page-life.json') }),
    nameBlob('actors/shelter.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ step: 'pine.rain-shelter', environment: 'pine.habitat', roster: 'pine.roster', weather: 'pine.air', herdLimit: 512, look: shelterLook, program: { script: shelter.script, bytes: '' } })), { jsonSchema: registeredJsonSchema('actors/shelter.json') })]);
  const namedFiles = [...output.namedFiles.filter(file => file !== stale), ...page.files, ...trees.files, ...heroMaterials.files, ...timberMaterials.files, life.file, ...birds.files, ...client.files, ...creatures.files, ...rigs.files, ...programs.files, ...contracts.files.files, ...elites.files.files, ...journal.files, ...kingFiles.files, ...flock.files.files, ...drawFile.files, ...people.files.files, ...peopleFile.files, ...coats.files, night.blob.file, clock.file].sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  const assets = new Map([...output.assets, ...trees.assets, ...heroMaterials.assets, ...timberMaterials.assets, ...birds.assets, ...client.assets, ...creatures.assets, ...rigs.assets, ...programs.assets, ...contracts.files.assets, ...elites.files.assets, ...journal.assets, ...kingFiles.assets, ...flock.files.assets, ...drawFile.assets, ...people.files.assets, ...peopleFile.assets, ...coats.assets, [night.blob.file.hash, night.blob.bytes], [clock.file.hash, clock.bytes]]);
  assets.set(life.file.hash, life.bytes);
  assets.delete(stale.hash); for (const [hash, bytes] of page.assets) assets.set(hash, bytes);
  const sortedAssets = [...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const platform = emitPlatformSections(new Map<PlatformSectionName, unknown>([...platformRows, ['actors/return-scripts', [life.script, shelter.script, contracts.script]], ['actors/spawn-scripts', [night.row, ...elites.programs]]]));
  // I2: the cabin weld builds after control (cabinSceneContribution.ts), so its node shapes leave the library fetched before it;
  // the keyed sky decodes only the keys around the clock's phase (game looks/keyedSky.ts), read on demand, so no key is prefetched
  const skyKeys = output.namedFiles.filter(file => file.name?.startsWith('look/sky/') === true && file.kind === 'bin').map(file => ({ hash: file.hash }));
  const late = [...(await cabinScene(sources)).CABIN_LATE, ...skyKeys];
  return { ...output, platform, namedFiles: [...namedFiles, shelter.file], assets: new Map([...sortedAssets, [shelter.file.hash, shelter.bytes]]), late, server: serverFiles(sources) };
}
