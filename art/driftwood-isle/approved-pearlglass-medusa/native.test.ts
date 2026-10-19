import { readFileSync,writeFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { packedCreatureBodies } from '../../../src/game/plugin/geometry';
const rootPath=(name:string)=>root+name;
const root = 'art/driftwood-isle/approved-pearlglass-medusa/v2/';
const read = (name: string): unknown => JSON.parse(readFileSync(root + name, 'utf8'));
const numbers = v.array(v.number());
const source = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: numbers })), parts: v.array(v.object({ positions: numbers, colorsLinear: numbers, skinIndices: numbers, skinWeights: numbers, furLen: numbers })) }), read('native-source.json'));
async function load() {
 const loader = packedCreatureBodies(read('metadata.json'), undefined, () => Promise.resolve(new Uint8Array(readFileSync(root + 'payload.bin'))));
 await loader.preload(); return loader.copy('pearlglass-medusa', 'pearlglass-medusa');
}
test('actual native consumer preserves every typed mesh attribute and absolute bind', async () => {
 const body = await load(); expect(body.bones).toEqual(source.bones); expect(body.hardParts).toHaveLength(source.parts.length);
 expect(body.dims.bodyY).toBe(0); expect(body.dims.capsuleAxis).toBe('y');
 const attrs = [['position','positions'],['color','colorsLinear'],['skinIndex','skinIndices'],['skinWeight','skinWeights'],['furLen','furLen']] as const;
 body.hardParts.forEach((geometry, i) => { const part=source.parts[i]; if (part === undefined) throw new Error('Missing part');
  for (const [attribute,key] of attrs) { const actual=geometry.getAttribute(attribute); const expected=key==='skinIndices'?new Uint16Array(part[key]):new Float32Array(part[key]); expect(actual.array).toEqual(expected); }
  geometry.dispose();
 });
});
test('consumer produces independent fresh geometry with normalized multi-joint ribbon skin', async () => {
 const a=await load(), b=await load(); let blended=0;
 a.hardParts.forEach((geometry,i) => { const other=b.hardParts[i]; if (other === undefined) throw new Error('Missing clone'); expect(geometry).not.toBe(other); expect(geometry.getAttribute('position').array).not.toBe(other.getAttribute('position').array);
 const weights=geometry.getAttribute('skinWeight'); for(let j=0;j<weights.count;j++){ const sum=weights.getX(j)+weights.getY(j)+weights.getZ(j)+weights.getW(j); expect(Math.abs(sum-1)).toBeLessThan(1e-6); if(weights.getY(j)>0)blended++; } geometry.dispose(); other.dispose(); });
 expect(blended).toBeGreaterThan(500);
});

