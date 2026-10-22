import { beforeAll,expect,test } from 'vitest';
import { compileReturnProjectionV2 } from '../src/sdk/returnProjectionV2';
import { readDecisionSources } from '../src/sdk/buildDecisionScripts';
import { ReturnProjectionV2 } from '../src/game/population/returnProjectionV2';
import { ProjectedState,ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import { parseReturnProjectionV2,returnProjectionV2Layout,type ReturnProjectionV2Rows } from '../src/format/returnProjectionV2';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { v2CoreSource } from '../src/sdk/as/wsV2';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { TITAN_SCRIPT } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type:'json' };

let built:Awaited<ReturnType<typeof compileReturnProjectionV2>>;
let hostile:ReturnProjectionV2Rows;
beforeAll(async()=>{
  const row=programs.attack.script;
  const ids=(values:Readonly<Record<string,string>>):Map<string,number>=>new Map(Object.values(values).sort().map((name,index)=>[name,index+1]));
  built=await compileReturnProjectionV2(row,{fields:ids(row.fields),signals:ids(row.signals),channels:ids(row.channels)},
    readDecisionSources(new URL('../src/shards/nalati-grasslands/',import.meta.url).pathname),{asLineCeiling:2837});
  const layout=returnProjectionV2Layout(1);
  const bytes=await compileScriptV2(`import * as core from './core';
    export function ws_abi():i32{return 2;}export function ws_io():i32{return 0;}
    export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return fuel;}
    export function ws_project(fuel:i32):i32{
      core.beginState();assert(core.beginBinding(0));const mode=i32(core.field(0));core.pageOutput(1,core.random(1));
      if(mode==0)core.pageOutput(1,2);
      if(mode==1)core.pageOutput(2,2);
      if(mode==2)core.pageOutput(1,Math.sqrt(-1));
      if(mode==3)store<u32>(16,2);
      if(mode==4)store<f64>(core.row(10,0)+24,1);
      if(mode==5)store<u32>(core.row(22,0),2);
      core.endBinding();return fuel;
    }`,{lane:'project',ioBytes:layout.bytes,sources:{'core.ts':v2CoreSource(0)}});
  hostile=parseReturnProjectionV2({artifact:{abi:2,minor:0,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission,
    hash:hashImmutableBytes(bytes),lane:'project',pages:1,ioBytes:layout.bytes},fields:['mode'],signals:['run'],channels:['value'],
  bytes:btoa(Array.from(bytes,byte=>String.fromCodePoint(byte)).join(''))});
},60000);

test('Titan dual port retains exact public ABI1 bytes and admits a project-only candidate',()=>{
  expect(built.legacy).toStrictEqual({script:programs.attack.script,bytes:programs.attack.bytes});
  expect(built.candidate).toStrictEqual(programs.attack.v2);
  expect(parseReturnProjectionV2(built.candidate).artifact.lane).toBe('project');
  expect(()=>new ReturnProjectionV2({...built.candidate,artifact:{...built.candidate.artifact,hash:'0'.repeat(64)}})).toThrow('hash mismatch');
  expect(()=>parseReturnProjectionV2({...built.candidate,fields:[...built.candidate.fields].reverse()})).toThrow();
});

test('the full hostile output bank refuses atomically and rewinds for the next call',()=>{
  const program=new ReturnProjectionV2(hostile),random=new Rng(91),before=random.snapshot();
  for(const mode of [0,1,2,3,4,5]){
    expect(()=>program.project('run',{mode},random)).toThrow();expect(random.snapshot()).toStrictEqual(before);
  }
  const expected=new Rng(91);expect(program.project('run',{mode:6},random)).toStrictEqual({value:expected.next()});
  expect(random.snapshot()).toStrictEqual(expected.snapshot());
  let reads=0;
  const getter={...hostile,get fields(){reads++;return ['mode'];}};
  expect(()=>parseReturnProjectionV2(getter)).toThrow('JSON data');expect(reads).toBe(0);
});

