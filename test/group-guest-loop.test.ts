import {beforeAll,expect,test} from 'vitest';
import {AnimalSim} from '../src/engine/entities/AnimalSim';
import {GroupBrain,type GroupGuestFrameV2,type GroupGuestProjectionV2,type GroupGuestPublicationV2} from '../src/engine/ai/GroupBrain';
import {GroupStepV2,type GroupStepNativeResultV2} from '../src/engine/script/groupStepV2';
import {Scope} from '../src/engine/app/scope';
import {Rng} from '../src/engine/core/rng';
import type {GroupBankValueV2} from '../src/format/scriptGroupBankV2';
import {parseGroupStepV2,groupStepLayoutV2} from '../src/format/scriptGroupStepV2';
import {compileScriptV2} from '../src/sdk/bake/compileScriptV2';
import {v2CoreSource} from '../src/sdk/as/wsV2';
import {groupBankSourceV2} from '../src/sdk/as/groupBankV2';
import {groupStepSourceV2} from '../src/sdk/as/groupStepV2';

const rows=parseGroupStepV2({bank:[{name:'value',kind:'number'},{name:'pc',kind:'number',integer:true,min:0,max:1}],columns:[{name:'reply',id:1,source:{kind:'result',channel:'reply'}}],members:1,signals:['step'],actions:[{id:1,words:2,native:{kind:'normal',channel:'reply'}},{id:2,words:2,member:0,native:{kind:'memory',key:'aw'}}],outputs:2,pages:1,fuel:40000,randomStreams:2});
let bytes:Uint8Array;
beforeAll(async()=>{bytes=await compileScriptV2(`import * as core from './sdk/as/wsV2';import * as bank from './sdk/as/groupBankV2';import * as slots from './sdk/as/groupStepV2';
export function ws_abi():i32{return 2;}export function ws_io():i32{return 0;}export function ws_init(a:i32,b:i32,f:i32):i32{return f;}
export function ws_project(f:i32):i32{core.beginState();assert(core.beginBinding(0));if(bank.value(1)==0){bank.write(0,bank.value(0)+core.random(1)+core.random(2));bank.write(1,1);core.pageOutput(1,2,3);}else{const value=bank.value(0)+slots.member(0,0);bank.write(0,value);bank.write(1,0);core.pageOutput(2,0,value);}core.endBinding();return f;}`,{lane:'project',ioBytes:groupStepLayoutV2(rows).bytes,sources:{'sdk/as/wsV2.ts':v2CoreSource(0),'sdk/as/groupBankV2.ts':groupBankSourceV2(0,2),'sdk/as/groupStepV2.ts':groupStepSourceV2(1,1)}});});
function actor(){return new AnimalSim({kind:'horse',label:'Horse',variant:'mare',rarity:'common',hp:100,aggressive:false,dims:{bodyY:1,bodyHalfLen:1,bodyRadius:.4,headRadius:.2,legLen:.5,feet:[],halfWidth:.4},mods:{speed:1,chargeDist:1,damageTaken:1,chargeDamage:1,relentless:false}},.3,1,'mare',{heightAt:()=>0,random:()=>.5});}
class NativeGroup extends GroupBrain<AnimalSim>{
 readonly scope=new Scope('original-group');readonly random=new Rng(50);readonly contextRandom=new Rng(90);readonly bank=new Float64Array([7,0]);
 readonly resume={field:'pc',values:[0,1],segments:4};readonly seen:number[]=[];
 value=7;refuse=false;retire=false;
 readonly ground={normalY:(_x:number,_z:number)=>{this.seen.push(this.value);if(this.retire)this.scope.dispose();return .5;}};
 readonly runner:GroupStepV2;readonly program:GroupGuestProjectionV2;
 constructor(){super([actor()]);this.runner=new GroupStepV2(bytes,rows,this.scope);this.program={prepareGroup:input=>this.runner.prepare(input)};}
 step(){this.bank[1]=0;this.runGuest(this.program);}
 protected override captureGuest(replies:readonly GroupStepNativeResultV2[]):GroupGuestFrameV2{
  const body=this.members[0];if(body===undefined)throw new Error('Missing original member');this.bank[0]=this.value;
  const members=[{scope:this.scope,self:{group:'herd',slot:0,identity:body.entityId,actor:body},player:{position:{x:0,z:0}},observed:new Map(),t:1,dt:.1,results:{reply:0,...Object.fromEntries(replies.map(row=>[row.channel,row.value]))}}];
  const input={group:'herd',handle:1,signal:'step',tick:1,state:this.bank,members,references:[{group:'herd',slot:0,identity:body.entityId,wire:body.entityId,handle:1,body}],random:this.random,contextRandom:this.contextRandom};
  return{input,native:{scope:this.scope,members,ground:this.ground},resume:this.resume};
 }
 protected override prepareGuestCommit(_frame:GroupGuestFrameV2,values:Readonly<Record<string,GroupBankValueV2>>):GroupGuestPublicationV2{
  const value=values['value'];if(typeof value!=='number'||!Number.isFinite(value)||this.refuse)throw new Error('Original codec refusal');
  const before=this.value;return{validate:()=>{if(this.value!==before||this.scope.disposed||this.scope.disposing)throw new Error('Changed original scalar owner');},commit:()=>{this.value=value;}};
 }
}
test('shared loop publishes original scalars before native reads and resumes before returning',()=>{
 const group=new NativeGroup();try{group.step();expect(group.seen).toHaveLength(1);const value=group.seen[0];if(value===undefined)throw new Error('Missing native read');expect(value).toBeGreaterThan(7);expect(group.value).toBe(value+.5);expect(group.members[0]?.mem['aw']).toBe(group.value);expect(group.bank[1]).toBe(0);}finally{group.scope.dispose();}
});
test('an original codec refusal rejects both RNGs and the entire native prefix',()=>{
 const group=new NativeGroup();try{const random=group.random.snapshot(),context=group.contextRandom.snapshot();group.refuse=true;expect(()=>group.step()).toThrow('Original codec refusal');expect(group.random.snapshot()).toEqual(random);expect(group.contextRandom.snapshot()).toEqual(context);expect([...group.bank]).toEqual([7,0]);expect(group.value).toBe(7);expect(group.seen).toEqual([]);expect(group.members[0]?.mem['aw']).toBeUndefined();}finally{group.scope.dispose();}
});
test('retirement during native drain retains the original accepted prefix and stops later effects',()=>{
 const group=new NativeGroup();try{group.retire=true;const random=group.random.snapshot();expect(()=>group.step()).toThrow(/Retired|owner/);expect(group.seen).toEqual([group.value]);expect(group.value).toBeGreaterThan(7);expect(group.random.snapshot()).not.toEqual(random);expect(group.members[0]?.mem['aw']).toBeUndefined();}finally{group.scope.dispose();}
});
