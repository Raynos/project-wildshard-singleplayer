// oxlint-disable-next-line import/no-nodejs-modules -- Standalone execution builds the official products before the timed scenario.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- An exact immutable receipt avoids duplicate production.
import { env, execPath } from 'node:process';
import { beforeAll, expect, test } from 'vitest';
import { scenario } from '@wildshard/sdk/scriptScenario';

beforeAll(() => {
  if (env['WS_TEST_PRODUCTS_SHA'] !== env['VERCEL_GIT_COMMIT_SHA'] || env['WS_TEST_PRODUCTS_SHA'] === undefined)
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse'], { stdio: 'inherit' });
}, 120_000);
test('the published Matriarch guest flies, grounds and restores without replaying effects', async () => {
  const create = () => scenario('sunscar-dunes', 'sunscar.matriarch.decision', { seed: 6511,
    actors: [{ id: 'matriarch', at: [-14, 18, -150] }], players: [{ id: 101, at: [-14, 0, -130] }],
  });
  const boss = await create(); boss.send('start');
  expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['move', 'matriarch', 'orbit'], ['timer', 'beat', 3]]);
  boss.advance(3); expect(boss.commands(), JSON.stringify({state:boss.state(),trace:boss.trace().slice(-12),metrics:boss.host.metrics()})).toContainEqual(['move', 'matriarch', 'dive', 101]);
  boss.send('strike.done', 'matriarch', 'maw', true);
  expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['timer', 'beat', 0], ['move', 'matriarch', 'climb']]);
  boss.send('move.done', 'matriarch', 'climb', true);
  expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['move', 'matriarch', 'orbit'], ['timer', 'beat', 5]]);
  boss.send('threshold', 'matriarch', 1); expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['move', 'matriarch', 'stormOrbit']]);
  boss.send('threshold', 'matriarch', 2);
  expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['stop', 'matriarch'], ['timer', 'beat', 0], ['move', 'matriarch', 'lie']]);
  boss.send('move.done', 'matriarch', 'lie', true); expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['move', 'matriarch', 'stalk', 101]]);
  boss.send('move.done', 'matriarch', 'stalk', true); expect(boss.commands(),JSON.stringify(boss.trace().slice(-3))).toEqual([['strike', 'matriarch', 'tail', 101]]);
  const saved = boss.save(), resumed = await create(); resumed.restore(structuredClone(saved));
  expect(resumed.host.metrics()[0]?.calls).toBe(0);
  for (const owner of [boss, resumed]) owner.send('strike.done', 'matriarch', 'tail', false);
  expect(resumed.commands()).toEqual(boss.commands()); expect(resumed.save()).toEqual(boss.save());
  resumed.send('death', 'matriarch'); expect(resumed.state()).toEqual({ step: 25 });
  expect(resumed.commands()).toEqual([['stop', 'matriarch'], ['timer', 'beat', 0]]);
  resumed.advance(8); expect(resumed.commands()).toEqual([]);
  resumed.send('stop'); expect(resumed.state()).toEqual({ step: 0 });
  expect(boss.maxFuel()).toBeLessThan(400_000);
  expect(boss.host.metrics()[0]).toMatchObject({ refusals: 0, disabled: false });
}, 2_000);