test('every Titan signal preserves f64 outputs, candidate order and borrowed RNG',()=>{
  const old=ReturnProgram.page(built.legacy),next=ReturnProgram.page(programs.attack),a=new Rng(735),b=new Rng(735);
  const base=Object.fromEntries(built.candidate.fields.map(name=>[name,0]));
  Object.assign(base,{dt:.1,radius:30,capacity:12,every:.1,fullHp:2600,fullDrawMul:2,share:1,bodyX:20,bodyZ:10,
    spearAim:.8,spearLock:.2,spearRadius:3,respawnDistance:16,rewardDistance:4,count:8,fullDraw:80,victoryT:-1,
    cx:4,cz:3,x:5,z:8,px:7,pz:9,cy:2,ax:1,az:2,theta:-1,lane:1,flank:2});
  const candidates=Array.from({length:8},(_,i)=>({...base,x:i+1,z:i-2,hit:Number(i%2===0),mode:i%4}));
  for(const phase of [0,1,2])for(const mode of [0,1,2,3])for(const signal of built.candidate.signals){
    const frame={...base,phase,mode,t:1.75,elapsed:.15};
    expect(next.project(signal,frame,b,candidates),`${signal}/${phase}/${mode}`).toStrictEqual(old.project(signal,frame,a,candidates));
    expect(b.snapshot()).toStrictEqual(a.snapshot());
  }
});

test('the same ProjectedState keeps lifecycle, retain maps and irregular ten-Hz slots',()=>{
  const old=new ProjectedState(TITAN_SCRIPT.fight,ReturnProgram.page(built.legacy));
  const next=new ProjectedState(TITAN_SCRIPT.fight,ReturnProgram.page(programs.rules));
  const frame={mode:3,broke:0,px:0,pz:0,cx:0,cz:0,radius:10,mounted:1,fighting:1,engaged:1,storm:1,armed:0,victory:0};
  for(const phase of [0,1,2]){
    expect(next.restart({phase,share:1})).toStrictEqual(old.restart({phase,share:1}));
    expect(next.event('begin',{phase})).toStrictEqual(old.event('begin',{phase}));
    for(const dt of [.016,.017,.067,.5,.03,.03,.04,.2]){
      expect(next.step(dt,frame)).toStrictEqual(old.step(dt,frame));expect(next.state).toStrictEqual(old.state);
    }
    expect(next.event('damage',{mode:3,amount:80})).toStrictEqual(old.event('damage',{mode:3,amount:80}));
    expect(next.event('victory')).toStrictEqual(old.event('victory'));
  }
});

test('preparing, declining, trapping and stale acceptance never advance a borrowed stream',()=>{
  const program=new ReturnProjectionV2(built.candidate),random=new Rng(19),before=random.snapshot();
  const frame={phase:0,mode:3,dt:2,t:0,cd:0,x:0,z:0,px:1,pz:1,chain:0,aim:1,lock:.2,stuck:.5};
  const first=program.prepare('spear',frame,random);expect(random.snapshot()).toStrictEqual(before);
  expect(first.values).toStrictEqual(program.prepare('spear',frame,random).values);
  expect(()=>program.project('spear',{},random)).toThrow();expect(random.snapshot()).toStrictEqual(before);
  first.accept();expect(random.snapshot()).not.toStrictEqual(before);expect(()=>first.accept()).toThrow('already accepted');
  const stale=program.prepare('spear',frame,random);random.next();const changed=random.snapshot();
  expect(()=>stale.accept()).toThrow('Changed projection RNG');expect(random.snapshot()).toStrictEqual(changed);
  expect(()=>program.project('unknown',frame,random)).toThrow('Invalid return request');
});

test('a rejected retained state does not publish candidate RNG or mutate continuation',()=>{
  const program=new ReturnProjectionV2(built.candidate),random=new Rng(23);
  const initial:Record<string,number>={cd:0};
  const state=new ProjectedState({initial,retain:{cd:'cd'},signal:'spear'},program);
  delete initial['cd'];
  const before=random.snapshot(),frame={phase:0,mode:3,dt:2,t:0,cd:0,x:0,z:0,px:1,pz:1,chain:0,aim:1,lock:.2,stuck:.5};
  expect(()=>state.project(frame,random)).toThrow('Invalid projection state');
  expect(random.snapshot()).toStrictEqual(before);expect(state.state).toStrictEqual({cd:0});
});
