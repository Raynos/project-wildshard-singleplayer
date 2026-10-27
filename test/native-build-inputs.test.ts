// oxlint-disable-next-line import/no-nodejs-modules -- Execute the exact workflow classifier with NUL-delimited Git paths.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify release builds retain the extra native check.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { nativeBuildNeeded } from '../scripts/native-build-inputs.mjs';

test('native entry, HTML transform and toolchain changes retain the native bundle check', () => {
  for (const path of ['index.html', 'native.html', 'native-unavailable.html', 'scripts/native-page.mjs', 'scripts/build-app.mjs',
    'scripts/app-build/versionFiles.ts', 'vite.config.ts', 'vite/rapier.ts', 'src/native.ts',
    'src/engine/native/ota.ts', 'src/pageServices.ts', 'src/main.ts', 'src/identity.ts',
    'capacitor.config.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.engine.json',
    '.github/workflows/deploy.yml', 'scripts/native-build-inputs.mjs']) {
    expect(nativeBuildNeeded([path]), path).toBe(true);
  }
});

test('ordinary game/data/test edits use their existing web checks, including deletion and unusual filenames', () => {
  const paths = ['src/engine/player/Player.ts', 'src/shards/nalati-grasslands/data/rows.json',
    'test/native-riding.test.ts', 'docs/native build.md', 'test/a\nnew line.test.ts'];
  expect(nativeBuildNeeded(paths)).toBe(false);
  expect(nativeBuildNeeded([])).toBe(false);
  expect(execFileSync('node', ['scripts/native-build-inputs.mjs'], { input: `${paths.join('\0')}\0`, encoding: 'utf8' })).toBe('false\n');
  expect(execFileSync('node', ['scripts/native-build-inputs.mjs'], { input: `${paths.join('\0')}\0src/engine/native/boot.ts\0`, encoding: 'utf8' })).toBe('true\n');
});

test('releases always build native, and push/PR detection compares the complete event range', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  expect(workflow).toMatch(/NATIVE_BASE: \$\{\{ github\.event\.before \|\| github\.event\.pull_request\.base\.sha \}\}/u);
  expect(workflow).toContain('git diff --name-only -z "$NATIVE_BASE" HEAD');
  expect(workflow).toContain("(env.DEPLOY == 'true' || steps.native-inputs.outputs.needed == 'true')");
  const native = workflow.split('      - name: Native web build\n')[1]?.split('      - name: Pack the exact web build for boot smoke\n')[0];
  if (native === undefined) throw new Error('Missing native build step');
  const [release, prepared] = native.split('          else\n');
  if (release === undefined || prepared === undefined) throw new Error('Missing native build modes');
  expect(release).toContain("if [ \"$DEPLOY\" = 'true' ]; then\n            pnpm gen --inputs-only");
  expect(release).toContain('python3 scripts/ci-fail-fast.py -- pnpm run build:native');
  const verify = prepared.indexOf('python3 scripts/ci-fail-fast.py -- python3 scripts/ci-products.py unpack');
  const binding = prepared.indexOf('WS_TEST_PRODUCTS_SHA="$GITHUB_SHA" VERCEL_GIT_COMMIT_SHA="$GITHUB_SHA"');
  const build = prepared.indexOf('python3 scripts/ci-fail-fast.py -- python3 scripts/heavy-lane.py build -- node scripts/build-app.mjs --mode native');
  expect(verify).toBeGreaterThanOrEqual(0);
  expect(binding).toBeGreaterThan(verify);
  expect(build).toBeGreaterThan(binding);
  expect(prepared).not.toContain('build-shardfiles');
  expect(prepared).not.toContain('pnpm gen');
});
