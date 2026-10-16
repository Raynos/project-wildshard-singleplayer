import { expect, test } from 'vitest';
import { EliteCore, memoryElitePersistence, type EliteCoreScript } from '../src/game/eliteSystem';

function fixture(): { core: EliteCore<EliteCoreScript>; effects: string[] } {
  const effects: string[] = [];
  const core = new EliteCore<EliteCoreScript>({ player: { position: { x: 0, z: 0 } }, condition: () => true },
    { spawned: () => { effects.push('spawned'); } }, 'continuation-fixture', memoryElitePersistence());
  for (const id of ['first', 'second']) core.add({ def: { id, lair: { x: 0, z: 0, r: 2 }, awareR: 10, engageR: 5, leashR: 20, rule: 'always', respawnMin: 1 },
    animal: null, spawn: () => { effects.push('spawn'); }, despawn: () => { effects.push('despawn'); },
    tick: () => { effects.push('tick'); }, enterPhase2: () => { effects.push('phase'); }, reset: () => { effects.push('reset'); }, trophy: () => { effects.push('trophy'); } });
  return { core, effects };
}

test('elite core resumes legacy lair fields quietly and refuses an incompatible roster before mutation', () => {
  const { core, effects } = fixture(), before = core.snapshot();
  const saved = { ...before, clocks: { saveT: 0.75, lastDusk: true }, entries: before.entries.map((row, i) => ({ ...row, state: 'engaged' as const,
    timer: 4, lastHit: i === 0 ? null : 2, phase2: true })), version: 4, scripts: [] };
  const commit = core.prepareRestore(saved);
  expect(core.snapshot()).toEqual(before);
  commit();
  expect(core.snapshot().clocks).toEqual(saved.clocks);
  expect(core.snapshot().entries).toEqual(saved.entries);
  expect(core.entries[0]?.lastHit).toBe(-Infinity);
  expect(effects).toEqual([]);
  const restored = core.snapshot();
  expect(() => core.prepareRestore({ ...saved, entries: [...saved.entries].reverse() })).toThrow(/continuation/);
  expect(() => core.prepareRestore({ ...saved, entries: saved.entries.slice(1) })).toThrow(/continuation/);
  expect(() => core.prepareRestore({ ...saved, entries: saved.entries.map(row => ({ ...row, unexpected: true })) })).toThrow();
  expect(() => core.prepareRestore({ ...saved, clocks: { saveT: Number.NaN, lastDusk: true } })).toThrow();
  expect(core.snapshot()).toEqual(restored);
  expect(effects).toEqual([]);
  const prepared = core.prepareRestore(saved);
  core.entries.reverse();
  expect(prepared).toThrow(/roster changed/);
  expect(core.snapshot().entries.map(row => row.id)).toEqual(['second', 'first']);
});
