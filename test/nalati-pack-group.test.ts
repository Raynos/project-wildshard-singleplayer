import {readDecisionSources} from '../src/sdk/buildDecisionScripts';
import { Vector3 } from 'three';
import { expect, test,vi } from 'vitest';
import {GroupBankV2} from '../src/engine/script/groupBankV2';
import type {V2ColumnOwners} from '../src/engine/script/observationColumnsV2';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { v2CoreSource } from '../src/sdk/as/wsV2';
import { groupStepSourceV2 } from '../src/sdk/as/groupStepV2';
import { groupBankSourceV2 } from '../src/sdk/as/groupBankV2';
import { groupStepLayoutV2, parseGroupStepV2 } from '../src/format/scriptGroupStepV2';
import { GroupStepV2,type GroupStepNativeResultV2 } from '../src/engine/script/groupStepV2';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { PackBrain, type PackPorts,type PackSpec } from '../src/engine/ai/pack';
import { nativeGroupBrain } from '../src/format/groupBrains';
import brains from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';
import {PACK_PROFILE} from '../src/shards/nalati-grasslands/generators/packGroup';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {lendNalatiPasture} from './fixtures/nalati-return-modules';
import {NALATI_PASTURE as pasture} from './fixtures/nalati-titan';
import packBinding from '../src/shards/nalati-grasslands/data/packGuest.json' with {type:'json'};
import {scriptAdmissionRows} from '../src/format/scriptContract';
import {NALATI_SCRIPT_SECTIONS} from './fixtures/nalati-script-inventory';

const {id:profileId,...profile}=PACK_PROFILE;
const PACK_ROWS={...profile,outputs:128,pages:1,fuel:400000};
void profileId;
class ScriptedPack extends PackBrain<AnimalSim>{
 segments=0;captures=0;readonly banks=new Set<Float64Array>();
 readonly resultOwners=new Set<Readonly<Record<string,number>>>();
 readonly memberOwners=new Set<V2ColumnOwners>();readonly selfOwners=new Set<V2ColumnOwners['self']>();checkResults=false;resultMismatches=0;resultReplies=0;unsharedFrames=0;
 protected override captureGuest(replies:readonly GroupStepNativeResultV2[]){
  this.captures++;const frame=super.captureGuest(replies),first=frame.input.members[0];
  if(first===undefined)throw new Error('Missing pack member');
  for(const[slot,member]of frame.input.members.entries()){
   this.memberOwners.add(member);this.selfOwners.add(member.self);
   if(member.results!==undefined)this.resultOwners.add(member.results);
   if(member.player!==first.player||member.environment!==first.environment||member.observed!==first.observed)this.unsharedFrames++;
   if(this.checkResults)this.resultReplies+=replies.filter(reply=>reply.value!==0).length;
   if(this.checkResults)for(const[channel,value]of Object.entries(member.results??{})){
    let expected=0;for(const reply of replies)if(reply.channel===channel&&(reply.member===undefined||reply.member.slot===slot))expected=reply.value;
    if(!Object.is(value,expected))this.resultMismatches++;
   }
  }
  return frame;
 }
 constructor(step:GroupStepV2,scope:Scope,group:string,handle:number,members:AnimalSim[],home:{x:number;z:number},spec:PackSpec,ports:PackPorts<AnimalSim>){
 super(members,home.x,home.z,spec,ports);
 this.bindGuest({groupBindings:PACK_ROWS,prepareGroup:input=>{this.segments++;this.banks.add(input.state);return step.prepare(input);}},{profile:'main',parameters:{boundsHalf:250},capture:{common:['c00.alive','c12.lunge','c28.x','c30.z'],slots:[],references:[]},resume:{field:'pc',values:[0,1,2,3,4,5,6,7,8,9,10,20,21,22,23],segments:64}},{scope,group,handle,roster:()=>[]});
 }
}

