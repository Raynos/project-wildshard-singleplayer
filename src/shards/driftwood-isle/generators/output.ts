import brinePufferClips from '../data/brinePufferClips.generated.json' with { type: 'json' };
import conchDuelistClips from '../data/conchDuelistClips.generated.json' with { type: 'json' };
import splinterMantisClips from '../data/splinterMantisClips.generated.json' with { type: 'json' };
import bellbackClips from '../data/bellbackClips.generated.json' with { type: 'json' };
import tideRootColossusClips from '../data/tideRootColossusClips.generated.json' with { type: 'json' };
import { DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_MOVES, TIDAL_GIANTS_STRIKES } from './tidalGiantsCombat';
import { FIGURE_CATALOGUE } from './figureCatalogue';
import { QUEST_SERVICES } from './questServiceEffects';
import { TOON_LOOK } from './toonPresentation';
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
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
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
const placements = emitNamedBlobs([
  nameBlob('poses/brine-puffer.json', 'json', new TextEncoder().encode(encodeCanonicalJson(brinePufferClips))),
  nameBlob('poses/conch-duelist.json', 'json', new TextEncoder().encode(encodeCanonicalJson(conchDuelistClips))),
  nameBlob('poses/splinter-mantis.json', 'json', new TextEncoder().encode(encodeCanonicalJson(splinterMantisClips))),
  nameBlob('poses/bellback.json', 'json', new TextEncoder().encode(encodeCanonicalJson(bellbackClips))),
  nameBlob('poses/tide-root-colossus.json', 'json', new TextEncoder().encode(encodeCanonicalJson(tideRootColossusClips))),

  nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE))),
  nameBlob('scenes/rocks.json', 'json', new TextEncoder().encode(encodeCanonicalJson(rocks.scene))),
  nameBlob('models/world-scenes.json', 'json', new TextEncoder().encode(encodeCanonicalJson(siteCatalogue()))),
  nameBlob('world/building-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(buildingLife))),
  nameBlob('scenes/wreck.json', 'json', new TextEncoder().encode(encodeCanonicalJson(wreckScene))),
  nameBlob('scenes/trail.json', 'json', new TextEncoder().encode(encodeCanonicalJson(trailScene))),
  nameBlob('scenes/cove.json', 'json', new TextEncoder().encode(encodeCanonicalJson(coveScene))),
  nameBlob('scenes/cascade.json', 'json', new TextEncoder().encode(encodeCanonicalJson(cascadeScene))),
  nameBlob('models/fixed-geometry.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(FixedGeometryGroupsSchema, fixedInventory.groups)))),
  nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...headlessAssembly, constants: { dayStyle: TOON_LOOK.sky.day, questKillSteps, entries: ENTRY_WALK, swords: headlessSwords, interact: DRIFTWOOD_INTERACT } }))),
  nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: directorModule.module, bytes: directorModule.bytes }, stages: directorStages, bindings: directorBindings, seed: 357 }))),
  nameBlob('poses/monkey.json', 'json', new TextEncoder().encode(encodeCanonicalJson(monkeyClips))),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall))),
  nameBlob('quests/trader.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(TRADER_PAGE)))),
  nameBlob('quests/steps.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestStepRows(questSteps)))),
  nameBlob('quests/hints.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestHintRows(questHints)))),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestServiceActions(QUEST_SERVICES)))),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),nameBlob('quests/discovery.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ places: DRIFTWOOD_PLACES, guide: GUIDE, glassCount: SEA_GLASS_COUNT, shardFlags: SHARD_FLAGS }))),
  nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(placed))),
  nameBlob('sim/keeper.json', 'json', new TextEncoder().encode(encodeCanonicalJson(keeperRows(placed))))]);
export const output = { ...DRIFTWOOD_OUTPUT, blobs: [...DRIFTWOOD_OUTPUT.blobs, ...SCENE_MODEL_BLOBS], platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['look/toon', TOON_LOOK], ['client/plan', clientPlan], ['world/scenes', WORLD_SCENES], ['held/arms', HELD_ARMS], ['ui/strings', strings], ['ui/completion', completionRows()], ['actors/species-programs', DRIFTWOOD_SPECIES_PROGRAMS], ['sim/scripts', [...CAPTAIN_DECISION, ...DRIFTWOOD_REGULAR_DECISIONS, ...TIDAL_GIANTS_DECISIONS]], ['actors/moves', [...CAPTAIN_MOVES, ...DRIFTWOOD_REGULAR_MOVES, ...TIDAL_GIANTS_MOVES]], ['actors/strikes', [...CAPTAIN_STRIKES, ...DRIFTWOOD_REGULAR_STRIKES, ...TIDAL_GIANTS_STRIKES]], ['world/targets',CAPTAIN_TARGETS]])), namedFiles: placements.files, assets: placements.assets, custom };

/** Root-mapped platform data is admitted before the canonical output writer. */
export const sections = { 'world/movers': { movers: MOVERS }, 'state/modes': { modes: DRIFTWOOD_MODES } };
