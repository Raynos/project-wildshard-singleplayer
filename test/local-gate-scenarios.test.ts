import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the gate's pure Python selection rule without running a gate.
import { execFileSync } from 'node:child_process';

test('selected disk readers require exactly their published products', () => {
  const result = execFileSync('python3', ['-c', `
import json, runpy
select = runpy.run_path('scripts/test_products.py')['required_test_products']
registry = json.load(open('scripts/test-products.json'))
cases = [
 ['test/scripts/_template-boss.test.ts'],
 ['test/unit.test.ts', 'test/scripts/far-reach-roc.test.ts'],
 ['test/script-scenario.test.ts', 'test/shard-headless.test.ts'],
 [], ['test/scripts-not-a-scenario.test.ts'],
 ['test/scripts/readme.md'], ['other/test/scripts/example.test.ts'],
 ['test/pine-npc-figure-product.test.ts', 'test/scripts/ground-encounters.test.ts'],
 ['test/scripts/nine-sign-atlas.test.ts'],
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
  expect(JSON.parse(result)).toEqual([
    ['_template'], ['far-reach'],
    ['_template', 'driftwood-isle', 'far-reach', 'nalati-grasslands', 'nine-dragon-stack', 'pastel-plain', 'pine-hollow', 'sunscar-dunes'],
    [], [], [], [], ['driftwood-isle', 'pine-hollow'], [],
  ]);
});

test('old carriers skip a checkout-only checker and new carriers run their own', () => {
  const result = execFileSync('python3', ['-c', `
import json, runpy
from pathlib import Path
from tempfile import TemporaryDirectory
command = runpy.run_path('scripts/test_products.py')['custom_section_growth_command']
Path('tmp').mkdir(exist_ok=True)
with TemporaryDirectory(dir='tmp') as temporary:
 root = Path(temporary).resolve()
 repo, tree, common = root / 'repo', root / 'carrier', root / 'git'
 for folder in [repo, tree]:
  (folder / 'scripts').mkdir(parents=True)
 checker = 'scripts/check-custom-section-growth.mjs'
 (repo / checker).write_text('checkout-only checker')
 assert command(tree, repo, 'base', 'sha', common) is None
 (tree / checker).write_text('committed checker')
 assert command(tree, repo, 'base', 'sha', common) == [
  'node', str(tree / checker), str(repo), 'base', 'sha',
  str(common / 'custom-section-measures')]
 print(json.dumps({'oldSkipped': True, 'newUsesCarrier': True}))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual({ oldSkipped: true, newUsesCarrier: true });
});
