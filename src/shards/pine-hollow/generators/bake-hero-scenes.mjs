#!/usr/bin/env node
// Preserve original Float32 vertex channels; normalize transforms and cut both arch LODs at author time.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {MeshStandardMaterial} from 'three';
import {readSourceModel} from '@wildshard/sdk/bake/skinned';
import {staticGlb} from '@wildshard/sdk/bake/glb';
import {heroRestShape,alignHeroLod,heroHullPoints,disposeHeroSource,openedArch,closedArchPlane} from './heroScenes.ts';
import {heroMaterialFiles} from './heroMaterialFiles.mjs';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';
import rows from '../data/heroRows.json' with {type:'json'};
import authored from '../data/timberWorld.generated.json' with {type:'json'};

const root=new URL('../../../../',import.meta.url),project=new URL('../',import.meta.url);
const writer=byteWriter(process.argv.includes('--check'),'pine-hero-scenes'),geometry=new Map(),facts=[],blobs=[],geometryHashes={};
const material=new MeshStandardMaterial();
async function read(id,phone=false){
 const source=await readSourceModel(readFileSync(new URL(`public${rows.directory}/${id}/${id}${phone?'.phone':''}.glb`,root)));
 try{return heroRestShape(source);}finally{disposeHeroSource(source);}
}
function same(a,b,id){
 const names=Object.keys(a.attributes).sort();if(JSON.stringify(names)!==JSON.stringify(Object.keys(b.attributes).sort()))throw new Error(`Hero tier channels differ: ${id}`);
 for(const name of names){const p=a.getAttribute(name),q=b.getAttribute(name);if(p.count!==q.count||p.itemSize!==q.itemSize)throw new Error(`Hero tier shape differs: ${id}/${name}`);for(let i=0;i<p.count;i++)for(let k=0;k<p.itemSize;k++)if(p.getComponent(i,k)!==q.getComponent(i,k))throw new Error(`Hero tier bytes differ: ${id}/${name}`);}
 const p=a.getIndex(),q=b.getIndex();if(p?.count!==q?.count)throw new Error(`Hero tier index count differs: ${id}`);for(let i=0;i<(p?.count??0);i++)if(p.getX(i)!==q.getX(i))throw new Error(`Hero tier index differs: ${id}`);
}
function put(id,shape){geometry.set(id,shape);return id;}
try{
 for(const id of rows.sources){
  const fine=await read(id),phone=await read(id,true),coarse=await read(`${id}-lod1`);
  try{same(fine,phone,id);}finally{phone.dispose();}
  alignHeroLod(fine,coarse);
  const hull=heroHullPoints(coarse),near=put(`${id}-near`,fine),far=put(`${id}-far`,coarse);
  const source=rows.models.find(row=>row.sources.includes(id));if(source===undefined)throw new Error(`Hero model row missing: ${id}`);
  const collider={kind:'hull',x:0,y:0,z:0,surface:source.surface,points:hull};
  const shape={id,near,far,colliders:[collider],material:{near:`${rows.directory}/${id}/${id}.glb`,far:`${rows.directory}/${id}-lod1/${id}-lod1.glb`}};
  if(id==='cave-arch'){
   const box=row=>({kind:'box',x:row.x,y:row.y,z:row.z,hx:row.hx,hy:row.hy,hz:row.hz,surface:'rock'}),arch=authored.landmarks.archShape.coarse;
   shape.colliders=arch.boxes.map(box);
   shape.open={near:put('cave-arch-open-near',openedArch(fine,'fine')),far:put('cave-arch-open-far',openedArch(coarse,'coarse'))};
   shape.closed={plane:put('cave-arch-dark',closedArchPlane()),colliders:[...shape.colliders,box(arch.wall)],material:{kind:'standard',properties:{color:0x040404,roughness:1,metalness:0}}};
  }
  facts.push(shape);
 }
 for(const [id,shape] of geometry){const name=`models/heroes/${id}.glb`,source=`assets/hero-scenes/${id}.glb`;const encoded=staticGlb([{geometry:shape,material,compactIndex:true}]);writer.put(fileURLToPath(new URL(source,project)),encoded);geometryHashes[source]=createHash('sha256').update(encoded).digest('hex');blobs.push({name,kind:'glb',source});}
 const materials=heroMaterialFiles();
 for(const [path,bytes] of Object.entries(materials.outputs))writer.put(fileURLToPath(new URL(path,root)),bytes);
 writer.put(fileURLToPath(new URL('data/heroScenes.generated.json',project)),jsonBytes({blobs,geometryHashes,sources:facts,materialAliases:materials.aliases,materialCosts:materials.costs}));writer.finish();
}finally{material.dispose();for(const shape of geometry.values())shape.dispose();}
