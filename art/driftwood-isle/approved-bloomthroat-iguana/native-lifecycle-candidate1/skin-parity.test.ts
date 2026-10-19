import { readFileSync } from 'node:fs';
import { Bone, Group, Matrix4, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { iguanaClips } from '../iguanaClips';
import type { AnimalRigContext } from '../../../../src/engine/entities/animalRig';
const folder='art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next';
test('manual contact transform equals actual native THREE weighted skin under translated rotated roots',async()=>{
 const metadata:unknown=JSON.parse(readFileSync(`${folder}/metadata.json`,'utf8'));
 const loader=packedCreatureBodies(metadata,undefined,()=>Promise.resolve(new Uint8Array(readFileSync(`${folder}/payload.bin`))));await loader.preload();
 const body=loader.copy('bloomthroat-iguana','bloomthroat-iguana'),root=new Group(),bones:Record<string,Bone>={};
 for(const row of body.bones){const bone=new Bone();bone.position.fromArray(row.pos);if(row.parent===null)root.add(bone);else{const parent=bones[row.parent],rest=body.bones.find(r=>r.name===row.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');bone.position.sub(new Vector3(...rest.pos));parent.add(bone);}bones[row.name]=bone;}
 root.updateMatrixWorld(true);const skeleton=new Skeleton(Object.values(bones)),material=new MeshBasicMaterial();
 const meshes=body.hardParts.map(g=>{const mesh=new SkinnedMesh(g,material);mesh.bind(skeleton);return mesh;});
 const mem={},position=new Vector3();const context:AnimalRigContext={bones,dims:body.dims,dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'idle',alive:false,deathT:1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const animate=numericCreaturePose(iguanaClips());
 let maximumError=0;
 for(const death of [0,.5,1]){
  context.deathT=death;animate(context);root.position.set(.3,.4,-.2);root.rotation.set(.9,-.6,1.2);root.updateMatrixWorld(true);skeleton.update();
  const transforms=body.bones.map(row=>{const b=bones[row.name];if(b===undefined)throw new Error('Missing bone');return new Matrix4().multiplyMatrices(b.matrixWorld,new Matrix4().makeTranslation(...row.pos).invert());});
  for(const mesh of meshes){const p=mesh.geometry.getAttribute('position'),indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
   for(let i=0;i<p.count;i++){const manual=new Vector3(),rest=new Vector3().fromBufferAttribute(p,i);for(let j=0;j<4;j++){const matrix=transforms[indices.getComponent(i,j)],w=weights.getComponent(i,j);if(matrix===undefined)throw new Error('Missing transform');manual.addScaledVector(rest.clone().applyMatrix4(matrix),w);}maximumError=Math.max(maximumError,manual.distanceTo(mesh.applyBoneTransform(i,rest.clone())));}
  }
 }
 expect(maximumError).toBeLessThan(1e-6);
 for(const mesh of meshes)mesh.geometry.dispose();skeleton.dispose();material.dispose();
});
