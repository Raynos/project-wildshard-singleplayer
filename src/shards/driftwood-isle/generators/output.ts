import { completionRows } from './completion';
import { TRADER_PAGE } from './traderPage';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { DRIFTWOOD_PLACES, GUIDE } from './discovery';
import { SEA_GLASS_COUNT, SHARD_FLAGS } from '../data/interactables';
import { DRIFTWOOD_MODES } from './modes';
import MOVERS from '../data/movers.generated.json' with { type: 'json' };
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { DRIFTWOOD_SPECIES_PROGRAMS } from './speciesPrograms';
import * as v from 'valibot';
import {SECTIONS,WIRE_SCHEMAS} from './sectionSchemas.generated';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { DRIFTWOOD_FEAT_COUNTERS } from './questInventory';
import { enemyPlacements } from './enemyPlacement';
import { keeperRows } from './keeperRows';
import { emitDefinedSections } from '@wildshard/sdk/sections';
import { DRIFTWOOD_OUTPUT } from '../generators/assets';
import { DRIFTWOOD_CLIENT_SECTIONS } from './clientSections';
import { RUNTIME_MIRRORS } from './runtimeMirrors';

const schemas:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
const values=[{name:'custom/assets',value:DRIFTWOOD_OUTPUT.custom},...DRIFTWOOD_CLIENT_SECTIONS];
if(values.length!==Object.keys(schemas).length)throw new Error('Incomplete Driftwood section inventory');
const custom=emitDefinedSections(values.map(({name,value})=>{
 const schema=schemas[name],jsonSchema=WIRE_SCHEMAS[name];
 if(schema===undefined||jsonSchema===undefined)throw new Error(`Missing generated Driftwood section: ${name}`);
 return {name,jsonSchema,value:v.parse(schema,value)};
}));

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
const placed = enemyPlacements();
const counterRows = { ...DRIFTWOOD_FEAT_COUNTERS, feats: DRIFTWOOD_FEAT_COUNTERS.feats.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['id', 'count', 'kind', 'event', 'variant'].includes(key)))) };
const placements = emitNamedBlobs([
  nameBlob('quests/trader.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseQuestPageInteractions(TRADER_PAGE)))),
  nameBlob('quests/achievements.json', 'json', new TextEncoder().encode(encodeCanonicalJson(parseAchievementCounterData(counterRows)))),nameBlob('quests/discovery.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ places: DRIFTWOOD_PLACES, guide: GUIDE, glassCount: SEA_GLASS_COUNT, shardFlags: SHARD_FLAGS }))),
  nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(placed))),
  nameBlob('sim/keeper.json', 'json', new TextEncoder().encode(encodeCanonicalJson(keeperRows(placed))))]);
export const output = { ...DRIFTWOOD_OUTPUT, platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([['ui/completion', completionRows()], ['actors/species-programs', DRIFTWOOD_SPECIES_PROGRAMS]])), namedFiles: placements.files, assets: placements.assets, custom };
/** Strict output copies prove the same constants the source mirror fixture checks. */
export const mirrors = [...RUNTIME_MIRRORS];

/** Root-mapped platform data is admitted before the canonical output writer. */
export const sections = { 'world/movers': { movers: MOVERS }, 'state/modes': { modes: DRIFTWOOD_MODES } };
