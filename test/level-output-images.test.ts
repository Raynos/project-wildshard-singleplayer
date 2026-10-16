import * as v from 'valibot';
import { expect, it } from 'vitest';
import { LevelSectionSchema } from '@wildshard/format/level';
import metadata from '../src/shards/far-reach/manifest.json';

it('admits bounded image blob URLs in emitted level metadata', () => {
  const url = `/shardfiles/far-reach/blobs/image/${'a'.repeat(64)}.jpg`;
  const manifest = { ...metadata, card: { ...metadata.card, thumb: url } };
  expect(v.parse(LevelSectionSchema, { manifest }).manifest.card.thumb).toBe(url);
  for (const bad of [url.replace('a'.repeat(64), 'a'.repeat(63)), url.replace('.jpg', '.svg'),
    url.replace('far-reach', '../other'), url.replace('blobs/image', 'runtime'), `${url}?raw`, `${url}/extra`]) {
    expect(() => v.parse(LevelSectionSchema, { manifest: { ...manifest, card: { ...manifest.card, thumb: bad } } })).toThrow();
  }
});
