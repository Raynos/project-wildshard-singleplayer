import {readFileSync,writeFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {Vector3,BufferGeometry,Float32BufferAttribute} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {packedCreatureBodies} from '../../../../src/game/plugin/geometry';
import {numericCreaturePose,installChannelPrograms} from '../../../../src/game/plugin/channelPrograms';
import {supportsRigidCorpseAnimation} from '../../../../src/engine/entities/rigidCorpsePose';
import {validateRigidCorpse} from '../../../../src/engine/physics/rigidCorpse';
import {rigidCorpseSchema} from '../../../../src/format/rigidCorpse';
import {iguanaOwnedClips} from './clips';
const folder='art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1';
const old='art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next';
const read=(p:string):unknown=>JSON.parse(readFileSync(p,'utf8'));
const nums=v.array(v.number());
const schema=v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:nums})),parts:v.array(v.object({name:v.string(),positions:nums,colorsLinear:nums,skinIndices:nums,skinWeights:nums,furLen:nums}))});
const source=v.parse(schema,read(`${folder}/native-source.json`)),original=v.parse(schema,read(`${old}/native-source.json`));
const meta=v.parse(v.object({bodies:v.array(v.object({dims:v.object({rigidCorpse:rigidCorpseSchema})}))}),read(`${folder}/metadata.json`));
const recipe=meta.bodies[0]?.dims.rigidCorpse;if(recipe===undefined)throw Error('Missing recipe');
test('raw source/packed attribute and computed flat-normal preservation is exact; not decoder admission',()=>{
 expect(source.parts).toHaveLength(original.parts.length);const newBytes=inflateSync(readFileSync(`${folder}/payload.bin`)),oldBytes=inflateSync(readFileSync(`${old}/payload.bin`));let offset=0;
 for(const [i,p]of source.parts.entries()){const q=original.parts[i];if(q===undefined)throw Error('Missing part');for(const key of ['positions','colorsLinear','furLen'] as const)expect(p[key]).toEqual(q[key]);
  for(const [key,bytes]of [['positions',4],['colorsLinear',4],['skinIndices',2],['skinWeights',4],['furLen',4]] as const){const size=p[key].length*bytes;if(key!=='skinIndices'&&key!=='skinWeights')expect(newBytes.subarray(offset,offset+size)).toEqual(oldBytes.subarray(offset,offset+size));for(let n=0;n<p[key].length;n++)expect(bytes===2?newBytes.readUInt16LE(offset+n*2):newBytes.readFloatLE(offset+n*4)).toBe(bytes===2?p[key][n]:Math.fround(p[key][n]??NaN));offset+=size;offset+=(-offset%4+4)%4;}
  const ga=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(p.positions,3)),gb=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(q.positions,3));ga.computeVertexNormals();gb.computeVertexNormals();expect(ga.getAttribute('normal').array).toEqual(gb.getAttribute('normal').array);ga.dispose();gb.dispose();
  for(let t=0;t<p.positions.length/9;t++){const owners=[0,1,2].map(c=>p.skinIndices[(t*3+c)*4]);expect(new Set(owners).size).toBe(1);for(let c=0;c<3;c++)expect(p.skinWeights.slice((t*3+c)*4,(t*3+c+1)*4)).toEqual([1,0,0,0]);}
 }expect(offset).toBe(newBytes.length);expect(offset).toBe(oldBytes.length);
});
test('eight exact component hulls meet existing recipe schema with all triangles coherently owned',()=>{
 validateRigidCorpse(recipe);v.parse(rigidCorpseSchema,recipe);expect(recipe.parts).toHaveLength(8);expect(recipe.parts.reduce((s,p)=>s+p.points.length,0)).toBe(457);let maxExcess=-Infinity;
 for(const part of recipe.parts){const owner=source.bones.findIndex(b=>b.name===part.bone),pivot=source.bones[owner];if(pivot===undefined)throw Error('Missing owner');const hull=new ConvexHull().setFromPoints(part.points.map(p=>new Vector3(...p)));
  const points=source.parts.filter(p=>p.skinIndices[0]===owner).flatMap(p=>Array.from({length:p.positions.length/3},(_,i)=>new Vector3(...p.positions.slice(i*3,i*3+3).map(Math.fround)).sub(new Vector3().fromArray(pivot.pos))));
  for(const extreme of part.points)expect(points.some(p=>p.distanceTo(new Vector3(...extreme))<1e-12)).toBe(true);
  for(const p of points)for(const face of hull.faces)maxExcess=Math.max(maxExcess,face.distanceToPoint(p));
 }expect(maxExcess).toBeLessThan(1e-12);
});
test('authored numeric programs remain registered and exact-clock continuous, without runtime admission',()=>{
 const clips=iguanaOwnedClips();expect(supportsRigidCorpseAnimation(numericCreaturePose(clips))).toBe(true);
 const frame={deathT:-1,flinch:0,t:0,speed:0},strike={phase:0,elapsed:0,index:0};const joints=new Map(clips.programs.flatMap(p=>p.numeric?.outputs.map(o=>[o.target,{rotation:{x:0,y:0,z:0},position:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}}] as const)??[]));const owners=new Map<string,unknown>(joints);owners.set('frame',frame);owners.set('strike',strike);const evaluator=installChannelPrograms(clips.programs,clips.group,owners);
 const pose=(phase:number,elapsed:number)=>{strike.phase=phase;strike.elapsed=elapsed;strike.index=phase===0?0:1;evaluator.evaluate({time:0,delta:1/60,values:{}});return Array.from(joints.values()).flatMap(j=>[j.rotation.x,j.rotation.y,j.rotation.z,j.position.x,j.position.y,j.position.z]);};
 const compare=(a:number[],b:number[])=>expect(Math.max(...a.map((x,i)=>Math.abs(x-(b[i]??Infinity))))).toBeLessThan(1e-12);
 pose(0,0);for(const [name,joint]of joints){expect([joint.rotation.x,joint.rotation.y,joint.rotation.z]).toEqual([0,0,0]);if(name.startsWith('joint.leg')){expect(joint.position.y).toBe(name.includes('legF')?-.04:-.12);expect(joint.position.z).toBe(name.includes('legF')?.82:-.50);}}
 compare(pose(1,.75),pose(2,0));compare(pose(2,.16),pose(3,0));compare(pose(3,.9),pose(0,0));frame.deathT=1;const dead=pose(0,0);frame.t=100;frame.speed=1;frame.flinch=1;compare(dead,pose(2,.08));
});
test('unaltered actual packed consumer rejects candidate metadata before loading; no bypass',()=>{
 let requested=false;let message='';try{packedCreatureBodies(read(`${folder}/metadata.json`),undefined,()=>{requested=true;return Promise.resolve(new Uint8Array(readFileSync(`${folder}/payload.bin`)));});}catch(error){message=error instanceof Error?error.message:String(error);}
 expect(message).toContain('Invalid key: Expected never but received "bodyAt"');expect(requested).toBe(false);
 writeFileSync(`${folder}/admission-rejection.json`,JSON.stringify({status:'REJECTED before physics',target:'packedCreatureBodies',source:'src/game/plugin/geometry.ts:1328',message,loadCallbackInvoked:requested,unsupportedDimensions:['bodyAt','bodyPitch','headAt','fore'],actualSchema:'PackedBody.dims strictObject allows rigidCorpse and legacy scalar dimensions only',recipeSchemaPass:true,sourceAttributeParityPass:true,fullAuthoredPoseLiveCoverage:'not proven; blocked before runtime body exists',physicalContactTrials:0,appBuilds:0,runtimeAcceptance:false,buildAllowed:false,visualAcceptance:false,animationAcceptance:false},null,2)+'\n');
});
