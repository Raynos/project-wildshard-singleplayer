/** Finish native cabin welds, hosted instances and frozen specimens. GR8: the program bakes them from its sources (no
 *  scheduler job writes the GLBs or the rows); each row and GLB equals the retired pine-cabin-scenes outputs, and the rows
 *  keep the job's source names (`assets/cabin-scenes/…`) as the GLBs' and graphs' identities. */
import {BufferAttribute,MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {hashImmutableBytes} from '@wildshard/sdk/immutable';
import {installPortableMath} from '@wildshard/commons/bake/portableMath';
import {parseWorldSceneWeld} from '@wildshard/format/worldSceneWeld';
import {cabinSceneSources} from './cabinSceneSources.mjs';
import {CabinSceneRecorder} from './cabinScenes.ts';
import {perSources} from './pineSources.ts';

/** A row's bytes as the retired bake wrote them (two-space JSON and a newline), for its scene hash. */
const jsonBytes=value=>new TextEncoder().encode(`${JSON.stringify(value,null,2)}\n`);
export async function captureCabinScenes(sources,{portable=true}={}){
 const restore=portable?installPortableMath():undefined;
 try{
 const recorder=new CabinSceneRecorder(),worlds=[],specimens=[];
 for(const tier of ['phone','desktop']){
  const source=await cabinSceneSources(tier,sources);
  for(const shadow of [false,true]){
   const captured=recorder.world(source,shadow);
   worlds.push({tier,shadow,graph:parseWorldSceneWeld(captured.graph),registrations:captured.registrations});
   for(const entry of recorder.specimens(source,shadow)){
    const building=source.rows.buildings.find(row=>row.id===entry.id),cabin=building!==undefined&&!building.hamlet;
    if(cabin&&(!Number.isInteger(building.index)||building.index<0||building.index>2))throw new Error('Cabin specimen variant ordinal differs');
    const choice=cabin?['hollow','east','ridge'][building.index]:'only';
    specimens.push({tier,shadow,key:cabin?'log-cabin':entry.id,choice,graph:parseWorldSceneWeld(entry.scene)});
   }
  }
 }
 return{recorder,worlds,specimens};
 }finally{restore?.();}
}
/** The cabin scene rows (the retired job's `cabinScenes.generated.json`) and the raw GLB of each stored shape by its
 *  source name, baked once per sources. */
export const cabinSceneBake=perSources(async sources=>{
 const {recorder,worlds,specimens}=await captureCabinScenes(sources),blobs=[],geometry=[],geometryHashes={},sceneHashes={},graphs=[],canonical=new Map(),glbs=new Map();
 const material=new MeshStandardMaterial();
 try{
  for(const [index,[id,shape]]of [...recorder.geometry].entries()){
   const customAttributes={};
   for(const key of Object.keys(shape.attributes))if(!['position','normal','uv','uv1','color','tangent'].includes(key))customAttributes[`_${key.toUpperCase()}`]=key;
   const encoded=shape.clone();
   for(const [key,attribute]of Object.entries(shape.attributes)){
    if(attribute instanceof BufferAttribute)continue;
    const ArrayType=attribute.data.array.constructor,values=new ArrayType(attribute.count*attribute.itemSize);
    for(let vertex=0;vertex<attribute.count;vertex++)for(let channel=0;channel<attribute.itemSize;channel++)values[vertex*attribute.itemSize+channel]=attribute.data.array[vertex*attribute.data.stride+attribute.offset+channel];
    encoded.setAttribute(key,new BufferAttribute(values,attribute.itemSize,attribute.normalized));
   }
   // Partition only index storage. Each admitted segment retains identical
   // vertex channels; the generic intake restores the original index stream.
   const originalIndex=encoded.getIndex(),files=[];
   const count=originalIndex===null?1:Math.ceil(originalIndex.count/900_000);
   for(let segment=0;segment<count;segment++){
    const chunk=count===1?encoded:encoded.clone();
    if(count>1){
     if(originalIndex===null)throw new Error('Cabin indexed segment source absent');
     chunk.setIndex(new BufferAttribute(originalIndex.array.slice(segment*900_000,(segment+1)*900_000),1));
    }
    const bytes=staticGlb([{geometry:chunk,material,compactIndex:true,nativeAttributes:true,customAttributes}]),hash=hashImmutableBytes(bytes);
    if(chunk!==encoded)chunk.dispose();
    let file=canonical.get(hash);
    if(file===undefined){
     const label=count===1?id:`${id}-segment-${segment}`;
     file=`models/cabins/${label}.glb`;const source=`assets/cabin-scenes/${label}.glb`;
     canonical.set(hash,file);glbs.set(source,bytes);blobs.push({name:file,kind:'glb',source});geometryHashes[source]=hash;
    }
    files.push(file);
   }
   encoded.dispose();
   const[file,...segments]=files;if(file===undefined)throw new Error('Cabin geometry storage absent');
   geometry.push({id,library:`cabin-shapes-${Math.floor(index/128)}`,file,...(segments.length===0?{}:{segments}),attributes:{}});
  }
  const metadata=[];
  for(const world of worlds){
   const name=`scenes/cabins-${world.tier}-shadow-${world.shadow}.json`,source=`assets/cabin-scenes/world-${world.tier}-${world.shadow}.json`;
   blobs.push({name,kind:'json',source});sceneHashes[source]=hashImmutableBytes(jsonBytes(world.graph));
   graphs.push({file:name,graph:world.graph});
   metadata.push({tier:world.tier,shadow:world.shadow,file:name,registrations:world.registrations});
  }
  const cards=[];
  for(const specimen of specimens){
   const label=`${specimen.key}-${specimen.choice}-${specimen.tier}-${specimen.shadow}`,name=`scenes/cabins/specimens/${label}.json`,source=`assets/cabin-scenes/specimen-${label}.json`;
   blobs.push({name,kind:'json',source});sceneHashes[source]=hashImmutableBytes(jsonBytes(specimen.graph));
   graphs.push({file:name,graph:specimen.graph});
   cards.push({tier:specimen.tier,shadow:specimen.shadow,key:specimen.key,choice:specimen.choice,file:name});
  }
  return{rows:{blobs,geometry,geometryHashes,sceneHashes,worlds:metadata,specimens:cards,sourceMaterials:[...recorder.sourceMaterials.values()],graphs},glbs};
 }finally{material.dispose();for(const shape of recorder.geometry.values())shape.dispose();}
});
