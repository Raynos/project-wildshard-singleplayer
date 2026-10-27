// oxlint-disable-next-line import/no-nodejs-modules -- The committed terrain input feeds the exact offline source constructor.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare tile bytes natively.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { nalatiRenderTileSources } from '../src/shards/nalati-grasslands/generators/renderTileSources';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { visitGlbTriangles } from '../src/format/product';
import { i3Predecessor } from './fixtures/nalati-render-i3';
import originals from './fixtures/nalati-render-source-files.json' with { type: 'json' };

const native = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
const originalNative = hashImmutableBytes(native);
// One genuine construction supplies all original files; timed assertions preserve complete pins. iPhone downloads I3: the
// pins hold the pre-I3 ('exact') publication; the I3 test below qualifies the shipped one against it.
const made = await nalatiRenderTileSources(native, 'exact');

// 72 original L0 tile files, the tile metadata and (T8, G748.6) the 16 L1 squares' pair files
test('the explicit terrain source reproduces all 89 complete publications', () => {
  expect(originals).toHaveLength(89);
  expect([...made.files.keys()].sort((a, b) => a.localeCompare(b)))
    .toEqual(originals.map(row => row.path).sort((a, b) => a.localeCompare(b)));
  expect(made.tiles).toBe(80);
  expect(made.nativeGround).toBe(originalNative);
  expect(made.bytes).toBe(originals.reduce((sum, row) => sum + row.bytes, 0));
  for (const pin of originals) {
    const bytes = made.files.get(pin.path);
    if (bytes === undefined) throw new Error(`Missing original render source ${pin.path}`);
    expect(bytes.byteLength, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
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
    for (const pin of originals) {
      const bytes = rebuilt.files.get(pin.path);
      if (bytes === undefined) throw new Error('Missing rebuilt render source');
      expect(bytes === made.files.get(pin.path)).toBe(false);
      expect(bytes.byteLength, pin.path).toBe(pin.bytes);
      expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
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
