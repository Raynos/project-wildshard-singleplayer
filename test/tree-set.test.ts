import { expect, test } from 'vitest';
import * as v from 'valibot';
import { TreeSetSchema } from '../src/format/treeSetRows';
import { TREE_SET } from '../src/shards/pine-hollow/generators/treeSet';

/** An unrelated orchard's set: two apple trees and a pear in its own pool, graphs and asset folder. */
const orchard = {
  product: 'orchard', set: 'orchard-trees',
  geometry: { url: '/assets/orchard/baked/trees.glb', parts: ['apple-a__trunk', 'apple-a__hi'], channels: [{ name: 'aWindWeight', source: '_wind_weight', width: 1 }] },
  looks: { bark: 'orchard-bark', needles: 'orchard-leaves', twigs: 'orchard-twigs', far: 'orchard-far' }, anisotropy: { cards: 4, far: 2 }, tintBark: true,
  model: { id: 'orchard/tree', name: 'Orchard tree', file: 'src/shards/orchard/trees.ts' },
  variants: [{ name: 'apple-a', label: 'Apple A', species: 'apple', height: 6, trunk: 0.2, collider: 1 },
    { name: 'apple-b', label: 'Apple B', species: 'apple', height: 5, trunk: 0.18, collider: 1 }, { name: 'pear', label: 'Pear', species: 'pear', height: 7, trunk: 0.22, collider: 1 }],
};

test('tree set rows admit an unrelated orchard and Pine Hollow\'s species set', () => {
  expect(v.parse(TreeSetSchema, orchard).variants.map(row => row.species)).toEqual(['apple', 'apple', 'pear']);
  expect(v.parse(TreeSetSchema, structuredClone(TREE_SET)).variants).toHaveLength(14);
});

test('tree set rows refuse a factory callback, no variants and an unbounded anisotropy', () => {
  expect(v.safeParse(TreeSetSchema, { ...orchard, build: () => undefined }).success).toBe(false);
  expect(v.safeParse(TreeSetSchema, { ...orchard, variants: [] }).success).toBe(false);
  expect(v.safeParse(TreeSetSchema, { ...orchard, anisotropy: { cards: 64, far: 2 } }).success).toBe(false);
});
