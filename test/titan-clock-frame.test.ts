import { expect,test,vi } from 'vitest';
import { ProjectedState,ReturnProgram } from '../src/game/population/returnProgram';
import { ReturnProjectionV2 } from '../src/game/population/returnProjectionV2';
import { Rng } from '../src/engine/core/rng';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
import { TITAN_CLOCKS } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import frozen from './fixtures/titan-clocks.json' with {type:'json'};

const spearKeys=['mode','t','cd','x','z','strike','stuck','hurt','spread'];
function columns(row:Readonly<Record<string,number>>,keys:readonly string[]):Record<string,number>{
  return Object.fromEntries(keys.map(key=>{const value=row[key];if(value===undefined)throw new Error('Missing frozen clock column');return [key,value];}));
}

/** Frozen original native schedule loop and the new single-projection boundary.
 * Both execute actual admitted WASM; no mocked projection or clock is supplied. */
class ClockTrace {
  readonly gate:ProjectedState;
  readonly trail:ProjectedState;
  readonly landing:ProjectedState[];
  readonly spear:ProjectedState;
  readonly chain:ProjectedState;
  readonly joint:ProjectedState;
  readonly random=new Rng(731);
  constructor(private readonly combined:boolean,capacity=8,every=.1){
    const program=ReturnProgram.page(combined?programs.attack:{script:programs.attack.script,bytes:programs.attack.bytes});
    this.gate=new ProjectedState({initial:{},parameters:frozen.gate.parameters,signals:{step:frozen.gate.signal}},program);
    this.trail=new ProjectedState({...frozen.volley.trail,parameters:{...frozen.volley.trail.parameters,every}},program);
    this.landing=Array.from({length:capacity},()=>new ProjectedState(frozen.volley.landing,program));
    const spear=frozen.schedules.find(row=>row.id==='spear'),chain=frozen.schedules.find(row=>row.id==='chain');
    if(spear===undefined||chain===undefined)throw new Error('Missing frozen schedules');
    this.spear=new ProjectedState<Record<string,number>>(spear.law,program);
    this.chain=new ProjectedState<Record<string,number>>(chain.law,program);
    this.joint=new ProjectedState<Record<string,number>>(TITAN_CLOCKS.schedule,program);
  }
  reset():void{this.gate.reset();this.trail.reset();this.spear.reset();this.chain.reset();this.joint.reset();for(const law of this.landing)law.reset();}
  phase(mode:number,cd:number):void{this.spear.set({mode,cd});this.joint.set({mode,cd});}
  victory():void{this.spear.set({mode:0});this.joint.set({mode:0});for(const law of this.landing)law.reset();}
  chainState(cd:number,left:number,t:number):void{this.chain.set({cd,chain:left,t});this.joint.set({zzChainCd:cd,zzChainLeft:left,zzChainT:t});}
  snapshot():unknown{return {spear:this.combined?columns(this.joint.state,['mode','t','cd','x','z']):this.spear.state,
    chain:this.combined?{cd:this.joint.value('zzChainCd'),chain:this.joint.value('zzChainLeft'),t:this.joint.value('zzChainT')}:this.chain.state,
    trail:this.trail.state,landing:this.landing.map(law=>law.state),random:this.random.snapshot()};}
  step(dt:number,frame:Readonly<Record<string,number>>):unknown{
    const step=this.gate.step(dt,frame);if(step.dt===0)return {dt:0,effects:[]};
    const gate=step.values,effects:{id:string;index:number;values:Readonly<Record<string,number>>}[]=[];
    const px=frame['px']??0,pz=frame['pz']??0;
    if(gate['active']===1)this.trail.event('step',{dt:step.dt,x:px,z:pz});
    const launch=(index:number):void=>{
      const at=this.trail.event('pick',{index,x:px,z:pz}),landing=this.landing.find(law=>law.value('on')===0);
      landing?.reset({on:1,x:at['x']??px,z:at['z']??pz});
    };
    if(this.combined){
      const values:Readonly<Record<string,number>>=(gate['mask']??0)===0?{}:this.joint.project({...frame,dt:step.dt,count:this.trail.value('count'),zzMask:gate['mask']??0},this.random);
      if(values[TITAN_CLOCKS.outputs.spear]===1)effects.push({id:'spear',index:0,values:columns(values,spearKeys)});
      if(values[TITAN_CLOCKS.outputs.launch]===1)launch(values[TITAN_CLOCKS.outputs.index]??-1);
    }else{
      // Original schedule order and shared-state reads, including post-spear mode.
      const clocks=new Map([['spear',this.spear],['chain',this.chain]]);
      for(const [index,row]of frozen.schedules.entries()){
        if(((gate['mask']??0)&(1<<index))===0)continue;
        const shared:Record<string,number>={};
        for(const [name,source]of Object.entries(frozen.shared)){
          const clock=clocks.get(source.clock);if(clock===undefined)throw new Error('Missing frozen clock');shared[name]=clock.value(source.slot);
        }
        const clock=clocks.get(row.id);if(clock===undefined)throw new Error('Missing frozen clock');
        const values=clock.project({...shared,...frame,dt:step.dt,count:this.trail.value('count')},this.random);
        if(row.id==='spear')effects.push({id:row.id,index,values}); // Nonlanding chain effect has no consumer.
        if(row.id===frozen.volley.launcher&&values['strike']===1)launch(values['index']??-1);
      }
    }
    if(gate['land']===1)for(const [index,law]of this.landing.entries()){
      if(law.value('on')!==1)continue;const x=law.value('x'),z=law.value('z');
      effects.push({id:frozen.volley.launcher,index,values:{...law.project({...frame,dt:step.dt},this.random),x,z,landing:1}});
    }
    return {dt:step.dt,effects};
  }
}

