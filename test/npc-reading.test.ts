import {expect,test} from 'vitest';
import {DialogueClock,NpcDialogue,NpcReading} from '../src/engine/quest/dialogueClock';
import oldPine from './fixtures/pine-reading-before.json' with { type: 'json' };
import { RANGER, MILLER } from '../src/shards/pine-hollow/quest/wardensHollow';
import { PinePeople } from '../src/shards/pine-hollow/runtime/people';
import type {NpcDef} from '../src/engine/quest/core';

test('old reading resumes on the same clock, completes once, and refuses corrupt continuation before flags',()=>{
  const values=new Set(['ready']);let grants=0;
  const flags={has:(flag:string)=>values.has(flag),set:(flag:string)=>{values.add(flag);grants++;}};
  const npc:NpcDef={id:'guide',name:'Guide',dialogue:[{when:{all:['ready']},lines:['Find the key.','Return to the gate.'],sets:['talked:guide']}]};
  const original=new NpcDialogue(npc,flags);expect(original.open()).toBe(true);original.update(0.05);
  const old=original.snapshot();const clock=new DialogueClock(),resumed=new NpcDialogue(npc,flags,clock);
  resumed.restore(old);expect(resumed.clock).toBe(clock);expect(clock.text).toBe(original.clock.text);
  expect(()=>resumed.finish()).toThrow();expect(grants).toBe(0);
  const before=clock.snapshot();
  expect(()=>resumed.restore({...old,npc:'foreign'})).toThrow();expect(clock.snapshot()).toEqual(before);expect(grants).toBe(0);
  expect(()=>resumed.restore({...old,entry:99})).toThrow();expect(clock.snapshot()).toEqual(before);
  for(let i=0;i<8&&clock.isOpen;i++)resumed.advance();
  expect(clock.isOpen).toBe(false);expect(values.has('talked:guide')).toBe(true);expect(grants).toBe(1);
  resumed.advance();expect(grants).toBe(1);
  values.delete('talked:guide');const cancelled=new NpcDialogue(npc,flags);cancelled.open();cancelled.cancel();
  expect(cancelled.clock.isOpen).toBe(false);expect(values.has('talked:guide')).toBe(false);
  // The page opens its existing panel clock after selecting the same authored entry.
  const pageClock=new DialogueClock(),page=new NpcDialogue(npc,flags,pageClock),entry=page.select();
  if(entry===null)throw new Error('Missing authored reading');pageClock.open(entry.lines);
  for(let i=0;i<8&&pageClock.isOpen;i++)pageClock.advance();pageClock.close();page.finish();
  expect(values.has('talked:guide')).toBe(true);
});

test('actual old Pine readings resume silently, retain key/reach law and refuse incompatible state atomically', () => {
  const values = new Set<string>(), writes: string[] = [];
  const flags = { has: (id: string) => values.has(id), set: (id: string) => { values.add(id); writes.push(id); } };
  const at = { x: 0, y: 1.6, z: 0 }, feet = { x: 0, y: 0, z: 0 };
  const resumed = new NpcReading(RANGER, flags, at, 3.2, 0.15);
  const commit = resumed.prepareRestore(oldPine.ranger); expect(resumed.active).toBe(false); expect(writes).toEqual([]);
  commit(); expect(resumed.active).toBe(true); expect(resumed.clock.text.length).toBeGreaterThan(0);
  const before = resumed.snapshot(); resumed.use(); expect(resumed.snapshot()).toEqual(before);
  expect(() => resumed.prepareRestore({ ...oldPine.ranger, elapsed: 0.16 })).toThrow();
  expect(() => resumed.prepareRestore({ ...oldPine.ranger, extra: true })).toThrow();
  expect(() => resumed.prepareRestore({ ...oldPine.ranger, dialogue: { ...oldPine.ranger.dialogue, npc: 'foreign' } })).toThrow();
  expect(() => resumed.prepareRestore({ ...oldPine.ranger, dialogue: { ...oldPine.ranger.dialogue,
    clock: { ...oldPine.ranger.dialogue.clock, open: false } } })).toThrow();
  expect(resumed.snapshot()).toEqual(before); expect(writes).toEqual([]);
  resumed.step(0.11, feet);
  for (let i = 0; i < 32 && resumed.active; i++) resumed.use();
  expect(resumed.active).toBe(false); expect(values.has('talked:ranger')).toBe(true);
  expect(writes.filter(id => id === 'talked:ranger')).toHaveLength(1);
  const cancelled = new NpcReading(MILLER, flags, at, 3.2, 0.15);
  cancelled.prepareRestore(oldPine.miller.reading)(); cancelled.step(0.1, { x: 20, y: 0, z: 0 });
  expect(cancelled.active).toBe(false); expect(values.has('errand:asked')).toBe(false);
  const spots = (['ranger', 'miller', 'trader'] as const).map(kind => ({ kind, at, prompt: { ...at, radius: 3.2 } }));
  const completed: string[] = [], people = new PinePeople((npc, point, radius) => new NpcReading(npc, flags, point, radius, 0.15), spots, kind => { completed.push(kind); });
  people.prepareRestore(oldPine.miller)(); expect(people.active).toBe(true); expect(completed).toEqual([]);
  people.advanceReading(0.11, feet);
  for (let i = 0; i < 32 && people.active; i++) people.press('ranger');
  expect(people.active).toBe(false); expect(completed).toEqual(['miller']); expect(values.has('errand:asked')).toBe(true);
  expect(people.snapshot()).toBeNull();
});

test('page reading lends its actual clock lazily and keeps cancellation/completion and range with that owner', () => {
  const writes: string[] = [], flags = { has: () => false, set: (id: string) => { writes.push(id); } };
  const npc: NpcDef = { id: 'speaker', name: 'Speaker', dialogue: [{ lines: ['Go to the gate.'], sets: ['talked:speaker'] }] };
  const clock = new DialogueClock(), at = { x: 0, y: 0, z: 0 }; let borrows = 0;
  const reading = new NpcReading(npc, flags, at, 2, 0, () => { borrows++; return clock; });
  expect(borrows).toBe(0); const entry = reading.select(); if (entry === null) throw new Error('Missing authored page reading');
  clock.open(entry.lines); expect(reading.clock).toBe(clock);
  const before = clock.snapshot(); expect(() => reading.step(0.1, at)).toThrow(); expect(() => reading.prepareRestore(null)).toThrow();
  expect(clock.snapshot()).toEqual(before); expect(writes).toEqual([]);
  expect(reading.outside({ x: 4.5, y: 0, z: 0 })).toBe(false); expect(reading.outside({ x: 4.6, y: 0, z: 0 })).toBe(true);
  expect(() => reading.outside({ x: Number.NaN, y: 0, z: 0 })).toThrow();
  expect(() => reading.finish()).toThrow(); clock.update(1); clock.advance(); reading.finish(); reading.finish();
  expect(writes).toEqual(['talked:speaker']);
  const cancel = new NpcReading(npc, flags, at, 2, 0, () => clock), line = cancel.select();
  if (line === null) throw new Error('Missing cancel reading'); clock.open(line.lines); cancel.dismiss();
  expect(clock.isOpen).toBe(false); expect(writes).toEqual(['talked:speaker']);
  expect(() => new NpcReading(npc, flags, at, -1)).toThrow(); expect(() => new NpcReading(npc, flags, at, 2, Infinity)).toThrow();
  const own = new NpcReading(npc, flags, at, 2, 0.15); expect(() => own.step(-1, at)).toThrow();
});
