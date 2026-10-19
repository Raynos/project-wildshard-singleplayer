// oxlint-disable-next-line import/no-nodejs-modules -- Retains source-only measurement results for independent review.
import { writeFileSync } from 'node:fs';
import { type Bone, Matrix4, type Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { mantisCompleteMotionClips } from '../src/shards/driftwood-isle/generators/mantisCompleteMotionClips';
import { mantisPrecontactClips } from '../src/shards/driftwood-isle/generators/mantisPrecontactClips';
import { fixture, native, locals, poseContext } from './mantis-complete-fixture';

function bone(context:ReturnType<typeof poseContext>,name:string):Bone {
  const value=context.bones[name];if(value===undefined)throw new Error('Missing native bone');return value;
}
function weighted(context:ReturnType<typeof poseContext>) {
  bone(context,'body').updateMatrixWorld(true);
  const transforms=native.bones.map(b=>bone(context,b.name).matrixWorld.clone().multiply(new Matrix4().makeTranslation(...b.pos).invert()));
  let minimum=Infinity,part='';
  const feet:Record<string,Vector3>={};
  for(const p of native.parts) {
    const patch:number[]=[];let restMin=Infinity;
    if(p.name.includes('_knee'))for(let i=1;i<p.positions.length;i+=3)restMin=Math.min(restMin,p.positions[i]??Infinity);
    const centroid=new Vector3();
    for(let i=0;i<p.positions.length/3;i++) {
      const pos=new Vector3().fromArray(p.positions,i*3),out=new Vector3();
      for(let j=0;j<4;j++) {
        const index=p.skinIndices[i*4+j],weight=p.skinWeights[i*4+j];
        if(index===undefined||weight===undefined)throw new Error('Missing native influence');
        const matrix=transforms[index];if(matrix===undefined)throw new Error('Missing native transform');
        if(weight!==0)out.addScaledVector(pos.clone().applyMatrix4(matrix),weight);
      }
      if(out.y<minimum){minimum=out.y;part=p.name;}
      if(pos.y<restMin+.03){patch.push(i);centroid.add(out);}
    }
    if(patch.length>0)feet[p.name]=centroid.divideScalar(patch.length);
  }
  return {minimum,part,feet};
}
const record:Record<string,unknown>={scope:'Source-only exact native22 skin evaluator. Synthetic inputs; no actual-world/runtime/visual acceptance.',acceptance:false};
test('complete authored data stays bounded and opts into only the two preserved real strikes',()=>{
  const clips=mantisCompleteMotionClips();expect(()=>numericCreaturePose(clips)).not.toThrow();
  expect(clips.programs.every(p=>p.nodes.length<=128&&p.locals===undefined)).toBe(true);
  expect(clips.strikeIds).toEqual(['strike.splinter-mantis.first','strike.splinter-mantis.second']);
  expect(clips.programs.flatMap(p=>p.numeric?.outputs??[]).every(o=>o.target.startsWith('joint.'))).toBe(true);
  record['dag']={programs:clips.programs.length,maxNodes:Math.max(...clips.programs.map(p=>p.nodes.length))};
});
test('retains the rejected complete source motion and its exact gate witness',async()=>{
  const f=await fixture(),animate=numericCreaturePose(mantisCompleteMotionClips());
  try {
    const saved=v.parse(v.record(v.string(),v.unknown()),JSON.parse(v.parse(v.string(),f.control.snapshot())));
    const original=v.parse(v.record(v.string(),v.unknown()),saved['strike']);
    const pose=(phase:string,index:number,elapsed:number,speed=0,gait=0,death=-1,flinch=0) => {
      f.control.restore(JSON.stringify({...saved,strike:{...original,phase,currentId:index===0?null:`strike.splinter-mantis.${index===1?'first':'second'}`,elapsed}}));
      Object.assign(f.context,{t:2.5,speed,phase:gait,deathT:death,alive:death<0,flinch});animate(f.context);return locals(f.context);
    }
    const transitions:unknown[]=[];
    const compare=(a:ReturnType<typeof locals>,b:ReturnType<typeof locals>) => {
      let error=0;for(const [name,values]of Object.entries(a))for(let i=0;i<values.length;i++)
        error=Math.max(error,Math.abs((values[i]??Infinity)-(b[name]?.[i]??-Infinity)));
      expect(error,'Native arithmetic continuity, not bitwise sample-node endpoint equality').toBeLessThanOrEqual(1e-12);return error;
    }
    for(const [index,duration,recovery] of [[1,.75,.12],[2,.45,1.1]]) {
      if(index===undefined||duration===undefined||recovery===undefined)throw new Error('Missing strike');
      const wind=pose('windup',index,duration,1.15,.2),active=pose('active',index,0,1.15,.2);
      transitions.push({index,windupToActiveMaximumError:compare(active,wind)});
      const end=pose('active',index,1.4,4,.2),recover=pose('recover',index,0,4,.2);compare(recover,end);
      const rest=pose('recover',index,recovery,0,.2),idle=pose('idle',0,0,0,.2);compare(rest,idle);
    }
    let minimum=Infinity,witness:unknown=null,maxStep=0,stepWitness:unknown=null,cases=0;
    const scan=(phase:string,index:number,elapsed:number,speed:number,gait:number,death:number,flinch:number)=>{
      pose(phase,index,elapsed,speed,gait,death,flinch);const measure=weighted(f.context);cases++;
      if(measure.minimum<minimum){minimum=measure.minimum;witness={phase,index,elapsed,speed,gait,death,flinch,part:measure.part};}
      return measure;
    };
    const gaitRows:unknown[]=[];
    for(const speed of [0,.05,.15,.3,.7,1.15])for(let i=0;i<=120;i++) {
      const gait=i/120,measured=scan('idle',0,0,speed,gait,-1,0);
      if(speed===1.15)gaitRows.push({phase:gait,feet:Object.fromEntries(Object.entries(measured.feet).map(([n,p])=>[n,p.toArray()]))});
    }
    for(const [index,phase,duration] of [[1,'windup',.75],[1,'active',1.7],[1,'recover',.12],[2,'windup',.45],[2,'active',1.7],[2,'recover',1.1]] as const) {
      let previous:Record<string,Quaternion>|undefined;
      for(let i=0;i<=Math.ceil(duration*60);i++) {
        const elapsed=Math.min(duration,i/60);scan(phase,index,elapsed,phase==='active'?4:0,.2,-1,0);
        const now=Object.fromEntries(Object.keys(f.context.bones).map(n=>[n,bone(f.context,n).quaternion.clone()]));
        if(previous!==undefined)for(const [name,q] of Object.entries(now)){const old=previous[name];if(old===undefined)throw new Error('Missing old joint');const delta=old.angleTo(q);if(delta>maxStep){maxStep=delta;stepWitness={index,phase,elapsed,name};}}
        previous=now;
      }
    }
    for(let i=0;i<=120;i++)for(const flinch of [0,1])scan('idle',0,0,0,.2,i/120,flinch);
    record['transitions']=transitions;record['envelope']={cases,minimum,witness,maxStep,stepWitness};record['gait']=gaitRows;
    record['sourceGates']={sampledFloor:minimum>=-1e-6,steady60HzStep:maxStep<=.1};
    writeFileSync('docs/reviews/mantis-complete-motion-plan/motion-results.json',`${JSON.stringify(record,null,2)}\n`);
    expect.soft(minimum,'Source floor gate').toBeGreaterThanOrEqual(-1e-6);
    // Characterization of the rejected attempt, NOT a relaxed acceptance threshold.
    expect(maxStep,'Preserve the mandatory failed 0.10-radian gate').toBeGreaterThan(.1);
    expect(maxStep).toBeCloseTo(.13444144375857628,12);
    expect(record['sourceGates']).toEqual({sampledFloor:true,steady60HzStep:false});
  }finally{f.host.dispose();}
},120000);
test('unchanged candidate7 still admits without a strike owner',()=>{
  const c=poseContext();expect(()=>numericCreaturePose(mantisPrecontactClips())(c)).not.toThrow();
});
