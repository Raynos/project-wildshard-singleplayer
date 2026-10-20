import { expect, it } from 'vitest';
import { runtimeInventoryBytes, type CatalogRuntimeFile } from '@wildshard/format/shardCatalog';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { compileCatalogRegistry, type CatalogRuntimeModule } from '../src/game/shard/catalogBoot';

const hash = (bytes: Uint8Array): Promise<string> => Promise.resolve(hashImmutableBytes(bytes));
const files: CatalogRuntimeFile[] = [{ path: 'runtime/index.ts', hash: 'b'.repeat(64), bytes: 40, lines: 2 }];

it('defers runtime evaluation until selection, then memoizes it', async () => {
  let loads = 0; const module: CatalogRuntimeModule = { default: class { world(): void { /* Synthetic runtime. */ } } };
  const registry = await compileCatalogRegistry({'/out/far-reach/runtime/index.ts':() => { loads++; return Promise.resolve(module); }},
    {'/out/far-reach/shard.json':{files}},hash);
  const entry = registry.get('far-reach'); if (entry === undefined) throw new Error('Missing runtime');
  expect(loads).toBe(0);
  expect(entry.filesHash).toBe(hashImmutableBytes(runtimeInventoryBytes(files)));
  expect(await entry.load()).toBe(module);
  expect(await entry.load()).toBe(module); expect(loads).toBe(1);
});

it('refuses missing copied code or an inventory that cannot name its runtime', async () => {
  const modules = {'/out/far-reach/runtime/index.ts':() => Promise.reject(new Error('Code must not evaluate'))};
  await expect(compileCatalogRegistry({}, {'/out/far-reach/shard.json':{files}},hash)).rejects.toThrow('Missing copied runtime');
  await expect(compileCatalogRegistry(modules, {},hash)).rejects.toThrow('Missing compiled runtime inventory');
  await expect(compileCatalogRegistry(modules, {'/out/far-reach/shard.json':{files:[]}},hash)).rejects.toThrow('Missing compiled runtime inventory');
  await expect(compileCatalogRegistry({'/src/shards/far-reach/runtime/index.ts':modules['/out/far-reach/runtime/index.ts']},{},hash)).rejects.toThrow('copied output');
});

it('fingerprints sorted declarations and refuses duplicate runtime paths', () => {
  const declaration = {path:'runtime/local.d.ts',hash:'c'.repeat(64),bytes:12,lines:1};
  expect(hashImmutableBytes(runtimeInventoryBytes([...files,declaration]))).toBe(hashImmutableBytes(runtimeInventoryBytes([declaration,...files])));
  expect(hashImmutableBytes(runtimeInventoryBytes(files))).not.toBe(hashImmutableBytes(runtimeInventoryBytes([...files,declaration])));
  expect(() => runtimeInventoryBytes([...files,...files])).toThrow('Duplicate');
});
