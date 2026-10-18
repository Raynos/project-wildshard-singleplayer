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
// The fixed camp emitters share one seeded instanced quad; no page-side scatter.
const view=read('data/worldView.json');
let seed=12345;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const attributes={aEmitter:[],aSeed:[],aCfg:[]},low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
let puffs=0;
for(const step of view.sequence){
 const place=places.rows.find(row=>row.name===step.name);if(place===undefined)continue;
 for(const [kind,point,options] of place.effects){
  if(kind!=='emitter')continue;
  const [x,y,z]=point,{size:[s0,s1]=[.35,2.8],puffs:count=12,rise=8,life=9}=options??{};
  for(const [i,v]of [x,y,z].entries()){low[i]=Math.min(low[i],v);high[i]=Math.max(high[i],i===1?v+rise+s1:v);}
  for(let i=0;i<count;i++){attributes.aSeed.push(random(),random(),random(),i/count+random()*.3/count);attributes.aEmitter.push(x,y,z);attributes.aCfg.push(rise,s0,s1,life);}
  puffs+=count;
 }
}
const centre=low.map((v,i)=>(v+high[i])/2),radius=Math.sqrt(high.reduce((sum,v,i)=>sum+(v-low[i])**2,0))/2+12;
const smoke={attributes,centre,radius,puffs};
const writer=byteWriter(process.argv.includes('--check'),'nalati-place-runtime');
writer.put(resolve(root,shard,'boot/placeRuntime.generated.json'),jsonBytes({places:{...places,rows},dressing:{...dressing,rows:shapes},view:{...view,smoke}}));
writer.put(resolve(root,shard,'boot/modelMetrics.generated.json'),jsonBytes(read('data/modelMetrics.json')));
writer.finish();
