// SF74 W12: the push gate's affected-test selection reaches tests that use a changed file outside vite's import graph.
// oxlint-disable-next-line import/no-nodejs-modules -- Own throwaway fixture trees only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Canonical temporary fixture paths.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Canonical temporary fixture paths.
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { textReferencedTests } from '../scripts/gate-cache.mjs';

const trees: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gate-cache-selection-'));
  trees.push(root);
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), body);
  }
  return root;
}
afterEach(() => { for (const root of trees.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('selects a test that runs a fixture which loads the changed script (the 2026-10-09 sim-memory-interval miss)', () => {
  const root = tree({
    'test/sim-memory-interval.test.ts': "execFileSync('python3', ['test/fixtures/soak/native-interval.py']);",
    'test/fixtures/soak/native-interval.py': "SPEC = spec_from_file_location('phases', ROOT / 'scripts/sim-mem-phases.py')",
    'test/unrelated.test.ts': "import { x } from '../src/x';",
    'scripts/sim-mem-phases.py': '',
  });
  expect(textReferencedTests(root, ['scripts/sim-mem-phases.py'])).toEqual(['test/sim-memory-interval.test.ts']);
});

it('matches a distinctive basename but never a generic one like index.ts', () => {
  const root = tree({
    'test/spawn.test.ts': "spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'bake-check.mjs')]);",
    'test/generic.test.ts': "readFileSync('somewhere/index.ts');",
  });
  expect(textReferencedTests(root, ['scripts/bake-check.mjs'])).toEqual(['test/spawn.test.ts']);
  expect(textReferencedTests(root, ['src/engine/index.ts'])).toEqual([]);
});
