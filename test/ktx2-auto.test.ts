/**
 * E157 B — "images on the first visit, KTX2 from the next launch" (src/boot/gpuFiles.ts, src/boot/shardPrefetch.ts).
 * Settings ▸ Debug ▸ GPU textures: Auto loads KTX2 only when the shard's whole KTX2 set for the tier is cached (the marker
 * the background download writes names the set's hash); the explicit picks override. Resolved once per page.
 */
import { describe, expect, it, vi } from 'vitest';
import type * as ShardPrefetch from '../src/boot/shardPrefetch';
import type { ChunkDef } from '../src/chunks/ChunkDef';

type SP = typeof ShardPrefetch;

async function load(opts: { chunk?: string; tier?: 'phone' | 'desktop'; tex?: string; marker?: (sp: SP, CHUNKS: readonly ChunkDef[]) => [string, string] | null } = {}) {
  vi.resetModules();
  const chunk = opts.chunk ?? 'pine-hollow';
  vi.stubGlobal('location', new URL(`http://localhost:5173/?tier=${opts.tier ?? 'phone'}&chunk=${chunk}`));
  localStorage.clear();
  if (opts.tex !== undefined) localStorage.setItem('ws.settings.v1', JSON.stringify({ tex: opts.tex }));
  const [{ CHUNKS }, sp, gf, { chunkFiles }, { packFor, bootParts }] = await Promise.all([
    import('../src/chunks/registry'), import('../src/boot/shardPrefetch'), import('../src/boot/gpuFiles'), import('../src/boot/manifest'), import('../src/boot/pack'),
  ]);
  const m = opts.marker?.(sp, CHUNKS);
  if (m) localStorage.setItem(m[0], m[1]);
  return { CHUNKS, sp, gf, chunkFiles, packFor, bootParts, def: CHUNKS.find((c) => c.slug === chunk) };
}
const current = (sp: SP, CHUNKS: readonly ChunkDef[], slug = 'pine-hollow'): [string, string] | null => {
  const def = CHUNKS.find((c) => c.slug === slug);
  return def ? [sp.ktx2MarkerKey(slug), sp.setHash(sp.ktx2Set(def))] : null;
};

describe('Auto: images until the shard\'s KTX2 set is cached', () => {
  it('a first visit (no marker) loads images', async () => {
    const { gf } = await load();
    expect(gf.texModeWhy().mode).toBe('img');
  });
  it('the marker naming the current set → KTX2 from this load on', async () => {
    const { gf } = await load({ marker: current });
    expect(gf.texModeWhy()).toMatchObject({ mode: 'ktx2' });
  });
  it('a stale marker (another build\'s set) → images', async () => {
    const { gf } = await load({ marker: (sp) => [sp.ktx2MarkerKey('pine-hollow'), '1-deadbeef'] });
    expect(gf.texMode()).toBe('img');
  });
  it('another shard\'s marker does not count', async () => {
    const { gf } = await load({ marker: (sp, C) => current(sp, C, 'nalati-grasslands') });
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
    const phoneMarker = phone.sp.setHash(phone.sp.ktx2Set(def));
    const desk = await load({ tier: 'desktop', marker: (sp) => [sp.ktx2MarkerKey('pine-hollow'), phoneMarker] });
    expect(desk.sp.ktx2MarkerKey('pine-hollow')).not.toBe(phone.sp.ktx2MarkerKey('pine-hollow'));
    expect(desk.gf.texMode()).toBe('img');
  });
  it('is resolved once: a marker written mid-session changes nothing until the next load', async () => {
    const { gf, sp, CHUNKS } = await load();
    expect(gf.texMode()).toBe('img');
    const m = current(sp, CHUNKS);
    if (m) localStorage.setItem(m[0], m[1]);
    expect(gf.texMode()).toBe('img');
  });
});

describe('the explicit picks override Auto', () => {
  it('Images never loads KTX2, even with the set cached', async () => {
    const { gf } = await load({ tex: 'img', marker: current });
    expect(gf.texMode()).toBe('img');
  });
  it('KTX2 always loads KTX2, cached or not', async () => {
    const { gf } = await load({ tex: 'ktx2' });
    expect(gf.texMode()).toBe('ktx2');
  });
});

