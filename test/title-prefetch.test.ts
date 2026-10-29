// @vitest-environment happy-dom
import {expect, test} from 'vitest';
import {SaveStore} from '../src/engine/saves/store';
import {titlePrefetchChoice, titlePrefetchTargets} from '../src/game/grid/titlePrefetchChoice';
import type {TitleManifest} from '../src/game/shard/titleList';
import * as v from 'valibot';

test('last product hint uses one save definition and survives blocked persistence', () => {
  const store = new SaveStore({local: null, session: null});
  const choice = titlePrefetchChoice(store);
  expect(choice.read()).toBeNull();
  expect(choice.flow()).toBe('client');
  choice.remember('driftwood-isle');
  expect(titlePrefetchChoice(store)).toBe(choice);
  expect(titlePrefetchChoice(store).read()).toBe('driftwood-isle');
  choice.remember('../outside');
  expect(choice.read()).toBe('driftwood-isle');
  choice.remember('driftwood-isle', 'grid');
  expect(choice.read()).toBe('driftwood-isle'); expect(choice.flow()).toBe('grid');
  choice.remember('../outside', 'client');
  expect(choice.flow()).toBe('grid');
});

test('old last-shard preference migrates as client and later retains the actual flow', () => {
  const data = new Map<string, string>();
  const local = {get length(): number {return data.size;}, key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => {data.set(key, value);},
    removeItem: (key: string) => {data.delete(key);}};
  const old = new SaveStore({local, session: null});
  old.define({key: 'titlePrefetch', scope: 'device', version: 1, schema: v.nullable(v.string()), initial: (): string | null => null}).write('pine-hollow');
  const migrated = titlePrefetchChoice(new SaveStore({local, session: null}));
  expect(migrated.read()).toBe('pine-hollow'); expect(migrated.flow()).toBe('client');
  migrated.remember('driftwood-isle', 'grid');
  const reread = titlePrefetchChoice(new SaveStore({local, session: null}));
  expect(reread.read()).toBe('driftwood-isle'); expect(reread.flow()).toBe('grid');
});

test('title selects the compiled home then last, deduplicating and refusing unavailable LEGACY metadata', () => {
  const row = (slug: TitleManifest['slug'], extra: Partial<TitleManifest> = {}): TitleManifest => ({slug, name: slug, biome: '', status: 'live',
    card: {thumb: '', portrait: '', landscape: ''}, entries: {legacy: false, shardfile: true}, shardfile: `/shardfiles/${slug}/shard.json`, ...extra});
  const rows = [row('driftwood-isle'), row('nalati-grasslands'), row('_template', {status: 'hidden'}), row('blender-template', {legacy: true})];
  expect(titlePrefetchTargets('driftwood-isle', 'nalati-grasslands', rows, false)).toEqual(['driftwood-isle', 'nalati-grasslands']);
  expect(titlePrefetchTargets('driftwood-isle', 'driftwood-isle', rows, false)).toEqual(['driftwood-isle']);
  expect(titlePrefetchTargets('unknown', 'blender-template', rows, true)).toEqual([]);
  expect(titlePrefetchTargets('_template', null, rows, false)).toEqual([]);
  expect(titlePrefetchTargets('_template', null, rows, true)).toEqual(['_template']);
});
