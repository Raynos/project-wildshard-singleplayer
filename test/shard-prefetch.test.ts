/**
 * E158 — the background download of the other shards (src/boot/shardPrefetch.ts). The list it fetches must be the list a
 * boot of that shard requests on this tier, or the first switch downloads what the prefetch missed (or the prefetch fills
 * the cache with files no boot reads). main.ts composes a boot's requests from four sources: the shard's pack (packFor),
 * the per-file world reads the pack does not carry (bootFetches), the art + audio queue (extraFetches) and the physics
 * files Rapier / the navmesh fetch themselves. The prefetch list is derived differently (every declared file, minus the
 * packed ones, plus the pack) — these tests hold the two equal, per shard and per tier.
 */
import { describe, expect, it, vi } from 'vitest';

async function load(tier: 'phone' | 'desktop') {
  vi.resetModules();
  vi.stubGlobal('location', new URL(`http://localhost:5173/?tier=${tier}`));
  const [{ CHUNKS }, sp, { bootFiles, extraFetches }, { bootFetches }, { packFor }, { versionedUrl }] = await Promise.all([
    import('../src/chunks/registry'),
    import('../src/boot/shardPrefetch'),
    import('../src/boot/extras'),
    import('../src/boot/prefetch'),
    import('../src/boot/pack'),
    import('../src/boot/bytes'),
  ]);
  return { CHUNKS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl };
}

describe('shardBootRequests: the boot request list of each shard', () => {
  for (const tier of ['phone', 'desktop'] as const) {
    it(`equals main.ts's own composition — ${tier} tier`, async () => {
      const { CHUNKS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl } = await load(tier);
      for (const def of CHUNKS) {
        const files = bootFiles(def);
        const pack = packFor(def);
        const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
        // main.ts: streamPack(pack) · prefetch(bootFetches(...) minus packed) · prefetchAfter(extraFetches(files)) — and the
        // physics source (Rapier's WASM, the navmesh) fetched by src/physics at boot
        const boot = new Set([
          ...(pack ? [pack.url] : []),
          ...bootFetches(def, files).filter((p) => !packed.has(p)),
          ...extraFetches(files),
          ...files.physics,
        ].map(versionedUrl));
        const list = sp.shardBootRequests(def);
        expect(new Set(list), `${def.slug} (${tier})`).toEqual(boot);
        expect(list.length, `${def.slug}: no duplicates`).toBe(new Set(list).size);
        // every declared file is reachable: either packed or requested on its own (plan.done() needs 100 % DOWNLOAD)
        for (const f of Object.values(files).flat()) expect(packed.has(f) || list.includes(versionedUrl(f)), `${def.slug} ${f}`).toBe(true);
      }
    });
  }

  it('names the tier pack on the phone and none on the desktop', async () => {
    const phone = await load('phone');
    expect(phone.CHUNKS.filter((d) => phone.packFor(d) !== null).length).toBe(phone.CHUNKS.length); // every shard has a phone pack
    for (const def of phone.CHUNKS) {
      const pack = phone.packFor(def);
      if (pack) expect(phone.sp.shardBootRequests(def)[0]).toBe(pack.url);
    }
    const desktop = await load('desktop');
    for (const def of desktop.CHUNKS) expect(desktop.sp.shardBootRequests(def).some((u) => u.startsWith('/assets/packs/'))).toBe(false);
  });
});

describe('prefetchVeto: when the background download must not run', () => {
  it('runs by default under a controlling worker', async () => {
    const { sp } = await load('desktop');
    expect(sp.prefetchVeto({ search: '', controlled: true })).toBeNull();
    expect(sp.prefetchVeto({ search: '?chunk=pine-hollow&prefetch=1', controlled: true, saveData: false })).toBeNull();
  });
  it('is off with ?prefetch=0, without a worker and on the OS data saver — never by connection type', async () => {
    const { sp } = await load('desktop');
    expect(sp.prefetchVeto({ search: '?prefetch=0', controlled: true })).toBe('?prefetch=0');
    expect(sp.prefetchVeto({ search: '', controlled: false })).toBe('no service worker');
    expect(sp.prefetchVeto({ search: '', controlled: true, saveData: true })).toBe('Save-Data');
  });
});
