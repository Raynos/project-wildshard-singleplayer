import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real duration producer in an owned fixture.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Create and clean an isolated timing-cache fixture.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node runtime for the standalone producer.
import process from 'node:process';

it('retains a coverage-only unit measurement and prefers recorded project entries', () => {
  const root = mkdtempSync(join(tmpdir(), 'vitest-durations-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'scripts/vitest-durations.mjs'), readFileSync('scripts/vitest-durations.mjs'));
    writeFileSync(join(root, 'vitest.config.ts'), "const heavy = [\n  'test/heavy.test.ts',\n  ...(coverage ? [\n    'test/coverage-only.test.ts',\n  ] : []),\n];\n");
    for (const file of ['unit', 'heavy', 'coverage-only']) writeFileSync(join(root, `test/${file}.test.ts`), '');
    const cache = join(root, 'results.json');
    writeFileSync(cache, JSON.stringify({ results: [
      ['unit:test/unit.test.ts', { duration: 5000 }],
      ['integration:test/unit.test.ts', { duration: 100000 }],
      ['unit:test/heavy.test.ts', { duration: 100000 }],
      ['integration:test/heavy.test.ts', { duration: 12000 }],
      ['unit:test/coverage-only.test.ts', { duration: 67533 }],
      ['unit:test/deleted.test.ts', { duration: 9999 }],
    ] }));
    execFileSync(process.execPath, ['scripts/vitest-durations.mjs', cache], { cwd: root });
    expect(JSON.parse(readFileSync(join(root, 'test/durations.json'), 'utf8'))).toEqual({
      'test/coverage-only.test.ts': 67.5, 'test/heavy.test.ts': 12, 'test/unit.test.ts': 5,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
