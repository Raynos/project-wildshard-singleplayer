import { beforeAll, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Optional scenario receipt belongs to this test runner.
import { writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone test runs prepare official outputs outside the timed scenario.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse only an exact gate build, never a loose ready flag.
import { env, execPath } from 'node:process';
import { scenario as diskScenario } from '@wildshard/sdk/scriptScenario';
import { scenarioHostHash, scriptScenarioReceipt } from '../../scripts/script-scenario-metrics.mjs';

beforeAll(() => {
  const built = env['WS_TEST_PRODUCTS_SHA'];
  if (built === undefined || !/^[a-f0-9]{40}$/u.test(built) || built !== env['VERCEL_GIT_COMMIT_SHA']) {
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse'], { stdio: 'inherit' });
  }
}, 120_000);

test('Template boss runs published Wasm decisions and resumes a logical save', async () => {
  const create = () => diskScenario('_template', 'template.boss.decision', { seed: 437,
    players: [{ id: 101, at: [-15, 0, -18] }],
  });
  const scenario = await create();
  expect(scenario.product.sectionHash).toMatch(/^[a-f0-9]{64}$/u);
  scenario.send('start');
  expect(scenario.commands()).toEqual([['encounter', 'phase', 0], ['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  scenario.send('start'); expect(scenario.commands()).toEqual([]); // No restart while active.
  scenario.advance(1);
  expect(scenario.commands()).toEqual([['strike', 'boss', 'bump', 101], ['timer', 'beat', 1]]);
  scenario.advance(1);
  expect(scenario.commands()).toEqual([['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  scenario.send('threshold', 'boss', 1);
  expect(scenario.commands()).toEqual([['encounter', 'phase', 1], ['timer', 'beat', 0.5]]);
  scenario.send('threshold', 'boss', 1); expect(scenario.commands()).toEqual([]);
  scenario.advance(0.25);
  const saved = scenario.save();
  scenario.advance(0.5);
  const commands = scenario.commands(), state = scenario.state();
  expect(commands).toEqual([['strike', 'boss', 'bump', 101], ['timer', 'beat', 0.5]]);
  // A fresh host restores slots, queued commands and timer remainder, never a Wasm heap image.
  const resumed = await create(); resumed.restore(structuredClone(saved));
  resumed.advance(0.5); expect(resumed.commands()).toEqual(commands); expect(resumed.state()).toEqual(state);
  expect(resumed.save()).toEqual(scenario.save());
  resumed.send('death', 'boss');
  expect(resumed.commands()).toEqual([['stop', 'boss'], ['timer', 'beat', 0], ['encounter', 'win', 0]]);
  resumed.send('death', 'boss'); expect(resumed.commands()).toEqual([]);
  resumed.advance(2); expect(resumed.commands()).toEqual([]);
  resumed.send('stop'); expect(resumed.state()).toEqual({ phase: 0, swingNext: true });
  resumed.advance(2); expect(resumed.commands()).toEqual([]);
  resumed.send('start'); expect(resumed.commands()).toEqual([['encounter', 'phase', 0], ['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  resumed.send('stop'); expect(resumed.state()).toEqual({ phase: 0, swingNext: true });
  resumed.advance(2); expect(resumed.commands()).toEqual([]); // Stop cancels an active timer too.
  expect(resumed.host.metrics()[0]).toMatchObject({ refusals: 0, disabled: false });
  expect(resumed.maxFuel()).toBeGreaterThan(0);
  expect(resumed.maxFuel()).toBeLessThan(400_000);
  const receiptPath=env['WS_SCRIPT_SCENARIO_RECEIPT'];
  if(receiptPath!==undefined) {
    const hostHash=scenarioHostHash('.');
    if(hostHash===null)throw new Error('Missing scenario host binding');
    writeFileSync(receiptPath,`${JSON.stringify(scriptScenarioReceipt({slug:scenario.product.slug,script:scenario.product.script,scenario:'boss logical save continuation',sectionHash:scenario.product.sectionHash,hostHash,trace:[...scenario.trace(),...resumed.trace()]}),null,2)}\n`);
  }
}, 2_000);
