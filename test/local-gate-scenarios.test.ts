import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the gate's pure Python selection rule without running a gate.
import { execFileSync } from 'node:child_process';

test('only selected disk scenarios require the official product prerequisite', () => {
  const result = execFileSync('python3', ['-c', `
import json, runpy
select = runpy.run_path('scripts/local-gate.py')['needs_script_products']
cases = [
 ['test/scripts/_template-boss.test.ts'],
 ['test/unit.test.ts', 'test/scripts/far-reach-roc.test.ts'],
 ['test/script-scenario.test.ts', 'test/shard-headless.test.ts'],
 [], ['test/scripts-not-a-scenario.test.ts'],
 ['test/scripts/readme.md'], ['other/test/scripts/example.test.ts'],
]
print(json.dumps([select(case) for case in cases], separators=(',', ':')))
`], { encoding: 'utf8' });
  expect(result.trim()).toBe('[true,true,false,false,false,false,false]');
});
