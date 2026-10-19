// oxlint-disable-next-line import/no-nodejs-modules -- Exact candidate and captured world matrices are immutable test fixtures.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Explicit opt-in curve rebake for this candidate only.
import { env } from 'node:process';
import { Bone, Matrix4, Vector3, Group } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { conchPlantedClips } from '../src/shards/driftwood-isle/generators/conchPlantedClips';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

const directory='art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
const metadata: unknown=JSON.parse(readFileSync(`${directory}/metadata.json`,'utf8'));
const defs=v.parse(v.object({bodies:v.array(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])}))}))}),metadata).bodies[0];
if(defs===undefined) throw new Error('Missing Conch');
const boneDefinitions=defs.bones;
const traceSchema=v.array(v.object({ frame:v.number(),gameTime:v.number(),stage:v.number(),guard:v.number(),clock:v.number(),speed:v.number(),gait:v.number(),flinch:v.number(),deathT:v.number(),alive:v.boolean(),world:v.array(v.number()),bones:v.record(v.string(),v.object({local:v.array(v.number())})) }));

test('motion3 full weighted replay and independent dense poses use unchanged contact tolerances',async()=>{
 const bodies=packedCreatureBodies(metadata,undefined,()=>Promise.resolve(new Uint8Array(readFileSync(`${directory}/payload.bin`))));await bodies.preload();
 const packed=bodies.copy('conch-duelist','conch-duelist'), bones:Record<string,Bone>={}, actor=new Group();
 for(const def of boneDefinitions){const joint=new Bone();joint.position.fromArray(def.pos);bones[def.name]=joint;
  if(def.parent===null) actor.add(joint);else{const parent=bones[def.parent],rest=boneDefinitions.find(row=>row.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3(...rest.pos));parent.add(joint);}}
 actor.updateMatrixWorld(true);const inverse=boneDefinitions.map(def=>{const joint=bones[def.name];if(joint===undefined)throw new Error('Missing joint');return joint.matrixWorld.clone().invert();});
 const matrices=inverse.map(()=>new Matrix4()),position=new Vector3(),mem={};
 const c:AnimalRigContext={bones,dims:{bodyY:1.04,bodyHalfLen:0,bodyRadius:0,headRadius:0,legLen:0,feet:[],halfWidth:0},dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'stalk',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const animate=numericCreaturePose(conchPlantedClips());
 const root=bones['body'];if(root===undefined)throw new Error('Missing body');
 const p=new Vector3(),q=new Vector3(),sum=new Vector3();let vertices=0,blended=0;
 const parts=packed.hardParts.map(g=>({p:g.getAttribute('position'),i:g.getAttribute('skinIndex'),w:g.getAttribute('skinWeight')}));
 for(const part of parts){vertices+=part.p.count;for(let n=0;n<part.p.count;n++)if([part.w.getX(n),part.w.getY(n),part.w.getZ(n),part.w.getW(n)].filter(x=>x>0).length>1)blended++;}
 let minimumOwner='';
 const measure=()=>{actor.updateMatrixWorld(true);boneDefinitions.forEach((d,i)=>{const joint=bones[d.name],m=matrices[i],inv=inverse[i];if(joint===undefined||m===undefined||inv===undefined)throw new Error('Missing transform');m.multiplyMatrices(joint.matrixWorld,inv);});
  let minimum=Infinity;for(const part of parts)for(let n=0;n<part.p.count;n++){p.fromBufferAttribute(part.p,n);sum.set(0,0,0);
   for(let k=0;k<4;k++){const weight=part.w.getComponent(n,k);if(weight===0)continue;const m=matrices[part.i.getComponent(n,k)];if(m===undefined)throw new Error('Invalid weight');q.copy(p).applyMatrix4(m);sum.addScaledVector(q,weight);}if(sum.y-actor.position.y<minimum){minimum=sum.y-actor.position.y;minimumOwner=boneDefinitions[part.i.getX(n)]?.name??'missing';}}return minimum;};
 const resetBones=()=>{for(const def of boneDefinitions){const joint=bones[def.name];if(joint===undefined)throw new Error('Missing joint');joint.position.fromArray(def.pos);joint.rotation.set(0,0,0);if(def.parent!==null){const parent=boneDefinitions.find(x=>x.name===def.parent);if(parent===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3(...parent.pos));}}};
 const reset=()=>{resetBones();actor.matrixAutoUpdate=true;actor.position.set(0,0,0);actor.rotation.set(0,0,0);actor.scale.setScalar(1);c.t=0;c.speed=0;c.phase=0;c.flinch=0;c.mem['conch-st']=5;c.mem['conch-guard']=0;c.mem['regular-clock']=0;c.alive=false;};
 reset();
 if(env['CONCH_BAKE_CONTACT']==='1'){
  const heights:number[]=[];for(let i=0;i<=96;i++){c.deathT=i/96;animate(c);root.position.y=1.04;heights.push(.003-measure());}
  writeFileSync('src/shards/driftwood-isle/data/conchPlantedContact.json',`${JSON.stringify({schema:'conch.motion3.contact.v1',method:'97 uniform deathT knots; all 7338 canonical vertices, all four weights, 3mm support target; upright actor world only',heights},null,2)}\n`);return;
 }
 const failures:unknown[]=[];
 const summaries:Record<string,{samples:number,min:number,max:number,penetrating:number,withoutNear2cm:number}>={};
 const record=(name:string,value:number)=>{if(value<-.005&&failures.length<20)failures.push({name,value,minimumOwner,stage:c.mem['conch-st'],clock:c.mem['regular-clock'],flinch:c.flinch,phase:c.phase});const row=summaries[name]??={samples:0,min:Infinity,max:-Infinity,penetrating:0,withoutNear2cm:0};row.samples++;row.min=Math.min(row.min,value);row.max=Math.max(row.max,value);if(value<-.005)row.penetrating++;if(Math.abs(value)>.02)row.withoutNear2cm++;};
 // Independent state grid; sample between knots, vary yaw and supported uniform scale.
 for(const stage of [0,1,3,4,5])for(const scale of [.75,1,1.25])for(let i=0;i<=384;i++){
  reset();actor.rotation.y=i*.371;actor.scale.setScalar(scale);c.deathT=i/384;c.mem['conch-st']=stage;c.mem['regular-clock']=i/384*1.6;c.mem['conch-guard']=stage===1?1:0;c.speed=1;c.phase=i*.177;c.flinch=(i%5)/4;c.t=i*.13;animate(c);record('denseDeath',measure());
 }
 for(const stage of [0,1,2,3,4])for(const scale of [.75,1,1.25])for(let i=0;i<=120;i++){
  reset();actor.rotation.y=i*.371;actor.scale.setScalar(scale);c.alive=true;c.deathT=-1;c.mem['conch-st']=stage;c.mem['conch-guard']=stage===1?1:0;c.mem['regular-clock']=i/120*1.6;c.flinch=(i%5)/4;c.speed=(i%7)/6;c.phase=i/120;c.t=i*.23;animate(c);record('denseLiving',measure());
 }
 const trace=v.parse(traceSchema,JSON.parse(readFileSync('tmp/conch-motion-observer-event-order1/render-trace.json','utf8')));
 const replayRows=[];
 for(const r of trace){reset();actor.matrix.fromArray(r.world);actor.matrix.decompose(actor.position,actor.quaternion,actor.scale);const dt=Math.max(0,r.deathT), live=1-dt*dt*(3-2*dt), shell=r.bones['shell']?.local; if(shell===undefined)throw new Error('Missing captured shell');const idle=live>1e-9?2*Math.atan2(shell[3]??0,shell[6]??1)/(.008*live):0;c.t=Math.asin(Math.max(-1,Math.min(1,idle)))/1.7;c.mem['conch-st']=r.stage;c.mem['conch-guard']=r.guard;c.mem['regular-clock']=r.clock;c.speed=r.speed;c.phase=r.gait;c.flinch=r.flinch;c.deathT=r.deathT;c.alive=r.alive;animate(c);const next=measure();record(r.alive?'traceLiving':r.deathT>=1?'traceCorpse':'traceCollapse',next);
  resetBones();for(const [name,joint]of Object.entries(bones)){const local=r.bones[name]?.local;if(local?.length!==10)throw new Error('Missing captured bone');joint.position.fromArray(local,0);joint.quaternion.fromArray(local,3);joint.scale.fromArray(local,7);}const previous=measure();record(r.alive?'baselineLiving':r.deathT>=1?'baselineCorpse':'baselineCollapse',previous);replayRows.push({frame:r.frame,minimum:next,baselineMinimum:previous});}
 mkdirSync('tmp/conch-planted-offline',{recursive:true});writeFileSync('tmp/conch-planted-offline/contact-report.json',`${JSON.stringify({vertices,blended,scope:'Offline exact canonical four-weight FK, recorded actor world transforms; no browser/current-host/ragdoll acceptance',summaries,failures,replayRows},null,2)}\n`);
 const reference=v.parse(v.object({frames:v.array(v.object({minimum:v.number()}))}),JSON.parse(readFileSync('tmp/conch-independent-event-order1-review/numeric-verification.json','utf8')));expect(reference.frames.length).toBe(replayRows.length);replayRows.forEach((row,i)=>expect(row.baselineMinimum).toBeCloseTo(reference.frames[i]?.minimum??Infinity,10));
 expect(summaries['baselineLiving']?.withoutNear2cm).toBe(546);expect(summaries['baselineCorpse']?.min).toBeCloseTo(.15036534208161356,10);expect(vertices).toBe(7338);expect(blended).toBe(94);for(const [name,row]of Object.entries(summaries)){if(name.startsWith('baseline'))continue;expect(row.penetrating,name).toBe(0);expect(row.withoutNear2cm,name).toBe(0);expect(row.min,name).toBeGreaterThanOrEqual(0);}
 for(const g of packed.hardParts)g.dispose();
},120000);
