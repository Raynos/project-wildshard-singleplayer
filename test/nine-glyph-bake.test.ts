import { expect, test } from 'vitest';
import { DataTexture, RGFormat, UnsignedByteType } from 'three';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import baseline from './fixtures/nine-glyphs.json' with { type: 'json' };
import { FONT_CHARS, WORDS } from '../src/shards/nine-dragon-stack/generators/words';
import signRows from '../src/shards/nine-dragon-stack/data/signView.json' with { type: 'json' };
import profiles from '../src/shards/nine-dragon-stack/data/specimenProfiles.json' with { type: 'json' };
import { GLYPH_LAYOUT } from '../src/shards/nine-dragon-stack/generators/signs';


function blob(name: string): Uint8Array {
  const row = output.namedFiles.find(file => file.name === name), bytes = row === undefined ? undefined : output.assets.get(row.hash);
  if (bytes === undefined) throw new Error(`Missing admitted Nine glyph blob ${name}`);
  return bytes;
}
const files = { file: (name: string): Promise<Uint8Array> => Promise.resolve(blob(name)) };
async function loadGlyphField(tier: string, sourceFiles: { readonly file: (name: string) => Promise<Uint8Array> }) {
  const [{ KTX2Loader }, v] = await Promise.all([import('three/addons/loaders/KTX2Loader.js'), import('valibot')]);
  const meta = v.parse(v.object({ words: v.array(v.string()), layout: v.object({ cell: v.number(), fontPx: v.number(), spread: v.number(), skeletonSpread: v.number() }),
    rects: v.record(v.string(), v.object({ u0: v.number(), v0: v.number(), u1: v.number(), v1: v.number() })) }),
  JSON.parse(new TextDecoder().decode(await sourceFiles.file(`signs/glyphs-${tier}.json`))));
  const loader = new KTX2Loader(), bytes = await sourceFiles.file(`signs/glyphs-${tier}.ktx2`);
  loader.workerConfig = { astcSupported: false, astcHDRSupported: false, etc1Supported: false, etc2Supported: false, dxtSupported: false, bptcSupported: false, pvrtcSupported: false };
  const texture: unknown = await new Promise((resolve, reject) => { loader.parse(Uint8Array.from(bytes).buffer, resolve, reject); });
  loader.dispose(); if (!(texture instanceof DataTexture)) throw new Error('Glyph KTX2 must decode as RG8');
  return { texture, ...meta, chars: Object.keys(meta.rects).join(''), rect: (ch: string) => {
    const rect = meta.rects[ch]; if (rect === undefined) throw new Error(`glyph atlas has no ${ch}`); return rect;
  } };
}

async function hash(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');
}

for (const tier of ['phone', 'desktop'] as const) {
  test(`${tier} admitted glyph pixels and metrics match the original runtime byte for byte`, async () => {
    const field = await loadGlyphField(tier, files), before = baseline[tier];
    const pixels = field.texture.image.data;
    if (!(pixels instanceof Uint8Array)) throw new Error('Glyph pixels must remain RG8 bytes');
    expect(await hash(pixels)).toBe(before.pixelHash);
    expect(field.texture.image.width).toBe(before.size);
    expect(field.texture.image.height).toBe(before.size);
    expect(field.layout).toEqual(GLYPH_LAYOUT[tier]); expect(field.chars).toBe(FONT_CHARS); expect(field.words).toEqual(WORDS);
    const rects = Object.fromEntries(Array.from(FONT_CHARS, char => [char, field.rect(char)]));
    expect(await hash(new TextEncoder().encode(JSON.stringify(rects)))).toBe(before.rectHash);
    const wire = output.namedFiles.find(file => file.name === `signs/glyphs-${tier}.ktx2`);
    expect(wire?.decoded).toBe(before.size * before.size * 2);
    expect(wire?.compressed).toBeLessThan(1_000_000);
    expect(field.texture.format).toBe(RGFormat); expect(field.texture.type).toBe(UnsignedByteType);
    expect(() => field.rect('🦊')).toThrow('glyph atlas has no');
    field.texture.dispose();
  });
}

test('separate worlds own separate glyph textures and decoded pixel arrays', async () => {
  const a = await loadGlyphField('phone', files), b = await loadGlyphField('phone', files);
  expect(a.texture === b.texture).toBe(false); expect(a.texture.image.data === b.texture.image.data).toBe(false);
  const left = a.texture.image.data, right = b.texture.image.data;
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) throw new Error('Glyph pixels must be RG8 bytes');
  const before = right[0]; if (before === undefined) throw new Error('Missing atlas pixel');
  left[0] = before ^ 255;
  expect(right[0]).toBe(before);
  a.texture.dispose(); b.texture.dispose();
});

// Frozen from the native value modules at 8ae50cee, before their data conversion.
test('native sign and specimen rows retain every original field and variant', async () => {
  expect(await hash(new TextEncoder().encode(JSON.stringify(signRows)))).toBe('2ddce64ffdb9b04796510400ce8a60878b29b57fb29bdd376b560f4bacb5da6a');
  expect(await hash(new TextEncoder().encode(JSON.stringify(profiles)))).toBe('a5f52084d05ed660db16e678c06dbaa4401600ec47a5de23cc842fb2094dc2aa');
});

test('baked neon pools retain readable gains and complete picking rows', async () => {
  const [{ GLTFLoader }, v] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('valibot')]);
  const rows = v.parse(v.object({ pools: v.array(v.object({ name: v.string(), parts: v.array(v.string()) })),
    neonLights: v.array(v.unknown()), copies: v.array(v.object({ neon: v.boolean(), boxes: v.array(v.number()), poses: v.array(v.unknown()) })) }),
  JSON.parse(new TextDecoder().decode(blob('signs/atlas-phone.json'))));
  const pool = rows.pools.find(row => row.parts.includes('neon-world-boards'));
  if (pool === undefined) throw new Error('Missing world neon pool');
  const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(blob(pool.name)).buffer, '');
  const { Mesh, BufferGeometry, BufferAttribute, Material } = await import('three');
  const mesh = loaded.scene.getObjectByName('neon-world-boards');
  if (!(mesh instanceof Mesh)) throw new Error('Missing native neon boards');
  const geometry: unknown = mesh.geometry;
  if (!(geometry instanceof BufferGeometry)) throw new Error('Missing native neon geometry');
  const gains: unknown = geometry.getAttribute('_neon_ap');
  if (!(gains instanceof BufferAttribute)) throw new Error('Missing neon gain channel');
  for (let i = 0; i < gains.count; i++) expect(gains.getX(i)).toBeGreaterThan(0);
  expect(gains.getX(0)).toBeLessThan(20);
  const copies = rows.copies.find(row => row.neon);
  expect(copies?.poses.length).toBe(rows.neonLights.length);
  expect(copies?.boxes.length).toBe(rows.neonLights.length * 6);
  const positions: unknown = geometry.getAttribute('position');
  if (!(positions instanceof BufferAttribute)) throw new Error('Missing neon positions');
  expect(positions.count).toBe(rows.neonLights.length * 24);
  loaded.scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const shape: unknown = node.geometry, surface: unknown = node.material;
    if (shape instanceof BufferGeometry) shape.dispose();
    if (surface instanceof Material) surface.dispose();
    else if (Array.isArray(surface)) for (const entry of surface) if (entry instanceof Material) entry.dispose();
  });
});
