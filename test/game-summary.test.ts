import * as v from 'valibot';
import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { buildSummary, summaryStore, summaryView } from '../src/game/summary';
import { progressSave } from '../src/game/saves';
import { Progress } from '../src/game/Progress';

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}


const shards = [{ slug: 'driftwood-isle', name: 'Driftwood Isle' }, { slug: 'pine-hollow', name: 'Pine Hollow' }, { slug: 'nalati-grasslands', name: 'Nalati Grasslands' }];
it('builds read-only summary lines and totals from two played shards and one never visited', () => {
  const summary = buildSummary(shards, (slug) => slug === 'nalati-grasslands' ? null : { earned: slug === 'pine-hollow' ? ['a', 'b'] : ['c'], playS: 9 }, 12);
  expect(summaryView(summary, shards)).toEqual({ visited: true, earned: 3, lines: [
    { slug: 'driftwood-isle', name: 'Driftwood Isle', earned: 1, total: null, playS: 9, visited: true },
    { slug: 'pine-hollow', name: 'Pine Hollow', earned: 2, total: null, playS: 9, visited: true },
    { slug: 'nalati-grasslands', name: 'Nalati Grasslands', earned: 0, total: null, playS: 0, visited: false },
  ] });
});
it('rebuilds a missing global summary, updates a known total and exports/imports it globally', () => {
  const storage = new MemoryStorage(), store = new SaveStore({ local: storage, session: null });
  const summaries = summaryStore(store, (slug) => slug === 'pine-hollow' ? { earned: ['a'], playS: 33 } : null);
  expect(summaries.read().shards['pine-hollow']).toMatchObject({ earned: 1, total: null, playS: 33 });
  summaries.update('pine-hollow', { earned: ['a', 'b'], playS: 44 }, 19);
  const imported = new SaveStore({ local: new MemoryStorage(), session: null });
  const next = summaryStore(imported, () => null);
  expect(imported.importAll(store.exportAll()).imported).toContain('global/summary');
  expect(next.read().shards['pine-hollow']).toMatchObject({ earned: 2, total: 19, playS: 44 });
});
it('does not write, create or throw for absent, malformed, invalid or newer shard documents', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  const progress = store.define({ key: 'progress', scope: 'shard', version: 1, schema: v.object({ earned: v.array(v.string()), playS: v.number() }), initial: () => ({ earned: [], playS: 0 }) });
  // Initialize the store before installing raw fixture documents.
  expect(progress.peek('pine-hollow')).toBeNull();
  for (const raw of ['{', JSON.stringify({ keys: { progress: { v: 1, data: { earned: 7 } } } }), JSON.stringify({ keys: { progress: { v: 2, data: { earned: ['a'], playS: 2 } } } })]) {
    local.setItem('wildshard.save.v2.pine-hollow', raw);
    const summary = buildSummary(shards, (slug) => progress.peek(slug));
    expect(summary.shards).toEqual({}); expect(local.getItem('wildshard.save.v2.pine-hollow')).toBe(raw);
    expect(local.getItem('wildshard.save.v2.nalati-grasslands')).toBeNull();
  }
});
it('marks zero-feat loaded shards visited and updates the summary on a feat and play-time save', () => {
  const progress = new Progress('driftwood-isle');
  progress.recordEvent('talked');
  for (let i = 0; i < 60; i++) progress.addPlay(0.25);
  const saved = progressSave.peek('driftwood-isle');
  expect(saved).toMatchObject({ earned: ['castaway'], playS: 15 });
  const global = JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}') as { keys: { summary: { data: { shards: Record<string, { earned: number; total: number; playS: number }> } } } };
  expect(global.keys.summary.data.shards['driftwood-isle']).toMatchObject({ earned: 1, total: 10, playS: 15 });
});

it('excludes hidden shards from reconstruction and totals, including an old saved summary line', () => {
  const registry = [...shards, { slug: '_template', name: 'Hidden', status: 'hidden' }];
  const read = (slug: string) => ({ earned: slug === '_template' ? ['hidden-a', 'hidden-b'] : ['a'], playS: 9 });
  const summary = buildSummary(registry, read);
  expect(summary.shards['_template']).toBeUndefined();
  summary.shards['_template'] = { earned: 20, total: 20, playS: 9, at: 12 };
  const view = summaryView(summary, registry);
  expect(view.earned).toBe(3);
  expect(view.lines.map((line) => line.slug)).toEqual(shards.map((shard) => shard.slug));
});
