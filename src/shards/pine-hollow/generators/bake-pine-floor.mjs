import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { pineFloorPlacements } from './floorPlacements.ts';

const root = resolve(import.meta.dirname, '../../../..');
const source = readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin')));
const trunks = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/physicsRows.json'),'utf8')).shelterTrees.map(([x,z,r])=>({x,z,r}));
const pass = pineFloorPlacements(trunks,source);
let step=pass.next(); while(!step.done) step=pass.next();
const places=step.value, kinds=['ferns','shrubs','litter','stones','moss','reeds'];
const counts=kinds.map(kind=>places[kind].length), count=counts.reduce((n,k)=>n+k,0), raw=new Uint8Array(32+count*12), view=new DataView(raw.buffer);
view.setUint32(0,0x46555357,true);view.setUint32(4,2,true);counts.forEach((n,i)=>view.setUint32(8+i*4,n,true));
const tints=[[.5,.78],[.8,1],[.7,.9],[.75,1],[.6,.85],[.75,1]];
let offset=32;for(const [kindIndex,kind] of kinds.entries())for(const row of places[kind]){
  const tint=tints[kindIndex];
  view.setUint16(offset,Math.round((row.x+250)/500*65535),true);view.setUint16(offset+2,Math.round((row.y+128)/256*65535),true);view.setUint16(offset+4,Math.round((row.z+250)/500*65535),true);
  view.setUint16(offset+6,Math.round(row.rot/(2*Math.PI)*65535),true);view.setInt8(offset+8,Math.round(row.nx*127));view.setInt8(offset+9,Math.round(row.nz*127));
  view.setUint8(offset+10,Math.round((row.scale-.5)*200));view.setUint8(offset+11,Math.round((row.r-tint[0])/(tint[1]-tint[0])*255));offset+=12;
}
const lanes=new Uint8Array(raw.length), words=raw.length/4;for(let i=0;i<words;i++)for(let j=0;j<4;j++)lanes[j*words+i]=raw[i*4+j];
const packed=deflateSync(lanes,{level:9}), hash=createHash('sha256').update(packed).digest('hex'), file=`public/assets/pine-hollow/baked/floor/${hash}.bin`;
mkdirSync(resolve(root,'public/assets/pine-hollow/baked/floor'),{recursive:true});writeFileSync(resolve(root,file),packed);
writeFileSync(resolve(root,'src/shards/pine-hollow/data/floor.generated.json'),`${JSON.stringify({url:file.slice(6),counts,bytes:packed.length,decoded:raw.length})}\n`);
console.log(JSON.stringify({file,counts,bytes:packed.length,decoded:raw.length}));
