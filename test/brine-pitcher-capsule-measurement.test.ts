// oxlint-disable-next-line import/no-nodejs-modules -- Source-only numeric pose/weighted mesh audit; no app or world is built.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { brinePitcherNativeClips } from '../src/shards/driftwood-isle/generators/brinePitcherNativeClips';

const source=v.parse(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])})),parts:v.array(v.object({name:v.string(),positions:v.array(v.number()),skinIndices:v.array(v.number()),skinWeights:v.array(v.number())}))}),JSON.parse(readFileSync('art/driftwood-isle/approved-brine-pitcher/v3/native-source.json','utf8')));
const directory='art/driftwood-isle/approved-brine-pitcher/capsule-measurement';
test('measure actual numeric poses and prove fixed-bind full-envelope capsule infeasibility',()=>{
 const bones:Record<string,Bone>={};
 for(const def of source.bones){const b=new Bone();b.name=def.name;b.position.fromArray(def.pos);if(def.parent!==null){const parent=bones[def.parent],rest=source.bones.find(r=>r.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');b.position.sub(new Vector3(...rest.pos));parent.add(b);}bones[def.name]=b;}
 const root=bones['body'];if(root===undefined)throw new Error('No root');
 const mem={},position=new Vector3();const context:AnimalRigContext={bones,dims:{bodyY:.7,bodyHalfLen:1.55,bodyRadius:.65,headRadius:.75,legLen:.7,feet:[],halfWidth:1.93},dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const animate=numericCreaturePose(brinePitcherNativeClips());
 const extrema=new Map(source.parts.map(part=>[part.name,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
 let frames=0,vertices=0,zRadiusFloor=0,yRadiusFloor=0,mainHeadRadius=0,ground=Infinity,maxBodyZ=0;
 const point=new Vector3(),headCenter=new Vector3();
 for(const phase of ['idle','crown','left','right','hit','death']) for(let sample=0;sample<=120;sample++){
  const t=phase==='idle'?sample/24:sample/40;context.t=t;context.mem['pitcher-step']=phase==='crown'?1:phase==='left'?2:phase==='right'?3:phase==='hit'?4:phase==='death'?6:0;context.mem['pitcher-clock']=t;context.deathT=phase==='death'?Math.min(1,t):-1;context.alive=phase!=='death';context.flinch=phase==='hit'?Math.max(0,1-t):0;context.state=phase==='idle'?'idle':phase==='hit'?'alert':'attack';animate(context);root.updateMatrixWorld(true);frames++;
  const head=bones['head'];if(head===undefined)throw new Error('No head');head.getWorldPosition(headCenter);
  for(const part of source.parts){const bounds=extrema.get(part.name);if(bounds===undefined)throw new Error('No bounds');
   for(let i=0;i<part.positions.length;i+=3){const vertex=i/3,index=part.skinIndices[vertex*4];if(index===undefined)throw new Error('No skin');const def=source.bones[index];if(def===undefined)throw new Error('Bad skin');const joint=bones[def.name];if(joint===undefined)throw new Error('No joint');if(part.skinWeights[vertex*4]!==1)throw new Error('Non-rigid source needs blended audit');
    point.fromArray(part.positions,i).sub(new Vector3(...def.pos)).applyMatrix4(joint.matrixWorld);vertices++;
    const values=point.toArray();for(let axis=0;axis<3;axis++){const value=values[axis],low=bounds.min[axis],high=bounds.max[axis];if(value===undefined||low===undefined||high===undefined)throw new Error('Missing coordinate');bounds.min[axis]=Math.min(low,value);bounds.max[axis]=Math.max(high,value);}
    ground=Math.min(ground,point.y);
    if(part.name==='body'){zRadiusFloor=Math.max(zRadiusFloor,Math.hypot(point.x,point.y-.7));yRadiusFloor=Math.max(yRadiusFloor,Math.hypot(point.x,point.z));maxBodyZ=Math.max(maxBodyZ,Math.abs(point.z));}
    if(part.name==='head'||part.name==='headLid')mainHeadRadius=Math.max(mainHeadRadius,point.distanceTo(headCenter));
   }
  }
 }
 const bodyBounds=extrema.get('body');if(bodyBounds===undefined)throw new Error('Missing body');const minBodyY=bodyBounds.min[1];if(minBodyY===undefined)throw new Error('Missing support');
 const groundSafeRadius=.7-minBodyY;
 const report={schema:'wildshard.brine-pitcher.capsule-measurement.v1',runtimeAcceptance:false,colliderAcceptance:false,frames,weightedVertices:vertices,sampling:'121 samples per phase; idle 0..5s, attacks/hit/death 0..3s. Body-axis contradiction is analytic for the fixed body part, independent of sampling.',phases:['idle','crown telegraph/snap/recovery','left telegraph/snap/recovery','right telegraph/snap/recovery','hit','death'],source:'v3/native-source.json',poseSource:'src/shards/driftwood-isle/generators/brinePitcherNativeClips.ts',rootBind:[0,.7,0],rootTranslationChanged:false,fullCycleBounds:Object.fromEntries(extrema),minimumWeightedY:ground,bodyRadiusLowerBoundForAnyHorizontalHalfLength:zRadiusFloor,bodyRadiusLowerBoundForAnyUprightHalfLength:yRadiusFloor,maximumGroundSafeHorizontalRadius:groundSafeRadius,minimumFullMainHeadSphereRadius:mainHeadRadius,mainHeadSphereBottom:2.05-mainHeadRadius,provisionalUprightCapsuleBottom:.7-1.55-.65,fullEnclosureWithFixedBindAndNoGroundPenetrationFeasible:false,diagnosticHorizontalProposal:{bodyY:.7,bodyHalfLen:maxBodyZ,bodyRadius:groundSafeRadius,capsuleAxis:'z',bottom:minBodyY,accepted:false,reason:'Ground-safe but cannot cover weighted trunk/root geometry; not a gameplay-ready replacement.'},reason:'At fixed body bind Y=.7, a ground-safe capsule radius cannot exceed .7. For a Z capsule, distance to its infinite axis already exceeds this bound; for a Y capsule, lateral radial extent already exceeds it. No half-length can repair either contradiction.'};
 expect(zRadiusFloor).toBeGreaterThan(.7);expect(yRadiusFloor).toBeGreaterThan(.7);expect(ground).toBeGreaterThanOrEqual(0);mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/measurement.json`,`${JSON.stringify(report,null,2)}\n`);
});
