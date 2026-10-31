import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {packChapterTaming,unpackChapterTaming,chapterObservationWire,installPackedChapterTaming,PACKED_CHAPTER_TAMING} from './fixtures/headless/chapterObservation';
import type {SimHost,SimStateAdapter,SimValue} from '../src/engine/sim';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct an actual bounded decompression refusal, not a metadata-only substitute.
import {deflateSync} from 'node:zlib';

test('complete observations round-trip every numeric bit and field within the unchanged byte boundary',()=>{
  const value={pose:Array.from({length:4000},(_,index)=>[index%2?0:-0,index%11,1.1234567890123457]),
    clock:{past:-Infinity,future:Infinity},text:'actual native owner',fields:{yaw:-0,health:100}};
  const raw=chapterObservationWire(value),wire=packChapterTaming(value);
  expect(wire.length).toBeLessThan(raw.length/2);expect(unpackChapterTaming(wire)).toStrictEqual(value);
  expect(Object.is((unpackChapterTaming(packChapterTaming(-0))),-0)).toBe(true);
  expect(()=>packChapterTaming({bad:Number.NaN})).toThrow('NaN');
  expect(()=>packChapterTaming('x'.repeat(1_000_001))).toThrow('byte bound');
});
test('foreign metadata, damaged data and decompression limits refuse without a fallback',()=>{
  const wire=packChapterTaming({all:[1,2,3],minus:-0}),value:unknown=JSON.parse(wire);
  if(value===null||typeof value!=='object')throw new Error('Missing fixture envelope');
  expect(()=>unpackChapterTaming(JSON.stringify({...value,owner:'foreign'}))).toThrow();
  expect(()=>unpackChapterTaming(JSON.stringify({...value,bytes:1}))).toThrow('byte count');
  expect(()=>unpackChapterTaming(JSON.stringify({...value,data:'@@@@'}))).toThrow();
  expect(()=>unpackChapterTaming(JSON.stringify({...value,bytes:1_000_001}))).toThrow();
  expect(()=>unpackChapterTaming(JSON.stringify({...value,extra:true}))).toThrow();
  const oversized=deflateSync(Buffer.alloc(1_000_001)).toString('base64');
  expect(()=>unpackChapterTaming(JSON.stringify({...value,bytes:1,data:oversized}))).toThrow();
});
test('the observation loan samples the same primary owner and restores without writing it',()=>{
  const scope=new Scope('chapter-observation'),adapters=new Map<string,SimStateAdapter>();let calls=0;
  let state:SimValue={phase:'bonded',pose:[0,-0,1]};
  const primary:SimStateAdapter={snapshot:()=>{calls++;return state;},restore:()=>{throw new Error('Observation cannot restore its primary owner');}};
  adapters.set('nalati.taming',primary);
  const host:Pick<SimHost,'scope'|'adapters'|'hasStep'|'onStep'>={scope,adapters,hasStep:id=>adapters.has(id),onStep:(id,_run,adapter)=>{
    if(adapter===undefined)throw new Error('Missing original loan');adapters.set(id,adapter);return ()=>{adapters.delete(id);};}};
  // The installer borrows only this concrete registry/scope surface.
  installPackedChapterTaming(host);const loan=adapters.get(PACKED_CHAPTER_TAMING);if(loan===undefined)throw new Error('Missing observation');
  try{
    const saved=loan.snapshot(),before=structuredClone(state);loan.restore(saved);expect(state).toStrictEqual(before);expect(calls).toBe(2);
    expect(()=>installPackedChapterTaming(host)).toThrow('unique');
    state={phase:'bonded',pose:[-0,4,9]};expect(unpackChapterTaming(loan.snapshot())).toStrictEqual(state);
    expect(()=>loan.restore(saved)).toThrow('differs');expect(state).toStrictEqual({phase:'bonded',pose:[-0,4,9]});
    adapters.set('nalati.taming',{snapshot:()=>null,restore:()=>undefined});expect(()=>loan.snapshot()).toThrow('replaced');
  }finally{scope.dispose();}
});
