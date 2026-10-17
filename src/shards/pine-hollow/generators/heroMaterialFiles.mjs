/** Original per-tier hero PBR payloads, with the duplicate vertex data removed. */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {compactMaterialGlb} from './materialGlb.mjs';
import rows from '../data/heroRows.json' with {type:'json'};

const root=new URL('../../../../',import.meta.url);
const literal=path=>{const text=readFileSync(new URL(path,root),'utf8');return JSON.parse(text.slice(text.indexOf(' = {')+3,text.lastIndexOf('}')+1));};
export function heroMaterialFiles(){
 const gpu=literal('src/shards/pine-hollow/ktx2.generated.ts'),astc=literal('src/shards/pine-hollow/runtime/boot/astc6/ktx2.generated.ts');
 const aliases={},outputs={},costs=[];
 for(const source of rows.sources)for(const id of [source,`${source}-lod1`]){
  const original=`${rows.directory}/${id}/${id}.glb`,phone=original.replace('.glb','.phone.glb');
  const urls=[...new Set([original,phone,gpu.desktop[original],gpu.desktop[phone],gpu.phone[original],gpu.phone[phone],astc[original],astc[phone]].filter(url=>typeof url==='string'&&existsSync(new URL(`public${url}`,root))))];
  for(const url of urls){
   const before=readFileSync(new URL(`public${url}`,root)),bytes=compactMaterialGlb(before),hash=createHash('sha256').update(bytes).digest('hex'),target=`/assets/pine-hollow/baked/hero-materials/${hash}.glb`;
   aliases[url]=target;outputs[`public${target}`]=bytes;costs.push({original:url,before:before.length,after:bytes.length});
  }
 }
 return{aliases,outputs,costs};
}
