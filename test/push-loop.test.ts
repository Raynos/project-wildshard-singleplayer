// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real scheduler against owned tiny Git fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The dependency walker receives an explicit repository root.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { liveTests, sourceInputs } from '../scripts/push-inputs.mjs';

test('related tests, prefix uploads and refusal retries', () => {
  execFileSync('python3', ['scripts/test_push_loop.py'], { encoding: 'utf8', timeout: 30_000 });
  execFileSync('python3', ['scripts/test_sp_tools.py'], { encoding: 'utf8', timeout: 30_000 });
});

test('failure attribution follows real transitive source imports', () => {
  expect(sourceInputs(resolve('.'), ['test/fixtures/push-inputs/unit.ts'])).toEqual([
    'test/fixtures/push-inputs/leaf.ts', 'test/fixtures/push-inputs/unit.ts',
  ]);
});

test('live selection keeps units and leaves product builders to CI', () => {
  expect(liveTests(resolve('.'), [
    'test/fixtures/push-inputs/unit.ts', 'test/fixtures/push-inputs/builder.ts',
    'test/push-loop.test.ts', 'test/scripts/_template-boss.test.ts',
  ], {})).toEqual(['test/fixtures/push-inputs/unit.ts']);
  expect(liveTests(resolve('.'), ['test/fixtures/push-inputs/unit.ts'], {
    'test/fixtures/push-inputs/unit.ts': ['_template'],
  })).toEqual([]);
});