describe('the KTX2 sets', () => {
  it.each(['phone', 'desktop'] as const)('every %s shard has one: the stand-ins its KTX2 boot declares + the transcoder, nothing else', async (tier) => {
    const { CHUNKS, sp, chunkFiles } = await load({ tier });
    for (const def of CHUNKS) {
      const set = sp.ktx2Set(def);
      expect(set.length, def.slug).toBeGreaterThan(2);
      for (const u of set) expect(/^\/assets\/gpu\/|^\/basis\/r\d+\/basis_transcoder\.(js|wasm)$/.test(u), u).toBe(true);
      // every KTX2 file the KTX2 boot declares is in the set (a KTX2 boot then reads nothing the set lacks, offline too)
      for (const f of Object.values(chunkFiles(def, 'ktx2')).flat()) if (f.startsWith('/assets/gpu/')) expect(set, `${def.slug} ${f}`).toContain(f);
    }
  });
  it.each(['phone', 'desktop'] as const)('the %s images boot declares no KTX2 file, and its lists are what they were before B (the packs do not change)', async (tier) => {
    const { CHUNKS, chunkFiles } = await load({ tier });
    for (const def of CHUNKS) for (const f of Object.values(chunkFiles(def, 'img')).flat()) expect(f.startsWith('/assets/gpu/'), f).toBe(false);
  });
  it('a KTX2 boot streams only the pack parts that carry a file it declares', async () => {
    const { def, chunkFiles, packFor, bootParts } = await load({ tex: 'ktx2' });
    const pack = def ? packFor(def) : null;
    if (!def || !pack) throw new Error('no pack');
    const img = bootParts(pack, chunkFiles(def, 'img')), ktx = bootParts(pack, chunkFiles(def, 'ktx2'));
    expect(img.parts.length).toBe(pack.parts.length);
    expect(ktx.parts.length).toBeLessThanOrEqual(pack.parts.length);
    const declared = new Set(Object.values(chunkFiles(def, 'ktx2')).flat());
    for (const part of ktx.parts) expect(part.files.some(([p]) => declared.has(p))).toBe(true);
  });
  it('the set hash names the set (order-free) and changes with any file', async () => {
    const { sp } = await load();
    expect(sp.setHash(['/a', '/b'])).toBe(sp.setHash(['/b', '/a']));
    expect(sp.setHash(['/a', '/b'])).not.toBe(sp.setHash(['/a', '/c']));
  });
});

describe('the bake keeps no file a KTX2 set does not read (E173, scripts/bake-ktx2.mjs ARRAY_ONLY)', () => {
  const GPU = Object.keys(import.meta.glob('../public/assets/gpu/**/*', { query: '?url' })).map((k) => k.replace('../public', ''));
  const GLTF = import.meta.glob<string>('../public/assets/gpu/**/*.gltf', { query: '?raw', import: 'default', eager: true });
  const LIST = import.meta.glob<Record<string, unknown>>('../scripts/bake-ktx2.list.json', { import: 'default', eager: true });
  const dirOf = (p: string): string => p.slice(0, p.lastIndexOf('/'));
  /** `rel` against folder `dir`, as a URL resolves it */
  const join = (dir: string, rel: string): string => new URL(rel, `http://x${dir}/`).pathname;
  it('every file under /assets/gpu is in some tier\'s KTX2 set (a .gltf stand-in\'s textures with it)', async () => {
    const used = new Set<string>();
    for (const tier of ['phone', 'desktop'] as const) {
      const { CHUNKS, sp } = await load({ tier });
      for (const def of CHUNKS) for (const u of sp.ktx2Set(def)) used.add(u.split('?')[0] ?? u);
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
    const { CHUNKS, chunkFiles } = await load({ tier, tex: 'ktx2' });
    const list = Object.values(LIST)[0]?.[tier];
    const seen = new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    expect(seen.size).toBeGreaterThan(100);
    const raw = CHUNKS.flatMap((def) => Object.values(chunkFiles(def, 'ktx2')).flat()).filter((f) => /^\/assets\/tex\/.+\.(jpe?g|png|webp)$/.test(f) && seen.has(f));
    expect(raw).toEqual([]);
  });
});