// Compile inside an executed test so a compiler failure remains a test red.
// Only compiled bytes are shared; every caller still owns its guest image.
let compiledProgram: Promise<Uint8Array> | undefined;
async function program(): Promise<Uint8Array> {
  compiledProgram ??= compileProgram();
  return new Uint8Array(await compiledProgram);
}
function compileProgram(): Promise<Uint8Array> {
  const rows = parseGroupStepV2(PACK_ROWS), pack = readDecisionSources(new URL('../src/shards/nalati-grasslands/', import.meta.url).pathname).get('behaviour/pack.as');
  if(pack===undefined)throw new Error('Missing authored pack source');
  const entry = `import { init, tick, drive } from './behaviour/pack';
import * as core from './sdk/as/wsV2';
export function ws_abi():i32{return 2;}export function ws_io():i32{return 0;}
export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return fuel;}
export function ws_project(fuel:i32):i32{core.beginState();assert(core.beginBinding(0));
  const signal=i32(core.parameter(0));if(signal==1)init();else if(signal==2)tick();else if(signal>=3&&signal<19)drive(signal-3,false);else drive(signal-19,true);
  core.endBinding();return fuel;}`;
  return compileScriptV2(entry, { lane: 'project', ioBytes: groupStepLayoutV2(rows).bytes, maximumPages: rows.pages,
    sources: { 'behaviour/pack.ts': pack, 'sdk/as/wsV2.ts': v2CoreSource(0), 'sdk/as/groupBankV2.pack.ts': groupBankSourceV2(0, 34), 'sdk/as/groupStepV2.pack.ts': groupStepSourceV2(63, 16) } });
}

test('pack fixture copies preserve an independent compile after caller mutation', async () => {
  const reference = await compileProgram();
  const [first, second] = await Promise.all([program(), program()]);
  const hash = hashImmutableBytes(reference);
  expect(hashImmutableBytes(first)).toBe(hash);
  expect(hashImmutableBytes(second)).toBe(hash);
  expect(first.buffer).not.toBe(second.buffer);
  first.fill(0);
  expect(hashImmutableBytes(second)).toBe(hash);
  const later = await program();
  expect(later.buffer).not.toBe(second.buffer);
  expect(hashImmutableBytes(later)).toBe(hash);
});

type Log = (string | number)[][];
const round = (value: number): number => Math.round(value * 1e6) / 1e6;
function roster(count=5): AnimalSim[] {
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing wolf recipe');
  return Array.from({length:count},(_,i) => {
    const wolf = new AnimalSim(sample.spec, sample.seed + i, [1.1, 1, .9, 1, .8][i] ?? 1, `fixture:wolf:${i}`, { heightAt: () => 0, random: () => .5, now: () => 0 });
    wolf.position.set(60 + i * 3, 0, 40 - i * 2); wolf.yaw = 0; return wolf;
  });
}
function side(_tag: string, log: Log,count=5) {
  const shared = new Rng(7), context = new Rng(11), wolves = roster(count);
  const ports: PackPorts<AnimalSim> = { sharedRng: () => shared,
    environment: () => ({ playerFwdX: 0, playerFwdZ: -1, playerMounted: false, playerHealth01: 1, grassHeightAt: () => .5 }),
    visibility: () => 1, hearing: () => 10, downwind: () => false, inBounds: () => true, normalY: () => 1,
    register: () => undefined, bite: (actor, _c, radius) => { log.push(['bite', actor.entityId.split(':')[2] ?? '', round(radius)]); },
    onEvent: (event, x, z) => { log.push(['event', event, round(x), round(z)]); } };
  const context0 = (t: number, player: Vector3) => ({ dt: .1, t, player, playerSpeed: 3, calm: false, rng: context,
    sound: (cue: string) => { log.push(['sound', cue]); }, claim: () => true,
    steer: (actor: AnimalSim, yaw: number, speed: number, turn: number) => { log.push(['steer', actor.entityId.split(':')[2] ?? '', round(yaw), round(speed), round(turn)]);
      actor.yaw = yaw; actor.position.x += Math.sin(yaw) * speed * .1; actor.position.z += Math.cos(yaw) * speed * .1; },
    pathYaw: (actor: AnimalSim, x: number, z: number) => Math.atan2(x - actor.position.x, z - actor.position.z) });
  return { wolves, ports, context0,shared,contextRng:context };
}

