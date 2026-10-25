import { expect, test, vi } from 'vitest';
import { assetTableAsset, assetTableBanks } from '../vite/assetTables';
import { prepareAssetTables, prepareAssetPacks, readAssetTables } from '../src/assetTables';

function fixture() {
  const data = { bytes: { '/assets/kept.bin': 42 }, versions: { '/assets/kept.bin': 'abc' }, music: { theme: { loop: 1 } }, sfx: {},
    packs: { legacy: { phone: { bytes: 42, files: [['/assets/kept.bin', 0, 42, 'application/octet-stream']], parts: [{ url: '/assets/packs/p.bin', bytes: 42, files: [['/assets/kept.bin', 0, 42, 'application/octet-stream']] }] } } } };
  const source = JSON.stringify(data); return { data, source, asset: assetTableAsset(source) };
}
test('selected-entry transport retains every original table value and pack tuple', async () => {
  const f = fixture();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(f.source)));
  expect(f.asset.address.sha256).toBe(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''));
  expect(await readAssetTables(f.asset.address, url => { expect(url).toBe(`/${f.asset.fileName}`); return Promise.resolve(new Response(f.source)); })).toEqual(f.data);
});
test('table transport refuses corruption, truncation and extra bytes before publication', async () => {
  const f = fixture();
  for (const source of [f.source.slice(1), `${f.source} `, f.source.replace('kept', 'lost')]) {
    await expect(readAssetTables(f.asset.address, () => Promise.resolve(new Response(source)))).rejects.toThrow();
  }
});
test('matching bytes still require the table contract and a bounded build address', async () => {
  const asset = assetTableAsset(JSON.stringify({ bytes: {}, versions: {}, music: {}, sfx: {}, packs: { bad: { phone: { bytes: -1 } } } }));
  await expect(readAssetTables(asset.address, () => Promise.resolve(new Response(asset.source)))).rejects.toThrow('Invalid asset tables');
  await expect(readAssetTables({ ...asset.address, bytes: 17 * 1024 * 1024 }, () => { throw new Error('must not fetch'); })).rejects.toThrow('Invalid asset table address');
});

test('concurrent entry callers await one complete read before synchronous tables change', async () => {
  const f = fixture(), slot = Symbol.for('engine.asset-tables'), previous: unknown = Reflect.get(globalThis, slot);
  const before = { bytes: {}, versions: {}, music: {}, sfx: {}, packs: {} }; Reflect.set(globalThis, slot, before);
  let finish: (response: Response) => void = () => { throw new Error('read has not started'); };
  const response = new Promise<Response>(resolve => { finish = resolve; });
  const shared = { ...f.data, packs: {} }, common = assetTableAsset(JSON.stringify(shared));
  const read = vi.fn(() => Promise.resolve(new Response(f.source))).mockImplementationOnce(() => response);
  const globals: readonly (readonly [string, unknown])[] = [['document', { querySelector: () => null }], ['fetch', read],
    ['__BOOT_TABLE_ASSETS__', { common: common.address, all: f.asset.address, packs: { legacy: f.asset.address } }]];
  const originals = new Map(globals.map(([name]) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of globals) Reflect.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  try {
    const first = prepareAssetTables(), second = prepareAssetTables();
    expect(first).toBe(second); expect(read).toHaveBeenCalledTimes(1);
    expect(Reflect.get(globalThis, slot)).toBe(before);
    finish(new Response(common.source)); await first;
    expect(Reflect.get(globalThis, slot)).toEqual(shared);
    await prepareAssetPacks('unpacked'); expect(read).toHaveBeenCalledTimes(1);
    await prepareAssetPacks('legacy'); await prepareAssetPacks('legacy'); expect(read).toHaveBeenCalledTimes(2);
    expect(Reflect.get(globalThis, slot)).toEqual(f.data);
  } finally {
    Reflect.set(globalThis, slot, previous);
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name); else Reflect.defineProperty(globalThis, name, descriptor);
    }
  }
});

test('pack projection keeps shared facts exact and excludes another shard bank', () => {
  const f = fixture(), shared = { ...f.data, packs: {} }, other = { ...f.data, packs: { another: f.data.packs.legacy } };
  const banks = assetTableBanks(JSON.stringify({ common: JSON.stringify(shared), all: f.source,
    packs: { legacy: f.source, another: JSON.stringify(other) } }));
  expect(JSON.parse(banks.common.source)).toEqual(shared);
  expect(JSON.parse(banks.packs['legacy']?.source ?? '')).toEqual(f.data);
  expect(banks.packs['legacy']?.address).not.toEqual(banks.packs['another']?.address);
  expect(banks.all.source).toBe(f.source);
});
