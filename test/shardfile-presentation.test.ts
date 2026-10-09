// oxlint-disable-next-line import/no-nodejs-modules -- Exact content hashes for the immutable fixture bytes.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { assetCost } from '../src/sdk/assets';
import { parseShardfile, ShardfileSchema } from '../src/game/shardfile/schema';
import { schemaInventory } from '../scripts/docs/schema-reference.mjs';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { parseStillImage, STILL_IMAGE_LIMITS, stillImageUrl } from '../src/game/shardfile/stillImage';
import { sourceManifest } from '../src/game/shardfile/sourceManifest';
import { emptyShardfileSource, installManifestShardfile, shardfileSource } from '../src/game/shardfile/loader';

// Actual lossless PNG and encoded JPEG/WebP of the same 2x3 fixture, emitted once by the SDK's pinned sharp.
const images = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGOQ17f/D8IMGAwAdVcJSW4CyU8AAAAASUVORK5CYII=',
  jpeg: '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIeAaK//2Q==',
  webp: 'UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAMAAUAmJYwCdAFAAAD++b4XAkrVm6WHJtcxAAA=',
};
const bytesOf = (encoded: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(encoded), character => character.codePointAt(0) ?? 0);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const bytes = bytesOf(images.png), ref = hash(bytes), cost = assetCost('image', bytes);
  const base = emptyShardfile({ slug: 'template', name: 'Card fixture', author: 'Fixture', seed: 1, revision: 1 });
  const source = parseShardfile({ ...base, presentation: { biome: 'Temperate woods', blurb: 'A card made from admitted data.', card: { thumb: ref, portrait: ref, landscape: ref } },
    files: [{ hash: ref, kind: 'image', compressed: bytes.length, ...cost, dependencies: [], critical: false }], library: [ref],
    budgets: { ...base.budgets, library: { resident: cost.decoded + cost.gpu, compressed: bytes.length } } });
  return { base, source, bytes, ref, cost, assets: new Map([[ref, bytes]]) };
}

it('the defining-schema reference includes every presentation field and the image asset kind', () => {
  const rows = schemaInventory(ShardfileSchema), paths = new Set(rows.map(row => row.path));
  for (const path of ['presentation', 'presentation.biome', 'presentation.blurb', 'presentation.card', 'presentation.card.thumb', 'presentation.card.portrait', 'presentation.card.landscape']) expect(paths.has(`$.${path}`)).toBe(true);
  expect(rows.find(row => row.path === '$.files[].kind')?.values).toContain('"image"');
});

it.each(Object.entries(images))('derives bounded %s dimensions, MIME and residency from its bytes', (kind, encoded) => {
  const bytes = bytesOf(encoded), parsed = parseStillImage(bytes);
  expect(parsed).toEqual({ mime: `image/${kind}`, width: 2, height: 3, decoded: 24 + bytes.length * 4, gpu: 24 });
  expect(assetCost('image', bytes)).toEqual({ decoded: parsed.decoded, gpu: 24, triangles: 0, draws: 0 });
  expect(stillImageUrl(bytes)).toBe(`data:image/${kind};base64,${encoded}`);
  for (let end = 0; end < bytes.length; end++) expect(() => parseStillImage(bytes.subarray(0, end))).toThrow();
});

