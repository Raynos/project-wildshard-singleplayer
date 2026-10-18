// oxlint-disable-next-line import/no-nodejs-modules -- Compare admitted channels with pre-migration runtime hashes.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { bakedActorGeometry } from '../src/shards/nalati-grasslands/world/places';
import oracle from './fixtures/nalati-actor-paint.json';

it('preserves all original actor attributes, index and bounds', () => {
  for (const row of oracle.rows) {
    const geometry = bakedActorGeometry(row.key);
    const attributes = Object.entries(geometry.attributes).map(([name, a]) => ({ name, itemSize: a.itemSize, count: a.count,
      hash: createHash('sha256').update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)).digest('hex') }));
    const actual = { key: row.key, attributes, index: geometry.index === null ? null : Array.from(geometry.index.array), box: geometry.boundingBox === null ? null : { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() }, sphere: geometry.boundingSphere === null ? null : { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } };
    expect(actual, row.key).toEqual(row);
    geometry.dispose();
  }
});

it('returns independent geometry for dungeon transforms and refuses missing shapes', () => {
  const a = bakedActorGeometry('balbal:0:2977'), b = bakedActorGeometry('balbal:0:2977');
  const x = b.getAttribute('position').getX(0);
  a.translate(12, 3, -4);
  expect(b.getAttribute('position').getX(0)).toBe(x);
  expect(() => bakedActorGeometry('absent')).toThrow('no admitted actor shape');
  a.dispose(); b.dispose();
});
