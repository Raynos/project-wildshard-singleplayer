import * as v from 'valibot';
import {SECTIONS,WIRE_SCHEMAS} from './sectionSchemas.generated';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { enemyPlacements } from './enemyPlacement';
import { keeperRows } from './keeperRows';
import { emitDefinedSections } from '@wildshard/sdk/sections';
import { DRIFTWOOD_OUTPUT } from '../data/output';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../data/clientSections';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';

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
const placements = emitNamedBlobs([nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(placed))),
  nameBlob('sim/keeper.json', 'json', new TextEncoder().encode(encodeCanonicalJson(keeperRows(placed))))]);
export const output = { ...DRIFTWOOD_OUTPUT, namedFiles: placements.files, assets: placements.assets, custom };
/** Strict output copies prove the same constants the source mirror fixture checks. */
export const mirrors = [...RUNTIME_MIRRORS];
