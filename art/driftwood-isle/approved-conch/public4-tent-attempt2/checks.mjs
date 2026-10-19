/** Pure evidence checks; synthetic tests exercise refusal, never count as runtime proof. */
import { Matrix4 } from 'three';
import { canonical, same } from './admission.mjs';
import { assertShader, checkRig, checkFirstUse } from '../tent-shadow-diagnostic/contract.mjs';
export function cadence(clocks) {
 const deltas=clocks.slice(1).map((c,i)=>c.wall-clocks[i].wall).filter(n=>n>0).sort((a,b)=>a-b);
 const first=clocks[0],last=clocks.at(-1),wallSeconds=first&&last?(last.wall-first.wall)/1000:0;
 return {samples:clocks.length,uniqueFrames:new Set(clocks.map(c=>c.frame)).size,wallSeconds,simulationSeconds:first&&last?last.simulation.elapsed-first.simulation.elapsed:0,deliveredFramesPerWallSecond:wallSeconds>0?(clocks.length-1)/wallSeconds:null,medianFrameMs:deltas.length?deltas[Math.floor(deltas.length*.5)]:null,p95FrameMs:deltas.length?deltas[Math.min(deltas.length-1,Math.floor(deltas.length*.95))]:null,maxFrameMs:deltas.at(-1)??null,fixedSteps:clocks.reduce((n,c)=>n+c.fixedSteps,0)};
}
export function checkLiveEvidence(data,variant) {
 const live=data.live,trace=data.trace;
 if(live.variant!==variant||live.errors.length||live.clocks.length<2||live.frames!==live.clocks.length||trace.length!==live.frames+live.traceStartCount)throw new Error('Incomplete live frame coverage');
 if(live.clocks.some(c=>c.simulation.captureFps!==null||c.simulation.scale!==1||!Number.isFinite(c.wall)||!Number.isFinite(c.time)||!Number.isFinite(c.fixedSteps)))throw new Error('Non-live or invalid clock');
 if(live.clocks.some((c,i)=>i>0&&(c.wall<live.clocks[i-1].wall||c.frame<=live.clocks[i-1].frame||c.time<live.clocks[i-1].time||c.simulation.frames<=live.clocks[i-1].simulation.frames)))throw new Error('Clock/frame progression invalid');
 if(live.clocks.at(-1).time<=live.clocks[0].time)throw new Error('No advancing simulation');
 checkRig(live.rig);
 checkFirstUse(live.firstUse.before);if(live.firstUse.variant!==variant||live.firstUse.importedFilterIdentity!==true)throw new Error('Missing first-use imported filter identity');
 if(!live.shaders.length||new Set(live.shaders.map(row=>row.mesh)).size!==live.meshes)throw new Error('Missing native linked shader');
 for(const shader of live.shaders){if(!shader.linked||!shader.cast||!shader.receive)throw new Error('Shadow draw disabled');assertShader(shader.fragment,variant==='tent'?'tent':'control');}
 if(trace.some(row=>Object.keys(row.bones).length!==15||row.meshes.length!==data.geometry.length||row.poseInput===null))throw new Error('Missing authoritative rendered transforms/pose input');
 verifyBindings(data);
 return cadence(live.clocks);
}
export function emptyStores(rows) {
 if(!rows.length)return false;
 return rows.every(row=>Object.keys(row.local).length===0&&Object.keys(row.session).length===0&&row.indexedDB.length===0&&row.serviceWorkers===0&&(!row.state||(Object.keys(row.state.shard).length===0&&row.state.generation===0&&Object.values(row.state.docs).every(doc=>Object.keys(doc.keys).length===0))));
}
export function cycleChecks(data,report) {
 const trace=data.trace,events=data.events,dead=trace.filter(r=>!r.alive),playerDead=trace.filter(r=>r.playerHp===0),settled=dead.filter(r=>r.deathT>=1);
 const hasPhase=phase=>trace.some(r=>r.phase===phase);
 return {
  stationaryPostStrikeRest:stationaryRest(trace).verified,walk:trace.some(r=>r.phase==='approach'&&r.speed>.1),
  attackWindup:trace.some(r=>r.strike.phase==='windup'),attackActive:trace.some(r=>r.strike.phase==='active'),attackRecovery:trace.some(r=>r.strike.phase==='recover'||r.stage===2),
  actualPlayerDamage:events.some(r=>r.kind==='damage.dealt'&&r.target==='player'&&r.dealt>0),actualEnemyDamage:events.some(r=>r.kind==='damage.dealt'&&r.target==='enemy'&&r.dealt>0),
  actualDamageClocks:events.some(r=>r.kind==='hurt-request-before'&&r.strike.phase==='active'&&r.strike.elapsed>0&&r.poseInput!==null),
  guardObserved:trace.some(r=>r.guard===1),counter:trace.some(r=>r.stage===3),counterPending:trace.some(r=>r.stage===4),
  hit:trace.some(r=>r.flinch>0),death:dead.length>0,settledDeath:settled.length>0&&settled.every(r=>r.stage===5&&r.guard===0),
  noPostDeathStrike:dead.length>0&&dead.every(r=>r.strike.phase==='idle'),
  playerDefeat:playerDead.length>0&&playerDead.every(r=>r.alive&&r.hp===60&&r.stage!==5&&r.deathT<0),
  reward:report.reward?.loot?.scope==='practice'&&report.reward?.loot?.coins===3&&report.reward?.loot?.complete===true,
  noDuplicateReward:canonical(report.reward?.loot)===canonical(report.rewardStable?.loot),
  retry:report.retry?.enemy.hp===60&&report.retry?.enemy.alive===true&&report.retry?.playerHp===100&&report.retry?.loot?.coins===0,
  defeatRetry:report.defeatRetry?.enemy.hp===60&&report.defeatRetry?.playerHp===100,
  defeatedAttackBlocked:report.defeatedAttack?.enemy.hp===report.playerDefeat?.enemy.hp,
  pause:report.pauseStart?.state==='paused'&&report.pauseEnd?.state==='paused'&&report.pauseEnd?.wall>report.pauseStart?.wall&&report.pauseStart?.boutTime===report.pauseEnd?.boutTime,
  resume:report.resume?.state==='practice'&&report.resume?.boutTime>report.pauseEnd?.boutTime,
  stopResume:trace.some(r=>r.phase==='stop'&&r.speed<.05)&&trace.some(r=>r.phase==='resume-walk'&&r.speed>.1),
  interruptionTrialsRecorded:['idle','early-windup','late-windup','active','recovery'].every(name=>hasPhase('interruption-'+name)),
  stores:emptyStores(report.stores),errors:report.errors.length===0,
 };
}
export function compareCurrentControl(control,candidate) {
 const controlBindings=verifyBindings(control),candidateBindings=verifyBindings(candidate);
 const invariants=data=>data.geometry.map(({world,bindInverse,...mesh})=>mesh);
 same(invariants(control),invariants(candidate));
 const specs=data=>[...new Map(data.trace.filter(row=>row.strikeSpec!==null).map(row=>[row.strikeSpec.id,row.strikeSpec])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 const a=specs(control),b=specs(candidate);if(!a.length)throw new Error('PCF control observed no strike spec');
 for(const spec of a){const found=b.find(row=>row.id===spec.id);if(!found)throw new Error('Candidate missed control strike');same(spec,found);}
 same(control.live.rig,candidate.live.rig);
 return {actualGeometryEqual:true,controlBindings,candidateBindings,allFourSkinWeightsCompared:true,controlObservedStrikesEqual:true,controlStrikes:a.map(row=>row.id),candidateStrikes:b.map(row=>row.id),rigEqual:true,scope:'Both fixed entries share one freshly pinned current-runtime build and exact public4 product. These actual observations corroborate geometry, rig and overlapping strike specs; their real clocks do not imply deterministic pixel/time parity. The retained original4 compiled host is only a byte-verified fallback, not the runtime parity control.'};
}

/** Attached SkinnedMesh.updateMatrixWorld computes inverse(mesh.matrixWorld), not a product invariant.
 * Check both inverse coefficients and both multiplication orders; never waive a live matrix. */
export function verifyBindings(data) {
 let checked=0,maxError=0;
 const matrix=(a)=>{if(!Array.isArray(a)||a.length!==16||a.some(x=>!Number.isFinite(x)))throw new Error('Missing/nonfinite binding matrix');return new Matrix4().fromArray(a);};
 const check=mesh=>{
  if(mesh.bindMode!=='attached')throw new Error('Expected actual attached binding mode');
  const world=matrix(mesh.world),inverse=matrix(mesh.bindInverse);
  if(Math.abs(world.determinant())<1e-12)throw new Error('Singular mesh world transform');
  const expected=world.clone().invert();
  const errors=expected.elements.map((x,i)=>Math.abs(x-inverse.elements[i]));
  for(const product of [world.clone().multiply(inverse),inverse.clone().multiply(world)])errors.push(...product.elements.map((x,i)=>Math.abs(x-(i%5===0?1:0))));
  const error=Math.max(...errors);maxError=Math.max(maxError,error);if(error>1e-8)throw new Error('Live attached bindInverse/world contract violated');checked++;
 };
 if(!data.geometry?.length||!data.trace?.length||!Array.isArray(data.events))throw new Error('Missing binding coverage');
 data.geometry.forEach(check);
 for(const row of [...data.trace,...data.events]){if(row.meshes?.length!==data.geometry.length)throw new Error('Missing per-observation mesh binding');row.meshes.forEach(check);}
 return {checked,maxError,tolerance:1e-8,contract:'attached: bindMatrixInverse = inverse(matrixWorld)',streams:['initial geometry','every rendered trace','every event']};
}
export function stationaryRest(trace) {
 const eligible=r=>r.alive&&r.hp>0&&r.playerHp>0&&r.stage===2&&r.guard===0&&r.speed<.05&&r.flinch===0&&r.strike.phase==='idle'&&r.poseInput?.attack===-1&&r.poseInput?.speed<.05&&r.arenaCenter&&[r.actorPosition,r.playerPosition].every(p=>p.every(Number.isFinite)&&Math.abs(p[0]-r.arenaCenter.x)<49&&Math.abs(p[2]-r.arenaCenter.z)<49&&Math.abs(p[1]-900)<1);
 let group=[];
 for(const row of trace){
  const previous=group.at(-1);
  if(!eligible(row)){group=[];continue;}
  if(previous&&(row.bout!==previous.bout||row.gameTime<=previous.gameTime||Math.hypot(...row.actorPosition.map((n,i)=>n-previous.actorPosition[i]))>1e-5))group=[];
  group.push(row);
  if(group.length>=3&&row.gameTime-group[0].gameTime>=.4)return {verified:true,scope:'Stationary post-strike neutral/rest window only; not ordinary or sustained disengaged idle',frames:group.map(r=>r.frame),gameStart:group[0].gameTime,gameEnd:row.gameTime,bout:row.bout};
 }
 return {verified:false,scope:'No stationary post-strike neutral/rest window proved'};
}
export function interruptionEvidence(events) {
 return ['idle','early-windup','late-windup','active','recovery'].map(name=>{
  const rows=events.filter(r=>r.phase==='interruption-'+name&&r.kind==='enemy-damage-before-presentation'&&r.dealt>0);
  const matches=r=>r.poseInput!==null&&(name==='idle'?r.stage===0&&r.speed<.05&&r.strike.phase==='idle':name==='early-windup'?r.strike.phase==='windup'&&r.strike.elapsed>=.05&&r.strike.elapsed<.3:name==='late-windup'?r.strike.phase==='windup'&&r.strike.elapsed>=.35&&r.strike.elapsed<.6:name==='active'?r.strike.phase==='active':r.strike.phase==='recover');
  return {intended:name,actualBoundaryHit:rows.some(matches),observations:rows.map(r=>({sampleIndex:r.sampleIndex,frame:r.frame,gameTime:r.gameTime,boutTime:r.boutTime,strike:r.strike,stage:r.stage,behaviorClock:r.clock,poseInput:r.poseInput,dealt:r.dealt})),scope:'Actual pre-presentation damage event and prior evaluated pose; trial label alone is never boundary proof'};
 });
}
export function reloadChecks(data,run) {
 return {reentry:run.reentry?.enemy.hp===60&&run.reentry?.playerHp===100&&run.reentry?.enemy.kind==='conch-duelist',reloadRealCombat:data.events.some(r=>r.kind==='damage.dealt'&&r.target==='player'&&r.dealt>0),reloadNewDocument:Number.isFinite(run.documentBefore)&&Number.isFinite(run.documentAfter)&&run.documentAfter>run.documentBefore,reloadEmptyStores:emptyStores(run.stores.filter(r=>r.label.startsWith('reload-')||r.label==='after-reload-before-start'))};
}
