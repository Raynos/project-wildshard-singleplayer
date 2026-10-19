// Run from repository root with node --experimental-transform-types --import ./scripts/bake-loader.mjs.
// Read-only source audit: actual Bellback numeric program, identical fixed clock, only death-event memory differs.
import {readFileSync} from 'node:fs';
import {Bone,Vector3} from 'three';
import {numericCreaturePose} from '../../../src/game/plugin/channelPrograms.ts';
import {RigidCorpsePose} from '../../../src/engine/entities/rigidCorpsePose.ts';
import {bellbackTuckedClips} from '../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts';
const native=JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json','utf8'));
function make(step,clock) {
  const bones={};
  for(const def of native.bones){const joint=new Bone();joint.position.fromArray(def.pos);if(def.parent!==null){joint.position.sub(new Vector3(...native.bones.find(b=>b.name===def.parent).pos));bones[def.parent].add(joint);}bones[def.name]=joint;}
  const position=new Vector3(),mem={'tg-state':step,'tg-clock':clock};
  const context={bones,dims:{bodyY:1.2000000476837158,bodyHalfLen:0,bodyRadius:0,headRadius:0,legLen:0,feet:[],halfWidth:0},dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'dead',alive:false,deathT:0,flinch:1,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
  return {context,bones,pose:new RigidCorpsePose(context,numericCreaturePose(bellbackTuckedClips()))};
}
const rows=[];
for(const [step,clock] of [[1,.96],[2,.68],[3,.68]]) {
 const stale=make(step,clock),finalized=make(6,0);
 // The real onDeath command occurs after constructor snapshot; mutating original memory cannot repair it.
 stale.context.mem['tg-state']=6;stale.context.mem['tg-clock']=0;
 for(let tick=1;tick<=48;tick++) {
  stale.pose.step(1/60);finalized.pose.step(1/60);stale.pose.render(1);finalized.pose.render(1);
  if([1,6,12,24,48].includes(tick))rows.push({step,clock,tick,deathT:stale.pose.deathT,
   bellRotationDelta:stale.bones.bell.rotation.x-finalized.bones.bell.rotation.x,
   clapperRotationDelta:stale.bones.clapper.rotation.x-finalized.bones.clapper.rotation.x,
   foreLegYDelta:stale.bones.leg0.position.y-finalized.bones.leg0.position.y});
 }
}
console.log(JSON.stringify({recipeTree:'661647c747d62a3b3308dd1b4ca0fd2f3cd835bc',rows},null,2));
