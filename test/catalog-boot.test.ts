import { expect, it } from 'vitest';
import { parseShardCatalog, runtimeInventoryBytes, type CatalogRuntimeFile } from '@wildshard/format/shardCatalog';
import { LevelSectionSchema, type LevelSection } from '@wildshard/format/level';
import * as v from 'valibot';
import metadata from '../src/shards/far-reach/manifest.json';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { compileCatalogRegistry, loadCatalogRuntime, lookupCatalogEntry, prepareCatalogBoot, type CatalogRuntimeModule } from '../src/game/shard/catalogBoot';

const hash = (bytes: Uint8Array): Promise<string> => Promise.resolve(hashImmutableBytes(bytes));
const files: CatalogRuntimeFile[] = [{ path: 'runtime/index.ts', hash: 'b'.repeat(64), bytes: 40, lines: 2 }];
function catalog() {
  const image = `far-reach/blobs/image/${'a'.repeat(64)}.jpg`;
  return parseShardCatalog({ format:'wildshard.catalog',formatVersion:1,shards:[{
    slug:'far-reach',identity:{slug:'far-reach',revision:2},index:{path:'far-reach/shard.json',hash:'a'.repeat(64)},
    card:{name:metadata.name,label:metadata.label,biome:metadata.biome,blurb:metadata.blurb,order:metadata.order,status:metadata.status,thumb:image,portrait:image,landscape:image,accent:'pink'},
    placement:{instance:'far-reach',grid:[1,1],size:[500,500,500]},runtime:{entry:'runtime/index.ts',filesHash:hashImmutableBytes(runtimeInventoryBytes(files))},
  }]});
}
it('defers code evaluation until a matching admitted product is selected, then memoizes it', async () => {
  let loads = 0; const module: CatalogRuntimeModule = { default: class { world(): void { /* No content in this synthetic runtime. */ } } };
  const registry = await compileCatalogRegistry({'/out/far-reach/runtime/index.ts':() => { loads++; return Promise.resolve(module); }},
    {'/out/far-reach/shard.json':{files}},hash);
  const entry = catalog().shards[0]; if (entry === undefined) throw new Error('Fixture entry missing');
  expect(loads).toBe(0);
  const product = {identity:{slug:'far-reach',revision:2},runtime:{files}};
  expect(await loadCatalogRuntime(entry,product,registry,hash)).toBe(module);
  expect(await loadCatalogRuntime(entry,product,registry,hash)).toBe(module); expect(loads).toBe(1);
});
it('refuses old products, missing code and crossed compiled inventory before loading any module', async () => {
  let loads = 0;
  const registry = await compileCatalogRegistry({'/out/far-reach/runtime/index.ts':() => { loads++; throw new Error('Code must not evaluate'); }},
    {'/out/far-reach/shard.json':{files}},hash);
  const entry = catalog().shards[0]; if (entry === undefined) throw new Error('Fixture entry missing');
  await expect(loadCatalogRuntime(entry,{identity:{slug:'far-reach',revision:1},runtime:{files}},registry,hash)).rejects.toThrow('identity mismatch');
  await expect(loadCatalogRuntime(entry,{identity:{slug:'far-reach',revision:2},runtime:{files:[]}},registry,hash)).rejects.toThrow('inventory mismatch');
  await expect(loadCatalogRuntime({...entry,runtime:{entry:'runtime/index.ts',filesHash:'c'.repeat(64)}},{identity:entry.identity,runtime:{files}},registry,hash)).rejects.toThrow('inventory mismatch');
  await expect(loadCatalogRuntime(entry,{identity:entry.identity,runtime:{files}},new Map(),hash)).rejects.toThrow('inventory mismatch');
  expect(loads).toBe(0);
  await expect(compileCatalogRegistry({}, {'/out/far-reach/shard.json':{files}},hash)).rejects.toThrow('Missing copied runtime');
  await expect(compileCatalogRegistry({'/src/shards/far-reach/runtime/index.ts':() => Promise.reject(new Error('unused'))},{},hash)).rejects.toThrow('copied output');
});
it('awaits plain level metadata before publishing discovery and never evaluates code for the title', async () => {
  const source = catalog(), level = v.parse(LevelSectionSchema,{manifest:metadata});
  let release: ((value: LevelSection) => void) | undefined;
  const levelReady = new Promise<LevelSection>(resolve => { release = resolve; }); let settled = false;
  const ready = prepareCatalogBoot(source,() => levelReady).then(result => { settled = true; return result; });
  await Promise.resolve(); expect(settled).toBe(false);
  if (release === undefined) throw new Error('Fixture promise missing'); release(level);
  const entries = await ready; expect(entries[0]?.level).toBe(level); expect(settled).toBe(true);
  await expect(prepareCatalogBoot(source,() => Promise.reject(new Error('level unavailable')))).rejects.toThrow('level unavailable');
  await expect(prepareCatalogBoot(source,() => Promise.resolve({manifest:{...level.manifest,slug:'wrong'}}))).rejects.toThrow('level identity');
});
it('keeps data-only entries free of compiled runtime and fingerprints declarations too', async () => {
  const entry = catalog().shards[0]; if (entry === undefined) throw new Error('Fixture entry missing');
  expect(await loadCatalogRuntime({...entry,runtime:null},{identity:entry.identity,runtime:null},new Map(),hash)).toBeNull();
  const declaration = {path:'runtime/local.d.ts',hash:'c'.repeat(64),bytes:12,lines:1};
  expect(hashImmutableBytes(runtimeInventoryBytes([...files,declaration]))).toBe(hashImmutableBytes(runtimeInventoryBytes([declaration,...files])));
  expect(hashImmutableBytes(runtimeInventoryBytes(files))).not.toBe(hashImmutableBytes(runtimeInventoryBytes([...files,declaration])));
  expect(() => runtimeInventoryBytes([...files,...files])).toThrow('Duplicate');
  const aliased = parseShardCatalog({...catalog(),shards:[{...entry,slug:'output-folder',index:{...entry.index,path:'output-folder/shard.json'},card:{...entry.card,thumb:'data:image/png,x',portrait:'data:image/png,x',landscape:'data:image/png,x'}}]});
  expect(lookupCatalogEntry(aliased,'far-reach')).toBe(aliased.shards[0]);
  expect(lookupCatalogEntry(aliased,'output-folder')).toBe(aliased.shards[0]);
  expect(lookupCatalogEntry(aliased,'unknown')).toBeUndefined();
});
