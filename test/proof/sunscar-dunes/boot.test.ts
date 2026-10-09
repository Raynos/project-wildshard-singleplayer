// oxlint-disable-next-line import/no-nodejs-modules -- Boot the actual shard in a fresh plain Node process without the test DOM.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use this test runner's native executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('boots Signal Dunes through its declared trusted headless factory in plain Node: 13 homes, its controllers, no effects', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/proof/sunscar-dunes/boot.mjs'], { encoding: 'utf8', timeout: 60_000 });
  expect(JSON.parse(output)).toEqual({ native: true, tick: 1, homes: 13, terrain: true, effects: 0,
    steps: ['sunscar.homes', 'sunscar.matriarch', 'item.weapon.sunscar-whip', 'quest.declared', 'sunscar.interactions'] });
}, 60_000);
