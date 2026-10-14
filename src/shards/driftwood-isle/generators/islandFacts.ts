import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as v from 'valibot';
import { protosFromMeshes, simplifiedProto, simplifierReady, type IslandProto } from '../runtime/looks/bakedIsland';
import { ISLAND_LOOK } from '../data/islandRows';

interface ProtoFacts { name:string;present:boolean;empty:boolean;min:{x:number;y:number;z:number};max:{x:number;y:number;z:number};half:number;top:number }
/** Prototype bounds and original rock fit dimensions; no vertices or placements are duplicated. */
export function prototypeFacts(name:string,proto:IslandProto|undefined):ProtoFacts {
 const box=new Box3(),point=new Vector3();
 if(proto!==undefined)for(let i=0;i<proto.pos.length;i+=3)box.expandByPoint(point.set(proto.pos[i]??0,proto.pos[i+1]??0,proto.pos[i+2]??0));
 const empty=box.isEmpty(),top=empty?0:Math.max(0,box.max.y);
 return {name,present:proto!==undefined,empty,min:empty?{x:0,y:0,z:0}:{x:box.min.x,y:box.min.y,z:box.min.z},max:empty?{x:0,y:0,z:0}:{x:box.max.x,y:box.max.y,z:box.max.z},
  half:empty?0.4:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2,top:top>0?top:0.25};
}
const isMesh=(o:Object3D):o is Mesh=>o instanceof Mesh;
/** The native Blender GLB and LOD recipe are the sole authority for these cheap metadata rows. */
export async function islandPrototypeFacts(readAsset:(url:string)=>Uint8Array):Promise<Uint8Array> {
 const base='/assets/models/driftwood-blender/';
 const meta=v.parse(v.object({protos:v.array(v.object({name:v.string()})),lod:v.record(v.string(),v.number())}),JSON.parse(new TextDecoder().decode(readAsset(`${base}island.json`))));
 await MeshoptDecoder.ready;await simplifierReady();
 const bytes=Uint8Array.from(readAsset(`${base}island.glb`));
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer,'');
 try {
  gltf.scene.updateMatrixWorld(true);const meshes:Mesh[]=[];gltf.scene.traverse(o=>{if(isMesh(o))meshes.push(o);});
  const protos=protosFromMeshes(meshes,meta.protos.map(p=>p.name),ISLAND_LOOK.protoPrefix);
  for(const [index,lo]of Object.entries(meta.lod)){const near=protos[Number(index)];if(near!==undefined)protos[lo]=simplifiedProto(near,ISLAND_LOOK.far.ratio,ISLAND_LOOK.far.error);}
  return new TextEncoder().encode(`${JSON.stringify(meta.protos.map((p,i)=>prototypeFacts(p.name,protos[i])))}\n`);
 }finally{gltf.scene.traverse(o=>{if(isMesh(o)){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});}
}
