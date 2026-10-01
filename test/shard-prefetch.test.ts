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
  await initializeTier();
  const [{ SHARDS, playable }, sp, { bootFiles, extraFetches }, { bootFetches }, { packFor }, { versionedUrl }, { PACKS }] = await Promise.all([
    import('#game/shard/registry'),
    import('#engine/boot/shardPrefetch'),
    import('#engine/boot/extras'),
    import('#engine/boot/prefetch'),
    import('#engine/boot/pack'),
    import('#engine/boot/bytes'),
    import('#engine/boot/packs.generated'),
  ]);
  const { prepareShardAssets } = await import('#game/shard/load');
  const { registerGpuFiles } = await import('#engine/boot/gpuFiles');
  await Promise.all(SHARDS.map((m) => prepareShardAssets(m, registerGpuFiles)));
  const PLAYABLE_SHARDS = SHARDS.filter(playable);
  // The background downloader visits title cards, including experimental shards; hidden teaching shards are excluded.
  return { PLAYABLE_SHARDS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl, PACKS };
}

describe('shardBootRequests: the boot request list of each shard', () => {
  it.each(['phone', 'desktop'] as const)('counts public artwork and keeps inline artwork out of the %s download list', async (tier) => {
    const { PLAYABLE_SHARDS, bootFiles, sp, packFor, versionedUrl } = await load(tier);
    const { PUBLIC_BYTES } = await import('#engine/boot/bytes.generated');
    const { declareTotals } = await import('#engine/boot/bytes');
    const def = PLAYABLE_SHARDS[0];
    const image = Object.keys(PUBLIC_BYTES).find((path) => path.endsWith('.jpg'));
    if (def?.boot === undefined || image === undefined) throw new Error('needs a registered shard with boot declarations and a public JPEG fixture');
    const inline = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E';
    const precache: string[] = [];
    const fixture = { ...def, boot: { ...def.boot, precache } };
    const before = bootFiles(fixture, 'img');
    // A query still names the same public file; cards, Explore art and precache art share this inventory path.
    precache.push(`${image}?fixture=1`, image, inline);
    const files = bootFiles(fixture, 'img');
    expect(files.art).toContain(image);
    expect(files.art).not.toContain(new URL(inline).pathname);
    expect(files.art.filter((path) => path === image)).toHaveLength(1);
    const bytes: Readonly<Record<string, number>> = PUBLIC_BYTES;
    expect(declareTotals(files).art.bytes - declareTotals(before).art.bytes).toBe(before.art.includes(image) ? 0 : bytes[image]);
    const packed = packFor(fixture)?.files.some(([path]) => path === image) === true;
    expect(packed || sp.shardBootRequests(fixture, 'img').includes(versionedUrl(image))).toBe(true);
  });

  it('preserves active profile downloads while preparing the owning prefetch inventory', async () => {
    const { PLAYABLE_SHARDS, bootFiles } = await load('phone');
    const { prepareBootAudio } = await import('#engine/boot/audioInventory');
    const [{ createPineAudio }, { createNalatiAudio }, { createNdAudio }, { createDriftwoodAudio }] = await Promise.all([
      import('../src/shards/pine-hollow/audio/files'), import('../src/shards/nalati-grasslands/audio/files'),
      import('../src/shards/nine-dragon-stack/audio/files'), import('../src/shards/driftwood-isle/audio/files'),
    ]);
    for (const [slug, create] of [['pine-hollow', createPineAudio], ['nalati-grasslands', createNalatiAudio], ['nine-dragon-stack', createNdAudio], ['driftwood-isle', createDriftwoodAudio]] as const) {
      const def = PLAYABLE_SHARDS.find((row) => row.slug === slug);
      if (def === undefined) throw new Error(`Missing fixture shard ${slug}`);
      const profile = await create(), before = bootFiles(def, 'img', profile);
      await prepareBootAudio(def.boot);
      expect(bootFiles(def, 'img', profile), `${slug}: active downloads`).toEqual(before);
      const prefetched = bootFiles(def);
      expect({ music: prefetched.music, sfx: prefetched.sfx }, `${slug}: owning inventory`).toEqual(profile.files());
    }
  });
  for (const tier of ['phone', 'desktop'] as const) {
    it(`equals main.ts's own composition — ${tier} tier`, async () => {
      const { PLAYABLE_SHARDS, sp, bootFiles, extraFetches, bootFetches, packFor, versionedUrl } = await load(tier);
      for (const def of PLAYABLE_SHARDS) {
        const files = bootFiles(def);
        // Downloadable cards retain the landscape tier rule. SVG data URLs are bundled and never fetched.
        const artPath = (url: string): string => new URL(url, location.href).pathname;
        // A shard may reuse its thumbnail as its landscape: the same path is required by either role.
        const neededArt = new Set([
          ...PLAYABLE_SHARDS.flatMap((card) => [card.card.thumb, card.card.portrait, ...(tier === 'desktop' || card === def ? [card.card.landscape] : [])]),
          ...(def.boot?.explore?.art ?? []), ...(def.boot?.precache ?? []),
        ].filter((url) => !url.startsWith('data:')).map(artPath));
        for (const card of PLAYABLE_SHARDS) {
          for (const image of [card.card.thumb, card.card.portrait]) {
            expect(files.art.includes(artPath(image)), `${card.slug}: ${image}`).toBe(!image.startsWith('data:'));
          }
          expect(files.art.includes(artPath(card.card.landscape)), `${card.slug}: required landscape path`).toBe(neededArt.has(artPath(card.card.landscape)));
        }
        for (const image of def.boot?.explore?.art ?? []) expect(files.art.includes(new URL(image, location.href).pathname)).toBe(!image.startsWith('data:'));
        for (const other of PLAYABLE_SHARDS) if (other !== def) for (const image of other.boot?.explore?.art ?? []) {
          if (!neededArt.has(artPath(image))) expect(files.art).not.toContain(artPath(image));
        }
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
    // Packs are generated only where assets are authored; asset-free experimental shards boot per file.
    for (const def of phone.PLAYABLE_SHARDS) {
      const pack = phone.packFor(def);
      expect(pack, `${def.slug}: phone pack inventory`).toEqual(phone.PACKS[def.slug]?.['phone'] ?? null);
      if (pack) expect(phone.sp.shardBootRequests(def).slice(0, pack.parts.length)).toEqual(pack.parts.map((part) => part.url));
    }
    const desktop = await load('desktop');
    for (const def of desktop.PLAYABLE_SHARDS) {
      const pack = desktop.PACKS[def.slug]?.['desktop'];
      expect(desktop.packFor(def), `${def.slug}: desktop pack inventory`).toEqual(pack ?? null);
      expect(desktop.sp.shardBootRequests(def).some((u) => u.startsWith('/assets/packs/'))).toBe((pack?.parts.length ?? 0) > 0);
    }
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
      const { PLAYABLE_SHARDS, sp, versionedUrl } = await load(tier);
      const { PUBLIC_BYTES } = await import('#engine/boot/bytes.generated');
      for (const def of PLAYABLE_SHARDS) {
        const late = sp.lateReads(def);
        for (const u of late) expect(new URL(u, 'http://x').pathname in PUBLIC_BYTES, `${def.slug} ${u}`).toBe(true);
        if (def.load === undefined) expect(late.length, `${def.slug} (${tier})`).toBeGreaterThan(3);
        else expect(late, `${def.slug} (${tier}): only declared late reads`).toEqual((def.boot?.lateReads?.(tier) ?? []).map(versionedUrl));
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
