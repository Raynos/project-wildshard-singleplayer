// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual source entry for the boundary proof.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('the actual source assembly bundles without filesystem, publication or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/mapAssemblySource.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing Nine map source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
