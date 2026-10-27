// The original ordered scatter, with instance uploads and native body placement fully authored. GR8 G28:
// `pinePropScenes` gives the scatter rows, the props library's geometry rows and each prop shape's GLB by product name;
// sceneModelRows.ts names them in memory (no scheduler job, no stored files under assets/). D65: the timber world's rows
// and the scans come from the program's sources.
import {Mesh,MeshStandardMaterial} from 'three';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {bakePropSceneRows} from './propSceneRows.ts';
import {pinePropShapes} from './propShapes.ts';
import {pinePropScan,pineProps} from './bake-pine-props.mjs';
import {TIMBER_SOURCE,perSources,sourceJson} from './pineSources.ts';

async function bakePropScenes(sources){
 const source=sourceJson(sources,TIMBER_SOURCE),rows=bakePropSceneRows(await pineProps(sources),source.propShapes);
 const [rocks,stumps,logs]=await Promise.all([pinePropScan(sources,'rock_moss_set_01'),pinePropScan(sources,'tree_stump_01'),pinePropScan(sources,'dead_tree_trunk')]);
 const shapes=pinePropShapes({rocks,stumps,logs}),models=[],geometry=[];
 if(JSON.stringify(shapes.rows)!==JSON.stringify(source.propShapes))throw new Error('Prop rest facts differ from admitted timber bake');
 const material=new MeshStandardMaterial(),owned=[];
 shapes.piece.traverse(node=>{if(node instanceof Mesh)owned.push(node);});
 try{
  for(const node of owned){
   const name=`models/props/${node.name}.glb`;
   models.push([name,staticGlb([{geometry:node.geometry,material,compactIndex:true,nativeAttributes:true}])]);geometry.push({id:node.name,file:name,attributes:{}});
  }
 }finally{material.dispose();for(const node of owned){node.geometry.dispose();for(const sourceMaterial of Array.isArray(node.material)?node.material:[node.material])sourceMaterial.dispose();}}
 return{rows,geometry,models};
}

/** The prop scenes, built once per sources. */
export const pinePropScenes=perSources(bakePropScenes);
