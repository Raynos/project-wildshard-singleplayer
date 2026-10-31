// oxlint-disable-next-line import/no-nodejs-modules -- One fixed native tape and independent replay own a bounded child.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- No caller-selected executable or fixture source.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The unchanged native loader refuses renderer dependencies.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import * as v from 'valibot';

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const result = v.object({ story: v.literal('driftwood-trade'), ticks: count, commands: count, parts: count,
  coins: count, price: count, earned: count, spent: count, owned: v.array(v.string()), omitted: count,
  restoredSuffix: count, identicalPhysics: count, canonicalPhysics: count });

test('real kills fund Maren BUY and fresh restoration; omitted BUY cannot grant or spend', () => {
  const child = spawnSync(process.execPath, ['--experimental-transform-types', '--import',
    pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href, resolve('test/fixtures/headless/driftwood-trade-run.ts')],
  { encoding: 'utf8', timeout: 30_000 });
  const outcome = JSON.stringify({ status: child.status, signal: child.signal, error: child.error?.message });
  expect(child.error, `${outcome}\n${child.stdout}${child.stderr}`).toBeUndefined();
  expect(child.status, `${outcome}\n${child.stdout}${child.stderr}`).toBe(0);
  const line = child.stdout.split('\n').find(row => row.includes('"story":"driftwood-trade"'));
  if (line === undefined) throw new Error('Missing actual earned Driftwood BUY replay');
  const actual = v.parse(result, JSON.parse(line));
  expect(actual.ticks).toBeGreaterThan(0); expect(actual.commands).toBeGreaterThan(0); expect(actual.parts).toBeGreaterThan(1);
  expect(actual.price).toBeGreaterThan(0); expect(actual.earned).toBeGreaterThanOrEqual(actual.price);
  expect(actual.spent).toBe(actual.price); expect(actual.coins).toBe(actual.earned - actual.price);
  expect(actual.owned).toContain('cape'); expect(actual.omitted).toBeGreaterThan(0);
  expect(actual.restoredSuffix).toBe(120); expect(actual.identicalPhysics + actual.canonicalPhysics).toBeGreaterThan(0);
  console.info(line);
}, 35_000);
