/**
 * E158 — the background download of the other shards (src/engine/boot/shardPrefetch.ts). The list it fetches must be the list a
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
  const { initializeTier } = await import('#engine/core/tier');
  initializeTier();
  const [{ SHARDS, playable }, sp, { bootFiles, extraFetches }, { bootFetches }, { packFor }, { versionedUrl }] = await Promise.all([
    import('#game/shard/registry'),
    import('#engine/boot/shardPrefetch'),
    import('#engine/boot/extras'),
    import('#engine/boot/prefetch'),
    import('#engine/boot/pack'),
    import('#engine/boot/bytes'),
  ]);
  const { prepareShardAssets } = await import('#game/shard/load');
  const { registerGpuFiles } = await import('#engine/boot/gpuFiles');
  await Promise.all(SHARDS.map((m) => prepareShardAssets(m, registerGpuFiles)));
  const PLAYABLE_SHARDS = SHARDS.filter(playable);
  return { PLAYABLE_SHARDS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl };
}

describe('shardBootRequests: the boot request list of each shard', () => {
  for (const tier of ['phone', 'desktop'] as const) {
    it(`equals main.ts's own composition — ${tier} tier`, async () => {
      const { PLAYABLE_SHARDS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl } = await load(tier);
      for (const def of PLAYABLE_SHARDS) {
        const files = bootFiles(def);
        // The moved art paths keep the phone's existing landscape exclusion and every portrait/thumbnail.
        for (const card of PLAYABLE_SHARDS) {
          const artPath = (url: string): string => new URL(url, location.href).pathname;
          expect(files.art).toContain(artPath(card.card.thumb));
          expect(files.art).toContain(artPath(card.card.portrait));
          expect(files.art.includes(artPath(card.card.landscape))).toBe(tier === 'desktop' || card.slug === def.slug);
        }
        expect(files.art.some((url) => url.includes('/explore/'))).toBe(def.ocean !== undefined);
        const pack = packFor(def);
        const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
        // main.ts: streamPack(pack) · prefetch(bootFetches(...) minus packed) · prefetchAfter(extraFetches(files)) — and the
        // physics source (Rapier's WASM, the navmesh) fetched by src/engine/physics at boot
        const boot = new Set([
          ...(pack ? pack.parts.map((part) => part.url) : []),
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

  it('names phone pack parts first and migrated desktop packs where authored', async () => {
    const phone = await load('phone');
    expect(phone.PLAYABLE_SHARDS.filter((d) => phone.packFor(d) !== null).length).toBe(phone.PLAYABLE_SHARDS.length); // every shard has a phone pack
    for (const def of phone.PLAYABLE_SHARDS) {
      const pack = phone.packFor(def);
      if (pack) expect(phone.sp.shardBootRequests(def).slice(0, pack.parts.length)).toEqual(pack.parts.map((part) => part.url));
    }
    const desktop = await load('desktop');
    for (const def of desktop.PLAYABLE_SHARDS) expect(desktop.sp.shardBootRequests(def).some((u) => u.startsWith('/assets/packs/'))).toBe(def.load !== undefined);
  });
});

describe('prefetchVeto: when the background download must not run', () => {
  it('runs by default under a controlling worker', async () => {
    const { sp } = await load('desktop');
    expect(sp.prefetchVeto({ controlled: true })).toBeNull();
    expect(sp.prefetchVeto({ off: false, controlled: true, saveData: false })).toBeNull();
  });
  it('is off by the Debug switch, without a worker and on the OS data saver — never by connection type', async () => {
    const { sp } = await load('desktop');
    expect(sp.prefetchVeto({ off: true, controlled: true })).toBe('switched off (Settings ▸ Debug)');
    expect(sp.prefetchVeto({ controlled: false })).toBe('no service worker');
    expect(sp.prefetchVeto({ controlled: true, saveData: true })).toBe('Save-Data');
  });
});

describe('lateReads and the ?v= URLs (E160)', () => {
  it('names only files the build ships, tier by tier', async () => {
    for (const tier of ['phone', 'desktop'] as const) {
      const { PLAYABLE_SHARDS, sp } = await load(tier);
      const { PUBLIC_BYTES } = await import('#engine/boot/bytes.generated');
      for (const def of PLAYABLE_SHARDS) {
        const late = sp.lateReads(def);
        for (const u of late) expect(new URL(u, 'http://x').pathname in PUBLIC_BYTES, `${def.slug} ${u}`).toBe(true);
        if (def.load === undefined) expect(late.length, `${def.slug} (${tier})`).toBeGreaterThan(3);
        else expect(late, `${def.slug} (${tier}): all declared world reads are at boot`).toEqual([]);
      }
    }
  });
  it('versions every unhashed asset and leaves content-named ones alone', async () => {
    const { versionedUrl } = await load('desktop');
    const { ASSET_VERSIONS } = await import('#engine/boot/versions.generated');
    const { PUBLIC_BYTES } = await import('#engine/boot/bytes.generated');
    for (const p of Object.keys(PUBLIC_BYTES)) {
      const u = versionedUrl(p);
      if (/-[0-9a-f]{8}\.[a-z0-9]+$/.test(p)) expect(u, p).toBe(p);
      else expect(u, p).toBe(`${p}?v=${ASSET_VERSIONS[p] ?? ''}`);
    }
    expect(versionedUrl('/assets/packs/pine-hollow.phone-12345678.bin')).toBe('/assets/packs/pine-hollow.phone-12345678.bin');
    expect(versionedUrl('/assets/tex/x.jpg?v=1')).toBe('/assets/tex/x.jpg?v=1');
  });
});