const MEM = ['role', 'ox', 'oz', 'ring', 'lunge', 'lt', 'bit', 'st', 'sx', 'sz', 'low', 'snarl', 'howl', 'hidden'];

test('the pack program runs the original circling-pack law tick for tick', { timeout: 600_000 }, async () => {
  const bytes = await program(), scope = new Scope('r10b.differential');
  const spec = nativeGroupBrain({ ...brains.pack, id: 'nalati.wolf-pack', home: [60, 40], members: ['wolf'] }); if (spec.kind !== 'pack') throw new Error('Missing pack spec');
  const oracleLog: Log = [], scriptLog: Log = [];
  const a = side('a', oracleLog), b = side('b', scriptLog);
  try {
    const oracle = new PackBrain(a.wolves, 60, 40, spec, a.ports), scripted = new ScriptedPack(new GroupStepV2(bytes, PACK_ROWS, scope), scope, 'pack', 100, b.wolves, { x: 60, z: 40 }, spec, b.ports);
    // as PageGroups does: the foal hunt's roll happens only with a findPrey (none in reach here)
    oracle.findPrey = () => null;
    scripted.findPrey = () => null;
    oracle.initialize(); scripted.initialize();
    const states = (wolves: AnimalSim[]): unknown => wolves.map(w => [w.state, ...MEM.map(key => round(w.mem[key] ?? 0))]);
    expect(states(b.wolves)).toStrictEqual(states(a.wolves));
    const phases: string[] = [], seen = new Map<string, number>();
    for (let tick = 1; tick <= 600; tick++) {
      const t = tick * .1, player = new Vector3(Math.max(64, 120 - tick * .25), 0, 40); // walks in and stands at the pack
      const ca = a.context0(t, player), cb = b.context0(t, player);
      oracle.tick(ca); for (const w of a.wolves) oracle.drive(w, ca);
      scripted.tick(cb); for (const w of b.wolves) scripted.drive(w, cb);
      const bodyRandom=[a.shared.snapshot(),a.contextRng.snapshot(),b.shared.snapshot(),b.contextRng.snapshot()];
      for (const w of a.wolves) oracle.drive(w, ca, true);for (const w of b.wolves) scripted.drive(w, cb, true);
      expect([a.shared.snapshot(),a.contextRng.snapshot(),b.shared.snapshot(),b.contextRng.snapshot()]).toEqual(bodyRandom);
      if (phases.at(-1) !== oracle.phase) phases.push(oracle.phase);
      expect([tick, scripted.phase, round(scripted.awareness)]).toStrictEqual([tick, oracle.phase, round(oracle.awareness)]);
      expect([tick, states(b.wolves)]).toStrictEqual([tick, states(a.wolves)]);
      // AS transcendental arithmetic may differ by an ulp (G415); wire shape,
      // native identities and both borrowed random streams remain exact.
      const normalized=(wire:string):unknown=>JSON.parse(wire,(_key,value:unknown)=>typeof value==='number'?round(value):value);
      expect(normalized(scripted.snapshot())).toStrictEqual(normalized(oracle.snapshot()));
      expect(b.shared.snapshot()).toStrictEqual(a.shared.snapshot());expect(b.contextRng.snapshot()).toStrictEqual(a.contextRng.snapshot());
      for (const row of oracleLog) { const key = `${row[0]}:${row[1]}`; seen.set(key, (seen.get(key) ?? 0) + 1); }
      expect([tick, scriptLog.splice(0)]).toStrictEqual([tick, oracleLog.splice(0)]);
    }
    const before=scripted.snapshot();scripted.restore(before);expect(scripted.snapshot()).toBe(before);
    expect(phases.length).toBeGreaterThan(2); // the run reached past roam
    // the attack path ran: a granted token's lunge (snarl), a bite at reach, and the phases past roam
    expect(phases).toContain('encircle');
    expect(seen.get('sound:wolf_snarl') ?? 0).toBeGreaterThan(0);
    expect([...seen].filter(([key]) => key.startsWith('bite:')).length).toBeGreaterThan(0);
  } finally { scope.dispose(); }
});

