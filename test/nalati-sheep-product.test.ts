import { expect, it } from 'vitest';
import { buildSheepGeometry, SHEEP_PIVOTS, SHEEP_PART_NAMES } from '../src/shards/nalati-grasslands-legacy/species/sheep';
import { bakeSheepBody } from '../src/shards/nalati-grasslands/generators/sheepBody';
import { readFlockBody } from '../src/shards/nalati-grasslands/runtime/flockDeclared';
import { FlockBrain } from '../src/engine/ai/flock';
import { flock } from '../src/sdk/crowds';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import { nalatiFlockRows as originalFlockRows } from '../src/shards/nalati-grasslands-legacy/creatures/flockRows';
import { ShippingFlock } from './fixtures/flock-oracle/flock';

const source = () => {
  const { bytes, ...row } = bakeSheepBody();
  const metadata = new TextEncoder().encode(JSON.stringify({ species: {}, ...row }));
  return { bytes, file: (name: string): Promise<Uint8Array> => {
    if (name === 'actors/sheep.bin') return Promise.resolve(bytes);
    if (name === 'actors/sheep.json') return Promise.resolve(metadata);
    throw new Error('Unexpected sheep product file');
  } };
};

for (const seed of [0, 3, 8172, 0xffffffff - 101]) it(`keeps flock identities and setup seeds exact at ${String(seed)}`, () => {
  const world = ecology.flocks.world.map(row => flock({ ...row, seed: seed + row.seed }));
  const specimen = ecology.flocks.specimen.map(row => flock({ ...row, seed: seed + row.seed }));
  expect(world).toEqual(originalFlockRows(seed));
  expect(specimen).toEqual(originalFlockRows(seed, [{ x: 0, z: 0, count: 1, dog: false }]));
});

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

it('keeps the Explorer sheep setup draws, wool and pose on the declared owner', () => {
  const heightAt = (x: number, z: number): number => x * 0.1 + z * 0.2;
  const centre = (): void => undefined, trample = (): void => undefined;
  const original = new ShippingFlock({ heightAt, normalAt: () => [0, 1, 0], wetAt: () => false,
    playerCrouched: false, grassHeightAt: () => 0, trample, centre }, { x: 0, z: 0, count: 1, seed: 3 });
  const row = ecology.flocks.specimen.map(declaration => flock({ ...declaration, seed: 3 + declaration.seed }))[0];
  if (row === undefined) throw new Error('Missing specimen flock row');
  const declared = new FlockBrain({ heightAt, normalY: () => 1,
    inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin,
    wetAt: () => false, playerCrouched: () => false, grassHeightAt: () => 0, trample, centre }, row);
  original.initialize(); declared.initialize();
  expect(declared.state()).toEqual(original.state());
});
