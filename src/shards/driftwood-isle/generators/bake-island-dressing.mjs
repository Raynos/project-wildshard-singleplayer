import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {islandDressing} from './islandDressing.ts';
import {palmGeometry} from './palm.ts';
import {palm} from '../models/palm.ts';
import {hibiscusTransport,foliageTransport} from './hibiscusTransport.ts';
import {leafClump} from './hibiscus.ts';
import {hibiscusBush} from '../models/hibiscusBush.ts';
import {Rng} from '@wildshard/engine/core/rng';
import {seedOf} from '@wildshard/engine/models/model';
import {_buildAs} from '@wildshard/engine/core/tier';
import {MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';

const root=new URL('../../../../',import.meta.url),folder=new URL('public/assets/driftwood-isle/baked/',root);
mkdirSync(folder,{recursive:true});
const hibiscusFiles={},palmFiles={};
const emit=(bytes,extension,prefix='hibiscus')=>{const hash=createHash('sha256').update(bytes).digest('hex'),file=`${prefix}-${hash}.${extension}`;writeFileSync(new URL(file,folder),bytes);return `/assets/driftwood-isle/baked/${file}`;};
const data=await islandDressing(url=>new Uint8Array(readFileSync(new URL(`public${url}`,root))), (tier,geometry,originals,plan)=>{
 const files={world:emit(hibiscusTransport(geometry,originals,plan),'bin')};
 for(const variant of hibiscusBush.variants){
  const shape=leafClump({...hibiscusBush.defaults,...variant.params},new Rng(seedOf(hibiscusBush)));
  try{files[variant.id]=emit(staticGlb([{geometry:shape,material:new MeshStandardMaterial(),customAttributes:{_SWAY:'aSway'},compactIndex:true}],`hibiscus-${variant.id}`),'glb');}finally{shape.dispose();}
 }
 hibiscusFiles[tier]=files;
},(tier,geometry,originals,plan)=>{
 const files={world:emit(foliageTransport(geometry,originals,plan,0x314d4c50,['position','color','sway']),'bin','palm')};
 for(const variant of palm.variants){
  const shape=palmGeometry({...palm.defaults,...variant.params},new Rng(seedOf(palm)));
  try{files[variant.id]=emit(staticGlb([{geometry:shape,material:new MeshStandardMaterial(),customAttributes:{_SWAY:'sway'},compactIndex:true}],`palm-${variant.id}`),'glb','palm');}finally{shape.dispose();}
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
 tiers[row.tier]={clips:row.clips,cover:{url:`/assets/driftwood-isle/baked/${file}`,hash,bytes:row.cover.bytes.length,used:row.cover.used,floats:(row.cover.bytes.length-16)/4,rect:row.cover.rect}};
}
writeFileSync(new URL('../data/islandDressing.generated.json',import.meta.url),`${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.clips])))}\n`);
console.log('Island dressing: native triangle runs and two cropped full cover grids');
console.log(`cover-files ${JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([tier,row])=>[tier,row.cover])))}`);