// The original reads hidden/grass AFTER native steering at this same slot.
test('drive observes terrain after its native steering barrier', { timeout: 120_000 }, async () => {
  const bytes=await program(), scope=new Scope('pack-post-steer');
  const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});
  if(spec.kind!=='pack')throw new Error('Missing pack spec');
  const a=side('a',[]),b=side('b',[]);
  for(const ports of[a.ports,b.ports])ports.environment=()=>({playerFwdX:0,playerFwdZ:-1,playerMounted:false,playerHealth01:1,grassHeightAt:x=>x>400?.9:.1});
  const oracle=new PackBrain(a.wolves,60,40,spec,a.ports),guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,b.wolves,{x:60,z:40},spec,b.ports);
  try {
    oracle.initialize();guest.initialize();
    const wa=a.wolves[0],wb=b.wolves[0];if(wa===undefined||wb===undefined)throw new Error('Missing actor');
    wa.position.x=100;wb.position.x=100;
    const ca=a.context0(.1,new Vector3(150,0,40)),cb=b.context0(.1,new Vector3(150,0,40));
    ca.steer=actor=>{actor.position.x=500;};cb.steer=actor=>{actor.position.x=500;};
    oracle.drive(wa,ca);guest.drive(wb,cb);
    expect(wb.position.x).toBe(wa.position.x);
    expect(wb.mem['hidden']).toBe(wa.mem['hidden']);
  }finally{scope.dispose();}
});

test('repeat ticks and inactive body calls skip capture and AS', {timeout:120_000}, async()=>{
 const bytes=await program(),scope=new Scope('pack-skip'),side0=side('skip',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 let reads=0;const environment=side0.ports.environment;side0.ports.environment=()=>{reads++;return environment();};
 const guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,side0.wolves,{x:60,z:40},spec,side0.ports);
 try{guest.initialize();const c=side0.context0(.1,new Vector3(150,0,40));guest.tick(c);const calls=guest.segments,previous=reads;
 for(const w of side0.wolves){guest.tick(c);guest.drive(w,c,true);}
 expect({calls:guest.segments,reads}).toStrictEqual({calls,reads:previous});
 }finally{scope.dispose();}
});

test('bite observes decremented timer and re-reads mounted after native contact', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-bite-barrier');
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const logA:Log=[],logB:Log=[],a=side('a',logA),b=side('b',logB),mounted=[true,true];
 for(const [i,side0]of[a,b].entries()){
  side0.ports.environment=()=>({playerFwdX:0,playerFwdZ:-1,playerMounted:mounted[i]??false,playerHealth01:1,grassHeightAt:()=>.5});
  side0.ports.bite=actor=>{(i===0?logA:logB).push(['contact',round(actor.mem['lt']??0)]);mounted[i]=false;};
 }
 const oracle=new PackBrain(a.wolves,60,40,spec,a.ports),guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,b.wolves,{x:60,z:40},spec,b.ports);
 try{
  oracle.initialize();guest.initialize();oracle.phase='encircle';
  guest.phase='encircle';
  const wa=a.wolves[0],wb=b.wolves[0];if(wa===undefined||wb===undefined)throw new Error('Missing actor');
  for(const actor of[wa,wb]){actor.mem['lunge']=2;actor.mem['lt']=1;actor.position.set(149,0,40);}
  const ca=a.context0(.1,new Vector3(150,0,40)),cb=b.context0(.1,new Vector3(150,0,40));
  oracle.drive(wa,ca,true);guest.drive(wb,cb,true);
  expect(logB).toStrictEqual(logA);expect(wb.mem['lt']).toBe(wa.mem['lt']);
 }finally{scope.dispose();}
});