it('refuses SVG, oversized dimensions, animation and surplus container bytes before decoding', () => {
  expect(() => parseStillImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toThrow('Only bounded');
  expect(() => parseStillImage(new Uint8Array(STILL_IMAGE_LIMITS.bytes + 1))).toThrow('wire');
  const png = bytesOf(images.png), huge = png.slice();
  new DataView(huge.buffer).setUint32(16, STILL_IMAGE_LIMITS.dimension + 1);
  expect(() => parseStillImage(huge)).toThrow('dimensions');
  const animation = png.slice(); new DataView(animation.buffer).setUint32(37, 0x6163544c);
  expect(() => parseStillImage(animation)).toThrow('Animated PNG');
  const webp = bytesOf(images.webp), animated = new Uint8Array(webp.length + 18);
  animated.set(webp.subarray(0, 12)); animated.set([86, 80, 56, 88, 10, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 0, 0], 12); animated.set(webp.subarray(12), 30);
  new DataView(animated.buffer).setUint32(4, animated.length - 8, true);
  expect(() => parseStillImage(animated)).toThrow('animated');
  for (const encoded of Object.values(images)) { const bytes = bytesOf(encoded); expect(() => parseStillImage(new Uint8Array([...bytes, 0]))).toThrow(); }
});

it('admits a charged image library and maps identity, accent and all three cards without fetching', () => {
  const f = fixture(), admitted = validateShardfileAssets(f.source, f.assets, hash);
  const manifest = sourceManifest(admitted, f.assets);
  expect([manifest.slug, manifest.name, manifest.accent, manifest.biome, manifest.blurb]).toEqual(['template', 'Card fixture', f.source.accent, 'Temperate woods', 'A card made from admitted data.']);
  expect(manifest.card).toEqual({ thumb: stillImageUrl(f.bytes), portrait: stillImageUrl(f.bytes), landscape: stillImageUrl(f.bytes) });
  expect(() => sourceManifest(admitted)).toThrow('missing admitted bytes');
  expect(sourceManifest(f.base).card).toEqual(emptyShardfileSource(f.base).card);
});

it('refuses URLs, uncharged/wrong-kind references, unknown keys and false byte-derived costs', () => {
  const f = fixture();
  for (const ref of ['https://example.test/card.png', 'data:image/png;base64,AA==', `commons:${f.ref}`, 'a'.repeat(64)]) {
    expect(() => parseShardfile({ ...f.source, presentation: { ...f.source.presentation, card: { thumb: ref, portrait: ref, landscape: ref } } })).toThrow();
  }
  expect(() => parseShardfile({ ...f.source, library: [], critical: [f.ref] })).toThrow();
  expect(() => parseShardfile({ ...f.source, files: f.source.files.map(file => ({ ...file, kind: 'binary' })) })).toThrow();
  expect(() => parseShardfile({ ...f.source, presentation: { ...f.source.presentation, script: 'onLoad' } })).toThrow();
  expect(() => parseShardfile({ ...f.source, presentation: { ...f.source.presentation, blurb: 'x'.repeat(513) } })).toThrow();
  expect(() => validateShardfileAssets({ ...f.source, files: f.source.files.map(file => ({ ...file, decoded: 1 })) }, f.assets, hash)).toThrow();
});

it('the admitted loader uses data cards and absent presentation preserves the first-party picker card', async () => {
  const f = fixture(), options = { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: (url: string) => Promise.resolve(url.endsWith('source.json') ? Response.json(f.source) : new Response(f.bytes)), hash: (bytes: Uint8Array) => Promise.resolve(hash(bytes)) };
  const bindings = { instance: 'template', catalogue: [], recipes: new Map(), items: new Map(), voices: () => new Map(), icon: () => { throw new Error('No item icons'); } };
  const direct = await shardfileSource(f.source, options, bindings);
  expect(direct.biome).toBe('Temperate woods'); expect(direct.card.thumb).toBe(stillImageUrl(f.bytes));
  const selected = { ...emptyShardfileSource(f.base), shardfile: 'source.json', biome: 'Existing biome', card: { thumb: 'old-thumb', portrait: 'old-portrait', landscape: 'old-landscape' } };
  const withCard = await installManifestShardfile(selected, options, bindings);
  expect(withCard.card).toEqual(direct.card); expect(withCard.biome).toBe('Temperate woods');
  const without = await installManifestShardfile(selected, { ...options, fetch: () => Promise.resolve(Response.json(f.base)) }, bindings);
  expect(without.card).toEqual(selected.card); expect(without.biome).toBe(selected.biome);
});
