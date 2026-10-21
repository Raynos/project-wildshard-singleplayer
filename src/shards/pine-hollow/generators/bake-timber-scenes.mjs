#!/usr/bin/env node
// Finish the shipping whole-geometry draws with their original weld and shadow proxies.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {Mesh,MeshStandardMaterial} from 'three';
import {GeometryPack,packedRows} from '@wildshard/sdk/kit/geometryPack';
import {readSourceModel} from '@wildshard/sdk/bake/skinned';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {readNativeTerrain} from '@wildshard/sdk/bake/terrain';
import {questSites} from './questSites.ts';
import {timberWholeViews} from './timberWholeViews.ts';
import {bakeTimberCopy} from './timberScenes.ts';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';

const root=new URL('../../../../',import.meta.url),project=new URL('../',import.meta.url);
export async function timberNativeViews(){
 const authored=JSON.parse(readFileSync(new URL('data/timberWorld.generated.json',project),'utf8')),meshes=[];
 try{
  for(const file of authored.shardfile.files.filter(row=>row.kind==='glb')){
   const input=readFileSync(new URL(`assets/${file.hash}`,project));
   if(createHash('sha256').update(input).digest('hex')!==file.hash)throw new Error('Native timber source hash differs');
   const source=await readSourceModel(input);
   source.gltf.scene.traverse(node=>{if(node instanceof Mesh)meshes.push(node);});
  }
  return {authored,views:timberWholeViews(meshes)};
 }finally{for(const mesh of meshes){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}}
}
const timberRow=({parts,glass,colliders,floors,anchors})=>({parts,glass,colliders,floors,anchors});
export async function bakeTimberSceneSources(){
 const {authored,views}=await timberNativeViews(),copies=[],geometry=new Map();
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
 const parts=JSON.parse(readFileSync(new URL('data/codeParts.json',project),'utf8'));
 const packed=readFileSync(new URL(`public${parts.url}`,root));
 const bytes=Uint8Array.from(inflateSync(packed));
 if(createHash('sha256').update(bytes).digest('hex')!==parts.sha256)throw new Error('Native code part hash differs');
 const pack=new GeometryPack(bytes,packedRows(parts.rows),'pine native code parts');
 for(const id of ['zip-cable','token-shelf','hollow-log-outer','hollow-log-inner','hollow-log-rim-0','hollow-log-rim-1','hollow-log-bed'])geometry.set(id,pack.geometry(parts.parts[id]));
 return {copies,geometry};
}
function writeQuestRideScenes(writer){
 const parts=JSON.parse(readFileSync(new URL('data/codeParts.json',project),'utf8'));
 const bytes=Uint8Array.from(inflateSync(readFileSync(new URL(`public${parts.url}`,root))));
 if(createHash('sha256').update(bytes).digest('hex')!==parts.sha256)throw new Error('Quest ride code-part hash differs');
 const pack=new GeometryPack(bytes,packedRows(parts.rows),'quest rides');
 const material=new MeshStandardMaterial({vertexColors:true});
 const models=JSON.parse(readFileSync(new URL('data/questRideModels.json',project),'utf8'));
 try{
  for(const row of models){
   const geometry=pack.geometry(parts.parts[row.index]);
   try{writer.put(fileURLToPath(new URL(row.source,project)),staticGlb([{geometry,material,compactIndex:true,nativeAttributes:true}],row.id));}
   finally{geometry.dispose();}
  }
 }finally{material.dispose();}
}
export async function writeTimberScenes(){
 const {copies,geometry}=await bakeTimberSceneSources(),blobs=[],models=[],geometryHashes={};
 const writer=byteWriter(process.argv.includes('--check'),'pine-timber-scenes'),material=new MeshStandardMaterial();
 try{
  for(const [id,shape] of geometry){
   const name=`models/timbers/${id}.glb`,source=`assets/timber-scenes/${id}.glb`,customAttributes={};
   for(const key of Object.keys(shape.attributes))if(!['position','normal','uv','uv1','color','tangent'].includes(key))customAttributes[`_${key.toUpperCase()}`]=key;
   const encoded=staticGlb([{geometry:shape,material,compactIndex:true,nativeAttributes:true,customAttributes}]);
   writer.put(fileURLToPath(new URL(source,project)),encoded);geometryHashes[source]=createHash('sha256').update(encoded).digest('hex');
   blobs.push({name,kind:'glb',source});models.push({id,file:name,attributes:shape.hasAttribute('moss')?{moss:'aMoss'}:{}});
  }
  writer.put(fileURLToPath(new URL('data/timberScenes.generated.json',project)),jsonBytes({blobs,geometry:models,copies,geometryHashes,sites:questSites(readNativeTerrain(readFileSync(new URL('public/assets/baked/pine-hollow/terrain.bin',root))).heightAt)}));
  writeQuestRideScenes(writer);
  writer.finish();
 }finally{material.dispose();for(const shape of geometry.values())shape.dispose();}
}
if(import.meta.main)await writeTimberScenes();
