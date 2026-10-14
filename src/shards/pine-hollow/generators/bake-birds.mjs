import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {bakeBirds} from './birds.ts';

const root=resolve(import.meta.dirname,'../../../..'),directory=resolve(root,'public/assets/pine-hollow/life');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sidecar=JSON.parse(readFileSync(resolve(directory,'birds.json'),'utf8'));
const desktop=await bakeBirds(new Uint8Array(readFileSync(resolve(directory,'birds.glb'))),sidecar);
const phone=await bakeBirds(new Uint8Array(readFileSync(resolve(directory,'birds.phone.glb'))),sidecar);
const key=hash(Buffer.concat([desktop.glb,phone.glb])),geometry=`birds-rest-${key}.glb`,phoneGeometry=`birds-rest-${key}.phone.glb`;
mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,geometry),desktop.glb);writeFileSync(resolve(directory,phoneGeometry),phone.glb);
writeFileSync(resolve(root,'src/shards/pine-hollow/data/ambientBirds.generated.json'),`${JSON.stringify({geometry:`/assets/pine-hollow/life/${geometry}`,atlasModel:'/assets/pine-hollow/life/birds.glb',models:desktop.models.map((model,index)=>({name:`bird_${index}`,...model}))})}\n`);
console.log(JSON.stringify({geometry,geometryBytes:desktop.glb.length,phoneGeometry,phoneGeometryBytes:phone.glb.length,models:desktop.models.length}));
