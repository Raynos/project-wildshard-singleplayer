// Read-only numeric-pose study. Run from repository root with scripts/bake-loader.mjs.
import {readFileSync,writeFileSync} from 'node:fs';
import {Bone,Vector3} from 'three';
import {numericCreaturePose} from '../../../src/game/plugin/channelPrograms.ts';
import {bellbackTuckedClips} from '../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts';
const native=JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json','utf8'));
const bones={};
for(const def of native.bones){const joint=new Bone();joint.position.fromArray(def.pos);if(def.parent!==null){joint.position.sub(new Vector3(...native.bones.find(b=>b.name===def.parent).pos));bones[def.parent].add(joint);}bones[def.name]=joint;}
const position=new Vector3(),mem={},ctx={bones,dims:{bodyY:1.2000000476837158,bodyHalfLen:0,bodyRadius:0,headRadius:0,legLen:0,feet:[],halfWidth:0},dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'stalk',alive:false,deathT:0,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
const animate=numericCreaturePose(bellbackTuckedClips()),rows=[];
// 1,001 samples resolve the fast .2-deathT fold at 201 knots. Real elapsed collapse is .8 seconds.
for(let i=0;i<=1000;i++){ctx.deathT=i/1000;ctx.mem['tg-state']=6;ctx.mem['tg-clock']=ctx.deathT;animate(ctx);rows.push({deathT:ctx.deathT,bones:Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,[...b.position.toArray(),...b.quaternion.toArray()]]))});}
writeFileSync('docs/reviews/bellback-corpse-shape-study/dense-poses.json',JSON.stringify(rows)+'\n');
console.log(`Sampled actual numeric program: ${rows.length} poses, ${Object.keys(bones).length} bones`);
