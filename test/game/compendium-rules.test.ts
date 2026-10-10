import { expect, it, vi } from 'vitest';
import { CompendiumRules } from '../../src/game/compendium/rules';
import { CompendiumState, COMPENDIUM_STORE } from '../../src/game/compendium/state';
import { PINE_HOLLOW_COMPENDIUM } from '../../src/shards/pine-hollow/compendium';
import { readFixture, saveFixture } from '../fake/saveFixture';

it('keeps the page journal save and callbacks while the pure owner never reads or writes browser storage', () => {
  saveFixture('pine-hollow', COMPENDIUM_STORE, { 'red-deer': { s: 3, n: 4, t: 2, b: 178 } });
  const read = vi.spyOn(localStorage, 'getItem'), write = vi.spyOn(localStorage, 'setItem');
  const native = new CompendiumRules(PINE_HOLLOW_COMPENDIUM);
  native.animalSpotted('deer', 'stag'); native.animalKilled('deer', 'stag', 187.4);
  native.placeVisited('pond');
  expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  expect(native.stats('red-deer')).toEqual({ state: 'taken', seen: 1, taken: 1, best: 187 });
  const page = new CompendiumState(PINE_HOLLOW_COMPENDIUM), changes: string[] = [];
  page.onChange = (entry, from, to) => { changes.push(`${entry.id}:${from}>${to}`); };
  page.animalSpotted('deer', 'stag'); page.placeVisited('pond');
  expect(page.stats('red-deer')).toEqual({ state: 'taken', seen: 5, taken: 2, best: 178 });
  expect(changes).toEqual(['pond:unknown>seen']);
  expect(readFixture('pine-hollow', COMPENDIUM_STORE)).toEqual(page.snapshot().entries);
});

it('silently restores stats, returns detached copies, and resumes variant-specific counters exactly', () => {
  const original = new CompendiumRules(PINE_HOLLOW_COMPENDIUM);
  original.animalKilled('deer', 'ghost', 270); original.placeVisited('lookout');
  const saved = original.snapshot(), restored = new CompendiumRules(PINE_HOLLOW_COMPENDIUM);
  const changed = vi.fn(), updated = vi.fn();
  restored.onChange = (entry, from, to) => { changed(entry, from, to); }; restored.onUpdate = () => { updated(); };
  const commit = restored.prepareRestore(saved);
  const entry = saved.entries['ghost-stag']; if (entry === undefined) throw new Error('Missing fixture kill');
  entry.t = 100;
  commit();
  expect(restored.stats('ghost-stag').taken).toBe(1); expect(changed).not.toHaveBeenCalled(); expect(updated).not.toHaveBeenCalled();
  for (const state of [original, restored]) {
    state.animalKilled('deer', 'ghost', 315.4); state.animalNear('deer', 'ghost');
    state.animalSpotted('deer', 'stag'); state.placeVisited('lookout');
  }
  expect(restored.snapshot()).toEqual(original.snapshot());
  expect(restored.stats('ghost-stag')).toEqual({ state: 'taken', seen: 0, taken: 2, best: 315 });
  const detached = restored.snapshot().entries['ghost-stag']; if (detached === undefined) throw new Error('Missing restored kill');
  detached.b = 0; expect(restored.stats('ghost-stag').best).toBe(315);
});

it('refuses corrupt or foreign exact continuations before mutation', () => {
  const state = new CompendiumRules(PINE_HOLLOW_COMPENDIUM); state.placeVisited('pond');
  const before = state.snapshot();
  for (const input of [
    { ...before, version: 2 }, { ...before, extra: true },
    { version: 1, entries: { foreign: { s: 2, n: 1, t: 0, b: 0 } } },
    ...[{ s: 4 }, { n: -1 }, { t: 0.5 }, { b: Infinity }, { b: -1 }, { n: Number.MAX_SAFE_INTEGER + 1 }, { extra: 1 }]
      .map(change => ({ version: 1, entries: { pond: { s: 2, n: 1, t: 0, b: 0, ...change } } })),
  ]) {
    expect(() => state.restore(input)).toThrow(); expect(state.snapshot()).toEqual(before);
  }
});

it('retains tolerant historical page cleaning separately from strict native restore', () => {
  const raw = { 'red-deer': { s: 2.6, n: 2.7, t: -4, b: 187.6 }, absent: { s: 3, n: 99, t: 2, b: 3 } };
  const state = new CompendiumRules(PINE_HOLLOW_COMPENDIUM, raw);
  expect(state.stats('red-deer')).toEqual({ state: 'taken', seen: 3, taken: 0, best: 187.6 });
  expect(Object.keys(state.snapshot().entries)).toEqual(['red-deer']);
  expect(new CompendiumRules(PINE_HOLLOW_COMPENDIUM, null).snapshot().entries).toEqual({});
});
