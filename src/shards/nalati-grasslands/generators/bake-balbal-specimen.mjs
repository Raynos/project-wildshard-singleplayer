import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root=resolve(import.meta.dirname,'../../../..'),shard='src/shards/nalati-grasslands';
const read=file=>JSON.parse(readFileSync(resolve(root,shard,file),'utf8'));
const places=read('data/placeRuntime.generated.json'),specimens=read('data/specimens.generated.json'),metrics=read('data/modelMetrics.json');
const lanes=inflateSync(readFileSync(resolve(root,'public/assets/nalati/baked/places.bin'))),binary=new Uint8Array(lanes.length);
if(lanes.length%4!==0)throw new Error('Place bake requires whole words');
for(let b=0;b<4;b++)for(let i=0;i<lanes.length/4;i++)binary[i*4+b]=lanes[b*lanes.length/4+i];
const geometryBytes=row=>row.attrs.reduce((sum,[,type,width])=>sum+Math.ceil(row.count*width*({f32:4,f16:2,u16:2,i8:1,u8:1}[type])/4)*4,0)+(row.index===null?0:row.indexCount*4);
const generated={...specimens.assets.balbal,transform:{yaw:Math.PI,scale:2.15/metrics.sizes.balbal[1]}};
const carving=variant=>{
  const mesh=places.places.rows.find(row=>row.name===`actor:balbal:${variant}:2977`)?.meshes[0];
  if(mesh===undefined)throw new Error('Missing admitted balbal carving');
  return{kind:'inline',representation:'parts',data:deflateSync(binary.subarray(mesh.offset,mesh.offset+geometryBytes(mesh.geometry)),{level:9}).toString('base64'),geometry:mesh.geometry,material:specimens.materials.poi};
};
const catalogue=v.parse(SpecimenCatalogueSchema,[{key:'balbal',model:{id:'nalati-grasslands/balbal',name:'Balbal',category:'props',pipeline:['trellis','code'],file:'src/shards/nalati-grasslands/generators/places.ts',surface:'stone',defaults:{carved:null},
  variants:[{id:'generated',label:'TRELLIS.2',params:{}},{id:'bare',label:'Carved',params:{carved:'bare'}},{id:'capped',label:'Carved · cap',params:{carved:'capped'}}]},
  source:{kind:'selection',variants:[{params:{carved:null},source:{kind:'asset',asset:generated}},{params:{carved:'bare'},source:carving(0)},{params:{carved:'capped'},source:carving(1)}]}}]);
const writer=byteWriter(process.argv.includes('--check'),'nalati-balbal-specimen');
// the crown sites (game/boss/encounterView EncounterSites): every third stele capped, each a box that stops colliding while its warrior is awake
const sites={name:'nalati-balbal',label:'Balbal',file:'src/shards/nalati-grasslands/generators/places.ts',surface:'stone',variants:['bare','capped'],variantCycle:[1,0,0],sink:.18,collider:{hw:.42,hd:.33,top:2.2,bottom:1}};
writer.put(resolve(root,shard,'data/balbalSpecimen.generated.json'),jsonBytes({catalogue,generated,sites}));writer.finish();
