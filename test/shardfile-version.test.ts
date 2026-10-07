import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SHARDFILE_VERSION as SDK_VERSION } from '@wildshard/sdk/version';
import { SHARDFILE_VERSION, shardfileRevision } from '../src/game/shardfile/version';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';
import { contentHash } from '@wildshard/sdk/project';

const source = () => emptyShardfile({ slug: 'wire-version', name: 'Wire version', author: 'Test', revision: 1, seed: 1 });
function options(cached: CachedProduct | null, firstParty = true, offline = true) {
  const cache: ProductCache = { product: () => Promise.resolve(cached), asset: () => Promise.resolve(null), putAsset: () => Promise.resolve(false), putProduct: () => Promise.resolve() };
  return { base: 'https://example.test/products/wire-version/', offline, firstParty, cache, fetch: () => Promise.reject(new Error('Version refusal must precede network')), hash: (bytes: Uint8Array) => Promise.resolve(contentHash(bytes)) };
}
it('writes the same canonical 0.x format and SDK version and compares integer revisions rather than floats', () => {
  expect(SDK_VERSION).toBe('0.1'); expect(SHARDFILE_VERSION).toBe(SDK_VERSION);
  expect(source()).toMatchObject({ version: SDK_VERSION, requires: { sdk: SDK_VERSION } });
  expect(shardfileRevision('0.10')).toBe(10); expect(shardfileRevision('0.9')).toBe(9); expect(shardfileRevision('0.10')).toBeGreaterThan(shardfileRevision('0.9'));
});
it.each([0, 1, 0.1, '1.0', '0.01', '0.1.0', '0.-1', '0.+1', '0.1e1', '0.1 ', '0.9007199254740992', null])('refuses malformed or unsupported current wire version %s', async version => {
  expect(() => parseShardfile({ ...source(), version })).toThrow();
  await expect(admitProduct({ ...source(), version }, options(null, true, false))).rejects.toThrow();
});
it('revalidates legacy integer-zero only in a visited first-party offline cache', async () => {
  const current = source(), legacy = { ...current, version: 0, requires: { ...current.requires, sdk: 0 } }, cached = { source: legacy, firstParty: true };
  expect((await admitProduct(current, options(cached))).source).toEqual(current);
  await expect(admitProduct(legacy, options(null, true, false))).rejects.toThrow('compatible client');
  await expect(admitProduct(current, options(cached, false))).rejects.toThrow('compatible client');
  await expect(admitProduct(current, options({ ...cached, firstParty: false }))).rejects.toThrow('compatible client');
  await expect(admitProduct(current, options({ ...cached, source: { ...legacy, requires: { ...legacy.requires, sdk: 1 } } }))).rejects.toThrow('legacy');
  await expect(admitProduct(current, options({ ...cached, source: { ...legacy, entryways: [] } }))).rejects.toThrow('entryways');
  await expect(admitProduct(current, options({ ...cached, source: { ...legacy, version: '0.0' } }))).rejects.toThrow('compatible client');
});
it('uses strict predecessor state lineage during an online integer-zero cache upgrade', async () => {
  const current = source(); current.state.shared.push({ id: 7, name: 'door.open', type: 'bool', default: false, privacy: 'public' });
  const legacy = { ...structuredClone(current), version: 0, requires: { ...current.requires, sdk: 0 } };
  const upgrade = structuredClone(current); upgrade.identity.revision++; upgrade.state.shared = [];
  await expect(admitProduct(upgrade, options({ source: legacy, firstParty: true }, true, false))).rejects.toThrow('explicit');
  expect((await admitProduct(current, options({ source: legacy, firstParty: true }, true, false))).source).toEqual(current);
});
