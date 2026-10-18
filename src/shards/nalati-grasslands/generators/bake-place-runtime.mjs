import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const shard = 'src/shards/nalati-grasslands';
const read = name => JSON.parse(readFileSync(resolve(root, shard, name), 'utf8'));
const places = read('data/places.json'), dressing = read('data/dressingGeos.json');
const bytes = g => g.attrs.reduce((n, [,type,size]) => n + Math.ceil(g.count * size * ({f32:4,u8:1,i8:1,u16:2,f16:2}[type]) / 4) * 4, 0) + (g.index === null ? 0 : g.indexCount * 4);
let at=0;
const rows=places.rows.map(row=>({...row,meshes:row.meshes.map(mesh=>{const offset=at;at+=bytes(mesh.geometry);return {...mesh,offset};})}));
if(at!==places.bytes)throw new Error('Place rows do not cover their binary');
at=0;const shapes=dressing.rows.map(row=>{const offset=at;at+=bytes(row.geometry);return {...row,offset};});
if(at!==dressing.bytes)throw new Error('Dressing rows do not cover their binary');
const writer=byteWriter(process.argv.includes('--check'),'nalati-place-runtime');
writer.put(resolve(root,shard,'boot/placeRuntime.generated.json'),jsonBytes({places:{...places,rows},dressing:{...dressing,rows:shapes}}));
writer.finish();
