import { expect, it } from 'vitest';
import { createPinePack } from '../../../src/shards/pine-hollow/runtime/pack';
import { PINE_PACK_KINDS } from '../../../src/shards/pine-hollow/items';

it('keeps the authored pack policy, full stacks and all-or-nothing trades across a silent restore', () => {
  const pack = createPinePack();
  for (const id of PINE_PACK_KINDS) expect(pack.add(id)).toBe(true);
  expect(pack.add('amber-resin', 4)).toBe(true);
  const saved = pack.snapshot(), copy = createPinePack();
  copy.restore(structuredClone(saved));
  expect(copy.snapshot()).toEqual(saved);
  expect(copy.take('amber-resin', 6)).toBe(false);
  expect(copy.take('amber-resin', 0)).toBe(true);
  expect(copy.snapshot()).toEqual(saved);
  expect(copy.take('amber-resin', 5)).toBe(true);
  expect(copy.snapshot().order).not.toContain('amber-resin');
  expect(copy.add('amber-resin')).toBe(true);
  expect(copy.snapshot().order.at(-1)).toBe('amber-resin');
});

it('refuses unknown, duplicate, unbounded and orphan saved pack lines before changing the continuation', () => {
  const pack = createPinePack(); pack.add('amber-resin');
  const before = pack.snapshot();
  for (const bad of [
    { counts: { unknown: 1 }, order: ['unknown'] },
    { counts: { 'amber-resin': 1 }, order: ['amber-resin', 'amber-resin'] },
    { counts: { 'amber-resin': Number.POSITIVE_INFINITY }, order: ['amber-resin'] },
    { counts: { 'amber-resin': 1_000_001 }, order: ['amber-resin'] },
    { counts: { 'amber-resin': 1 }, order: [] },
    { counts: {}, order: [], extra: true },
  ]) {
    expect(() => pack.restore(bad)).toThrow();
    expect(pack.snapshot()).toEqual(before);
  }
});
