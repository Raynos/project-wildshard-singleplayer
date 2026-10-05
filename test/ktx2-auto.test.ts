import { saveFixture } from './fake/saveFixture';
/**
 * E157 B — "images on the first visit, KTX2 from the next launch" (src/engine/boot/gpuFiles.ts, src/engine/boot/shardPrefetch.ts).
 * Settings ▸ Debug ▸ GPU textures: Auto loads KTX2 only when the shard's whole KTX2 set for the tier is cached (the marker
 * the background download writes names the set's hash); the explicit picks override. Resolved once per page.
 */
import { describe, expect, it } from 'vitest';
import type { ShardManifest } from '../src/game/shard/manifest';
import { SHARDS } from '../src/shards.generated';
import { findChunk, playable, setActiveChunk } from '../src/game/shard/registry';
import { prepareShardAssets } from '../src/game/shard/load';
import { ART_URL_BYTES } from '../src/game/shard/art.generated';
import { initializeTier } from '../src/engine/core/tier';
import * as sp from '../src/engine/boot/shardPrefetch';
import * as gf from '../src/engine/boot/gpuFiles';
import { chunkFiles } from '../src/engine/boot/manifest';
import { bootParts, packFor } from '../src/engine/boot/pack';
import { setBootCatalog } from '../src/engine/boot/catalog';
import { OPTION_VALUES, saveSetting } from '../src/engine/ui/Settings';

type SP = typeof sp;
// Unadmitted descriptors carry picker metadata. Their immutable KTX2 files enter the separate shardfile admission path.
const LEGACY_SHARDS = SHARDS.filter((manifest) => manifest.shardfile === undefined);
const texPick = (v: string | undefined): (typeof OPTION_VALUES.tex)[number] => OPTION_VALUES.tex.find((x) => x === v) ?? 'auto';

/**
 * A page load on a tier and a shard: the tier picked explicitly (initializeTier's named form), the GPU-textures pick saved
 * through Settings, the level selected, and the texture mode resolved afresh (setTexturePolicy) — not a module reload (E422).
 */
/** a shard whose phone tier sets no texture policy, so Auto's own rule shows (Pine's phone boots KTX2 by policy, G180) */
const AUTO_SHARD = 'driftwood-isle';
async function load(opts: { chunk?: string; tier?: 'phone' | 'desktop'; tex?: string; marker?: (prefetch: SP, playable: readonly ShardManifest[]) => [string, string] | null } = {}) {
  const chunk = opts.chunk ?? AUTO_SHARD, tier = opts.tier ?? 'phone';
  localStorage.clear();
  saveSetting('tex', texPick(opts.tex));
  initializeTier(tier);
  await Promise.all(SHARDS.map((m) => prepareShardAssets(m, gf.registerGpuFiles)));
  // E405: the session installs the registry into the engine's boot catalog; so does the test
  setActiveChunk(chunk); // the running level, as the composition root selects it
  setBootCatalog({ levels: SHARDS, playable: SHARDS.filter(playable), find: findChunk, artBytes: ART_URL_BYTES });
  const PLAYABLE_SHARDS = SHARDS.filter(playable);
  const selected = SHARDS.find((manifest) => manifest.slug === chunk);
  gf.setTexturePolicy(selected?.tiers?.[tier]?.textures, chunk);
  const m = opts.marker?.(sp, PLAYABLE_SHARDS);
  if (m) saveFixture('device', 'ktx2set', { [m[0].slice('ktx2set:'.length)]: m[1] });
  return { SHARDS, PLAYABLE_SHARDS, sp, gf, chunkFiles, packFor, bootParts, def: PLAYABLE_SHARDS.find((c) => c.slug === chunk) };
}
const current = (prefetch: SP, shards: readonly ShardManifest[], slug = AUTO_SHARD): [string, string] | null => {
  const def = shards.find((c) => c.slug === slug);
  return def ? [prefetch.ktx2MarkerKey(slug), prefetch.setHash(prefetch.ktx2Set(def))] : null;
};

