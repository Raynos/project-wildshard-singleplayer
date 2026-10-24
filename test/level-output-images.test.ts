import { expect, it } from 'vitest';
import { parseManifestMetadata } from '@wildshard/format/minimap';
import metadata from '../src/shards/far-reach/manifest.json';

it('admits bounded image blob URLs in emitted level metadata', () => {
  const url = `/shardfiles/far-reach/blobs/image/${'a'.repeat(64)}.jpg`;
  const manifest = { ...metadata, card: { ...metadata.card, thumb: url } };
  expect(parseManifestMetadata(manifest).card.thumb).toBe(url);
  for (const bad of [url.replace('a'.repeat(64), 'a'.repeat(63)), url.replace('.jpg', '.svg'),
    url.replace('far-reach', '../other'), url.replace('blobs/image', 'runtime'), `${url}?raw`, `${url}/extra`]) {
    expect(() => parseManifestMetadata({ ...manifest, card: { ...manifest.card, thumb: bad } })).toThrow();
  }
});
