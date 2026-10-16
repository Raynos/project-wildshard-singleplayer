import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bakeIslandPlan,islandPlacements} from './islandCover.ts';
import {islandDressing} from './islandDressing.ts';
import {palmGeometry} from './palm.ts';
import {palm} from '../runtime/models/palm.ts';
import {hibiscusTransport,foliageTransport} from './hibiscusTransport.ts';
import {leafClump} from './hibiscus.ts';
import {hibiscusBush} from '../runtime/models/hibiscusBush.ts';
import {Rng} from '@wildshard/engine/core/rng';
import {seedOf} from '@wildshard/engine/models/model';
import {_buildAs} from '@wildshard/engine/core/tier';
import {MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
mkdirSync(folder,{recursive:true});
const hibiscusFiles={},palmFiles={},blobs=namedBlobOutput(new URL('../',import.meta.url),'driftwood-dressing-blobs');
const emit=(bytes,extension,prefix,name)=>{const hash=createHash('sha256').update(bytes).digest('hex'),file=`${prefix}-${hash}.${extension}`;writeFileSync(new URL(file,folder),bytes);const url=`/assets/driftwood-isle/baked/${file}`;if(name!==undefined)blobs.add(name,extension,bytes,url);return url;};
const data=await islandDressing(url=>new Uint8Array(readFileSync(new URL(`public${url}`,root))), (tier,geometry,originals,plan)=>{
 const files={world:emit(hibiscusTransport(geometry,originals,plan),'bin','hibiscus',`world/hibiscus/${tier}.bin`)};
 for(const variant of hibiscusBush.variants){
  const shape=leafClump({...hibiscusBush.defaults,...variant.params},new Rng(seedOf(hibiscusBush)));
  try{files[variant.id]=emit(staticGlb([{geometry:shape,material:new MeshStandardMaterial(),customAttributes:{_SWAY:'aSway'},compactIndex:true}],`hibiscus-${variant.id}`),'glb','hibiscus',`models/hibiscus/${tier}/${variant.id}.glb`);}finally{shape.dispose();}
 }
 hibiscusFiles[tier]=files;
},(tier,geometry,originals,plan)=>{
 const files={world:emit(foliageTransport(geometry,originals,plan,0x314d4c50,['position','color','sway']),'bin','palm',`world/palms/${tier}.bin`)};
 for(const variant of palm.variants){
  const shape=palmGeometry({...palm.defaults,...variant.params},new Rng(seedOf(palm)));
  try{files[variant.id]=emit(staticGlb([{geometry:shape,material:new MeshStandardMaterial(),customAttributes:{_SWAY:'sway'},compactIndex:true}],`palm-${variant.id}`),'glb','palm',`models/palms/${tier}/${variant.id}.glb`);}finally{shape.dispose();}
 }
 palmFiles[tier]=files;
});
_buildAs(null);
console.log(`hibiscus-files ${JSON.stringify(hibiscusFiles)}`);
console.log(`palm-files ${JSON.stringify(palmFiles)}`);
const tiers={};
for(const row of data.tiers){
 const hash=createHash('sha256').update(row.cover.bytes).digest('hex'),file=`island-cover-${hash}.bin`;
 writeFileSync(new URL(file,folder),row.cover.bytes);
 blobs.add(`world/cover/${row.tier}.bin`,'bin',row.cover.bytes,`/assets/driftwood-isle/baked/${file}`);
 tiers[row.tier]={clips:row.clips,cover:{url:`/assets/driftwood-isle/baked/${file}`,hash,bytes:row.cover.bytes.length,used:row.cover.used,floats:(row.cover.bytes.length-16)/4,rect:row.cover.rect}};
}
writeFileSync(new URL('../data/islandDressing.generated.json',import.meta.url),`${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.clips])))}\n`);
console.log('Island dressing: native triangle runs and two cropped full cover grids');
console.log(`cover-files ${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.cover])))}`);

writeFileSync(new URL('../data/foliagePlacements.generated.json',import.meta.url),`${JSON.stringify({seed:data.seed,gullPerches:data.gullPerches,tiers:Object.fromEntries(data.tiers.map(row=>[row.tier,row.foliage]))})}\n`);

const islandBase=new URL('public/assets/models/driftwood-blender/',root);
const islandMeta=JSON.parse(readFileSync(new URL('island.json',islandBase),'utf8'));
const placementBytes=readFileSync(new URL('placements.bin',islandBase)),planFiles={};
for(const tier of ['phone','desktop']){
 const plan=bakeIslandPlan(islandPlacements(Uint8Array.from(placementBytes).buffer),islandMeta,tier==='phone');
 const packed={...plan,families:plan.families.map(row=>({...row,boxes:Buffer.from(Float32Array.from(row.boxes).buffer).toString('base64')}))};
 const bytes=new TextEncoder().encode(JSON.stringify(packed));
 planFiles[tier]={url:emit(bytes,'json','island-plan'),bytes:bytes.length,used:plan.used};
}
console.log(`island-plan-files ${JSON.stringify(planFiles)}`);

blobs.finish(new URL('../data/dressingBlobs.generated.json',import.meta.url));
