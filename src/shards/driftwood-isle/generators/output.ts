import { populationProjectionRows } from './populationProjection';
import mixedPopulation from '../data/mixedPopulation.json' with { type: 'json' };
import crabClips from '../data/crabClips.generated.json' with { type: 'json' };
import sailorClips from '../data/sailorClips.generated.json' with { type: 'json' };
import captainClips from '../data/captainClips.generated.json' with { type: 'json' };
import { ATTACK_TURN } from '@wildshard/engine/ai/hunt';
import { driftwoodJsonBlob as nameBlob } from './namedSchemas';
import nativePhysics from '../data/physics.generated.json' with { type: 'json' };
import { WAKE_ENCOUNTER } from './wakeEncounter';
import { NATIVE_QUEST_PROPS } from './nativeQuestProps';
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import authoredSpots from '../data/spotsRows.json' with { type: 'json' };
import { CHAPTER_DIRECTOR } from './chapterDirector';
import { PAGE_LIFE } from './pageLife';
import placeSets from '../data/placeSets.json' with { type: 'json' };
import { parse } from 'valibot';
import { CoverCompositionSchema, EntryLandingsSchema, PlaceSetsSchema } from './sections';
import coverComposition from '../data/coverComposition.json' with { type: 'json' };
import entryLandings from '../data/entryFloors.generated.json' with { type: 'json' };
import { parseWorldScene } from '@wildshard/format/clientChannels';
import piers from '../data/pierScenes.generated.json' with { type: 'json' };
import foliage from '../data/foliageScenes.generated.json' with { type: 'json' };
import { FIGURE_CATALOGUE } from './figureCatalogue';
import { QUEST_SERVICES } from './questServiceEffects';
import { TOON_LOOK } from './toonPresentation';
import { RETURN_PROGRAM, RETURN_WASM } from './returnProgram';
import ecology from '../data/ecology.json' with { type: 'json' };
import { DECLARED_SEA } from './sea';
import { siteCatalogue } from './siteCatalogue';
import rocks from '../data/rockScenes.generated.json' with { type: 'json' };
import wreckScene from '../data/wreckScene.json' with { type: 'json' };
import trailScene from '../data/trailScene.json' with { type: 'json' };
import clientPlan from '../data/clientPlan.json' with { type: 'json' };
import buildingLife from '../data/buildingLife.json' with { type: 'json' };
import coveScene from '../data/coveScene.json' with { type: 'json' };
import { WORLD_SCENES, SCENE_MODEL_BLOBS } from './worldScenes';
import cascadeScene from '../data/cascadeScene.json' with { type: 'json' };
import { HELD_ARMS } from './heldArms';
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
import directorModule from '../behaviour/director.json' with { type: 'json' };
import directorStages from '../data/finaleStages.json' with { type: 'json' };
import directorBindings from '../data/directorBindings.json' with { type: 'json' };
import monkeyClips from '../data/monkeyClips.generated.json' with { type: 'json' };
import traderStall from '../data/traderStall.json' with { type: 'json' };
import { PAGE_STORY } from './pageStory';
import { CAPTAIN_DECISION, CAPTAIN_MOVES, CAPTAIN_STRIKES, CAPTAIN_TARGETS } from './captainDecision';
import { completionRows } from './completion';
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
import { emitNamedBlobs } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { DRIFTWOOD_FEAT_COUNTERS } from './questInventory';
import { enemyPlacements } from './enemyPlacement';
import { keeperRows } from './keeperRows';
import { emitDefinedSections } from '@wildshard/sdk/sections';
import { DRIFTWOOD_OUTPUT } from '../generators/assets';
import { DRIFTWOOD_CLIENT_SECTIONS } from './clientSections';

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
const placed = enemyPlacements();
const values=[{name:'custom/assets',value:DRIFTWOOD_OUTPUT.custom},...DRIFTWOOD_CLIENT_SECTIONS, {name:'custom/enemyPlacements',value:placed}];
if(values.length!==Object.keys(schemas).length)throw new Error('Incomplete Driftwood section inventory');
const custom=emitDefinedSections(values.map(({name,value})=>{
 const schema=schemas[name],jsonSchema=WIRE_SCHEMAS[name];
 if(schema===undefined||jsonSchema===undefined)throw new Error(`Missing generated Driftwood section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
}));

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
const counterRows = { ...DRIFTWOOD_FEAT_COUNTERS, feats: DRIFTWOOD_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const sceneBytes = (value: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(parseWorldScene(value)));
const placements = emitNamedBlobs([nameBlob('actors/projection.json', 'json', new TextEncoder().encode(encodeCanonicalJson(populationProjectionRows()))), nameBlob('actors/page-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_LIFE))),

  nameBlob('world/place-sets.json', 'json', new TextEncoder().encode(JSON.stringify(parse(PlaceSetsSchema, placeSets)))),
  nameBlob('world/cover-composition.json', 'json', new TextEncoder().encode(JSON.stringify(parse(CoverCompositionSchema, coverComposition)))),
  nameBlob('world/entry-landings.json', 'json', new TextEncoder().encode(JSON.stringify(parse(EntryLandingsSchema, entryLandings)))),

  nameBlob('scenes/zipline.json', 'json', sceneBytes(piers.zipScene)),
  nameBlob('scenes/moorings.json', 'json', sceneBytes({ scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['lines'] }, { kind: 'mesh', id: 'lines', geometry: 'lines', material: 'still', missing: 'empty', castShadow: true }], materials: [{ kind: 'port', id: 'still', source: 'still' }] }, imports: [] })),
  ...piers.placements.map(row => nameBlob(`world/piers/${row.id}.json`, 'json', new TextEncoder().encode(JSON.stringify(row)))),
  nameBlob('world/foliage/logs.json', 'json', new TextEncoder().encode(JSON.stringify(foliage.logPlacement))),
  nameBlob('world/foliage/wreck-logs.json', 'json', new TextEncoder().encode(JSON.stringify(foliage.wreckLogPlacement))),
  ...['palms', 'hibiscus', 'reef', 'logs'].map(kind => nameBlob(`scenes/${kind}.json`, 'json', sceneBytes({ scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['mesh'] }, { kind: 'mesh', id: 'mesh', name: kind === 'reef' ? 'seabed' : kind === 'logs' ? 'ground-cover-driftwood' : kind, geometry: 'plant', material: 'plant', missing: 'empty', castShadow: kind !== 'reef', receiveShadow: true }], materials: [{ kind: 'port', id: 'plant', source: 'plant' }] }, imports: [] }))),
  ...(['phone', 'desktop'] as const).flatMap(tier => (['palms', 'hibiscus'] as const).map(kind => nameBlob(`world/foliage/${kind}-${tier}.json`, 'json', new TextEncoder().encode(JSON.stringify({ ...foliage.placements[tier][kind], id: `foliage.${kind === 'palms' ? 'palms' : 'bushes'}.${tier}` }))))),


  RETURN_WASM,
  nameBlob('sim/returns.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...ecology, program: RETURN_PROGRAM, water: DECLARED_SEA.level, fixed: ['sailor'], step: 'shard.driftwood-isle.installEcology' }))),
  nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE))),
  nameBlob('scenes/rocks.json', 'json', new TextEncoder().encode(encodeCanonicalJson(rocks.scene))),
  nameBlob('models/world-scenes.json', 'json', new TextEncoder().encode(encodeCanonicalJson(siteCatalogue()))),
  nameBlob('world/building-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(buildingLife))),
  nameBlob('scenes/wreck.json', 'json', new TextEncoder().encode(encodeCanonicalJson(wreckScene))),
  nameBlob('scenes/trail.json', 'json', new TextEncoder().encode(encodeCanonicalJson(trailScene))),
  nameBlob('scenes/cove.json', 'json', new TextEncoder().encode(encodeCanonicalJson(coveScene))),
  nameBlob('scenes/cascade.json', 'json', new TextEncoder().encode(encodeCanonicalJson(cascadeScene))),
  nameBlob('models/fixed-geometry.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(FixedGeometryGroupsSchema, fixedInventory.groups)))),
  nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...headlessAssembly, constants: { mixedPopulation: { ...mixedPopulation, attackTurnCap: ATTACK_TURN, practice: { ...mixedPopulation.practice, at: placed.practice, ...DRIFTWOOD_SPECIES_PROGRAMS.spawns.find(row => row.id === 'spawn.driftwood.practice')?.respawn }, poses: [{ kind: 'crab', clips: [crabClips] }, { kind: 'sailor', clips: [sailorClips], lift: [1.5, 1.5, -2.3, 6] }, { kind: 'captain', clips: [captainClips] }, { kind: 'monkey', clips: monkeyClips }] }, questProps: NATIVE_QUEST_PROPS, physics: nativePhysics, dayStyle: TOON_LOOK.sky.day, questKillSteps, entries: ENTRY_WALK, swords: headlessSwords, interact: DRIFTWOOD_INTERACT, interactSpots: authoredSpots.rows } }))),
  nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CHAPTER_DIRECTOR))),
  nameBlob('quests/wake-boss.json', 'json', new TextEncoder().encode(encodeCanonicalJson(WAKE_ENCOUNTER))),
  nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: directorModule.module, bytes: directorModule.bytes }, stages: directorStages, bindings: directorBindings, seed: 357 }))),
  nameBlob('poses/monkey.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ clips: monkeyClips, program: RETURN_PROGRAM }))),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall))),
  nameBlob('quests/trader.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(TRADER_PAGE)))),
  nameBlob('quests/steps.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestStepRows(questSteps)))),
  nameBlob('quests/hints.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestHintRows(questHints)))),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestServiceActions(QUEST_SERVICES)))),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),nameBlob('quests/discovery.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ places: DRIFTWOOD_PLACES, guide: GUIDE, glassCount: SEA_GLASS_COUNT, shardFlags: SHARD_FLAGS }))),
  nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(placed))),
  nameBlob('sim/keeper.json', 'json', new TextEncoder().encode(encodeCanonicalJson(keeperRows(placed))))]);
export const output = { ...DRIFTWOOD_OUTPUT, blobs: [...DRIFTWOOD_OUTPUT.blobs, ...SCENE_MODEL_BLOBS], platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['explore/catalogue', EXPLORER_CATALOGUE],['look/toon', TOON_LOOK], ['client/plan', clientPlan], ['world/scenes', WORLD_SCENES], ['held/arms', HELD_ARMS], ['ui/strings', strings], ['ui/completion', completionRows()], ['actors/species-programs', DRIFTWOOD_SPECIES_PROGRAMS], ['actors/return-scripts', [RETURN_PROGRAM.script]], ['sim/scripts', CAPTAIN_DECISION], ['actors/moves', CAPTAIN_MOVES], ['actors/strikes', CAPTAIN_STRIKES], ['world/targets',CAPTAIN_TARGETS]])), namedFiles: placements.files, assets: placements.assets, custom };

/** Root-mapped platform data is admitted before the canonical output writer. */
export const sections = { 'world/movers': { movers: MOVERS }, 'state/modes': { modes: DRIFTWOOD_MODES } };
