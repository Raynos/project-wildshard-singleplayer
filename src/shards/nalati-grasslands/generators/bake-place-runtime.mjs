import { placeFloors } from './placeFloors.mjs';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const shard = 'src/shards/nalati-grasslands';
const read = name => JSON.parse(readFileSync(resolve(root, shard, name), 'utf8'));
const catalogue = read('data/campCatalogue.json');
const places = read('data/places.json'), dressing = read('data/dressingGeos.json');
const bytes = g => g.attrs.reduce((n, [,type,size]) => n + Math.ceil(g.count * size * ({f32:4,u8:1,i8:1,u16:2,f16:2}[type]) / 4) * 4, 0) + (g.index === null ? 0 : g.indexCount * 4);
let at=0;
const rows=places.rows.map(row=>({...row,members:row.members.map(([id,member])=>[id,{...member,floors:member.floors.map(placeFloors)}]),instances: row.instances.map(([name, instance]) => {
 const asset = catalogue.find(entry => entry.source.asset?.instance?.name === name)?.source.asset;
 if (asset === undefined) throw new Error(`Missing asset declaration ${name}`);
 const matrices = instance.placements.flatMap(p => new Matrix4().compose(new Vector3(p.x,p.y,p.z), new Quaternion().setFromEuler(new Euler(p.pitch ?? 0,p.rot ?? 0,p.roll ?? 0,'YXZ')),new Vector3(p.sx ?? p.scale ?? 1,p.sy ?? p.scale ?? 1,p.sz ?? p.scale ?? 1)).toArray());
 return [name, { ...instance, asset, scene: {version:1,root:'copies',materials:[{kind:'port',id:'material',source:'material'}],nodes:[{kind:'mesh',id:'copies',name:`nalati-model-${name}`,geometry:'model',material:'material',instances:Math.max(1,instance.placements.length),matrices: matrices.length === 0 ? new Matrix4().makeScale(0,0,0).toArray() : matrices,missing:'empty',castShadow:instance.castShadow,receiveShadow:true}]}}];
}),meshes:row.meshes.map(mesh=>{const offset=at;at+=bytes(mesh.geometry);return {...mesh,offset};})}));
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
writer.put(resolve(root,shard,'data/placeRuntime.generated.json'),jsonBytes({places:{...places,rows},dressing:{...dressing,rows:shapes},view:{...view,smoke}}));
writer.put(resolve(root,shard,'boot/modelMetrics.generated.json'),jsonBytes(read('data/modelMetrics.json')));
writer.put(resolve(root,shard,'data/staticCapture.generated.json'),jsonBytes(read('data/staticCapture.json')));
const paint=read('data/poiPaint.json');
// G600 L8: the prepared shapes as fixed draw rows (game/models/fixedDraws): the actors' blocks in the place bake, the
// painted ones inline. The sign lettering's atlases are scene-dressing rows of their own (game/looks/lettering).
writer.put(resolve(root,shard,'data/shapeBook.generated.json'),jsonBytes({draws:[...rows.filter(row=>row.name.startsWith('actor:')).flatMap(row=>row.meshes.slice(0,1).map(mesh=>({slot:row.name.slice(6),channels:[],lane:{url:'/assets/nalati/baked/places.bin',offset:mesh.offset},baked:mesh.geometry}))),...paint.rows.map(({key,data,geometry})=>({slot:key,channels:[],inline:data,baked:geometry}))]}));
writer.finish();
