#!/usr/bin/env node
// The original ordered scatter, with instance uploads and native body placement fully authored.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Mesh,MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {bakePropSceneRows} from './propSceneRows.ts';
import {pinePropShapes} from './propShapes.ts';
import {pinePropScan} from './bake-pine-props.mjs';
import {byteWriter} from '../../../../scripts/bake-output.mjs';

const project=new URL('../',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,project),'utf8'));
const source=read('data/timberWorld.generated.json'),placements=read('data/props.json');
const rows=bakePropSceneRows(placements,source.propShapes);
const writer=byteWriter(process.argv.includes('--check'),'pine-prop-scenes');
const [rocks,stumps,logs]=await Promise.all([pinePropScan('rock_moss_set_01'),pinePropScan('tree_stump_01'),pinePropScan('dead_tree_trunk')]);
const shapes=pinePropShapes({rocks,stumps,logs}),blobs=[],geometry=[];
if(JSON.stringify(shapes.rows)!==JSON.stringify(source.propShapes))throw new Error('Prop rest facts differ from admitted timber bake');
const material=new MeshStandardMaterial(),owned=[];
shapes.piece.traverse(node=>{if(node instanceof Mesh)owned.push(node);});
try{
 for(const node of owned){
  const id=node.name,name=`models/props/${id}.glb`,path=`assets/prop-scenes/${id}.glb`;
  writer.put(fileURLToPath(new URL(path,project)),staticGlb([{geometry:node.geometry,material,compactIndex:true,nativeAttributes:true}]));
  blobs.push({name,kind:'glb',source:path});geometry.push({id,file:name,attributes:{}});
 }
}finally{material.dispose();for(const node of owned){node.geometry.dispose();for(const sourceMaterial of Array.isArray(node.material)?node.material:[node.material])sourceMaterial.dispose();}}
writer.put(fileURLToPath(new URL('data/propScenes.generated.json',project)),`${JSON.stringify({...rows,blobs,geometry},(_key,value)=>value instanceof Float32Array?[...value]:value,2)}\n`);
writer.finish();