test('native calls reuse one bank and skipped frames neither capture nor encode', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-bank-reuse'),side0=side('reuse',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const encode=vi.spyOn(GroupBankV2.prototype,'encode');
 try{
  const guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,side0.wolves,{x:60,z:40},spec,side0.ports);guest.initialize();
  for(let tick=1;tick<=10;tick++){const c=side0.context0(tick*.1,new Vector3(150,0,40));guest.tick(c);for(const w of side0.wolves)guest.drive(w,c);}
  expect(encode).toHaveBeenCalledTimes(1);expect(guest.banks.size).toBe(1);
  const before=guest.segments;const c=side0.context0(1,new Vector3(150,0,40));
  for(let i=0;i<120;i++)for(const w of side0.wolves){guest.tick(c);guest.drive(w,c,true);}
  expect(guest.segments).toBe(before);expect(encode).toHaveBeenCalledTimes(1);
 }finally{encode.mockRestore();scope.dispose();}
});

test('a nested native decision reuses its own depth bank and preserves later reads', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-reentry');
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const logs:Log[]=[[],[]],a=side('a',logs[0]??[]),b=side('b',logs[1]??[]);
 const oracle=new PackBrain(a.wolves,60,40,spec,a.ports),guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,b.wolves,{x:60,z:40},spec,b.ports);
 try{
  oracle.initialize();guest.initialize();
  for(const [i,f]of[a,b].entries()){
   const pack=i===0?oracle:guest,c=f.context0(.1,new Vector3(150,0,40));let nested=false;
   const steer=c.steer;c.steer=(actor,yaw,speed,turn)=>{
    steer(actor,yaw,speed,turn);
    if(!nested){nested=true;pack.scare(actor.position.x,actor.position.z);pack.tick({...c,t:.2});}
   };
   const actor=f.wolves[0];if(actor===undefined)throw new Error('Missing native actor');pack.drive(actor,c);
  }
  expect(logs[1]).toEqual(logs[0]);expect(guest.phase).toBe(oracle.phase);
  expect(round(guest.awareness)).toBe(round(oracle.awareness));
  expect(b.contextRng.snapshot()).toEqual(a.contextRng.snapshot());expect(guest.banks.size).toBe(2);
  expect(guest.resultOwners.size).toBe(b.wolves.length*2);
  expect(guest.memberOwners.size).toBe(b.wolves.length*2);expect(guest.selfOwners.size).toBe(b.wolves.length*2);
  expect([...guest.memberOwners].every(member=>member.self.actor===null&&member.self.identity===''
    &&member.context?.calm===true&&member.context.playerSpeed===0&&member.references?.size===0&&Object.keys(member.results??{}).length===0
    &&member.player.position.x===0&&member.player.position.z===0&&member.observed.size===0)).toBe(true);
 }finally{scope.dispose();}
});

