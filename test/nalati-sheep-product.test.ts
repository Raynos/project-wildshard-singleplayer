import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare baked channels by their exact bytes.
import { createHash } from 'node:crypto';
import type { BufferAttribute, InterleavedBufferAttribute } from 'three';
import { bakeSheepBody } from '../src/shards/nalati-grasslands/generators/sheepBody';
import { readCrowdBody } from '../src/game/ambient/crowdPage';
import { FlockBrain } from '../src/engine/ai/flock';
import { flock } from '../src/sdk/crowds';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
// The original Nalati sheep and flock rows, frozen from the legacy copy (fixtures/legacy-oracles/nalati-sheep.json)
import FROZEN from './fixtures/legacy-oracles/nalati-sheep.json' with { type: 'json' };
import { ShippingFlock } from './fixtures/flock-oracle/flock';

const readFlockBody = (product: Parameters<typeof readCrowdBody>[0]) => readCrowdBody(product, { json: 'actors/sheep.json', binary: 'actors/sheep.bin' });

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
  const frozen = FROZEN.flocks[String(seed) as keyof typeof FROZEN.flocks];
  expect(world).toEqual(frozen.world);
  expect(specimen).toEqual(frozen.specimen);
});

it('keeps every frozen sheep vertex, rig weight, index and animation bound exactly', async () => {
  const original = FROZEN.geometry, product = source(), body = await readFlockBody(product), baked = body.geometry;
  const bytes = (attribute: BufferAttribute | InterleavedBufferAttribute): string => {
    const array = attribute.array; return createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
  };
  try {
    expect(Object.keys(baked.attributes)).toEqual(original.order);
    for (const [name, expected] of Object.entries(original.attributes)) {
      const actual = baked.getAttribute(name);
      expect({ hash: bytes(actual), length: actual.array.length, kind: actual.array.constructor.name, itemSize: actual.itemSize, normalized: actual.normalized }, name).toEqual(expected);
    }
    const index = baked.index;
    expect(index === null ? null : { hash: bytes(index), length: index.array.length, kind: index.array.constructor.name }).toEqual(original.index);
    expect(baked.groups).toEqual(original.groups);
    expect(baked.boundingSphere === null ? null : { center: baked.boundingSphere.center.toArray(), radius: baked.boundingSphere.radius }).toEqual(original.boundingSphere);
    expect(baked.boundingBox === null ? null : { min: baked.boundingBox.min.toArray(), max: baked.boundingBox.max.toArray() }).toEqual(original.boundingBox);
    expect(body.pivots).toEqual(FROZEN.pivots); expect(body.parts).toEqual(FROZEN.parts);
    const first = baked.clone(), second = baked.clone(), x0 = baked.getAttribute('position').getX(0);
    try {
      first.getAttribute('position').setX(0, 1000);
      expect(second.getAttribute('position').getX(0)).toBe(x0);
      expect(baked.getAttribute('position').getX(0)).toBe(x0);
    } finally { first.dispose(); second.dispose(); }
  } finally { baked.dispose(); }
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
