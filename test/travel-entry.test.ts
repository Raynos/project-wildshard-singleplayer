import { expect, test } from 'vitest';
import { resolveTravelEntry } from '../src/game/travel/entry';
import { shardEntry } from '../src/game/shard/entryMode';
import type { ShardEntryMode } from '../src/game/shard/manifest';

const selected = (choice: ShardEntryMode) => (manifest: Parameters<typeof shardEntry>[0]) =>
  shardEntry(manifest, true, () => ({ read: () => choice, choose: () => undefined }));

test.each(['far-reach', 'sunscar-dunes'] as const)('%s primary data-only metadata still enters its registered frozen copy', slug => {
  const primary = { slug, entries: { legacy: false, shardfile: true } } as const;
  const copy = { slug: `${slug}-legacy`, legacy: true, entries: { legacy: true, shardfile: false } } as const;
  const rows = [primary, copy];
  expect(resolveTravelEntry(rows, primary, selected('legacy'))).toBe(copy);
  expect(resolveTravelEntry(rows, primary, selected('shardfile'))).toBe(primary);
  expect(primary.entries).toEqual({ legacy: false, shardfile: true });
});

test('missing or unflagged copies never authorize a disabled legacy entry', () => {
  const primary = { slug: 'far-reach', entries: { legacy: false, shardfile: true } } as const;
  const suffix = { ...primary, slug: 'far-reach-legacy' } as const;
  expect(resolveTravelEntry([primary], primary, selected('legacy'))).toBe(primary);
  expect(resolveTravelEntry([primary, suffix], primary, selected('legacy'))).toBe(primary);
});

test('frozen entry identity and a developer-disabled ordinary request stay exact', () => {
  const primary = { slug: 'far-reach', entries: { legacy: false, shardfile: true } } as const;
  const copy = { slug: 'far-reach-legacy', legacy: true, entries: { legacy: true, shardfile: false } } as const;
  const rows = [primary, copy];
  expect(resolveTravelEntry(rows, copy, selected('legacy'))).toBe(copy);
  expect(resolveTravelEntry(rows, primary, manifest => shardEntry(manifest, false))).toBe(primary);
});
