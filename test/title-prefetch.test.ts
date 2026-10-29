// @vitest-environment happy-dom
import {expect, test} from 'vitest';
import {SaveStore} from '../src/engine/saves/store';
import {titlePrefetchChoice, titlePrefetchTargets} from '../src/game/grid/titlePrefetchChoice';
import type {TitleManifest} from '../src/game/shard/titleList';

test('last product hint uses one save definition and survives blocked persistence', () => {
  const store = new SaveStore({local: null, session: null});
  const choice = titlePrefetchChoice(store);
  expect(choice.read()).toBeNull();
  choice.remember('driftwood-isle');
  expect(titlePrefetchChoice(store)).toBe(choice);
  expect(titlePrefetchChoice(store).read()).toBe('driftwood-isle');
  choice.remember('../outside');
  expect(choice.read()).toBe('driftwood-isle');
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
