import { originalSkyMovers } from './fixtures/sky-movers';
import { originalSkyNavigation } from './fixtures/sky-navigation';
import { expect, test } from 'vitest';
import { skyProductRows } from '../src/shards/far-reach/generators/product';

test('declaration publication is retired and callers retain isolated complete original values', () => {
  const original = skyProductRows(originalSkyNavigation(), originalSkyMovers());
  const rows = skyProductRows(originalSkyNavigation(), originalSkyMovers()); rows.entryways.length = 0; rows.files.length = 0;
  const replay = skyProductRows(originalSkyNavigation(), originalSkyMovers());
  expect(original.entryways.length).toBeGreaterThan(0); expect(original.files.length).toBeGreaterThan(0);
  expect(replay.entryways).toEqual(original.entryways); expect(replay.files).toEqual(original.files);
});
