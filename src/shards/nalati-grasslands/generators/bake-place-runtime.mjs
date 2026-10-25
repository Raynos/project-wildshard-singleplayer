import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { preparePlaceRuntime } from './placeRuntimeSource.mjs';
import { buildDressingWire } from './dressingProgram.ts';

const root=resolve(import.meta.dirname,'../../../..');
const shard='src/shards/nalati-grasslands';
const dressing=JSON.parse(new TextDecoder().decode(buildDressingWire().document));
const read=name=>name==='data/dressingGeos.json'?dressing:JSON.parse(readFileSync(resolve(root,shard,name),'utf8'));
const writer=byteWriter(process.argv.includes('--check'),'nalati-place-runtime');
for(const [name,bytes] of preparePlaceRuntime(read,jsonBytes))writer.put(resolve(root,shard,name),bytes);
writer.finish();
