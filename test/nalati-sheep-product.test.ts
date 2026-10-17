import { expect, it } from 'vitest';
import { buildSheepGeometry, SHEEP_PIVOTS, SHEEP_PART_NAMES } from '../src/shards/nalati-grasslands-legacy/species/sheep';
import { bakeSheepBody } from '../src/shards/nalati-grasslands/generators/sheepBody';
import { readFlockBody } from '../src/shards/nalati-grasslands/runtime/flockDeclared';

const source = () => {
  const { bytes, ...row } = bakeSheepBody();
  const metadata = new TextEncoder().encode(JSON.stringify(row));
  return { bytes, file: (name: string): Promise<Uint8Array> => {
    if (name === 'actors/sheep.bin') return Promise.resolve(bytes);
    if (name === 'actors/sheep.json') return Promise.resolve(metadata);
    throw new Error('Unexpected sheep product file');
  } };
};

it('keeps every frozen sheep vertex, rig weight, index and animation bound exactly', async () => {
  const original = buildSheepGeometry(), product = source(), body = await readFlockBody(product), baked = body.geometry;
  try {
    expect(Object.keys(baked.attributes)).toEqual(Object.keys(original.attributes));
    for (const name of Object.keys(original.attributes)) {
      const actual = baked.getAttribute(name), expected = original.getAttribute(name);
      expect(actual.array, name).toEqual(expected.array);
      expect([actual.itemSize, actual.normalized], name).toEqual([expected.itemSize, expected.normalized]);
    }
    expect(baked.index?.array).toEqual(original.index?.array);
    expect(baked.groups).toEqual(original.groups);
    expect(baked.boundingSphere).toEqual(original.boundingSphere);
    expect(baked.boundingBox).toEqual(original.boundingBox);
    expect(body.pivots).toEqual(SHEEP_PIVOTS); expect(body.parts).toEqual(SHEEP_PART_NAMES);
    const first = baked.clone(), second = baked.clone();
    try {
      first.getAttribute('position').setX(0, 1000);
      expect(second.getAttribute('position').getX(0)).toBe(original.getAttribute('position').getX(0));
      expect(baked.getAttribute('position').getX(0)).toBe(original.getAttribute('position').getX(0));
    } finally { first.dispose(); second.dispose(); }
  } finally { original.dispose(); baked.dispose(); }
});

it('refuses truncated product bytes before a flock can build', async () => {
  const product = source();
  await expect(readFlockBody({ file: name => name === 'actors/sheep.bin' ? Promise.resolve(product.bytes.slice(1)) : product.file(name) })).rejects.toThrow('declared blocks');
});
