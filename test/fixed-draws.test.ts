import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { fixedDraws } from '../src/game/models/fixedDraws';

// G571: a product's named fixed draws (Driftwood's fixed-model templates) loaded together as owned templates.
const tri = (x: number): BufferGeometry => new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([x, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
const rows = [{ slot: 'gull', file: 'models/fixed/gull.glb', channels: [] }, { slot: 'reefFish', file: 'models/fixed/reef-fish.glb', channels: [] }];
const product = { slug: 'fixture', file: () => Promise.reject(new Error('read through the product')) };

test('every slot loads together from named sources and copies its own template', async () => {
  const draws = fixedDraws(product, rows);
  expect(draws.ready).toBe(false);
  await draws.load(new Map([['models/fixed/gull.glb', tri(7)], ['models/fixed/reef-fish.glb', tri(9)]]));
  expect(draws.ready).toBe(true);
  const gull = draws.handle('gull').copy(), fish = draws.handle('reefFish').copy();
  expect(gull.getAttribute('position').getX(0)).toBe(7); expect(fish.getAttribute('position').getX(0)).toBe(9);
  expect(gull).not.toBe(draws.handle('gull').copy());
});

test('an undeclared, missing or repeated slot refuses; no source reads the product', async () => {
  expect(() => fixedDraws(product, [...rows, rows[0]])).toThrow('Repeated');
  const draws = fixedDraws(product, rows);
  expect(() => draws.handle('crab')).toThrow('Undeclared');
  await expect(draws.load(new Map([['models/fixed/gull.glb', tri(1)]]))).rejects.toThrow('Missing fixed draw: reefFish');
  expect(draws.ready).toBe(false);
  await expect(draws.load()).rejects.toThrow('read through the product');
});
