// oxlint-disable-next-line import/no-nodejs-modules -- The committed terrain input feeds the exact offline source constructor.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare tile bytes natively.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { nalatiRenderTileSources } from '../src/shards/nalati-grasslands/generators/renderTileSources';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { visitGlbTriangles } from '../src/format/product';
import { FilesSchema, TilesSchema } from '../src/format/shardSections';
import { WIRE_CELL, WIRE_TILE_SIZES } from '../src/format/wireLimits';
import { i3Predecessor } from './fixtures/nalati-render-i3';

const native = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
const originalNative = hashImmutableBytes(native);
// One genuine construction supplies all original files. iPhone downloads I3: the 'exact' publication is the pre-I3 one; the
// I3 test below qualifies the shipped one against it. G919: no frozen byte counts or digests: the publication keeps its
// current file references and laws, and a second construction reproduces it byte for byte.
const made = await nalatiRenderTileSources(native, 'exact');

test('the terrain publication covers the native grid with current content identities', () => {
  const metadata = made.files.get('data/renderTiles.json');
  if (metadata === undefined) throw new Error('Missing native render metadata');
  const rows = v.parse(v.object({ files: FilesSchema, tiles: TilesSchema }), JSON.parse(new TextDecoder().decode(metadata)));
  const addresses = new Set<string>();
  for (const lod of [0, 1] as const) {
    const side = WIRE_CELL.half * 2 / (lod === 0 ? WIRE_TILE_SIZES.l0 : WIRE_TILE_SIZES.l1);
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) addresses.add(`${lod}:${x}:${z}`);
  }
  expect(new Set(rows.tiles.map(tile => `${tile.lod}:${tile.x}:${tile.z}`))).toEqual(addresses);
  expect(rows.tiles).toHaveLength(addresses.size);
  expect(made.tiles).toBe(rows.tiles.length);
  const names = new Set(['data/renderTiles.json', ...rows.files.map(file => `assets/${file.hash}`)]);
  for (const tile of rows.tiles) if (tile.lod === 1) names.add(`assets/world-terrain/ground-l1-${Math.floor(tile.x / 2)}-${tile.z}.generated.glb`);
  expect(new Set(made.files.keys())).toEqual(names);
  for (const file of rows.files) {
    const bytes = made.files.get(`assets/${file.hash}`);
    if (bytes === undefined) throw new Error('Missing declared render bytes');
    expect(hashImmutableBytes(bytes)).toBe(file.hash);
  }
  expect(made.nativeGround).toBe(originalNative);
  expect(made.bytes).toBe([...made.files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0));
  for (const [path, bytes] of made.files) expect(bytes.byteLength, path).toBeGreaterThan(0);
  expect(hashImmutableBytes(native)).toBe(originalNative);
});

test('independent construction owns its bytes after an earlier result is mutated', async () => {
  const metadata = made.files.get('data/renderTiles.json');
  if (metadata === undefined) throw new Error('Missing render metadata loan');
  const before = metadata.slice(); metadata.fill(0);
  try {
    const rebuilt = await nalatiRenderTileSources(native, 'exact');
    // Vitest toBe computes deep diagnostics for distinct byte containers.
    // Compare identity only; complete hashes below already prove contents.
    expect(rebuilt.files === made.files).toBe(false);
    expect(rebuilt.files.size).toBe(made.files.size);
    for (const [path, first] of made.files) {
      const bytes = rebuilt.files.get(path);
      if (bytes === undefined) throw new Error('Missing rebuilt render source');
      expect(bytes === first).toBe(false);
      // the mutated loan is the first result's own: the rebuild reproduces what it held before
      const expected = path === 'data/renderTiles.json' ? before : first;
      expect(Buffer.compare(Buffer.from(bytes), Buffer.from(expected)), path).toBe(0);
    }
    expect(hashImmutableBytes(native)).toBe(originalNative);
  } finally { metadata.set(before); }
});

// I3: the shipped publication is the pinned one with L0 ground tiles in phone geometry. Every other file is byte for byte
// the pin's; every metadata row is the pin's but for a compacted tile's hash and byte costs; each compacted tile's triangles
// are the exact tile's, in order, each vertex within one grid step of its node (compactClearGlb's contained grid)
test('the shipped I3 publication is the pinned one with its L0 ground compacted', async () => {
  const phone = await nalatiRenderTileSources(native), metadata = phone.files.get('data/renderTiles.json');
  if (metadata === undefined) throw new Error('Missing I3 render metadata');
  const pinned = made.files.get('data/renderTiles.json');
  if (pinned === undefined) throw new Error('Missing pinned render metadata');
  const { renamed } = i3Predecessor(pinned, metadata);
  expect(renamed.size).toBeGreaterThan(40);
  expect(phone.files.size).toBe(made.files.size);
  let worst = 0, before = 0, after = 0;
  for (const [path, exact] of made.files) {
    if (path === 'data/renderTiles.json') continue;
    const hash = path.slice('assets/'.length), next = renamed.get(hash), bytes = phone.files.get(next === undefined ? path : `assets/${next}`);
    if (bytes === undefined) throw new Error(`Missing I3 render file for ${path}`);
    if (next === undefined) { expect(Buffer.compare(Buffer.from(bytes), Buffer.from(exact)), path).toBe(0); continue; }
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true)))) as { nodes: { scale?: number[] }[] };
    const step = Math.max(...json.nodes.map(node => node.scale?.[0] ?? 0)) / 32767;
    expect(step).toBeGreaterThan(0);
    const a: number[] = [], b: number[] = [];
    visitGlbTriangles(exact, triangle => { for (const p of triangle) a.push(p.x, p.y, p.z); });
    visitGlbTriangles(bytes, triangle => { for (const p of triangle) b.push(p.x, p.y, p.z); });
    expect(b.length, path).toBe(a.length);
    let tile = 0; for (let i = 0; i < a.length; i++) tile = Math.max(tile, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
    expect(tile, `${path} within one grid step`).toBeLessThanOrEqual(step + 1e-6);
    worst = Math.max(worst, tile); before += exact.byteLength; after += bytes.byteLength;
  }
  expect(after).toBeLessThan(before);
  expect(worst).toBeLessThan(0.01);
});

test('missing and malformed native terrain refuse before publication', async () => {
  await expect(nalatiRenderTileSources(new Uint8Array())).rejects.toThrow();
  const corrupted = native.slice(); corrupted[0] = (corrupted[0] ?? 0) ^ 1;
  await expect(nalatiRenderTileSources(corrupted)).rejects.toThrow();
  expect(hashImmutableBytes(native)).toBe(originalNative);
});
