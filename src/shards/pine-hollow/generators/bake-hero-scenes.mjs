// GR8: the hero props' rest shapes, cut at author time with their original Float32 vertex channels, normalized
// transforms and both arch LODs. `pineHeroScenes` gives the hero facts and each shape's GLB by product name;
// sceneModelRows.ts names them in memory (no scheduler job, no stored files under assets/). The hero GLBs and the
// timber world's arch facts come from the program's sources (pineSources.ts).
import {MeshStandardMaterial} from 'three';
import {readSourceModel} from '@wildshard/sdk/bake/skinned';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {heroRestShape,alignHeroLod,heroHullPoints,disposeHeroSource,openedArch,closedArchPlane} from './heroScenes.ts';
import {heroModelSource} from './heroMaterialFiles.mjs';
import {perSources} from './pineSources.ts';
import {timberWorld} from './timberWorldRows.ts';
import rows from '../data/heroRows.json' with {type:'json'};

async function read(sources,id,phone=false){
 const source=await readSourceModel(sources.bytes(heroModelSource(id,phone)));
 try{return heroRestShape(source);}finally{disposeHeroSource(source);}
}
function same(a,b,id){
 const names=Object.keys(a.attributes).sort();if(JSON.stringify(names)!==JSON.stringify(Object.keys(b.attributes).sort()))throw new Error(`Hero tier channels differ: ${id}`);
 for(const name of names){const p=a.getAttribute(name),q=b.getAttribute(name);if(p.count!==q.count||p.itemSize!==q.itemSize)throw new Error(`Hero tier shape differs: ${id}/${name}`);for(let i=0;i<p.count;i++)for(let k=0;k<p.itemSize;k++)if(p.getComponent(i,k)!==q.getComponent(i,k))throw new Error(`Hero tier bytes differ: ${id}/${name}`);}
 const p=a.getIndex(),q=b.getIndex();if(p?.count!==q?.count)throw new Error(`Hero tier index count differs: ${id}`);for(let i=0;i<(p?.count??0);i++)if(p.getX(i)!==q.getX(i))throw new Error(`Hero tier index differs: ${id}`);
}
async function bakeHeroScenes(sources){
 const authored=timberWorld(sources),geometry=new Map(),facts=[],glbs=[],material=new MeshStandardMaterial();
 const put=(id,shape)=>{geometry.set(id,shape);return id;};
 try{
 for(const id of rows.sources){
  const fine=await read(sources,id),phone=await read(sources,id,true),coarse=await read(sources,`${id}-lod1`);
  try{same(fine,phone,id);}finally{phone.dispose();}
  alignHeroLod(fine,coarse);
  const hull=heroHullPoints(coarse),near=put(`${id}-near`,fine),far=put(`${id}-far`,coarse);
  const source=rows.models.find(row=>row.sources.includes(id));if(source===undefined)throw new Error(`Hero model row missing: ${id}`);
  const collider={kind:'hull',x:0,y:0,z:0,surface:source.surface,points:hull};
  const shape={id,near,far,colliders:[collider],material:{near:`${rows.directory}/${id}/${id}.glb`,far:`${rows.directory}/${id}-lod1/${id}-lod1.glb`}};
  if(id==='cave-arch'){
   const box=row=>({kind:'box',x:row.x,y:row.y,z:row.z,hx:row.hx,hy:row.hy,hz:row.hz,surface:'rock'}),arch=authored.landmarks.archShape.coarse;
   shape.colliders=arch.boxes.map(box);
   shape.open={near:put('cave-arch-open-near',openedArch(fine,'fine',authored.landmarks.archShape)),far:put('cave-arch-open-far',openedArch(coarse,'coarse',authored.landmarks.archShape))};
   shape.closed={plane:put('cave-arch-dark',closedArchPlane(authored.landmarks.archShape)),colliders:[...shape.colliders,box(arch.wall)],material:{kind:'standard',properties:{color:0x040404,roughness:1,metalness:0}}};
  }
  facts.push(shape);
 }
 for(const [id,shape] of geometry)glbs.push([`models/heroes/${id}.glb`,staticGlb([{geometry:shape,material,compactIndex:true}])]);
  return{sources:facts,glbs};
 }finally{material.dispose();for(const shape of geometry.values())shape.dispose();}
}

/** The hero facts (each source's near and far shapes, colliders, materials and the arch's open and closed forms) and
 *  each shape's GLB by product name, built once per sources. */
export const pineHeroScenes=perSources(bakeHeroScenes);
