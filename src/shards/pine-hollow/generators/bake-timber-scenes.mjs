#!/usr/bin/env node
// Finish the shipping whole-geometry draws with their original weld and shadow proxies. D65: the timber world, its GLBs,
// the native code parts and the ground come from the program's sources.
import {Mesh,MeshStandardMaterial} from 'three';
import {GeometryPack,packedRows} from '@wildshard/sdk/kit/geometryPack';
import {readSourceModel} from '@wildshard/sdk/bake/skinned';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {readNativeTerrain} from '@wildshard/sdk/bake/terrain';
import {questSites} from './questSites.ts';
import {cabinAmbienceRows} from './ambience.ts';
import {timberWholeViews} from './timberWholeViews.ts';
import {bakeTimberCopy} from './timberScenes.ts';
import {hashImmutableBytes} from '@wildshard/sdk/immutable';
import {decodeBuildDeflate} from '@wildshard/sdk/bake/byteCodec';
import codeParts from '../data/codeParts.json' with {type:'json'};
import rideModels from '../data/questRideModels.json' with {type:'json'};
import {TERRAIN_SOURCE,TIMBER_SOURCE,perSources,sourceJson} from './pineSources.ts';

export async function timberNativeViews(sources){
 const authored=sourceJson(sources,TIMBER_SOURCE),meshes=[];
 try{
  for(const file of authored.shardfile.files.filter(row=>row.kind==='glb')){
   const input=sources.bytes(`assets/${file.hash}`);
   if(hashImmutableBytes(input)!==file.hash)throw new Error('Native timber source hash differs');
   const source=await readSourceModel(input);
   source.gltf.scene.traverse(node=>{if(node instanceof Mesh)meshes.push(node);});
  }
  return {authored,views:timberWholeViews(meshes)};
 }finally{for(const mesh of meshes){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}}
}
const timberRow=({parts,glass,colliders,floors,anchors})=>({parts,glass,colliders,floors,anchors});
/** The native code parts, inflated and checked against their declared hash. */
function codePartBytes(sources,label){
 const bytes=decodeBuildDeflate(sources.bytes(codeParts.url),codeParts.rows.bytes);
 if(hashImmutableBytes(bytes)!==codeParts.sha256)throw new Error(`${label} hash differs`);
 return bytes;
}
export async function bakeTimberSceneSources(sources){
 const {authored,views}=await timberNativeViews(sources),copies=[],geometry=new Map();
 const records=[['fire-lookout',authored.lookout,6],['zipline-landing',authored.sites.landing.world,4],
  ['zipline-landing-turntable',authored.sites.landing.turntable,4],['creek-footbridge',authored.sites.bridge.world,12],
  ['creek-footbridge-turntable',authored.sites.bridge.turntable,12]];
 try{
  for(const [identity,facts,pad] of records){
   const row=timberRow(facts),draws=new Map();
   for(const part of row.parts){if(part.counts.length===0)continue;const view=views.get(`${identity}-${part.key}`);if(view===undefined)throw new Error(`Missing native timber draw ${identity}/${part.key}`);draws.set(part.key,view.geometry.clone());}
   if(row.glass.length>0){const view=views.get(`${identity}-glass`);if(view===undefined)throw new Error(`Missing native timber glass ${identity}`);draws.set('glass',view.geometry.clone());}
   const baked=bakeTimberCopy(draws,row,identity,pad);copies.push(baked.copy);
   for(const [id,shape] of baked.geometry){if(geometry.has(id))throw new Error('Duplicate timber geometry');geometry.set(id,shape);}
  }
 }finally{for(const view of views.values())view.geometry.dispose();}
 const pack=new GeometryPack(codePartBytes(sources,'Native code part'),packedRows(codeParts.rows),'pine native code parts');
 for(const id of ['zip-cable','token-shelf','hollow-log-outer','hollow-log-inner','hollow-log-rim-0','hollow-log-rim-1','hollow-log-bed'])geometry.set(id,pack.geometry(codeParts.parts[id]));
 return {copies,geometry};
}
/** GR8 G31: the quest sites (the hollow log's floor and mouths, the rifle) over the page's baked ground. */
export function pineQuestSites(sources){
 return questSites(readNativeTerrain(sources.bytes(TERRAIN_SOURCE)).heightAt,cabinAmbienceRows(sources).floors);
}
/** GR8 G31: the quest rides' GLBs (data/questRideModels.json rows) by product name, from the native code parts. */
export function questRideGlbs(sources){
 const pack=new GeometryPack(codePartBytes(sources,'Quest ride code-part'),packedRows(codeParts.rows),'quest rides');
 const material=new MeshStandardMaterial({vertexColors:true}),glbs=[];
 try{
  for(const row of rideModels){
   const geometry=pack.geometry(codeParts.parts[row.index]);
   try{glbs.push([row.file,staticGlb([{geometry,material,compactIndex:true,nativeAttributes:true}],row.id)]);}
   finally{geometry.dispose();}
  }
 }finally{material.dispose();}
 return glbs;
}
async function bakeTimberScenes(sources){
 const {copies,geometry}=await bakeTimberSceneSources(sources),glbs=[],models=[],material=new MeshStandardMaterial();
 try{
  for(const [id,shape] of geometry){
   const name=`models/timbers/${id}.glb`,customAttributes={};
   for(const key of Object.keys(shape.attributes))if(!['position','normal','uv','uv1','color','tangent'].includes(key))customAttributes[`_${key.toUpperCase()}`]=key;
   glbs.push([name,staticGlb([{geometry:shape,material,compactIndex:true,nativeAttributes:true,customAttributes}])]);
   models.push({id,file:name,attributes:shape.hasAttribute('moss')?{moss:'aMoss'}:{}});
  }
  return {copies,geometry:models,glbs};
 }finally{material.dispose();for(const shape of geometry.values())shape.dispose();}
}
/** GR8 G31: the timber copies, the timbers library's geometry rows and every timber GLB by product name (not deduplicated),
 *  built once per sources (no scheduler job, no stored files under assets/). */
export const pineTimberScenes=perSources(bakeTimberScenes);
