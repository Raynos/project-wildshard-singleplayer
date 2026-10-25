// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the actual author graph from its source path.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import * as author from '../src/shards/nalati-grasslands/generators/catalogue';
import rows from '../src/shards/nalati-grasslands/data/campCatalogue.json' with { type: 'json' };
import type { CatalogueParams } from '../src/shards/nalati-grasslands/generators/campParams';

function metadata(value: object): object {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry !== 'function'));
}

test('all 53 author headers retain complete runtime catalogue metadata', () => {
  const runtime = defineSpecimenCatalogue<CatalogueParams>(rows);
  expect(Object.keys(author)).toHaveLength(53);
  expect(Object.keys(author).sort()).toEqual(rows.map(row => row.key).sort());
  for (const key of Object.keys(author)) {
    const header: unknown = Reflect.get(author, key);
    if (typeof header !== 'object' || header === null) throw new Error(`Missing author header: ${key}`);
    expect(metadata(header), key).toEqual(metadata(runtime.model(key as keyof CatalogueParams)));
  }
});

test('author headers bundle without runtime specimen or product loading', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/catalogue.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing catalogue author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    for (const suffix of ['/game/shardfile/runtimeProduct.ts', '/game/models/specimenCatalogue.ts']) {
      expect(Object.keys(chunk.modules).some(path => path.endsWith(suffix)), suffix).toBe(false);
    }
  }
});
