import { readFileSync,writeFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Bone,Vector3,Skeleton,SkinnedMesh,MeshBasicMaterial } from 'three';
import { packedCreatureBodies } from '../../../src/game/plugin/geometry';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import { supportsRigidCorpseAnimation } from '../../../src/engine/entities/rigidCorpsePose';
import { iguanaClips } from './iguanaClips';
const root='art/driftwood-isle/approved-bloomthroat-iguana/'+(process.env['IGUANA_VERSION']??'v3')+'/';
const read=(name:string):unknown=>JSON.parse(readFileSync(root+name,'utf8'));
const numbers=v.array(v.number());
const source=v.parse(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:numbers})),parts:v.array(v.object({name:v.string(),positions:numbers,colorsLinear:numbers,skinIndices:numbers,skinWeights:numbers,furLen:numbers}))}),read('native-source.json'));
async function load(){const loader=packedCreatureBodies(read('metadata.json'),undefined,()=>Promise.resolve(new Uint8Array(readFileSync(root+'payload.bin'))));await loader.preload();return loader.copy('bloomthroat-iguana','bloomthroat-iguana');}
test('actual native decoder retains absolute binds and all typed attributes',async()=>{
 const body=await load();expect(body.bones).toEqual(source.bones);expect(body.hardParts).toHaveLength(source.parts.length);
 const attrs=[['position','positions'],['color','colorsLinear'],['skinIndex','skinIndices'],['skinWeight','skinWeights'],['furLen','furLen']] as const;
 body.hardParts.forEach((geometry,i)=>{const part=source.parts[i];if(part===undefined)throw new Error('Missing part');for(const [attribute,key]of attrs){const expected=key==='skinIndices'?new Uint16Array(part[key]):new Float32Array(part[key]);expect(geometry.getAttribute(attribute).array).toEqual(expected);}geometry.dispose();});
});
test('fresh owned copies have normalized blended tail and limb skin',async()=>{
 const a=await load(),b=await load();let blended=0;
 a.hardParts.forEach((g,i)=>{const other=b.hardParts[i];if(other===undefined)throw new Error('Missing geometry');expect(g).not.toBe(other);expect(g.getAttribute('position').array).not.toBe(other.getAttribute('position').array);const w=g.getAttribute('skinWeight');for(let j=0;j<w.count;j++){expect(Math.abs(w.getX(j)+w.getY(j)+w.getZ(j)+w.getW(j)-1)).toBeLessThan(1e-6);if(w.getY(j)>0)blended++;}g.dispose();other.dispose();});expect(blended).toBeGreaterThan(100);
});
async function rig(){
 const body=await load(),bones:Record<string,Bone>={};
 for(const def of source.bones){const joint=new Bone();joint.name=def.name;joint.position.fromArray(def.pos);if(def.parent!==null){const parent=bones[def.parent],rest=source.bones.find(row=>row.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3().fromArray(rest.pos));parent.add(joint);}bones[def.name]=joint;}
 const mem={},position=new Vector3();const context:AnimalRigContext={bones,dims:body.dims,dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const rootBone=bones['body'];if(rootBone===undefined)throw new Error('Missing root');rootBone.updateMatrixWorld(true);const skeleton=new Skeleton(Object.values(bones)),material=new MeshBasicMaterial(),meshes=body.hardParts.map(g=>{const m=new SkinnedMesh(g,material);m.bind(skeleton);return m;});
 return{context,bones,rootBone,skeleton,material,meshes,body};
}
test('actual numeric poses, weighted contact and core coverage measured without runtime claim',async()=>{
 const q=await rig(),animate=numericCreaturePose(iguanaClips());expect(supportsRigidCorpseAnimation(animate)).toBe(true);
 const rows: {state:string;minY:number;maxY:number;minZ:number;maxZ:number;coreOutside:number;coreVertices:number;headOutside:number;headVertices:number}[]=[];
 for(const [state,death,attack,speed]of [['idle',-1,-1,0],['walk',-1,-1,1],['tell',-1,.25,0],['strike',-1,.42,0],['recover',-1,.85,0],['hit',-1,-1,0],['dying',.5,-1,0],['dead',1,-1,0]] as const){
  let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity,coreOutside=0,coreVertices=0,headOutside=0,headVertices=0;
  for(let frame=0;frame<24;frame++){
   Object.assign(q.context,{t:frame*.13,state,deathT:death,alive:death<0,attack,speed,flinch:state==='hit'?.7:0});animate(q.context);q.rootBone.updateMatrixWorld(true);q.skeleton.update();
   expect(q.rootBone.position.toArray()).toEqual([0,.78,-.2]);
   for(const b of Object.values(q.bones)){expect([...b.position,...b.quaternion].every(Number.isFinite)).toBe(true);expect(b.scale.toArray()).toEqual([1,1,1]);}
   for(const [i,m]of q.meshes.entries()){
    const p=m.geometry.getAttribute('position');for(let j=0;j<p.count;j++){
     const w=m.applyBoneTransform(j,new Vector3().fromBufferAttribute(p,j));minY=Math.min(minY,w.y);maxY=Math.max(maxY,w.y);minZ=Math.min(minZ,w.z);maxZ=Math.max(maxZ,w.z);
     if(source.parts[i]?.name==='head'){headVertices++;const head=q.bones['head'];if(head===undefined)throw new Error('Missing head');if(head.worldToLocal(w.clone()).length()>q.body.dims.headRadius+1e-6)headOutside++;}
     if(source.parts[i]?.name==='body'){coreVertices++;const local=q.rootBone.worldToLocal(w.clone());const dz=Math.max(0,Math.abs(local.z)-q.body.dims.bodyHalfLen);if(Math.hypot(local.x,local.y,dz)>q.body.dims.bodyRadius+1e-6)coreOutside++;}
    }
   }
  }
  rows.push({state,minY,maxY,minZ,maxZ,coreOutside,coreVertices,headOutside,headVertices});
 }
 writeFileSync(root+'weighted-pose-contact.json',JSON.stringify({proof:'actual native consumer + numericCreaturePose + THREE weighted vertices; source only',rootLift:0,physicalDeathTested:false,runtimeAcceptance:false,rows},null,2)+'\n');
 for(const row of rows){expect(row.minY).toBeGreaterThan(-1e-6);expect(row.coreOutside).toBe(0);expect(row.headOutside).toBe(0);}
 q.context.deathT=1;q.context.t=3;animate(q.context);const final=Object.values(q.bones).flatMap(b=>[...b.position,...b.quaternion].map(x=>x===0?0:x));q.context.t=73;q.context.attack=.42;animate(q.context);expect(Object.values(q.bones).flatMap(b=>[...b.position,...b.quaternion].map(x=>x===0?0:x))).toEqual(final);
 for(const m of q.meshes)m.geometry.dispose();q.skeleton.dispose();q.material.dispose();
});
