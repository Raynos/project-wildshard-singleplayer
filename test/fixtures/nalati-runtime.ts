// oxlint-disable-next-line import/no-nodejs-modules -- Prepare native test metadata without a generated runtime handoff.
import { readFileSync } from 'node:fs';
import { placeRuntimeRows } from '../../src/shards/nalati-grasslands/generators/placeRuntimeSource.mjs';
import { buildDressingWire } from '../../src/shards/nalati-grasslands/generators/dressingProgram';
import specimens from './nalati-specimens-original.json' with {type:'json'};

const places: unknown = JSON.parse(readFileSync('test/fixtures/nalati-places-original.json', 'utf8'));
const dressing:unknown=JSON.parse(new TextDecoder().decode(buildDressingWire().document));
/** Original input envelope through the same defining algorithm, retaining historical asset locations. */
export const nalatiRuntimePacket=placeRuntimeRows(name=>{
  if(name==='data/places.json')return places;
  if(name==='data/campCatalogue.json')return specimens.catalogue;
  if(name==='dressing')return dressing;
  const input:unknown=JSON.parse(readFileSync(`src/shards/nalati-grasslands/${name}`,'utf8'));return input;
},value=>{const text=JSON.stringify(value);if(text===undefined)throw new Error('Missing original runtime value');const normalized:unknown=JSON.parse(text);return normalized;});
export const nalatiRuntime=nalatiRuntimePacket.runtime;
