import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root=resolve(import.meta.dirname,'../../../..'),shard='src/shards/nalati-grasslands';
const read=file=>JSON.parse(readFileSync(resolve(root,shard,file),'utf8'));
const places=read('data/placeRuntime.generated.json'),specimens=read('data/specimens.generated.json');
const lanes=inflateSync(readFileSync(resolve(root,'public/assets/nalati/baked/places.bin'))),bytes=new Uint8Array(lanes.length);
if(lanes.length%4!==0)throw new Error('Place bake requires whole words');
for(let b=0;b<4;b++)for(let i=0;i<lanes.length/4;i++)bytes[i*4+b]=lanes[b*lanes.length/4+i];
const mesh=places.places.rows.find(row=>row.name==='actor:goat')?.meshes[0];if(mesh===undefined)throw new Error('Missing carried prop');
const g=mesh.geometry,size=g.attrs.reduce((sum,[,type,width])=>sum+Math.ceil(g.count*width*({f32:4,f16:2,u16:2,i8:1,u8:1}[type])/4)*4,0)+(g.index===null?0:g.indexCount*4);
const rows=v.parse(SpecimenCatalogueSchema,[{key:'prop',model:{id:'nalati-grasslands/kokpar-goat',name:'Kokpar goat',category:'props',pipeline:'code',file:'src/shards/nalati-grasslands/generators/carriedQuest.ts',defaults:{}},source:{kind:'inline',data:deflateSync(bytes.subarray(mesh.offset,mesh.offset+size),{level:9}).toString('base64'),geometry:g,material:specimens.materials.poi}}]);
const writer=byteWriter(process.argv.includes('--check'),'nalati-quest-prop');writer.put(resolve(root,shard,'data/questProp.generated.json'),jsonBytes(rows[0]));writer.finish();
