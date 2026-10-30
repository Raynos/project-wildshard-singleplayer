// oxlint-disable-next-line import/no-nodejs-modules -- Read each tile driver caller's shipped source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- List the game layer's sources from the checkout.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { productTileRing } from '../src/game/shardfile/tileDriver';
import { CELL_RING } from '../src/game/shardfile/tileContent';

// NT1: a driver started without its product's ring falls back to the device's 5 x 5, so Nine's `ring: 'cell'` held only
// 5 of 25 fabric unions from the west deck. Every caller hands residentTiles the product's own ring.
test('every residentTiles caller passes its product ring', () => {
  const files = execFileSync('git', ['ls-files', 'src/game'], { encoding: 'utf8' }).split('\n').filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('tileDriver.ts'));
  const calls = files.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/await residentTiles\(([^;]*?)\);/gsu)].map(match => [file, match[1] ?? ''] as const));
  expect(calls.length).toBeGreaterThanOrEqual(4);
  for (const [file, args] of calls) expect(`${file}: ${args}`).toMatch(/productTileRing\(\w+\)$/u);
});

test('a product declaring its whole cell drives the whole cell; others keep the device ring', () => {
  expect(productTileRing({ ring: 'cell' })()).toBe(CELL_RING);
  expect(productTileRing({})()).toBeLessThan(CELL_RING);
});