test('hostile binding accessors and incompatible banks refuse before initialization or RNG', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-preflight'),f=side('bad',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const step=new GroupStepV2(bytes,PACK_ROWS,scope),prepare=vi.fn(step.prepare.bind(step));
 const projection={groupBindings:PACK_ROWS,prepareGroup:prepare};
 const binding={profile:'main',parameters:{boundsHalf:250},resume:{field:'pc',values:[0,1,2,3,4,5,6,7,8,9,10,20,21,22,23],segments:64}};
 let getters=0;const hostile={get profile(){getters++;return 'main';}};
 const before=f.shared.snapshot();
 try{
  for(const row of [hostile,{...binding,profile:'missing'},{...binding,parameters:{boundsHalf:0}},{...binding,resume:{...binding.resume,field:'absent'}}]){
   const pack=new PackBrain(f.wolves,60,40,spec,f.ports);
   expect(()=>pack.bindGuest(projection,row,{scope,group:'bad',handle:100,roster:()=>[]})).toThrow();
  }
  const shortened={...PACK_ROWS,bank:PACK_ROWS.bank.filter(row=>row.name!=='phaseT')};
  expect(()=>new PackBrain(f.wolves,60,40,spec,f.ports).bindGuest({...projection,groupBindings:shortened},binding,{scope,group:'bad',handle:100,roster:()=>[]})).toThrow();
  expect(getters).toBe(0);expect(prepare).not.toHaveBeenCalled();expect(f.shared.snapshot()).toEqual(before);
 }finally{scope.dispose();}
});

test('independently retired native scope refuses before capture or guest effects', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-retirement'),f=side('retired',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 let reads=0;const environment=f.ports.environment;f.ports.environment=()=>{reads++;return environment();};
 const pack=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,f.wolves,{x:60,z:40},spec,f.ports);pack.initialize();
 const before={reads,calls:pack.segments,random:f.contextRng.snapshot()};scope.dispose();
 expect(()=>pack.tick(f.context0(.1,new Vector3(150,0,40)))).toThrow();
 expect({reads,calls:pack.segments,random:f.contextRng.snapshot()}).toEqual(before);
});

test('the full sixteen-member pack retains ordered effects within the fuel cap', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-capacity');
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const logA:Log=[],logB:Log=[],a=side('a',logA,16),b=side('b',logB,16);
 const oracle=new PackBrain(a.wolves,60,40,spec,a.ports),guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,b.wolves,{x:60,z:40},spec,b.ports);
 try{
  oracle.initialize();guest.initialize();
  for(let tick=1;tick<=40;tick++){
   for(const [i,f]of[a,b].entries()){
    const pack=i===0?oracle:guest,c=f.context0(tick*.1,new Vector3(64,0,40));
    pack.tick(c);for(const actor of f.wolves){pack.drive(actor,c);pack.drive(actor,c,true);}
   }
   expect(logB.splice(0)).toEqual(logA.splice(0));expect(guest.phase).toBe(oracle.phase);expect(round(guest.awareness)).toBe(round(oracle.awareness));
   expect(b.contextRng.snapshot()).toEqual(a.contextRng.snapshot());
  }
 }finally{scope.dispose();}
});

test('an original raid prey can be killed at the native contact barrier and clears on the next tick', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-prey');
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const logA:Log=[],logB:Log=[],a=side('a',logA),b=side('b',logB);
 const prey=()=>({position:new Vector3(61,0,40),yaw:0,alive:true,applyDamage(amount:number){this.alive=false;return amount>0;}}),pa=prey(),pb=prey();
 for(const [i,f]of[a,b].entries()){
  const target=i===0?pa:pb;f.ports.preyIdentity=()=> 'fixture:prey';f.ports.resolvePrey=id=>id==='fixture:prey'?target:null;
 }
 const oracle=new PackBrain(a.wolves,60,40,spec,a.ports),guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,b.wolves,{x:60,z:40},spec,b.ports);
 try{
  oracle.initialize();guest.initialize();expect(oracle.raid(pa)).toBe(true);expect(guest.raid(pb)).toBe(true);
  for(const [i,f]of[a,b].entries()){
   const pack=i===0?oracle:guest,c=f.context0(.1,new Vector3(150,0,40));pack.tick(c);pack.phase='encircle';
   const actor=f.wolves[0];if(actor===undefined)throw new Error('Missing predator');actor.position.set(61,0,40);actor.mem['lunge']=2;actor.mem['lt']=1;
   pack.drive(actor,c,true);pack.tick({...c,t:.2});
  }
  expect(pb.alive).toBe(pa.alive);expect(pa.alive).toBe(false);expect(guest.prey).toBe(oracle.prey);expect(guest.prey).toBe(null);
  expect(logB).toEqual(logA);expect(b.contextRng.snapshot()).toEqual(a.contextRng.snapshot());
 }finally{scope.dispose();}
});

