import { pineJsonBlob as nameBlob } from './namedSchemas';
import { EXPLORER_CATALOGUE } from './explorerCatalogue';
import { CHAPTER_DIRECTOR } from './chapterDirector';
import { PINE_HULL_BOOK } from './riggedHulls';
import { PAGE_LIFE, LIFE_WASM } from './pageLife';
import logKit from '../data/logKit.json' with { type: 'json' };
import { PLACE_SETS } from './placeSets';
import { parseCoverAppearance } from '@wildshard/format/coverAppearance';
import coverAppearance from '../data/coverAppearance.json' with { type: 'json' };
import { parseQuestServiceActions } from '@wildshard/format/questSteps';
import keyedSky from '../data/keyedSky.generated.json' with { type: 'json' };
import skyKeyBlobs from '../data/skyKeyBlobs.generated.json' with { type: 'json' };
import elites from '../behaviour/elites.generated.json' with {type:'json'};
import strings from '../data/strings.json' with { type: 'json' };
import clientPlan from '../data/clientPlan.json' with { type: 'json' };
import { WORLD_SCENES, SCENE_BLOBS, SCENE_MODEL_BLOBS } from './worldScenes';
import { HELD_GEAR, HELD_FINISHES, HELD_TOOL_LIFETIME } from './heldGear';
import heldLoadout from '../data/loadout.json' with { type: 'json' };
import heldTuning from '../data/heldTuning.json' with {type:'json'};
import shelterLook from '../data/populationShelter.json' with { type: 'json' };
import { POPULATION_ENVIRONMENT } from './populationEnvironment';
import { POPULATION_ROSTER } from './population';
import nightModule from '../behaviour/night.generated.json' with { type: 'json' };
import persistence from '../data/persistence.json' with {type:'json'};
import PINE_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import headlessEntries from '../data/entryWalk.json' with { type: 'json' };
import headlessAssembly from '../data/headlessAssembly.json' with { type: 'json' };
import { WILDLIFE_DRAW } from './wildlifeDraw';
import directorData from '../data/director.json' with { type: 'json' };
import directorModule from '../behaviour/director.json' with { type: 'json' };
import directorStages from '../data/watchStages.json' with { type: 'json' };
import directorBindings from '../data/directorBindings.json' with { type: 'json' };
import { cabinAmbienceRows } from './ambience';
import traderStall from '../data/traderStall.json' with { type: 'json' };
import { PINE_PANELS } from './panels';
import { THRALL_CLIPS } from './thrallClips';
import thrallLook from '../data/thrallLook.json' with { type: 'json' };
import { PINE_QUEST_RUNTIME } from './questRuntime';
import { PAGE_STORY } from './pageStory';
import { KING_DECISION, KING_MOVES } from './kingDecision';
import weatherProgram from '../data/weather.json' with { type: 'json' };
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { KNIFE_LOOK } from './knifeLook';
import toolPlayback from '../data/heldToolPlayback.json' with { type: 'json' };
import { PINE_MODES } from './zipline';
import { contractCatalogue } from './contractRows';
import { tradeCatalogue, tradeExchange } from './trades';
import movers from '../data/movers.generated.json' with { type: 'json' };
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { PINE_SPECIES_PROGRAMS } from './speciesPrograms';
import * as v from 'valibot';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { PINE_LANTERN_PAGE } from './questPageInteractions';
import { PINE_QUEST_CONSEQUENCES, PINE_QUEST_SERVICES, PINE_MILL_DOOR } from './questConsequences';
import { PINE_QUEST_TRANSACTIONS } from './questTransactions';
import {emitDefinedSections} from '@wildshard/sdk/sections';
import {isJsonData} from '@wildshard/format/json';
import {SECTIONS,WIRE_SCHEMAS,CabinAmbienceSchema,NativeViewSchema,CabinSeedsSchema,parseTradeCatalogue,parseFloorRows,PoolGroundSchema} from './sectionSchemas.generated';
import { emitNamedBlobs, type BlobSourceOptions } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { PINE_FEAT_COUNTERS } from './questInventory';
import { CABIN_LIFE } from './cabinLook';
import { CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { FIGURE_CATALOGUE } from './figureCatalogue';
import { WEAPON_FINISHES } from './weaponFinishes';
import lookMaterials from '../data/lookMaterials.generated.json' with { type: 'json' };
import props from '../data/props.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import floorRows from '../data/floorLayout.generated.json' with { type: 'json' };
import { PINE_OUTPUT } from './outputInputs';
import grazers from '../data/grazers.generated.json' with { type: 'json' };
import { NATIVE_VIEW } from './nativeView';

/** Preserve logical names and tier selection while packing named geometry losslessly. */
function meshoptSource<T extends { kind: string; options?: BlobSourceOptions }>(row: T) {
  return row.kind === 'glb' ? { ...row, options: { ...row.options, meshopt: true } } : row;
}

v.parse(CabinSeedsSchema, timbers.cabins.seeds);
v.parse(PoolGroundSchema, timbers.poolGround);
const cabinAppearance = { CABIN_LIFE,CABIN_LIGHT,HEARTH_LOOKS };
const counterRows = { ...PINE_FEAT_COUNTERS, feats: PINE_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
function eliteCatalogueFight(fight: typeof elites.fights[number]) { return { ...fight, program: { ...fight.program, bytes: '' } }; }
const eliteFights = elites.fights.map(eliteCatalogueFight);
const elitePrograms = eliteFights.map(fight => fight.program);
const paintedRows=PINE_OUTPUT.custom['custom/paintedTextures'];
const coverTextureIds=new Set([...coverAppearance.kinds.map(row=>row.texture),'endGrain','glow']);
const coverTextures=Object.fromEntries(Object.entries(paintedRows.textures).filter(([key])=>coverTextureIds.has(key)));
const collectionTextures=Object.fromEntries(Object.entries(paintedRows.textures).filter(([key])=>!coverTextureIds.has(key)));
const clientJson=emitNamedBlobs([LIFE_WASM, nameBlob('actors/page-life.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_LIFE))),
nameBlob('look/cover-appearance.json','json',new TextEncoder().encode(encodeCanonicalJson(parseCoverAppearance({...coverAppearance,textures:coverTextures})))),nameBlob('actors/elites.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...elites, fights: eliteFights }))),...SCENE_BLOBS,nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(persistence))),
  nameBlob('look/wildlife-draw.json', 'json', new TextEncoder().encode(encodeCanonicalJson(WILDLIFE_DRAW))),
  nameBlob('look/native-view.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(NativeViewSchema, { ...NATIVE_VIEW, ...logKit })))),
  nameBlob('sim/headless-assembly.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ ...headlessAssembly, constants: { terrain: PINE_TERRAIN, entries: headlessEntries, environment: POPULATION_ENVIRONMENT } }))),
  nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(encodeCanonicalJson(CHAPTER_DIRECTOR))),
  nameBlob('directors/main.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ declaration: directorData, module: { module: directorModule.module, bytes: directorModule.bytes }, stages: directorStages, bindings: directorBindings, seed: 357 }))),
  nameBlob('actors/shelter.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ step: 'pine.rain-shelter', environment: 'pine.habitat', roster: 'pine.roster', weather: 'pine.air', herdLimit: 512, look: shelterLook, program: PAGE_LIFE.program }))),
  nameBlob('actors/roster.json', 'json', new TextEncoder().encode(encodeCanonicalJson(POPULATION_ROSTER))),
  nameBlob('world/ambience.json', 'json', new TextEncoder().encode(encodeCanonicalJson(v.parse(CabinAmbienceSchema, cabinAmbienceRows())))),
  nameBlob('quests/stall.json', 'json', new TextEncoder().encode(encodeCanonicalJson(traderStall))),
  nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_PANELS))),
  nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weatherProgram)))),
  nameBlob('quests/services.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestServiceActions(PINE_QUEST_SERVICES)))),
  nameBlob('quests/story.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PAGE_STORY))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),
  nameBlob('quests/exchange.json', 'json', new TextEncoder().encode(encodeCanonicalJson(tradeExchange()))),
  nameBlob('quests/contracts.json', 'json', new TextEncoder().encode(encodeCanonicalJson(contractCatalogue()))),
  ...([['quests/mill-door.json', PINE_MILL_DOOR], ['quests/consequences.json', PINE_QUEST_CONSEQUENCES], ['quests/transactions.json', PINE_QUEST_TRANSACTIONS]] as const).map(([name, rows]) =>
    nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(rows))))),
nameBlob('quests/lanterns.json','json',new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(PINE_LANTERN_PAGE)))),nameBlob('people/catalogue.json', 'json', new TextEncoder().encode(encodeCanonicalJson(FIGURE_CATALOGUE))), nameBlob('world/floor.json','json',new TextEncoder().encode(JSON.stringify(parseFloorRows(floorRows)))), nameBlob('world/prop-shapes.json','json',new TextEncoder().encode(JSON.stringify(timbers.propShapes))), nameBlob('world/props.json','json',new TextEncoder().encode(JSON.stringify(props))), nameBlob('loadout/finishes.json','json',new TextEncoder().encode(JSON.stringify(WEAPON_FINISHES)))]);

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
const custom=emitDefinedSections(Object.entries(schemas).map(([name,schema])=>{
 const value=name==='custom/cabinAppearance'?cabinAppearance:name==='custom/questRuntime'?PINE_QUEST_RUNTIME:name==='custom/tradeCatalogue'?parseTradeCatalogue(tradeCatalogue()):name==='custom/grazers'?grazers:name==='custom/thrallLook'?{pose:THRALL_CLIPS,...thrallLook}:name==='custom/runtimeGraphs'?lookMaterials.runtime:name==='custom/placeSets'?PLACE_SETS:name==='custom/cabinAmbience'?cabinAmbienceRows():name==='custom/paintedTextures'?{textures:collectionTextures,chalk:paintedRows.chalk}:name==='custom/heldToolPlayback'?{...toolPlayback,look:KNIFE_LOOK}:(PINE_OUTPUT.custom as Readonly<Record<string,unknown>>)[name],jsonSchema=WIRE_SCHEMAS[name];
 if(!isJsonData(value)||jsonSchema===undefined)throw new Error(`Missing generated Pine section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
}));

const held = PINE_OUTPUT.custom;
const coatRow = (key:string) => { const row=held['custom/paintedTextures'].textures[key]; if(row===undefined)throw new Error(`Missing coat texture ${key}`);return row; };
const heldEquipment = { ...heldTuning,
 playback: held['custom/heldPlayback'], inputs: held['custom/heldInputs'], sights: held['custom/heldSights'], action: held['custom/leverPlayback'],
 firearm: { ...held['custom/leverDetails'], asset: { url:'/assets/pine-hollow/weapons/lever-rifle.glb', parts:['steel','forend','stock','lever','hammer','bolt'] } },
 launcher: held['custom/crossbowPool'], hands: held['custom/handsPool'],
 tool: { ...HELD_TOOL_LIFETIME, ...held['custom/heldToolPlayback'], look:KNIFE_LOOK, url:'/assets/pine-hollow/weapons/skinning-knife.glb' },
 coatTextures: { map:coatRow('coatMap'), normalMap:coatRow('coatNormal'), armMap:coatRow('coatArm') },
};

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT, platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['explore/catalogue', EXPLORER_CATALOGUE],['look/rigged-hulls', PINE_HULL_BOOK], ['look/keyed-sky', keyedSky], ['client/plan', clientPlan], ['ui/strings', strings], ['world/scenes', WORLD_SCENES], ['held/finishes', HELD_FINISHES], ['held/gear', HELD_GEAR], ['held/loadout', heldLoadout], ['held/equipment', heldEquipment], ['actors/species-programs', PINE_SPECIES_PROGRAMS],['actors/spawn-scripts', [{ ...nightModule, bytes: '' }, ...elitePrograms]], ['actors/return-scripts', [PAGE_LIFE.program?.script]], ['sim/scripts', KING_DECISION],['actors/moves',KING_MOVES]])), custom, namedFiles: clientJson.files, assets: clientJson.assets, blobs: [...PINE_OUTPUT.blobs, ...SCENE_MODEL_BLOBS, ...skyKeyBlobs.blobs].map(meshoptSource) };

/** Build-only mode rows; page and native owners consume the admitted section. */
export const sections = { 'state/modes': { modes: PINE_MODES }, 'world/movers': { movers } };
