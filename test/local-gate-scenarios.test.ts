import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the gate's pure Python selection rule without running a gate.
import { execFileSync } from 'node:child_process';

test('selected disk readers require exactly their published products', () => {
  const result = execFileSync('python3', ['-c', `
import json, runpy
select = runpy.run_path('scripts/local-gate.py')['required_test_products']
registry = json.load(open('scripts/gate-test-products.json'))
cases = [
 ['test/scripts/_template-boss.test.ts'],
 ['test/unit.test.ts', 'test/scripts/far-reach-roc.test.ts'],
 ['test/script-scenario.test.ts', 'test/shard-headless.test.ts'],
 [], ['test/scripts-not-a-scenario.test.ts'],
 ['test/scripts/readme.md'], ['other/test/scripts/example.test.ts'],
 ['test/pine-npc-figure-product.test.ts', 'test/scripts/ground-encounters.test.ts'],
]
print(json.dumps([select(case, registry) for case in cases], separators=(',', ':')))
try:
 select(['test/scripts/unregistered.test.ts'], registry)
 raise AssertionError('An unregistered scenario must refuse')
except ValueError:
 pass
from pathlib import Path
assert all(str(path) in registry for path in Path('test/scripts').glob('*.test.ts'))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual([['_template'], ['far-reach'], [], [], [], [], [], ['driftwood-isle', 'pine-hollow']]);
});