test('member capture reads grass only for the active member and original context slot', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-selected-grass'),f=side('capture',[],16);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const sampled:number[]=[];f.ports.environment=()=>({playerFwdX:0,playerFwdZ:-1,playerMounted:false,playerHealth01:1,grassHeightAt:x=>{sampled.push(x);return .5;}});
 const pack=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,f.wolves,{x:60,z:40},spec,f.ports);
 try{
  pack.initialize();sampled.length=0;const before=pack.segments,actor=f.wolves[7],context=f.wolves[0];if(actor===undefined||context===undefined)throw new Error('Missing member');
  const originalX=actor.position.x;pack.drive(actor,f.context0(.1,new Vector3(150,0,40)));
  expect(sampled.length).toBeGreaterThan(0);expect(sampled.length).toBeLessThanOrEqual((pack.segments-before)*2);
  expect(sampled.every(x=>x===originalX||x===actor.position.x||x===context.position.x)).toBe(true);
 }finally{scope.dispose();}
});


test('the consumed pack profile borrows the same scoped binary pasture module inside the eight-module cap',()=>{
 const scope=new Scope('pack-shipped-binary'),f=side('shipped',[],16);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 try{
  lendNalatiPasture(scope);const selected=ReturnProgram.page(pasture,scope);
  if(selected.prepareGroup===undefined||selected.groupBindings===undefined)throw new Error('Missing group capability');
  expect(pasture.v2.bytes).toBe('');expect(selected.groupBindings.profiles?.map(row=>row.id)).toEqual(['pack']);
  expect(ReturnProgram.page(pasture,scope)).toBe(selected);
  const pack=new PackBrain(f.wolves,60,40,spec,f.ports),prepare=selected.prepareGroup;
  pack.bindGuest({groupBindings:selected.groupBindings,prepareGroup:input=>{try{return prepare(input);}catch(error){throw new Error(`shipped ${input.signal} pc=${input.state[24]}`,{cause:error});}}},packBinding,{scope,group:'pack.shipped',handle:100,roster:()=>[]});
  pack.initialize();for(let tick=1;tick<=12;tick++){const c=f.context0(tick*.1,new Vector3(64,0,40));pack.tick(c);for(const actor of f.wolves){pack.drive(actor,c);pack.drive(actor,c,true);}}
  expect(f.wolves.every(actor=>Number.isFinite(actor.mem['ring']))).toBe(true);
  const modules=scriptAdmissionRows(NALATI_SCRIPT_SECTIONS);expect(modules.length).toBe(8);
  expect(modules.filter(row=>row.module===`blobs/wasm/${pasture.v2.artifact.hash}.wasm`)).toHaveLength(1);
 }finally{scope.dispose();}
});


test('periodic full-pack ticks encode once and skip every duplicate member tick before capture', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-periodic-tick'),f=side('tick-spike',[],16);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const encode=vi.spyOn(GroupBankV2.prototype,'encode');
 try{
  const pack=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,f.wolves,{x:60,z:40},spec,f.ports);pack.checkResults=true;pack.initialize();
  for(let tick=1;tick<=48;tick++){
   const c=f.context0(tick*.1,new Vector3(64,0,40)),before=pack.segments;pack.tick(c);
   const actual={segments:pack.segments,captures:pack.captures};expect(actual.segments-before).toBeGreaterThan(0);
   expect(actual.segments-before).toBeLessThanOrEqual(64);expect(actual.captures).toBe(actual.segments);
   for(const _member of f.wolves){pack.tick(c);}
   expect({segments:pack.segments,captures:pack.captures}).toEqual(actual);
  }
  expect(encode).toHaveBeenCalledTimes(1);expect(pack.banks.size).toBe(1);
  expect(pack.resultOwners.size).toBe(16);expect(pack.memberOwners.size).toBe(16);expect(pack.selfOwners.size).toBe(16);
  expect([...pack.memberOwners].every(member=>member.self.actor===null&&member.self.identity===''
    &&member.context?.calm===true&&member.context.playerSpeed===0&&member.references?.size===0&&Object.keys(member.results??{}).length===0
    &&member.player.position.x===0&&member.player.position.z===0&&member.observed.size===0)).toBe(true);
  expect(pack.resultMismatches).toBe(0);expect(pack.resultReplies).toBeGreaterThan(0);expect(pack.unsharedFrames).toBe(0);
 }finally{encode.mockRestore();scope.dispose();}
});

