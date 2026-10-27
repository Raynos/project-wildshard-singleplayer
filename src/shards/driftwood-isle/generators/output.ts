import { driftwoodFixedModelOutput } from './fixedModels';
import { driftwoodSceneModelOutput } from './sceneModelProgram';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { driftwoodIslandProtoOutput } from './islandProtoProgram';
import { driftwoodPhoneRockOutput } from './rockPhoneProgram';
import { driftwoodPageFileOutput } from './productPageFiles';
import { driftwoodCatalogueFeatures } from './catalogueEconomy';
import { driftwoodWorldStages } from './worldAssembly';
import { driftwoodWorldUpdates } from './worldUpdates';
import { DRIFTWOOD_NATIVE_QUEST } from './nativeQuest';
import { GULL_DRAW } from './gullDraw';
import { FISH_DRAW } from './fishDraw';
import { DRIFTWOOD_SPOTS as nativeQuestSpots } from './spots';
import { QuestPageCompositionSchema } from '@wildshard/format/questPageComposition';
import pageComposition from '../data/questPageComposition.json' with { type: 'json' };
import { driftwoodQuestContinuation } from './lootBag';
import { driftwoodQuestWorld } from './questWorld';
import questFrames from '../data/questFrames.json' with { type: 'json' };
import questEvents from '../data/questEvents.json' with { type: 'json' };
import questDeaths from '../data/questDeaths.json' with { type: 'json' };
import { populationProjectionRows } from './populationProjection';
import mixedPopulation from '../data/mixedPopulation.json' with { type: 'json' };
import { CRAB_CLIPS as crabClips } from './crabClips';
import { SAILOR_CLIPS as sailorClips, CAPTAIN_CLIPS as captainClips } from './humanoidClips';
import creatureLookRows from '../data/creatureLookRows.json' with { type: 'json' };
import { CREATURE_INSTALL } from './creatureLook';
import { ATTACK_TURN } from '@wildshard/engine/ai/hunt';
import { driftwoodJsonBlob as nameBlob } from './namedSchemas';
import nativePhysics from '../data/physics.generated.json' with { type: 'json' };
import { driftwoodNativeRows } from './nativeBake';
import { driftwoodPhysicsSources } from './physics';
import { WAKE_ENCOUNTER } from './wakeEncounter';
import { NATIVE_QUEST_PROPS } from './nativeQuestProps';
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import authoredSpots from '../data/spotsRows.json' with { type: 'json' };
import { CHAPTER_DIRECTOR } from './chapterDirector';
import { PAGE_LIFE } from './pageLife';
import { parse } from 'valibot';
import { CoverCompositionSchema } from '@wildshard/format/streamedCover';
import coverComposition from '../data/coverComposition.json' with { type: 'json' };
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { driftwoodPierScenes } from './pierScenesBank';
import { driftwoodFoliageScenes, driftwoodFoliageSceneOutput, foliageLogPlacements } from './foliageScenesBank';
import { FIGURE_CATALOGUE } from './figureCatalogue';
import { driftwoodQuestFigures } from './questFigures';
import { driftwoodBridgeSway } from './bridgeSway';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { driftwoodMoverOwners } from './moverOwners';
import { driftwoodKitFigureCards } from './kitFigureCards';
import { QUEST_SERVICES } from './questServiceEffects';
import { TOON_LOOK } from './toonPresentation';
import { RETURN_WASM_OPTIONS } from './returnProgram';
import { driftwoodGuestFiles, driftwoodGuestRows, type DriftwoodGuestRows } from './guestPrograms';
import ecology from '../data/ecology.json' with { type: 'json' };
import { DECLARED_SEA } from './sea';
import { siteCatalogue } from './siteCatalogue';
import wreckScene from '../data/wreckScene.json' with { type: 'json' };
import trailScene from '../data/trailScene.json' with { type: 'json' };
import clientPlan from '../data/clientPlan.json' with { type: 'json' };
import { driftwoodBakedCove } from './bakedCove';
import type { DriftwoodIslandFacts } from './islandFacts';
import buildingLife from '../data/buildingLife.json' with { type: 'json' };
import coveScene from '../data/coveScene.json' with { type: 'json' };
import { worldScenes } from './worldScenes';
import { driftwoodSceneBankOutput, driftwoodSceneBanksCached } from './sceneBanks';
import { uprightPoses } from './worldPlacements';
import cascadeScene from '../data/cascadeScene.json' with { type: 'json' };
import { driftwoodHeldArms } from './heldArms';
import type { DriftwoodFixedLayouts } from './fixedLayouts';
import questKillSteps from '../data/questKillSteps.json' with { type: 'json' };
import questSteps from '../data/questSteps.json' with { type: 'json' };
import questHints from '../data/questHints.json' with { type: 'json' };
import { parseQuestStepRows, parseQuestHintRows, parseQuestServiceActions } from '@wildshard/format/questSteps';
import { ENTRY_WALK } from './entryWalk';
import headlessSwords from '../data/nativeSwords.json' with { type: 'json' };
import headlessAssembly from '../data/headlessAssembly.json' with { type: 'json' };
import fixedInventory from '../data/fixedGeometry.json' with { type: 'json' };
import strings from '../data/strings.json' with { type: 'json' };
import directorData from '../data/director.json' with { type: 'json' };
import directorStages from '../data/finaleStages.json' with { type: 'json' };
import { MONKEY_CLIPS as monkeyClips } from './monkeyClips';
import { TRADER_STALL as traderStall } from './questShop';
import { PAGE_STORY } from './pageStory';
import { BARREL_DECISION, BARREL_BODIES } from './barrelDecision';
import { CAPTAIN_DECISION, CAPTAIN_MOVES, CAPTAIN_STRIKES, CAPTAIN_TARGETS } from './captainDecision';
import { completionRows, placeSetRows } from './completion';
import { TRADER_PAGE } from './traderPage';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { DRIFTWOOD_PLACES, GUIDE } from './discovery';
import { DRIFTWOOD_INTERACT, SEA_GLASS_COUNT, SHARD_FLAGS } from './interactables';
import { DRIFTWOOD_MODES } from './modes';
import MOVERS from '../data/movers.generated.json' with { type: 'json' };
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { DRIFTWOOD_SPECIES_PROGRAMS } from './speciesPrograms';
import * as v from 'valibot';
import {SECTIONS,WIRE_SCHEMAS,FixedGeometryGroupsSchema} from './sectionSchemas.generated';
import { emitNamedBlobs, nameBlob as nameGuestBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { DRIFTWOOD_FEAT_COUNTERS } from './questInventory';
import { enemyPlacements } from './enemyPlacement';
import { keeperRows } from './keeperRows';
import { emitDefinedSections } from '@wildshard/sdk/sections';
import { DRIFTWOOD_OUTPUT } from '../generators/assets';
import { DRIFTWOOD_CLIENT_SECTIONS, driftwoodOceanWaterRow } from './clientSections';
import type { DriftwoodCreatureBodyBank } from './creatureBodyBank';
import { driftwoodMap } from './mapProgram';
import { driftwoodGroundDeclaration } from './groundDeclaration';
import { driftwoodNavigation } from './navigation';

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
const placed = enemyPlacements();
const values=[...DRIFTWOOD_CLIENT_SECTIONS, {name:'custom/enemyPlacements',value:placed}];
if(values.length!==Object.keys(schemas).length)throw new Error('Incomplete Driftwood section inventory');
const custom=emitDefinedSections(values.map(({name,value})=>{
 const schema=schemas[name],jsonSchema=WIRE_SCHEMAS[name];
 if(schema===undefined||jsonSchema===undefined)throw new Error(`Missing generated Driftwood section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
}));

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
const counterRows = { ...DRIFTWOOD_FEAT_COUNTERS, feats: DRIFTWOOD_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const nativeFeats = parseAchievementCounterData(counterRows).feats.filter(row => row.kind === undefined);
const nativeCounters = parseAchievementCounterData({ ...counterRows, feats: nativeFeats, flags: nativeFeats.map(feat => DRIFTWOOD_FEAT_COUNTERS.flags.find(row => row.id === feat.id) ?? { id: feat.id, method: 'count', value: { constant: 0 } }), write: 'each' });
const sceneBytes = (value: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(parseWorldScene(value)));
const BRIDGE_SWAY_SCRIPT = { abi: 2 as const, lane: 'view' as const, pages: 1, ioBytes: 4096,
  compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission };
const placements = emitNamedBlobs([nameBlob('actors/page-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_LIFE))),

  nameBlob('world/cover-composition.json', 'json', new TextEncoder().encode(JSON.stringify(parse(CoverCompositionSchema, coverComposition)))),

  nameBlob('scenes/zipline.json', 'json', sceneBytes(driftwoodPierScenes().zipScene)),
  nameBlob('scenes/moorings.json', 'json', sceneBytes({ scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['lines'] }, { kind: 'mesh', id: 'lines', geometry: 'lines', material: 'still', missing: 'empty', castShadow: true }], materials: [{ kind: 'port', id: 'still', source: 'still' }] }, imports: [] })),
  ...driftwoodPierScenes().placements.map(row => nameBlob(`world/piers/${row.id}.json`, 'json', new TextEncoder().encode(JSON.stringify(row)))),
  ...['palms', 'hibiscus', 'reef', 'logs'].map(kind => nameBlob(`scenes/${kind}.json`, 'json', sceneBytes({ scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['mesh'] }, { kind: 'mesh', id: 'mesh', name: kind === 'reef' ? 'seabed' : kind === 'logs' ? 'ground-cover-driftwood' : kind, geometry: 'plant', material: 'plant', missing: 'empty', castShadow: kind !== 'reef', receiveShadow: true }], materials: [{ kind: 'port', id: 'plant', source: 'plant' }] }, imports: [] }))),


  nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE))),
  nameBlob('world/building-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(buildingLife))),
  nameBlob('scenes/wreck.json', 'json', new TextEncoder().encode(encodeCanonicalJson(wreckScene))),
  nameBlob('scenes/trail.json', 'json', new TextEncoder().encode(encodeCanonicalJson(trailScene))),
  nameBlob('scenes/cove.json', 'json', new TextEncoder().encode(encodeCanonicalJson(coveScene))),
  nameBlob('scenes/cascade.json', 'json', new TextEncoder().encode(encodeCanonicalJson(cascadeScene))),
  nameBlob('models/fixed-geometry.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(FixedGeometryGroupsSchema, fixedInventory.groups)))),
  nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...headlessAssembly, constants: { sea: DECLARED_SEA, nativeQuest: DRIFTWOOD_NATIVE_QUEST, nativeQuestSpots, nativeCounters, nativeEncounter: WAKE_ENCOUNTER.encounter, chapterDirector: CHAPTER_DIRECTOR, nativeChapterCues: WAKE_ENCOUNTER.cues.map(({ id, operation }) => ({ id, operation })), mixedPopulation: { ...mixedPopulation, attackTurnCap: ATTACK_TURN, practice: { ...mixedPopulation.practice, at: placed.practice, ...DRIFTWOOD_SPECIES_PROGRAMS.spawns.find(row => row.id === 'spawn.driftwood.practice')?.respawn }, poses: [{ kind: 'crab', clips: [crabClips] }, { kind: 'sailor', clips: [sailorClips], lift: [1.5, 1.5, -2.3, 6] }, { kind: 'captain', clips: [captainClips] }, { kind: 'monkey', clips: monkeyClips }] }, questProps: NATIVE_QUEST_PROPS, ...driftwoodNativeRows(nativePhysics), dayStyle: TOON_LOOK.sky.day, questKillSteps, entries: ENTRY_WALK, swords: headlessSwords, interact: DRIFTWOOD_INTERACT, interactSpots: authoredSpots.rows } }))),
  nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CHAPTER_DIRECTOR))),
  nameBlob('quests/wake-boss.json', 'json', new TextEncoder().encode(encodeCanonicalJson(WAKE_ENCOUNTER))),
  nameBlob('look/gull-draw.json', 'json', new TextEncoder().encode(encodeCanonicalJson(GULL_DRAW))),
  nameBlob('look/fish-draw.json', 'json', new TextEncoder().encode(encodeCanonicalJson(FISH_DRAW))),
  nameBlob('look/creature-looks.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ rows: creatureLookRows, poses: { sailor: sailorClips, crab: crabClips, captain: captainClips } }))),
  nameBlob('actors/creature-install.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CREATURE_INSTALL))),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall))),
  nameBlob('people/cards.json', 'json', new TextEncoder().encode(encodeCanonicalJson(driftwoodKitFigureCards()))),
  nameBlob('quests/trader.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(TRADER_PAGE)))),
  nameBlob('quests/steps.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestStepRows(questSteps)))),
  nameBlob('quests/hints.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestHintRows(questHints)))),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestServiceActions(QUEST_SERVICES)))),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),nameBlob('quests/discovery.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ places: DRIFTWOOD_PLACES, guide: GUIDE, glassCount: SEA_GLASS_COUNT, shardFlags: SHARD_FLAGS }))),
  nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(placed))),
  ]);
/** The drift-log, wreck-log and per-tier palm and bush placements (the foliage-scene bank, GR7). */
function foliagePlacements(layouts: DriftwoodFixedLayouts) {
  const foliage = { ...driftwoodFoliageScenes(), ...foliageLogPlacements(layouts) };
  return [nameBlob('world/foliage/logs.json', 'json', new TextEncoder().encode(JSON.stringify(foliage.logPlacement))),
  nameBlob('world/foliage/wreck-logs.json', 'json', new TextEncoder().encode(JSON.stringify(foliage.wreckLogPlacement))),
  ...(['phone', 'desktop'] as const).flatMap(tier => (['palms', 'hibiscus'] as const).map(kind => nameBlob(`world/foliage/${kind}-${tier}.json`, 'json', new TextEncoder().encode(JSON.stringify({ ...foliage.placements[tier][kind], poses: uprightPoses(foliage.placements[tier][kind].poses), id: `foliage.${kind === 'palms' ? 'palms' : 'bushes'}.${tier}` }))))),];
}
function questComposition(layouts: DriftwoodFixedLayouts) {
  return nameBlob('quests/page-composition.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(QuestPageCompositionSchema, { ...pageComposition, frames: questFrames, events: questEvents, deaths: questDeaths.page, entryResources: { world: driftwoodQuestWorld(layouts), figures: driftwoodQuestFigures(), continuation: driftwoodQuestContinuation() } }))));
}
function populationComposition(facts: DriftwoodIslandFacts, guests: DriftwoodGuestRows) {
  return nameBlob('actors/projection.json', 'json', new TextEncoder().encode(encodeCanonicalJson(populationProjectionRows(facts, guests.returnProgram))));
}
function returnComposition(guests: DriftwoodGuestRows) {
  return [nameBlob('sim/returns.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...ecology, program: guests.returnProgram, water: DECLARED_SEA.level, fixed: ['sailor'], step: 'shard.driftwood-isle.installEcology' }))),
    nameBlob('poses/monkey.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ clips: monkeyClips, program: guests.returnProgram, perch: mixedPopulation.perch }))),
    nameBlob('sim/keeper.json', 'json', new TextEncoder().encode(encodeCanonicalJson(keeperRows(placed, guests.returnProgram))))];
}
function directorComposition(guests: DriftwoodGuestRows) {
  return nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: guests.director.module, bytes: '', file: 'behaviour/director.wasm' }, stages: directorStages, bindings: null, seed: 357 })));
}
function guestModuleFiles(files: ReadonlyMap<string, Uint8Array>, guests: DriftwoodGuestRows) {
  const returns = files.get(guests.returns.compiled.source), bridge = files.get(guests.bridge.compiled.source), director = files.get(`assets/${guests.director.module}`);
  if (returns === undefined || bridge === undefined || director === undefined) throw new Error('Missing owned guest executable');
  return emitNamedBlobs([nameGuestBlob('behaviour/driftwood.returns.wasm', 'wasm', returns, { ...RETURN_WASM_OPTIONS, script: { ...RETURN_WASM_OPTIONS.script, pages: guests.returnProgram.script.pages } }),
    nameGuestBlob('views/bridge-sway.wasm', 'wasm', bridge, { critical: true, script: BRIDGE_SWAY_SCRIPT }),
    nameGuestBlob('behaviour/director.wasm', 'wasm', director, { script: { abi: 0 } })]);
}
/** The island's fauna looks over its packed creature bodies (`look/hull-book`; the creature-body bank, GR7). */
function hullBook(creatures: DriftwoodCreatureBodyBank): unknown { const { fauna, ...body } = creatures.rows; return { ...fauna, body }; }
/** The platform sections in their declared order; `world/scenes` joins once the scene banks are built (prepareOutput). */
function platformRows(scenes: ReturnType<typeof worldScenes> | undefined, layouts?: DriftwoodFixedLayouts, facts?: DriftwoodIslandFacts, creatures?: DriftwoodCreatureBodyBank, guests?: DriftwoodGuestRows): Map<PlatformDataSectionName, unknown> {
  return new Map<PlatformDataSectionName, unknown>([['explore/catalogue', EXPLORER_CATALOGUE],['look/toon', TOON_LOOK], ...(creatures === undefined ? [] : [['look/hull-book', hullBook(creatures)] as const]), ...(guests === undefined ? [] : [['view/modules', [{ id: 'driftwood.bridge-sway', module: `blobs/wasm/${guests.bridge.compiled.hash}.wasm`, side: 'view', ...BRIDGE_SWAY_SCRIPT }]] as const]), ['client/plan', { ...clientPlan, features: [...driftwoodCatalogueFeatures(clientPlan.features), ...(layouts === undefined ? [] : [{kind:'world.assembly',library:'driftwood.island',catalogue:'models/world-scenes.json',farStandIn:true,rows:driftwoodWorldStages(layouts)}]), { kind: 'world.updates', rows: driftwoodWorldUpdates() }, { kind: 'view.program', id: 'bridge-sway', rows: driftwoodBridgeSway(), module: 'views/bridge-sway.wasm' }, { kind: 'world.movers', ...driftwoodMoverOwners() }, ...(facts === undefined ? [] : [{ kind: 'world.baked', rows: [driftwoodBakedCove(facts)] }]), ...(layouts === undefined ? [] : [{ kind: 'world.water', rows: [driftwoodOceanWaterRow(layouts)] }]), { kind: 'world.sets', rows: placeSetRows() }] }], ...(scenes === undefined ? [] : [['world/scenes', scenes] as const]), ...(layouts === undefined ? [] : [['held/arms', driftwoodHeldArms(layouts.wreck)] as const]), ['ui/strings', strings], ['ui/completion', completionRows()], ['actors/species-programs', DRIFTWOOD_SPECIES_PROGRAMS], ...(guests === undefined ? [] : [['actors/return-scripts', [guests.returnProgram.script]] as const]), ['sim/scripts', [...CAPTAIN_DECISION, ...BARREL_DECISION]], ['sim/bodies', BARREL_BODIES], ['actors/moves', CAPTAIN_MOVES], ['actors/strikes', CAPTAIN_STRIKES], ['world/targets',CAPTAIN_TARGETS]]);
}
export const output: { blobs: ({ name: string; kind: string; source: string; } | { name: string; kind: "wasm"; source: string; options: { script: { abi: 0; }; }; })[]; platform: ReturnType<typeof emitDefinedSections>; namedFiles: readonly { path: string; kind: "audio" | "glb" | "ktx2" | "json" | "wasm" | "image" | "tile" | "bin"; name?: string; commons?: true; jsonSchema?: Record<string, unknown>; critical: boolean; hash: string; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; dependencies: ReturnType<typeof emitNamedBlobs>["files"][number]["dependencies"]; }[]; assets: ReadonlyMap<string, Uint8Array>; custom: ReturnType<typeof emitDefinedSections>; } = { ...DRIFTWOOD_OUTPUT, blobs: [...DRIFTWOOD_OUTPUT.blobs, ...driftwoodPhysicsSources()], platform: emitPlatformSections(platformRows(undefined)), namedFiles: placements.files, assets: placements.assets, custom };

/** Complete layout-dependent rows from the owned fixed facts, before binary banks join. */
export function driftwoodOutputRows(layouts: DriftwoodFixedLayouts, facts: DriftwoodIslandFacts, guests: DriftwoodGuestRows): typeof output {
  const questFiles = emitNamedBlobs([questComposition(layouts), populationComposition(facts, guests), ...foliagePlacements(layouts)]);
  const directorFiles = emitNamedBlobs([directorComposition(guests), ...returnComposition(guests)]);
  const placedFiles = [...output.namedFiles, ...directorFiles.files].sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  const placedAssets = new Map([...output.assets, ...directorFiles.assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  return { ...output, platform: emitPlatformSections(platformRows(undefined, layouts, facts, undefined, guests)),
    namedFiles: [...questFiles.files, ...placedFiles], assets: new Map([...questFiles.assets, ...placedAssets]) };
}

/** Root-mapped platform data is admitted before the canonical output writer. */
export const sections: { 'world/movers': { movers: ({ id: string; execution: string; entity: number; kind: string; at: { x: number; y: number; z: number; }; euler: { x: number; y: number; z: number; }; enabled: boolean; boxes: { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: { x: number; y: number; z: number; w: number; }; }[]; module: string; input: number[]; trigger: { kind: string; }; driver: { kind: string; damping: number; waves: number[][]; }; chain?: never; } | { id: string; execution: string; entity: number; kind: string; at: { x: number; y: number; z: number; }; euler: { x: number; y: number; z: number; }; enabled: boolean; boxes: never[]; chain: { segments: { x: number; y: number; z: number; rot: { x: number; y: number; z: number; w: number; }; hz: number; }[]; hx: number; hy: number; mass: number; }; module: string; input: number[]; trigger: { kind: string; }; driver: { kind: string; damping?: never; waves?: never; }; })[]; }; 'state/modes': { modes: typeof DRIFTWOOD_MODES; }; } = { 'world/movers': { movers: MOVERS }, 'state/modes': { modes: DRIFTWOOD_MODES } };


/** Prototype geometry and the cove's and sea's page files (I8) belong to the owned-byte cache, never a generated asset
 *  under src. */
export async function prepareOutput(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles' | 'compileScript' | 'compileScriptV2' | 'compileDecisionRows'>): Promise<typeof output> {
  const banks = await driftwoodSceneBanksCached(ctx), bankFiles = await driftwoodSceneBankOutput(banks), foliageFiles = await driftwoodFoliageSceneOutput(ctx);
  const guestFiles = await driftwoodGuestFiles(ctx), guests = driftwoodGuestRows(guestFiles), guestModules = guestModuleFiles(guestFiles, guests);
  const rows = driftwoodOutputRows(banks.layouts, banks.facts, guests);
  const catalogue = emitNamedBlobs([nameBlob('scenes/rocks.json', 'json', new TextEncoder().encode(encodeCanonicalJson(banks.rocks.scene))),
    nameBlob('models/world-scenes.json', 'json', new TextEncoder().encode(encodeCanonicalJson(siteCatalogue(banks))))]);
  const fixed = await driftwoodFixedModelOutput(ctx), protos = await driftwoodIslandProtoOutput(ctx), pages = await driftwoodPageFileOutput(ctx), phoneRocks = await driftwoodPhoneRockOutput(banks.rocks.glbs), scenes = await driftwoodSceneModelOutput(ctx);
  return { ...rows, platform: emitPlatformSections(platformRows(worldScenes(banks), banks.layouts, banks.facts, banks.creatures, guests)),
    namedFiles: [...rows.namedFiles, ...guestModules.files, ...catalogue.files, ...protos.files, ...pages.files, ...phoneRocks.files, ...fixed.files, ...scenes.files, ...bankFiles.files, ...foliageFiles.files],
    assets: new Map([...rows.assets, ...guestModules.assets, ...catalogue.assets, ...protos.assets, ...pages.assets, ...phoneRocks.assets, ...fixed.assets, ...scenes.assets, ...bankFiles.assets, ...foliageFiles.assets]) };
}

/** GR7: the map lattice (the source-owned map: the SDK publishes it as `ui/images/map` and the public alias). */
export async function prepareMap(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ pixels: Uint8Array; name: string }> {
  return { pixels: await driftwoodMap(ctx), name: 'ui/images/map' };
}

/** Bounded discovery data from defining source producers, admitted by the SDK. */
export async function prepareDiscovery(ctx: ProjectGenerationContext): Promise<{ 'ground.rows': ReturnType<typeof driftwoodGroundDeclaration>; navigation: Awaited<ReturnType<typeof driftwoodNavigation>> }> {
  return { 'ground.rows': driftwoodGroundDeclaration(), navigation: await driftwoodNavigation(ctx) };
}
