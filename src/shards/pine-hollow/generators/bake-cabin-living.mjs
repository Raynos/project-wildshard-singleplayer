/** Record native live nodes separately from the sealed static/specimen bake. GR8: the program bakes them from its sources
 *  over the cabin scene rows (bake-cabin-scenes.mjs) in memory; each row and GLB equals the retired pine-cabin-living
 *  outputs, and the rows keep the job's source names (`assets/cabin-living/…`) as identities. */
import {BufferAttribute,MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {hashImmutableBytes} from '@wildshard/sdk/immutable';
import {installPortableMath} from '@wildshard/commons/bake/portableMath';
import {parseWorldSceneWeld} from '@wildshard/format/worldSceneWeld';
import {parseBuildingLifeRows} from '@wildshard/format/buildings';
import {cabinSceneSources} from './cabinSceneSources.mjs';
import {CabinSceneRecorder} from './cabinScenes.ts';
import {cabinSceneBake} from './bake-cabin-scenes.mjs';
import {perSources} from './pineSources.ts';

const slot=id=>id.startsWith('materials.')?id.slice('materials.'.length):id;
/** A row's bytes as the retired bake wrote them (two-space JSON and a newline), for its scene hash. */
const jsonBytes=value=>new TextEncoder().encode(`${JSON.stringify(value,null,2)}\n`);
export async function captureCabinLiving(sources){
 const restore=installPortableMath(),recorder=new CabinSceneRecorder(),profiles=[];
 try{
  for(const tier of ['phone','desktop']){
   const source=await cabinSceneSources(tier,sources);
   for(const shadow of [false,true])for(const shared of [false,true]){
    const captured=recorder.living(source,shadow,shared);
    profiles.push({tier,shadow,shared,graph:parseWorldSceneWeld(captured.graph),life:parseBuildingLifeRows(captured.life)});
   }
  }
  return{recorder,profiles};
 }finally{restore();}
}
/** The living cabin rows (the retired job's `cabinLivingScenes.generated.json`) and the raw GLB of each living shape the
 *  scene bake does not already store, by its source name, baked once per sources. */
export const cabinLivingBake=perSources(async sources=>{
 const original=(await cabinSceneBake(sources)).rows,{recorder,profiles}=await captureCabinLiving(sources);
 const material=new MeshStandardMaterial(),glbs=new Map();
 const blobs=[],geometry=[],geometryHashes={},sceneHashes={},canonical=new Map(),references=new Map();
 for(const [source,digest]of Object.entries(original.geometryHashes)){
  const blob=original.blobs.find(row=>row.source===source),model=original.geometry.find(row=>row.file===blob?.name&&row.segments===undefined);
  if(model!==undefined&&!canonical.has(digest))canonical.set(digest,{file:model.file,source});
 }
 try{
  for(const [id,shape]of recorder.geometry){
   const customAttributes={};
   for(const key of Object.keys(shape.attributes))if(!['position','normal','uv','uv1','color','tangent'].includes(key))customAttributes[`_${key.toUpperCase()}`]=key;
   const encoded=shape.clone();
   for(const [key,attribute]of Object.entries(shape.attributes)){
    if(attribute instanceof BufferAttribute)continue;
    const ArrayType=attribute.data.array.constructor,values=new ArrayType(attribute.count*attribute.itemSize);
    for(let vertex=0;vertex<attribute.count;vertex++)for(let channel=0;channel<attribute.itemSize;channel++)values[vertex*attribute.itemSize+channel]=attribute.data.array[vertex*attribute.data.stride+attribute.offset+channel];
    encoded.setAttribute(key,new BufferAttribute(values,attribute.itemSize,attribute.normalized));
   }
   const bytes=staticGlb([{geometry:encoded,material,compactIndex:true,nativeAttributes:true,customAttributes}]),digest=hashImmutableBytes(bytes);encoded.dispose();
   let stored=canonical.get(digest);
   if(stored===undefined){
    const file=`models/cabin-living/${id}.glb`,source=`assets/cabin-living/${id}.glb`;
    glbs.set(source,bytes);blobs.push({name:file,kind:'glb',source});stored={file,source};canonical.set(digest,stored);
   }
   geometryHashes[stored.source]=digest;
   const library=`cabin-living-${Math.floor(geometry.length/128)}`;
   geometry.push({id,library,file:stored.file,attributes:{}});
   references.set(JSON.stringify([`cabin-shapes-${Math.floor(Number(id.slice('shape-'.length))/128)}`,id]),{library,model:id});
  }
  const rows=[];
  for(const profile of profiles){
   const graph=structuredClone(profile.graph),resources=new Map();
   for(const node of graph.nodes){
    if('geometry'in node){
     const reference=references.get(JSON.stringify([node.geometry.library,node.geometry.model]));
     if(reference===undefined)throw new Error('Living geometry canonical reference absent');
     node.geometry=reference;resources.set(JSON.stringify([reference.library,reference.model]),reference);
    }
    if('material'in node)node.material=slot(node.material);
   }
   for(const row of graph.materials){row.id=slot(row.id);if(row.source!==undefined)row.source.material=slot(row.source.material);}
   const label=`${profile.tier}-${profile.shadow}-${profile.shared}`,name=`scenes/cabins/living/${label}.json`,source=`assets/cabin-living/${label}.json`;
   const bindings=[...resources].map(([key,reference])=>({key,id:`cabins.living.geometry.${reference.library}.${reference.model}`,source:reference}));
   const data={graph:parseWorldSceneWeld(graph),life:profile.life,geometry:bindings};
   blobs.push({name,kind:'json',source});sceneHashes[source]=hashImmutableBytes(jsonBytes(data));
   rows.push({tier:profile.tier,shadow:profile.shadow,shared:profile.shared,file:name,...data});
  }
  return{rows:{blobs,geometry,geometryHashes,sceneHashes,profiles:rows},glbs};
 }finally{material.dispose();for(const shape of recorder.geometry.values())shape.dispose();}
});