test('pack capture reserves distinct scratch before scalar getter reentry', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-scalar-reentry'),f=side('scratch',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const step=new GroupStepV2(bytes,PACK_ROWS,scope),guest=new ScriptedPack(step,scope,'pack',100,f.wolves,{x:60,z:40},spec,f.ports);
 try{
  guest.initialize();guest.phase='shadow';guest.awareness=.8;
  const prepare=step.prepare.bind(step),codec=new GroupBankV2(PACK_ROWS.bank),phases:{signal:string;phase:unknown}[]=[];
  vi.spyOn(step,'prepare').mockImplementation(input=>{phases.push({signal:input.signal,phase:codec.decode(input.state,input.group,input.references)['phase']});return prepare(input);});
  let nested=false,value=guest.awareness;
  Object.defineProperty(guest,'awareness',{configurable:true,get:()=>{if(!nested){nested=true;guest.tick(f.context0(.2,new Vector3(150,0,40)));guest.phase='regroup';}return value;},set:(next:number)=>{value=next;}});
  const actor=f.wolves[0];if(actor===undefined)throw new Error('Missing wolf');
  guest.drive(actor,f.context0(.1,new Vector3(150,0,40)));
  expect(nested).toBe(true);expect(guest.banks.size).toBe(2);
  expect(phases.find(row=>row.signal==='drive.0')?.phase).toBe('regroup');
  expect(phases.some(row=>row.signal==='tick')).toBe(true);
 }finally{scope.dispose();}
});

test('a refused pack scalar getter releases preparation depth before the next call', {timeout:120_000},async()=>{
 const bytes=await program(),scope=new Scope('pack-scalar-refusal'),f=side('scratch',[]);
 const spec=nativeGroupBrain({...brains.pack,id:'pack',home:[60,40],members:['wolf']});if(spec.kind!=='pack')throw new Error('Missing spec');
 const guest=new ScriptedPack(new GroupStepV2(bytes,PACK_ROWS,scope),scope,'pack',100,f.wolves,{x:60,z:40},spec,f.ports);
 try{
  guest.initialize();let refused=false,value=guest.awareness;
  const before=guest.snapshot(),random=f.contextRng.snapshot();
  Object.defineProperty(guest,'awareness',{configurable:true,get:()=>{if(!refused){refused=true;throw new Error('scalar refusal');}return value;},set:(next:number)=>{value=next;}});
  const actor=f.wolves[0];if(actor===undefined)throw new Error('Missing wolf');
  const context=f.context0(.1,new Vector3(150,0,40));
  expect(()=>guest.drive(actor,context)).toThrow('scalar refusal');
  expect(guest.snapshot()).toBe(before);expect(f.contextRng.snapshot()).toEqual(random);
  expect([...guest.memberOwners].every(member=>member.self.actor===null&&member.context?.calm===true&&member.context.playerSpeed===0&&member.player.position.x===0&&member.observed.size===0)).toBe(true);
  guest.drive(actor,context);expect(guest.banks.size).toBe(1);
  expect(f.wolves.every(wolf=>Number.isFinite(wolf.desiredSpeed))).toBe(true);
 }finally{scope.dispose();}
});
