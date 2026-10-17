import weatherProgram from '../data/weather.json' with { type: 'json' };
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { KNIFE_LOOK } from './knifeLook';
import toolPlayback from '../data/heldToolPlayback.json' with { type: 'json' };
import { PINE_MODES } from './zipline';
import { contractCatalogue } from './contractRows';
import { tradeCatalogue } from './trades';
import { PINE_CANOE } from './canoe';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { PINE_SPECIES_PROGRAMS } from './speciesPrograms';
import * as v from 'valibot';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { PINE_LANTERN_PAGE } from './questPageInteractions';
import { PINE_QUEST_CONSEQUENCES, PINE_CLOCK_CONSEQUENCES, PINE_MILL_DOOR } from './questConsequences';
import { PINE_QUEST_TRANSACTIONS } from './questTransactions';
import {emitDefinedSections} from '@wildshard/sdk/sections';
import {isJsonData} from '@wildshard/format/json';
import {SECTIONS,WIRE_SCHEMAS} from './sectionSchemas.generated';
import { nameBlob, emitNamedBlobs, type BlobSourceOptions } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { PINE_FEAT_COUNTERS, PINE_FEATS, PINE_BAG_ITEMS } from './questInventory';
import { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS, CABIN_LIFE } from '../data/cabinLook';
import { CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE, CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { NPC_FIGURE } from './peopleLook';
import { WEAPON_FINISHES } from '../data/weaponFinishes';
import { TIMBER_DRAWS, TIMBER_GLASS } from '../data/timberDraws';
import lookMaterials from '../data/lookMaterials.generated.json' with { type: 'json' };
import props from '../data/props.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import floorRows from '../data/floorLayout.generated.json' with { type: 'json' };
import { PINE_OUTPUT } from '../data/output';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';

/** Preserve logical names and tier selection while packing named geometry losslessly. */
function meshoptSource<T extends { kind: string; options?: BlobSourceOptions }>(row: T) {
  return row.kind === 'glb' ? { ...row, options: { ...row.options, meshopt: true } } : row;
}

const counterRows = { ...PINE_FEAT_COUNTERS, feats: PINE_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const clientJson=emitNamedBlobs([
  nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weatherProgram)))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),
  nameBlob('quests/trades.json', 'json', new TextEncoder().encode(encodeCanonicalJson(tradeCatalogue()))),
  nameBlob('quests/contracts.json', 'json', new TextEncoder().encode(encodeCanonicalJson(contractCatalogue()))),
  nameBlob('movers/canoe.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_CANOE))),
  ...([['quests/mill-door.json', PINE_MILL_DOOR], ['quests/consequences.json', PINE_QUEST_CONSEQUENCES], ['quests/clock.json', PINE_CLOCK_CONSEQUENCES], ['quests/transactions.json', PINE_QUEST_TRANSACTIONS]] as const).map(([name, rows]) =>
    nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(rows))))),
nameBlob('quests/lanterns.json','json',new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(PINE_LANTERN_PAGE)))),nameBlob('world/cabins.json','json',new TextEncoder().encode(encodeCanonicalJson({
 CABIN_DOOR_LOOK,CABIN_MOSS_LOOKS,CABIN_LIFE,CABIN_PBR,CABIN_MATERIALS,CABIN_GLASS_EMISSIVE,CABIN_LIGHT,HEARTH_LOOKS,TIMBER_DRAWS,TIMBER_GLASS,
}))), nameBlob('people/figure.json','json',new TextEncoder().encode(JSON.stringify(NPC_FIGURE))), nameBlob('world/floor.json','json',new TextEncoder().encode(JSON.stringify(floorRows))), nameBlob('world/prop-shapes.json','json',new TextEncoder().encode(JSON.stringify(timbers.propShapes))), nameBlob('world/props.json','json',new TextEncoder().encode(JSON.stringify(props))), nameBlob('loadout/finishes.json','json',new TextEncoder().encode(JSON.stringify(WEAPON_FINISHES))), nameBlob('look/runtime-graphs.json','json',new TextEncoder().encode(encodeCanonicalJson(lookMaterials.runtime)))]);

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
const custom=emitDefinedSections(Object.entries(schemas).map(([name,schema])=>{
 const value=name==='custom/questInventory'?{feats:PINE_FEATS,items:PINE_BAG_ITEMS}:name==='custom/heldToolPlayback'?{...toolPlayback,look:KNIFE_LOOK}:PINE_OUTPUT.custom[name],jsonSchema=WIRE_SCHEMAS[name];
 if(!isJsonData(value)||jsonSchema===undefined)throw new Error(`Missing generated Pine section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
}));

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT, platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['actors/species-programs', PINE_SPECIES_PROGRAMS]])), custom, namedFiles: clientJson.files, assets: clientJson.assets, blobs: PINE_OUTPUT.blobs.map(meshoptSource) };
/** The data/ values runtime/const.ts copies; the build proves the copied runtime still equals them. */
export const mirrors = [...RUNTIME_MIRRORS];

/** Build-only mode rows; page and native owners consume the admitted section. */
export const sections = { 'state/modes': { modes: PINE_MODES } };
