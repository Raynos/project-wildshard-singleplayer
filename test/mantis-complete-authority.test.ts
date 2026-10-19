import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { numericChannelPrograms } from '../src/sdk/clientChannels';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { borrowedDecisionAuthority, borrowedDecisionControl } from '../src/game/shardfile/borrowedDecisions';
import { fixture, poseContext, locals } from './mantis-complete-fixture';

const ids = ['strike.splinter-mantis.first','strike.splinter-mantis.second'];
const phases = {idle:0,windup:1,active:2,recover:3,cooldown:4};
function clips(strikeIds: string[] = ids) {
  return { group:'creature.pose', strikeIds,
    programs: numericChannelPrograms('motion-proof','creature.pose', [
      { target:'joint.body',path:['rotation','x'],expr:(_b,r)=>r('strike',['elapsed']) },
      { target:'joint.body',path:['rotation','y'],expr:(_b,r)=>r('strike',['phase']) },
      { target:'joint.body',path:['rotation','z'],expr:(_b,r)=>r('strike',['index']) },
    ]) };
}
for(const group of [false,true]) test(`${group?'group':'single'} owner exposes exact clocks without changing gameplay continuation`,async()=>{
  const f=await fixture(group), animate=numericCreaturePose(clips()), seen=new Set<string>();
  try {
    for(let i=0;i<360;i++) {
      f.host.step(); const before=f.control.snapshot(), world=snapshotSimHost(f.host), damage=[...f.damage];
      animate(f.context); animate(f.context); seen.add(f.control.strikeState);
      const body=f.context.bones['body'];if(body===undefined)throw new Error('Missing body');
      expect(body.rotation.x).toBe(f.control.strikeTime);expect(body.rotation.y).toBe(phases[f.control.strikeState]);
      expect(body.rotation.z).toBe(f.control.current===null?0:ids.indexOf(f.control.current.id)+1);
      expect(f.control.snapshot()).toEqual(before);expect(snapshotSimHost(f.host)).toEqual(world);expect(f.damage).toEqual(damage);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['windup','active','recover']));
    expect(f.damage.length).toBeGreaterThan(0);expect(f.damage.every(value=>value===10)).toBe(true);
    const detached=f.control.strikeIds;expect(Object.isFrozen(detached)).toBe(true);expect(detached).toEqual(ids);
    const before=locals(f.context), unknown=numericCreaturePose(clips(['strike.unknown']));
    expect(()=>unknown(f.context)).toThrow();expect(locals(f.context)).toEqual(before);
    f.control.restart();expect(f.control.strikeState).toBe('idle');expect(f.control.strikeTime).toBe(0);
    expect(()=>unknown(f.context)).toThrow();expect(locals(f.context)).toEqual(before);
    f.scope.dispose();expect(()=>animate(f.context)).toThrow();expect(locals(f.context)).toEqual(before);
  }finally{f.host.dispose();}
},120000);
test('missing authority, duplicate and oversized selectors refuse before joint writes',()=>{
  const c=poseContext(), before=locals(c);
  expect(()=>numericCreaturePose(clips())(c)).toThrow();expect(locals(c)).toEqual(before);
  for(const bad of [[],[ids[0]??'',ids[0]??''],['a','b','c'],['__proto__']])expect(()=>numericCreaturePose(clips(bad))).toThrow();
});
test('no opt-in keeps the old independent pose path and does not lend strike reads',()=>{
  const c=poseContext();
  const old={group:'creature.pose',programs:numericChannelPrograms('old','creature.pose',[{target:'joint.body',path:['rotation','x'],expr:b=>b.constant(.25)}])};
  numericCreaturePose(old)(c);expect(c.bones['body']?.rotation.x).toBe(.25);
  const {strikeIds:_ids,...invalid}=clips();const before=locals(c);
  expect(()=>numericCreaturePose(invalid)(c)).toThrow();expect(locals(c)).toEqual(before);
});

for(const group of [false,true]) test(`${group?'group':'single'} old disposal cannot remove a rebound owner`,async()=>{
  const f=await fixture(group);
  try {
    const nextScope=f.host.scope.child('rebound'), authority=borrowedDecisionAuthority(f.source,f.assets,f.sections,{
      scope:nextScope,events:f.host.events,flags:f.host.flags,physics:f.host.physics,player:f.host.player,
      groundHeightAt:(x,z)=>f.host.groundHeightAt(x,z),live:body=>body===f.actor,
      fixed:(id,run,scope)=>{scope.onDispose(f.host.onStep(`rebound:${id}`,run));},
    });
    const next=authority.bind(f.actor,{script:'driftwood.splinter-mantis.decision',
      ...(group?{group:'motion.test'}:{actor:'driftwood.splinter-mantis'}),strikeEffects:[]},
      {kind:'animal',motion:'ground',attack:'keeper',stunned:'none',contact:{kind:'environment',halfArc:Math.PI/2}});
    next.observe({calm:false,reach:()=>true,claim:()=>true,hurt:()=>undefined});f.host.step();
    expect(borrowedDecisionControl(f.actor)).toBe(next);f.scope.dispose();expect(borrowedDecisionControl(f.actor)).toBe(next);
    numericCreaturePose(clips())(f.context);nextScope.dispose();expect(()=>borrowedDecisionControl(f.actor)).toThrow();
  } finally { f.host.dispose(); }
});

for(const group of [false,true]) test(`${group?'group':'single'} bad observations and a nonselected admitted strike refuse atomically`,async()=>{
  const f=await fixture(group), animate=numericCreaturePose(clips());
  try {
    const before=locals(f.context);
    for(const bad of [Number.NaN,Infinity,-.01]) {
      const spy=vi.spyOn(f.control,'strikeTime','get').mockReturnValue(bad);
      expect(()=>animate(f.context)).toThrow();expect(locals(f.context)).toEqual(before);spy.mockRestore();
    }
    const saved=v.parse(v.record(v.string(),v.unknown()),JSON.parse(v.parse(v.string(),f.control.snapshot())));
    const strike=v.parse(v.record(v.string(),v.unknown()),saved['strike']);
    f.control.restore(JSON.stringify({...saved,strike:{...strike,phase:'active',currentId:ids[1],elapsed:.25}}));
    expect(()=>numericCreaturePose(clips([ids[0]??'']))(f.context)).toThrow();expect(locals(f.context)).toEqual(before);
  }finally{vi.restoreAllMocks();f.host.dispose();}
});
