import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Vector3, Vector4, Skeleton, SkinnedMesh, MeshBasicMaterial, Matrix4 } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
const dir = 'art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate';
const fixtureSchema = v.object({ sourceSha256:v.string(),validation:v.unknown(),metadata:v.unknown(),payloadBase64:v.string() });
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');

test('unchanged static source survives actual codec, Three bind skin and normal transform', async()=>{
 const decoded=[];
 for(const key of ['original','candidate']){
  const f=v.parse(fixtureSchema,JSON.parse(execFileSync('python3',[`${dir}/prepare.py`,key],{maxBuffer:8000000}).toString()));
  const payload=new Uint8Array(Buffer.from(f.payloadBase64,'base64'));
  const decoder=packedCreatureBodies(f.metadata,undefined,()=>Promise.resolve(payload));await decoder.preload();
  decoded.push({body:decoder.copy('brine-puffer','brine-puffer'),source:f.sourceSha256,payload:createHash('sha256').update(payload).digest('hex')});
 }
 const original=decoded[0],candidate=decoded[1];if(original===undefined||candidate===undefined)throw new Error('Missing fixture');
 expect(candidate.body.bones).toEqual(original.body.bones);expect(candidate.body.dims).toEqual(original.body.dims);
 const table:Record<string,Bone>={},ordered:Bone[]=[];
 for(const def of candidate.body.bones){const bone=new Bone();bone.name=def.name;bone.position.fromArray(def.pos);
  if(def.parent!==null){const parent=table[def.parent],pd=candidate.body.bones.find(x=>x.name===def.parent);if(parent===undefined||pd===undefined)throw new Error('Missing parent');bone.position.sub(new Vector3(...pd.pos));parent.add(bone);}
  table[def.name]=bone;ordered.push(bone);
 }
 const root=table['body'];if(root===undefined)throw new Error('Missing root');root.updateMatrixWorld(true);const skeleton=new Skeleton(ordered);skeleton.calculateInverses();skeleton.update();
 let vertices=0,maxBindPositionError=0,maxBindNormalError=0;const material=new MeshBasicMaterial();
 for(const [pi,geo] of candidate.body.hardParts.entries()){
  const old=original.body.hardParts[pi];if(old===undefined)throw new Error('Missing original part');
  for(const name of ['position','color','furLen'])expect(Array.from(geo.getAttribute(name).array)).toEqual(Array.from(old.getAttribute(name).array));
  // Explicit flat-normal diagnostic from decoded positions; no GPU/factory claim.
  geo.computeVertexNormals();old.computeVertexNormals();expect(Array.from(geo.getAttribute('normal').array)).toEqual(Array.from(old.getAttribute('normal').array));
  const mesh=new SkinnedMesh(geo,material);mesh.bind(skeleton,new Matrix4());
  const positions=geo.getAttribute('position'),normals=geo.getAttribute('normal'),indices=geo.getAttribute('skinIndex'),weights=geo.getAttribute('skinWeight');
  for(let vi=0;vi<positions.count;vi++){
   const p=new Vector3().fromBufferAttribute(positions,vi),posed=mesh.applyBoneTransform(vi,p.clone());maxBindPositionError=Math.max(maxBindPositionError,p.distanceTo(posed));
   expect([weights.getX(vi),weights.getY(vi),weights.getZ(vi),weights.getW(vi)]).toEqual([1,0,0,0]);
   const bone=ordered[indices.getX(vi)],inverse=skeleton.boneInverses[indices.getX(vi)];if(bone===undefined||inverse===undefined)throw new Error('Missing skin bone');
   const skin=new Matrix4().multiplyMatrices(bone.matrixWorld,inverse);const n=new Vector3().fromBufferAttribute(normals,vi);const transformed=new Vector4(n.x,n.y,n.z,0).applyMatrix4(skin);maxBindNormalError=Math.max(maxBindNormalError,new Vector3(transformed.x,transformed.y,transformed.z).distanceTo(n));vertices++;
  }
 }
 expect(vertices).toBe(10458);expect(maxBindPositionError).toBeLessThan(1e-12);expect(maxBindNormalError).toBeLessThan(1e-12);
 writeFileSync('docs/reviews/puffer-rigid-unit-candidate/consumer-audit.json',JSON.stringify({status:'PASS static codec and bind skin only; geometry support separately FAILS',vertices,sourceSha256:candidate.source,packedSha256:candidate.payload,originalSourceSha256:original.source,originalPackedSha256:original.payload,exactPositionsColorsFurAndDiagnosticFlatNormals:true,exactBonesAndNumericDimensions:true,unitWeights:true,maxBindPositionError,maxBindNormalError,sourcePins:{geometry:hash('src/game/plugin/geometry.ts'),factory:hash('src/engine/entities/AnimalFactory.ts'),codec:hash('art/driftwood-isle/approved-puffer/native_export.py')},limitations:['No rendered image, GPU shader execution, motion, normal correctness after cross-owner deformation, physics, product or app tested.','At bind, unchanged geometry and explicitly computed diagnostic normals are exact. Neither source nor the direct packed decoder supplies stored normals; this test computes them, without claiming a full factory/GPU render.']},null,2)+'\n');
 for(const fixture of decoded)for(const geo of fixture.body.hardParts)geo.dispose();material.dispose();skeleton.dispose();
});
