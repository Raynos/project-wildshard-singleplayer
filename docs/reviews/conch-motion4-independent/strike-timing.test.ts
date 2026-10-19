// oxlint-disable-next-line import/no-nodejs-modules -- Read-only frozen source evidence and independent diagnostic output.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { StrikeRunner, type StrikeActor, type StrikeSpec } from '../../../src/engine/ai/strikes';

interface TipEvidence { activeWindowTipClassification: { stage: number; outsideAuthoredLaneHalfWidth: number[][]; insideAuthoredLaneHalfWidth: number[][] }[] }
const evidence: TipEvidence = JSON.parse(readFileSync('docs/reviews/conch-motion4-independent/source-audit.json','utf8'));

test('actual runner exposes a first-hit timing counterexample to the +35ms key',()=>{
 const results:object[]=[];
 for(const [stage,windup] of [[1,.6],[3,.45]] as const){
  let attackT=-1,attackDur=1,clock=0,hits=0;
  // Minimal structural actor; the clock getter below is exactly AnimalSim.attackPhase.
  const actor:StrikeActor={position:{x:0,y:0,z:0},alive:true,scale:1,yaw:0,
   startAttack(seconds){attackT=0;attackDur=seconds;},cancelAttack(){attackT=-1;},setMotion(){}};
  const phase=()=>attackT<0?-1:Math.min(1,attackT/attackDur);
  const spec:StrikeSpec={id:`conch-diagnostic-${stage}`,shape:{kind:'lane',length:2.4,width:.65},windup,
   active:.1,recover:.9,cooldown:0,range:2.4,damage:stage===1?14:16,tags:['cover.checked'],weight:()=>1,units:'world'};
  const runner=new StrikeRunner(); runner.start(spec,actor,{x:0,y:0,z:2});
  let firstHitClock=-1,activeEntry=-1,hitPoseAttack=0;
  const ctx={actor,target:{x:0,y:0,z:2},canReach:()=>true,hit(){hits++;firstHitClock=clock;hitPoseAttack=phase();}};
  for(let step=1;step<=500&&hits===0;step++){
   clock=step*.005; if(attackT>=0)attackT+=.005;
   const before=runner.state;runner.update(.005,ctx);
   if(before==='windup'&&runner.state==='active'){activeEntry=clock;expect(hits).toBe(0);expect(phase()).toBe(-1);}
  }
  expect(hits).toBe(1);expect(firstHitClock-activeEntry).toBeCloseTo(.005,10);expect(hitPoseAttack).toBe(-1);
  const entry=evidence.activeWindowTipClassification.find(row=>row.stage===stage);if(entry===undefined)throw new Error('Missing pinned tip evidence');
  const rows=[...entry.outsideAuthoredLaneHalfWidth,...entry.insideAuthoredLaneHalfWidth];
  const tip=rows.find(row=>Math.abs((row[0]??-1)-firstHitClock)<1e-8);if(tip===undefined)throw new Error('Missing exact sampled first-hit clock');
  // Preserve the known failure as an explicit diagnostic. A revision should reverse this assertion
  // using freshly measured weighted tip geometry rather than this old supplied evidence.
  expect(Math.abs(tip[1]??0)).toBeGreaterThan(.725);
  results.push({stage,windup,dt:.005,activeEntry,firstHitClock,hitPoseAttack,tip,
   target:{x:0,y:0,z:2},hitDespiteTipOutsideNominalAndEffectiveLane:true});
 }
 writeFileSync('docs/reviews/conch-motion4-independent/strike-timing.json',JSON.stringify({
  schema:'conch.motion4.actual-runner-diagnostic.v1',results,
  scope:'Real StrikeRunner with structural actor and synchronized behavior clock; frozen source tip lookup. Not a live-host scheduling test.'},null,2)+'\n');
});