describe('Auto: images until the shard\'s KTX2 set is cached', () => {
  it('Nine Dragon Auto uses images on phones while the compressed upload crash is isolated', async () => {
    const phone = await load({ chunk: 'nine-dragon-stack', tier: 'phone' });
    expect(phone.gf.texModeWhy()).toMatchObject({ mode: 'img' });
    const cachedPhone = await load({ chunk: 'nine-dragon-stack', tier: 'phone', marker: (p, C) => current(p, C, 'nine-dragon-stack') });
    expect(cachedPhone.gf.texModeWhy()).toMatchObject({ mode: 'img' });
    const desktop = await load({ chunk: 'nine-dragon-stack', tier: 'desktop' });
    expect(desktop.gf.texMode()).toBe('img');
  });
  it('Pine Hollow\'s phone boots KTX2 from the first visit by its level policy (G180); its desktop keeps Auto\'s rule', async () => {
    const phone = await load({ chunk: 'pine-hollow', tier: 'phone' });
    expect(phone.gf.texModeWhy()).toMatchObject({ mode: 'ktx2', why: 'auto: level tier texture policy' });
    const desktop = await load({ chunk: 'pine-hollow', tier: 'desktop' });
    expect(desktop.gf.texMode()).toBe('img');
    const picked = await load({ chunk: 'pine-hollow', tier: 'phone', tex: 'img' });
    expect(picked.gf.texMode()).toBe('img');
  });
  it('a first visit (no marker) loads images', async () => {
    await load();
    expect(gf.texModeWhy().mode).toBe('img');
  });
  it('the marker naming the current set → KTX2 from this load on', async () => {
    await load({ marker: current });
    expect(gf.texModeWhy()).toMatchObject({ mode: 'ktx2' });
  });
  it('a stale marker (another build\'s set) → images', async () => {
    await load({ marker: (p) => [p.ktx2MarkerKey(AUTO_SHARD), '1-deadbeef'] });
    expect(gf.texMode()).toBe('img');
  });
  it('another shard\'s marker does not count', async () => {
    await load({ marker: (p, C) => current(p, C, 'nalati-grasslands') });
    expect(gf.texMode()).toBe('img');
  });
  it('the desktop behaves the same (E173): images on the first visit, KTX2 once its own set is cached', async () => {
    const first = await load({ tier: 'desktop' });
    if (!first.def) throw new Error('no def');
    expect(first.sp.ktx2Set(first.def).length).toBeGreaterThan(2);
    expect(first.gf.texMode()).toBe('img');
    const cached = await load({ tier: 'desktop', marker: current });
    expect(cached.gf.texModeWhy()).toMatchObject({ mode: 'ktx2' });
  });
  it('a marker is per tier: the phone\'s set does not stand in for the desktop\'s', async () => {
    const phone = await load();
    const def = phone.def;
    if (!def) throw new Error('no def');
    const phoneMarker = phone.sp.setHash(phone.sp.ktx2Set(def)), phoneKey = phone.sp.ktx2MarkerKey(AUTO_SHARD);
    const desk = await load({ tier: 'desktop', marker: (p) => [p.ktx2MarkerKey(AUTO_SHARD), phoneMarker] });
    expect(desk.sp.ktx2MarkerKey(AUTO_SHARD)).not.toBe(phoneKey);
    expect(desk.gf.texMode()).toBe('img');
  });
  it('is resolved once: a marker written mid-session changes nothing until the next load', async () => {
    const { PLAYABLE_SHARDS } = await load();
    expect(gf.texMode()).toBe('img');
    const m = current(sp, PLAYABLE_SHARDS);
    if (m) saveFixture('device', 'ktx2set', { [m[0].slice('ktx2set:'.length)]: m[1] });
    expect(gf.texMode()).toBe('img');
  });
});

describe('the explicit picks override Auto', () => {
  it('Images never loads KTX2, even with the set cached', async () => {
    await load({ tex: 'img', marker: current });
    expect(gf.texMode()).toBe('img');
  });
  it('KTX2 always loads KTX2, cached or not', async () => {
    await load({ tex: 'ktx2' });
    expect(gf.texMode()).toBe('ktx2');
  });
});

