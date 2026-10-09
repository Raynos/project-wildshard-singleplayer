import { expect, it } from 'vitest';
import { Flags } from '../../../src/engine/world/interact/flags';
import { DialogueClock } from '../../../src/engine/quest/dialogueClock';
import { lineFor } from '../../../src/engine/quest/core';
import { RANGER } from '../../../src/shards/pine-hollow/quest/wardensHollow';
import { PineDialogue } from '../../../src/shards/pine-hollow/runtime/dialogue';

const at = { x: 12, y: 3, z: -8 }, feet = { ...at, y: at.y - 1.68 };
it('matches every authored Hale line under keyboard advances, typing and the page opening guard', () => {
  for (const entry of RANGER.dialogue) {
    const flags = new Flags('pine-dialogue', false), pageFlags = new Flags('pine-dialogue', false);
    for (const flag of entry.when?.all ?? []) { flags.set(flag); pageFlags.set(flag); }
    const selected = lineFor(RANGER, pageFlags);
    if (selected === null) throw new Error('No authored dialogue');
    const talk = new PineDialogue(flags, at, 3.2), page = new DialogueClock();
    talk.use(); page.open(selected.lines);
    let elapsed = 0;
    for (let tick = 0; tick < 1000 && page.isOpen; tick++) {
      talk.use();
      if (elapsed >= 0.15 && page.advance() === 'finished') for (const flag of selected.sets ?? []) pageFlags.set(flag);
      talk.step(1 / 60, feet); page.update(1 / 60); elapsed += 1 / 60;
      expect(talk.active).toBe(page.isOpen); expect(flags.all).toEqual(pageFlags.all);
      if (talk.active) expect(talk.snapshot()?.dialogue.clock).toEqual(page.snapshot());
    }
    expect(talk.active).toBe(false);
  }
});

it('restores the reading guard and rejects incompatible continuation without flags or partial mutation', () => {
  const flags = new Flags('pine-dialogue', false), restoredFlags = new Flags('pine-dialogue', false);
  const talk = new PineDialogue(flags, at, 3.2), restored = new PineDialogue(restoredFlags, at, 3.2);
  talk.use(); talk.step(0.03, feet);
  const saved = talk.snapshot(); restored.prepareRestore(saved)(); expect(restoredFlags.all).toEqual([]);
  for (const invalid of [{ dialogue: saved?.dialogue, elapsed: -1 }, { dialogue: saved?.dialogue, elapsed: 0.2 },
    { dialogue: { ...saved?.dialogue, npc: 'foreign' }, elapsed: 0.03 }, { dialogue: null, elapsed: 0.03 }]) {
    expect(() => talk.prepareRestore(invalid)).toThrow(); expect(talk.snapshot()).toEqual(saved);
  }
  for (let i = 0; i < 32; i++) {
    talk.use(); restored.use(); talk.step(1 / 60, feet); restored.step(1 / 60, feet);
    expect(restored.snapshot()).toEqual(talk.snapshot()); expect(restoredFlags.all).toEqual(flags.all);
  }
  expect(flags.all).toEqual(['talked:ranger']);
  talk.use(); talk.step(0, { ...feet, x: at.x + 6 }); expect(talk.active).toBe(false);
  talk.use(); talk.dismiss(); expect(talk.active).toBe(false); expect(flags.all).toEqual(['talked:ranger']);
});