import { Bone,Vector3,Skeleton,SkinnedMesh,MeshBasicMaterial } from 'three';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import { supportsRigidCorpseAnimation } from '../../../src/engine/entities/rigidCorpsePose';
import { medusaClips } from './medusaClips';
import { medusaBrain,MEDUSA_SCALE,MEDUSA_ADMISSION } from './medusaBehavior';
function makeRig(){
 const bones:Record<string,Bone>={};
 for(const def of source.bones){const joint=new Bone();joint.name=def.name;joint.position.fromArray(def.pos);if(def.parent!==null){const parent=bones[def.parent],rest=source.bones.find(row=>row.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3().fromArray(rest.pos));parent.add(joint);}bones[def.name]=joint;}
 const mem={},position=new Vector3();
 const context:AnimalRigContext={bones,dims:{bodyY:0,bodyHalfLen:.72,bodyRadius:.63,headRadius:.42,legLen:0,feet:[],halfWidth:1.85},dt:1/60,t:0,seed:.7,scale:MEDUSA_SCALE,speed:0,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const root=bones['body'];if(root===undefined)throw new Error('Missing root');root.updateMatrixWorld(true);return{bones,context,root};
}
test('numeric idle pulse, attack, recovery, hit and death compile against own chain rig',()=>{
 const {context,bones}=makeRig(),animate=numericCreaturePose(medusaClips());expect(supportsRigidCorpseAnimation(animate)).toBe(true);
 const translations=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,bone.position.toArray()]));
 for(const attack of [-1,0,.28,.40,.60,.90,1])for(const death of [-1,0,.5,1]){context.attack=attack;context.deathT=death;context.alive=death<0;context.t+=.3;context.flinch=.5;animate(context);for(const [name,bone]of Object.entries(bones)){expect([...bone.position,...bone.quaternion,...bone.scale].every(Number.isFinite)).toBe(true);expect(bone.scale.toArray()).toEqual([1,1,1]);if(name!=='bell')expect(bone.position.toArray()).toEqual(translations[name]);}}
 context.deathT=1;animate(context);const final=Object.values(bones).flatMap(b=>[...b.position,...b.quaternion].map(x=>x===0?0:x));context.t=99;context.attack=.4;animate(context);expect(Object.values(bones).flatMap(b=>[...b.position,...b.quaternion].map(x=>x===0?0:x))).toEqual(final);
 expect(medusaBrain({x:0,z:0,r:3,y:1.6}).pattern).toBe('burst');expect(MEDUSA_ADMISSION.sharedArenaEnabled).toBe(false);
});
test('actual weighted live pose sweep clears floor at existing 1.2 m burst root and 0.35 scale',async()=>{
 const {context,root,bones}=makeRig(),body=await load(),skeleton=new Skeleton(Object.values(bones)),material=new MeshBasicMaterial(),animate=numericCreaturePose(medusaClips());
 const meshes=body.hardParts.map(geometry=>{const mesh=new SkinnedMesh(geometry,material);mesh.bind(skeleton);return mesh;});let min=Infinity,max=-Infinity;
 for(let i=0;i<=40;i++){context.t=i*.11;context.attack=i/40;context.flinch=i%7===0?.7:0;animate(context);root.updateMatrixWorld(true);skeleton.update();for(const mesh of meshes){const positions=mesh.geometry.getAttribute('position');for(let v=0;v<positions.count;v++){const transformed=mesh.applyBoneTransform(v,new Vector3().fromBufferAttribute(positions,v));const y=1.2+MEDUSA_SCALE*transformed.y;min=Math.min(min,y);max=Math.max(max,y);}}}
 writeFileSync(rootPath('live-pose-bounds.json'),JSON.stringify({proof:'actual THREE weighted pose sweep; fixed existing burst contact root, not gameplay capture',minY:min,maxY:max,rootY:1.2,scale:MEDUSA_SCALE,frames:41,runtimeAcceptance:false},null,2));expect(min).toBeGreaterThan(0);for(const mesh of meshes)mesh.geometry.dispose();skeleton.dispose();material.dispose();
});
import { FlightMotion } from '../../../src/engine/ai/flight';
import { MEDUSA_FLIGHT } from './medusaBehavior';
test('retains explicit standard-flight death rejection from actual weighted geometry',async()=>{
 const {context,root,bones}=makeRig(),body=await load(),skeleton=new Skeleton(Object.values(bones)),material=new MeshBasicMaterial(),animate=numericCreaturePose(medusaClips());
 const meshes=body.hardParts.map(geometry=>{const mesh=new SkinnedMesh(geometry,material);mesh.bind(skeleton);return mesh;});
 const flight=new FlightMotion(MEDUSA_FLIGHT),position={x:0,y:1.2,z:0};let minimum=Infinity;
 for(let frame=0;frame<=120;frame++){flight.step(1/60,position,false,()=>0);context.alive=false;context.deathT=Math.min(1,frame/48);context.t=frame/60;context.attack=-1;animate(context);root.updateMatrixWorld(true);skeleton.update();for(const mesh of meshes){const points=mesh.geometry.getAttribute('position');for(let i=0;i<points.count;i++)minimum=Math.min(minimum,position.y+MEDUSA_SCALE*mesh.applyBoneTransform(i,new Vector3().fromBufferAttribute(points,i)).y);}}
 expect(position.y).toBe(0);expect(minimum).toBeLessThan(0);
 writeFileSync(rootPath('rejected-flight-death.json'),JSON.stringify({proof:'actual FlightMotion plus weighted THREE death pose replay, 121 fixed steps',minimumVertexY:minimum,finalRootY:position.y,status:'REJECTED: standard flyer death penetrates; existing physical corpse admission required',runtimeAcceptance:false},null,2));
 for(const mesh of meshes)mesh.geometry.dispose();skeleton.dispose();material.dispose();
});