describe('the KTX2 sets', () => {
  it.each(['phone', 'desktop'] as const)('every %s shard has the KTX2 stand-ins it declares + the transcoder, or an empty set without GPU assets', async (tier) => {
    await load({ tier });
    // Include experimental and hidden shards: assets and KTX2 mappings are optional for either.
    for (const def of SHARDS.filter((manifest) => manifest.shardfile !== undefined)) expect(def.boot).toBeUndefined();
    for (const def of LEGACY_SHARDS) {
      const set = sp.ktx2Set(def);
      const gpu = [...Object.values(chunkFiles(def, 'ktx2')).flat(), ...sp.lateReads(def, 'ktx2')].filter((url) => url.startsWith('/assets/gpu/'));
      if (gpu.length === 0) {
        expect(set, def.slug).toEqual([]);
        expect(sp.ktx2Ready(def), `${def.slug}: no empty-set cache hit`).toBe(false);
      } else {
        expect(set.length, def.slug).toBeGreaterThan(2);
        expect(set.filter((url) => url.startsWith('/assets/gpu/')).sort(), def.slug).toEqual([...new Set(gpu)].sort());
        expect(set.some((url) => url.endsWith('/basis_transcoder.js')), def.slug).toBe(true);
        expect(set.some((url) => url.endsWith('/basis_transcoder.wasm')), def.slug).toBe(true);
      }
      for (const u of set) expect(/^\/assets\/gpu\/|^\/basis\/r\d+\/basis_transcoder\.(js|wasm)$/.test(u), u).toBe(true);
      // every KTX2 file the KTX2 boot declares is in the set (a KTX2 boot then reads nothing the set lacks, offline too)
      for (const f of Object.values(chunkFiles(def, 'ktx2')).flat()) if (f.startsWith('/assets/gpu/')) expect(set, `${def.slug} ${f}`).toContain(f);
    }
  });
  it.each(['phone', 'desktop'] as const)('the %s images boot declares no KTX2 file, and its lists are what they were before B (the packs do not change)', async (tier) => {
    const { PLAYABLE_SHARDS } = await load({ tier });
    for (const def of PLAYABLE_SHARDS) for (const f of Object.values(chunkFiles(def, 'img')).flat()) expect(f.startsWith('/assets/gpu/'), f).toBe(false);
  });
  it('a KTX2 boot streams only the pack parts that carry a file it declares', async () => {
    const { def } = await load({ tex: 'ktx2' });
    const pack = def ? packFor(def) : null;
    if (!def || !pack) throw new Error('no pack');
    const img = bootParts(pack, chunkFiles(def, 'img')), ktx = bootParts(pack, chunkFiles(def, 'ktx2'));
    expect(img.parts.length).toBe(pack.parts.length);
    expect(ktx.parts.length).toBeLessThanOrEqual(pack.parts.length);
    const declared = new Set(Object.values(chunkFiles(def, 'ktx2')).flat());
    for (const part of ktx.parts) expect(part.files.some(([p]) => declared.has(p))).toBe(true);
  });
  it('the set hash names the set (order-free) and changes with any file', async () => {
    await load();
    expect(sp.setHash(['/a', '/b'])).toBe(sp.setHash(['/b', '/a']));
    expect(sp.setHash(['/a', '/b'])).not.toBe(sp.setHash(['/a', '/c']));
  });
});

describe('the bake keeps no file a KTX2 set does not read (E173, scripts/bake-ktx2.mjs ARRAY_ONLY)', () => {
  const GPU_FILES = import.meta.glob('../public/assets/gpu/**/*', { query: '?url' });
  expect(Object.keys(GPU_FILES).length).toBeGreaterThan(0);
  const GPU = Object.keys(GPU_FILES).map((k) => k.replace('../public', ''));
  const GLTF = import.meta.glob<string>('../public/assets/gpu/**/*.gltf', { query: '?raw', import: 'default', eager: true });
  expect(Object.keys(GLTF).length).toBeGreaterThan(0);
  const LIST = import.meta.glob<Record<string, unknown>>('../scripts/bake-ktx2.list.json', { import: 'default', eager: true });
  expect(Object.keys(LIST).length).toBeGreaterThan(0);
  const dirOf = (p: string): string => p.slice(0, p.lastIndexOf('/'));
  /** `rel` against folder `dir`, as a URL resolves it */
  const join = (dir: string, rel: string): string => new URL(rel, `http://x${dir}/`).pathname;
  it('every file under /assets/gpu is in some tier\'s KTX2 set (a .gltf stand-in\'s textures with it)', async () => {
    const used = new Set<string>();
    for (const tier of ['phone', 'desktop'] as const) {
      await load({ tier });
      for (const def of LEGACY_SHARDS) for (const u of sp.ktx2Set(def)) used.add(u.split('?')[0] ?? u);
    }
    for (const u of used) { // the textures a .gltf adds are .ktx2: visited, never expanded
      const raw = GLTF[`../public${u}`];
      if (raw === undefined) continue;
      const json = JSON.parse(raw) as { images?: { uri?: string }[] };
      // its images are relative to the ORIGINAL .gltf's folder (GLTFLoader resolves against the URL it asked for)
      const from = dirOf(u.replace(/^\/assets\/gpu\//, '/assets/'));
      for (const im of json.images ?? []) if (im.uri !== undefined) used.add(join(from, im.uri));
    }
    expect(GPU.length).toBeGreaterThan(100);
    expect(GPU.filter((f) => !used.has(f))).toEqual([]);
  });
  it.each(['phone', 'desktop'] as const)('a %s KTX2 boot declares no texture the bake could have stood in for (an ARRAY_ONLY set read by a plain loader)', async (tier) => {
    const { PLAYABLE_SHARDS } = await load({ tier, tex: 'ktx2' });
    const list = Object.values(LIST)[0]?.[tier];
    const seen = new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    expect(seen.size).toBeGreaterThan(100);
    const raw = PLAYABLE_SHARDS.flatMap((def) => Object.values(chunkFiles(def, 'ktx2')).flat()).filter((f) => /^\/assets\/tex\/.+\.(jpe?g|png|webp)$/.test(f) && seen.has(f));
    expect(raw).toEqual([]);
  });
});
