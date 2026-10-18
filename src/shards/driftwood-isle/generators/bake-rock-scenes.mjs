#!/usr/bin/env node
// Exact finished world draws and Explorer cards. No prior geometry table is read.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MeshStandardMaterial} from 'three';
import {parseWorldScene} from '@wildshard/format/clientChannels';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {bakeRockScenes} from './rockScenes.ts';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const sources=json('src/shards/driftwood-isle/data/islandPlanFiles.json');
const phone=json(`public${sources.phone.url}`),desktop=json(`public${sources.desktop.url}`);
if(JSON.stringify(phone.smallRocks)!==JSON.stringify(desktop.smallRocks))throw new Error('Small-rock tier placements differ');
const shore=json('src/shards/driftwood-isle/data/shoreBoulders.generated.json');
const bake=bakeRockScenes(shore.placements,phone.smallRocks),writer=byteWriter(process.argv.includes('--check'),'driftwood-rock-scenes');
const material=new MeshStandardMaterial({vertexColors:true,flatShading:false,roughness:0.82});
try{
 const models=[];
 for(const [id,geometry] of bake.geometry){
  const file=`models/rocks/${id}.glb`,source=`assets/rock-scenes/${id}.glb`;
  writer.put(fileURLToPath(new URL(source,project)),staticGlb([{geometry,material,compactIndex:true}]));
  models.push({id,file,source});
 }
 const sphere=id=>{const geometry=bake.geometry.get(id);if(geometry===undefined)throw new Error(`Missing rock bounds: ${id}`);geometry.computeBoundingSphere();const bound=geometry.boundingSphere;if(bound===null)throw new Error(`Missing rock sphere: ${id}`);return {center:[...bound.center],radius:bound.radius};};
 const catalogue=bake.catalogue.map(row=>({key:row.key,id:row.id,name:row.name,file:'src/shards/driftwood-isle/data/rockScenes.generated.json',category:'nature',pipeline:'code',surface:'rock',assembly:'parts',defaults:row.defaults,variants:row.variants,
  choices:row.choices.map(choice=>({id:choice.id,params:choice.params,size:choice.size,colliders:choice.colliders.map(shape=>({...shape,...('points'in shape?{points:[...shape.points]}:{})})),draws:[{id:'rock',library:'rocks',model:choice.geometry,material:'rock',sphere:[...sphere(choice.geometry).center,sphere(choice.geometry).radius],castShadow:true,receiveShadow:true,renderOrder:0}]}))}));
 const scene=parseWorldScene({scene:{version:1,root:'root',nodes:[{kind:'group',id:'root',children:['shore','small']},
  {kind:'mesh',id:'shore',missing:'empty',geometry:'shore',material:'rock',castShadow:true,receiveShadow:true},
  {kind:'mesh',id:'small',missing:'empty',geometry:'small',material:'rock',castShadow:true,receiveShadow:true},
 ],materials:[{kind:'port',id:'rock',source:'rock'}]},imports:[]});
 const section={library:{id:'rocks',kind:'owned',models:models.map(({source:_source,...row})=>({...row,attributes:{}}))},
  step:{id:'rocks',scene:'scenes/rocks.json',geometry:{shore:{library:'rocks',model:'shore'},small:{library:'rocks',model:'small'}},materials:{rock:'rock'},
   registry:[],publish:{shore:{kind:'object',part:'shore'},small:{kind:'object',part:'small'}},bounds:['shore','small'].map(part=>({part,sphere:sphere(part)})),instanceAttributes:[]}};
 const copies=rows=>rows.map(row=>({...row,colliders:row.colliders.map(shape=>({...shape,...('points'in shape?{points:[...shape.points]}:{})}))}));
 writer.put(fileURLToPath(new URL('data/rockScenes.generated.json',project)),jsonBytes({blobs:models.map(({file,source})=>({name:file,source,kind:'glb'})),section,scene,catalogue,world:{shore:copies(bake.world.shore),small:copies(bake.world.small)}}));
 writer.finish();
}finally{material.dispose();for(const geometry of bake.geometry.values())geometry.dispose();}
