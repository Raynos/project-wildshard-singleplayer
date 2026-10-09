import { expect, it } from 'vitest';
import { DialogueClock } from '../../src/engine/quest/dialogueClock';

it('matches the original panel arithmetic for mixed updates, typing completion, cancellation and empty lines', () => {
  const clock = new DialogueClock();
  const old = { lines: [] as string[], index: 0, shown: 0, open: false };
  const lines = ['A long line of dialogue.', '', 'Last line.'];
  for (let tick = 0; tick < 10000; tick++) {
    if (tick % 49 === 0) { clock.open(lines); old.lines = lines; old.index = 0; old.shown = 0; old.open = true; }
    if (tick % 13 === 0) {
      clock.advance();
      if (old.open) {
        const line = old.lines[old.index] ?? '';
        if (old.shown < line.length) old.shown = line.length;
        else { old.index++; old.shown = 0; if (old.index >= old.lines.length) old.open = false; }
      }
    }
    if (tick % 97 === 0) { clock.close(); old.open = false; }
    const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60, cps = tick % 5 === 0 ? 15 : 60;
    clock.update(dt, cps);
    const line = old.lines[old.index] ?? '';
    if (old.open && old.shown < line.length) old.shown = Math.min(line.length, old.shown + dt * cps);
    expect(clock.snapshot()).toEqual({ version: 1, lines: old.lines, index: old.index, shown: old.shown, open: old.open });
    expect(clock.text).toBe(line.slice(0, Math.floor(old.shown)));
  }
});

it('restores fractional typing exactly and validates the whole continuation before changing the live clock', () => {
  const clock = new DialogueClock(); clock.open(['First', 'Second']); clock.update(1 / 120);
  const saved = clock.snapshot(), restored = new DialogueClock(); restored.restore(saved);
  const input = structuredClone(saved), commit = restored.prepareRestore(input);
  input.lines[0] = 'corrupt'; input.shown = 2; commit();
  expect(restored.snapshot()).toEqual(saved);
  expect(restored.open([])).toBe(false); expect(restored.snapshot()).toEqual(saved);
  for (const invalid of [null, { ...saved, extra: 0 }, { ...saved, shown: 99 }, { ...saved, index: 2 },
    { ...saved, index: -1 }, { ...saved, shown: Number.NaN }, { ...saved, lines: [] }]) {
    expect(() => restored.restore(invalid)).toThrow(); expect(restored.snapshot()).toEqual(saved);
  }
  for (let tick = 0; tick < 60; tick++) {
    clock.update(1 / 60); restored.update(1 / 60);
    if (tick % 9 === 0) expect(restored.advance()).toBe(clock.advance());
    expect(restored.snapshot()).toEqual(clock.snapshot());
  }
});
