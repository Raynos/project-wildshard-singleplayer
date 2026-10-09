import { expect, it } from 'vitest';
import { NpcDialogue } from '../../src/game/quest/dialogue';
import { Flags } from '../../src/engine/world/interact/flags';
import type { NpcDef } from '../../src/engine/quest/core';

const npc: NpcDef = { id: 'guide', name: 'Guide', dialogue: [
  { when: { none: ['talked'] }, lines: ['First line.', 'Second line.'], sets: ['talked'] },
  { when: { none: ['wait'] }, lines: ['Wait here.'], sets: ['wait'] },
] };

it('commits the selected authored flags only after the final advance, never cancellation or restore', () => {
  const flags = new Flags('dialogue', false), restoredFlags = new Flags('dialogue', false);
  const talk = new NpcDialogue(npc, flags), restored = new NpcDialogue(npc, restoredFlags);
  expect(talk.open()).toBe(true); talk.update(1 / 120);
  restored.restore(talk.snapshot()); expect(restoredFlags.all).toEqual([]);
  talk.cancel(); expect(flags.all).toEqual([]);
  restored.cancel(); expect(restoredFlags.all).toEqual([]);
  talk.open(); restored.open();
  for (let press = 0; press < 4; press++) {
    expect(flags.all).toEqual([]);
    talk.advance(); restored.advance();
    expect(restored.snapshot()).toEqual(talk.snapshot()); expect(restoredFlags.all).toEqual(flags.all);
  }
  expect(flags.all).toEqual(['talked']); expect(talk.clock.isOpen).toBe(false);
  talk.open(); expect(talk.clock.line).toBe('Wait here.');
  talk.update(1); talk.advance(); expect(flags.all).toEqual(['talked', 'wait']);
  expect(talk.open()).toBe(false);
});

it('holds the selected entry while flags change and refuses another NPC or edited text atomically', () => {
  const flags = new Flags('dialogue', false), talk = new NpcDialogue(npc, flags);
  talk.open(); flags.set('talked'); talk.update(0.05);
  const saved = talk.snapshot(), corrupted = structuredClone(saved); corrupted.clock.lines[0] = 'different';
  for (const invalid of [{ ...saved, npc: 'foreign' }, { ...saved, entry: 99 }, { ...saved, entry: null }, corrupted]) {
    expect(() => talk.restore(invalid)).toThrow(); expect(talk.snapshot()).toEqual(saved);
  }
  let raised = 0; flags.onChange(() => { raised++; });
  talk.restore(saved); expect(raised).toBe(0); expect(talk.clock.line).toBe('First line.');
  const empty = new NpcDialogue({ id: 'empty', name: 'Empty', dialogue: [{ lines: [], sets: ['empty'] }] }, flags);
  expect(empty.open()).toBe(false); expect(flags.has('empty')).toBe(true);
});