test('joint schedule retains the original ABI1 witness bytes',()=>{
  expect(programs.attack.script.module).toBe('blobs/wasm/ba56b0de486d84b2dcf05695844f5ad61579d1eb4f3530d5211b85b2568f1e3b.wasm');
  for(const names of [programs.attack.v2.fields,programs.attack.v2.signals,programs.attack.v2.channels]){
    const first=names.findIndex(name=>name.startsWith('zz'));
    expect(first).toBeGreaterThan(0);expect(names.slice(first).every(name=>name.startsWith('zz'))).toBe(true);
  }
});

test('every mask, phase and spear mode preserves ordered schedule state and RNG including signed zero',()=>{
  const old=ReturnProgram.page({script:programs.attack.script,bytes:programs.attack.bytes}),next=ReturnProgram.page(programs.attack);
  for(const mask of [0,1,2,3])for(const phase of [0,1,2])for(const mode of [0,1,2,3])for(const dt of [0,.016,.1,.5,4])for(const count of [0,12]){
    const a=new Rng(193),b=new Rng(193),s={mode,t:4,cd:-0,x:-0,z:0},chain={cd:-0,chain:1,t:0};
    const frame={phase,dt,count,px:-0,pz:0};let spear:Readonly<Record<string,number>>|undefined,volley:Readonly<Record<string,number>>|undefined;
    if((mask&1)!==0){spear=old.project('arenaSpear',{...frozen.schedules[0]?.law.parameters,...s,...frame,chainLeft:chain.chain},a);Object.assign(s,columns(spear,['mode','t','cd','x','z']));}
    if((mask&2)!==0){volley=old.project('arenaChain',{...chain,...frame,spearMode:s.mode},a);Object.assign(chain,{cd:volley['cd'],chain:volley['left'],t:volley['t']});}
    const joint=new ProjectedState<Record<string,number>>(TITAN_CLOCKS.schedule,next);
    joint.set({mode,t:4,cd:-0,x:-0,z:0,zzChainCd:-0,zzChainLeft:1,zzChainT:0});
    const actual=joint.project({...frame,zzMask:mask},b);
    expect(columns(joint.state,['mode','t','cd','x','z'])).toStrictEqual(s);
    expect(columns(joint.state,['zzChainCd','zzChainLeft','zzChainT'])).toStrictEqual({zzChainCd:chain.cd,zzChainLeft:chain.chain,zzChainT:chain.t});
    expect(actual['zzSpearActive']).toBe(Number((mask&1)!==0));
    if(spear!==undefined)expect(columns(actual,spearKeys)).toStrictEqual(spear);
    if(volley!==undefined)expect(columns(actual,['zzChainCd','zzChainLeft','zzChainT','zzChainStrike','zzChainIndex'])).toStrictEqual({zzChainCd:volley['cd'],zzChainLeft:volley['left'],zzChainT:volley['t'],zzChainStrike:volley['strike'],zzChainIndex:volley['index']});
    expect(b.snapshot()).toStrictEqual(a.snapshot());
  }
});

test.each([{capacity:1,every:100},{capacity:8,every:.1}])('original irregular slots, resets, full/empty trail and first-free landings remain exact (%j)',({capacity,every})=>{
  const calls=vi.spyOn(ReturnProjectionV2.prototype,'prepare'),old=new ClockTrace(false,capacity,every),next=new ClockTrace(true,capacity,every);
  try{
    let launchAndLand=0,fullLaunches=0,emptyLaunches=0;
    for(let tick=0;tick<400;tick++){
      if(tick===0||tick===180){old.reset();next.reset();old.chainState(0,0,0);next.chainState(0,0,0);}
      if(tick===80||tick===220){old.phase(3,0);next.phase(3,0);}
      if(tick===140){old.victory();next.victory();}
      if(tick===250){for(const owner of [old,next]){owner.trail.set({count:12});for(const law of owner.landing)law.set({on:1,t:0,x:-0,z:2});owner.chainState(0,0,0);owner.phase(0,99);}}
      const dt=[.016,.017,.067,.5,.03,.03,.04,.2,.9][tick%9]??.1;
      const frame={phase:tick<120||tick>=180?2:tick<150?1:0,fighting:Number(tick%31!==0),px:tick===0?-0:Math.sin(tick*.07)*40,pz:Math.cos(tick*.09)*20};
      const full=next.landing.every(law=>law.value('on')===1);
      const expected=old.step(dt,frame);calls.mockClear();const actual=next.step(dt,frame);
      expect(actual,`effects at ${tick}`).toStrictEqual(expected);expect(next.snapshot(),`state at ${tick}`).toStrictEqual(old.snapshot());
      const names=calls.mock.calls.map(args=>args[0]),pick=names.indexOf('arenaTrailPick'),land=names.indexOf('chainLand');
      if(pick!==-1){if(full)fullLaunches++;if(next.trail.value('count')===0)emptyLaunches++;}
      if(pick!==-1&&land!==-1){expect(pick).toBeLessThan(land);launchAndLand++;}
      if(frame.fighting===0||frame.phase===1)expect(names).not.toContain('zzArenaSchedules');
    }
    expect(launchAndLand).toBeGreaterThan(5);expect(fullLaunches).toBeGreaterThan(0);
    if(every===100)expect(emptyLaunches).toBeGreaterThan(0);
  }finally{calls.mockRestore();}
});
