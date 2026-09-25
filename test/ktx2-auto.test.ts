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
  it('the desktop has no KTX2 set: Auto is always images there', async () => {
    const { gf, sp, def } = await load({ tier: 'desktop' });
    expect(def && sp.ktx2Set(def)).toEqual([]);
    expect(gf.texMode()).toBe('img');
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
  it('every phone shard has one: the stand-ins its KTX2 boot declares + the transcoder, nothing else', async () => {
    const { CHUNKS, sp, chunkFiles } = await load();
    for (const def of CHUNKS) {
      const set = sp.ktx2Set(def);
      expect(set.length, def.slug).toBeGreaterThan(2);
      for (const u of set) expect(/^\/assets\/gpu\/|^\/basis\/r\d+\/basis_transcoder\.(js|wasm)$/.test(u), u).toBe(true);
      // every KTX2 file the KTX2 boot declares is in the set (a KTX2 boot then reads nothing the set lacks, offline too)
      for (const f of Object.values(chunkFiles(def, 'ktx2')).flat()) if (f.startsWith('/assets/gpu/')) expect(set, `${def.slug} ${f}`).toContain(f);
    }
  });
  it('the images boot declares no KTX2 file, and its lists are what they were before B (the packs do not change)', async () => {
    const { CHUNKS, chunkFiles } = await load();
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
