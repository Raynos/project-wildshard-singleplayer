import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { packedCreatureBodies } from '../../../src/game/plugin/geometry';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { keelmawNativeClips } from './keelmawNativeClips';
const directory='art/driftwood-isle/approved-keelmaw/v1/';
const read=(name:string):unknown=>JSON.parse(readFileSync(directory+name,'utf8'));
const numbers=v.array(v.number());
const source=v.parse(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])})),parts:v.array(v.object({name:v.string(),positions:numbers,colorsLinear:numbers,skinIndices:numbers,skinWeights:numbers,furLen:numbers}))}),read('native-source.json'));
async function load(){const loader=packedCreatureBodies(read('metadata.json'),undefined,()=>Promise.resolve(new Uint8Array(readFileSync(directory+'payload.bin'))));await loader.preload();return loader.copy('keelmaw','keelmaw');}
test('actual strict native consumer preserves every mesh attribute and absolute bind',async()=>{
 const body=await load();expect(body.bones).toEqual(source.bones);expect(body.hardParts).toHaveLength(19);expect(body.dims.rigidCorpse?.parts).toHaveLength(7);
 const attrs=[['position','positions'],['color','colorsLinear'],['skinIndex','skinIndices'],['skinWeight','skinWeights'],['furLen','furLen']] as const;
 for(const [i,g]of body.hardParts.entries()){const part=source.parts[i];if(part===undefined)throw new Error('Missing part');for(const [attr,key]of attrs)expect(g.getAttribute(attr).array).toEqual(key==='skinIndices'?new Uint16Array(part[key]):new Float32Array(part[key]));g.dispose();}
});
test('weighted native numeric poses clear authored ground and expose exact core hit coverage',async()=>{
 const body=await load(),bones:Record<string,Bone>={};
 for(const def of source.bones){const b=new Bone();b.name=def.name;b.position.fromArray(def.pos);if(def.parent!==null){const parent=bones[def.parent],rest=source.bones.find(r=>r.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');b.position.sub(new Vector3(...rest.pos));parent.add(b);}bones[def.name]=b;}
 const root=bones['body'],head=bones['head'];if(root===undefined||head===undefined)throw new Error('Missing core');root.updateMatrixWorld(true);
 const skeleton=new Skeleton(Object.values(bones)),material=new MeshBasicMaterial(),meshes=body.hardParts.map(g=>{const m=new SkinnedMesh(g,material);m.bind(skeleton);return m;});
 const position=new Vector3(),mem:Record<string,number>={};const c:AnimalRigContext={bones,dims:body.dims,dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const animate=numericCreaturePose(keelmawNativeClips()),initial=Object.values(bones).map(b=>b.position.toArray()),p=new Vector3(),h=new Vector3(),oracle=new Vector3();let minY=Infinity,maxOracleError=0,frames=0,vertices=0;
 const coverage:Record<string,{tested:number,withinCore:number,maxOutside:number}>={};
 for(const phase of ['idle','bite','hit','death'])for(let frame=0;frame<=60;frame++){
  const t=frame/30;c.t=t;c.alive=phase!=='death';c.deathT=phase==='death'?Math.min(1,t):-1;c.flinch=phase==='hit'?Math.exp(-t*5.5):0;mem['keelmaw-step']=phase==='bite'?1:0;mem['keelmaw-clock']=t;animate(c);root.updateMatrixWorld(true);skeleton.update();head.getWorldPosition(h);frames++;
  expect(Object.values(bones).map(b=>b.position.toArray())).toEqual(initial);
  for(const [i,mesh]of meshes.entries()){
   const part=source.parts[i];if(part===undefined)throw new Error('Missing source');const row=coverage[part.name]??{tested:0,withinCore:0,maxOutside:0};coverage[part.name]=row;const positions=mesh.geometry.getAttribute('position');
   for(let vi=0;vi<positions.count;vi++){
    p.fromBufferAttribute(positions,vi);mesh.applyBoneTransform(vi,p);minY=Math.min(minY,p.y);vertices++;
    const def=source.bones[part.skinIndices[vi*4]??-1];if(def===undefined)throw new Error('Missing weighted bone');const joint=bones[def.name];if(joint===undefined)throw new Error('Missing joint');oracle.fromArray(part.positions,vi*3).sub(new Vector3(...def.pos)).applyMatrix4(joint.matrixWorld);maxOracleError=Math.max(maxOracleError,p.distanceTo(oracle));
    const bodyDistance=Math.hypot(p.x,p.y-body.dims.bodyY,Math.max(0,Math.abs(p.z)-body.dims.bodyHalfLen))-body.dims.bodyRadius,headDistance=p.distanceTo(h)-body.dims.headRadius,outside=Math.min(bodyDistance,headDistance);row.tested++;if(outside<=1e-5)row.withinCore++;row.maxOutside=Math.max(row.maxOutside,outside);
   }
  }
 }
 writeFileSync(directory+'weighted-pose-audit.json',JSON.stringify({frames,weightedVertices:vertices,minimumY:minY,maxIndependentSkinError:maxOracleError,rootTranslationChanged:false,coverage,corePolicy:'Living vulnerable torso/head volumes only. Feet, tail, decorative crests excluded intentionally. Snout coverage deficit reported; not accepted as complete facial hit fidelity.',gait:'No locomotion clip authored yet; all four feet remain planted.',death:'Numeric pose only; independent actual physics.json owns contact evidence.',runtimeAcceptance:false},null,2)+'\n');
 expect(minY).toBeGreaterThanOrEqual(0);expect(maxOracleError).toBeLessThan(1e-5);for(const mesh of meshes)mesh.geometry.dispose();skeleton.dispose();material.dispose();
});
