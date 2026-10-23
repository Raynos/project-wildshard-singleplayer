// oxlint-disable-next-line import/no-nodejs-modules -- Compile the real author entry without executing its runtime.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { nineBuildBlocks } from '../src/shards/nine-dragon-stack/generators/worldEntry';
import { BLEND_ADD_KEEP_ALPHA } from '../src/game/plugin/shaderFamily';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('Nine authored streaks retain the original blend state without importing a runtime host', () => {
  const row = Object.values(nineBuildBlocks()).flat().find(entry => entry.kind === 'look' && entry.look === 'nine-streaks');
  expect(row).toMatchObject({ state: { transparent: true, ...BLEND_ADD_KEEP_ALPHA } });
});

test('the actual Nine output sidecar bundles as one build-only module', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/output.ts'), formats: ['es'], fileName: 'config' }, rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing Nine output bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/src/game/shardfile/clientPlan.ts'))).toBe(false);
  }
});
