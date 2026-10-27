// @vitest-environment node
/// <reference types="node" />
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { CONTENT_CAPS } from '../src/format/contentBounds';
import { generatePlatform, type GeneratedStrip, type PlatformCell, type StripProfile } from '../src/engine/sim/strips';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { decodeCompiledGridStrips, platformGeometrySource, readCompiledGridStrips, type CompiledGridAddress } from '../src/game/grid/compiledStrips';
import { encodeGridStripPage, writeGridStripPages } from '../scripts/app-build/gridStripPages';
import { gridSeamAsset, readGridSeams, writeGridSeams } from '../scripts/app-build/gridSeams.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- This artifact fixture owns and removes only its bounded tmp directory.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture's own ignored scratch output.
import { join, resolve } from 'node:path';

function native(count = 257): { cells: PlatformCell[]; empty: StripProfile; strips: readonly GeneratedStrip[] } {
  const empty: StripProfile = { roadHeight: 0, heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]) };
  const profile: StripProfile = { roadHeight: 0,
    heights: Array.from({ length: count }, (_, i) => Math.abs(-250 + i * 500 / (count - 1)) < 12 ? 0 : i % 31 - 10),
    colours: Array.from({ length: count }, (_, i) => [i % 2 === 0 ? -0 : 0.125, (i % 7) / 7, (i % 11) / 11]) };
  const observed = { entryWidth: 8, waterSurface: 0, geometry: 'ground' as const, sourceSurface: 'terrain', outflows: [{ from: -30, to: -15 }] };
  const cells: PlatformCell[] = [{ instance: 'probe', cell: [0, 0], origin: { x: 0, z: -0 },
    edges: { north: profile, east: profile, south: empty, west: empty }, observations: { north: observed, east: { ...observed, geometry: 'void' }, south: { entryWidth: 0 }, west: { entryWidth: 0 } } }];
  return { cells, empty, strips: generatePlatform(cells, empty) };
}
const wire = (array: Float32Array | Uint32Array): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
function sameStrips(actual: readonly GeneratedStrip[], expected: readonly GeneratedStrip[]): void {
  expect(actual.map(strip => strip.id)).toEqual(expected.map(strip => strip.id));
  for (const [index, source] of expected.entries()) {
    const copy = actual[index]; if (copy === undefined) throw new Error('Missing shipped strip');
    expect(copy.mesh.origin).toEqual(source.mesh.origin); expect(copy.features).toEqual(source.features); expect(copy.turnIn).toEqual(source.turnIn);
    for (const key of ['positions', 'colours', 'indices'] as const) {
      expect(Buffer.compare(wire(copy.mesh[key]), wire(source.mesh[key]))).toBe(0); expect(copy.mesh[key].buffer).not.toBe(source.mesh[key].buffer);
    }
    expect(copy.duplicates.map(row => ({ instance: row.instance, origin: row.mesh.origin }))).toEqual(source.duplicates.map(row => ({ instance: row.instance, origin: row.mesh.origin })));
  }
}

test.each([256, 257])('shipped typed triangles match native construction word for word (%s samples)', async count => {
  const original = native(count), source = await platformGeometrySource(original.cells, original.empty);
  const page = encodeGridStripPage(source, 'probe', 'fixture', original.strips), header: unknown = JSON.parse(new TextDecoder().decode(page.header.bytes));
  const actual = decodeCompiledGridStrips(header, page.body.bytes, source, 'probe');
  sameStrips(actual, original.strips);
  const first = actual[0], before = original.strips[0];
  if (first === undefined || before === undefined) throw new Error('Missing mutation probe');
  first.mesh.positions[0] = 999;
  expect(before.mesh.positions[0]).not.toBe(999);
  expect(() => decodeCompiledGridStrips(header, page.body.bytes.slice(1), source, 'probe')).toThrow();
  expect(() => decodeCompiledGridStrips(header, page.body.bytes, 'f'.repeat(64), 'probe')).toThrow('source');
  expect(() => decodeCompiledGridStrips(header, page.body.bytes, source, 'other')).toThrow('source');
  const bad = page.body.bytes.slice(); new DataView(bad.buffer).setUint32(bad.length - 4, 0xffffffff, true);
  expect(() => decodeCompiledGridStrips(header, bad, source, 'probe')).toThrow('geometry');
});

test('baked source identity ignores property order but distinguishes changed values and signed zero', async () => {
  const input = native(), source = await platformGeometrySource(input.cells, input.empty);
  const reordered = input.cells.map(cell => ({ ...cell, edges: { west: cell.edges.west, south: cell.edges.south, east: cell.edges.east, north: cell.edges.north } }));
  expect(await platformGeometrySource(reordered, input.empty)).toBe(source);
  expect(await platformGeometrySource(structuredClone(input.cells), structuredClone(input.empty))).toBe(source);
  const moved = input.cells.map(cell => ({ ...cell, origin: { x: cell.origin.x, z: 0 } }));
  expect(await platformGeometrySource(moved, input.empty)).not.toBe(source);
});

test('the shipped initial ring is exactly the native subset, with all outer work omitted', async () => {
  const empty = native().empty, cells: PlatformCell[] = [];
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) cells.push({ instance: `cell_${x}_${z}`, cell: [x, z],
    origin: { x: x * CONTENT_CAPS.pitch, z: z * CONTENT_CAPS.pitch }, edges: { north: empty, east: empty, south: empty, west: empty } });
  const reach = 1.5 * CONTENT_CAPS.pitch + 1, ring = (x: number, z: number): boolean => Math.abs(x) <= reach && Math.abs(z) <= reach;
  const full = generatePlatform(cells, empty), expected = generatePlatform(cells, empty, new Map(), ring);
  const selected = full.filter(strip => ring(strip.mesh.origin.x, strip.mesh.origin.z));
  expect(expected).toHaveLength(40); expect(full.length - selected.length).toBe(56);
  const source = await platformGeometrySource(cells, empty), page = encodeGridStripPage(source, 'cell_0_0', 'fixture', selected);
  const header: unknown = JSON.parse(new TextDecoder().decode(page.header.bytes));
  sameStrips(decodeCompiledGridStrips(header, page.body.bytes, source, 'cell_0_0'), expected);
});

async function fixture() {
  const original = native(), source = await platformGeometrySource(original.cells, original.empty);
  const page = encodeGridStripPage(source, 'probe', 'fixture', original.strips);
  const directory = new TextEncoder().encode(JSON.stringify({ version: 1, pages: [page.page] }));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', directory)), sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  const address: CompiledGridAddress = { url: `/assets/grid-strip-book-${sha256.slice(0, 8)}.json`, bytes: directory.length, sha256 };
  const files = new Map([[address.url, directory], [page.header.address.url, page.header.bytes], [page.body.address.url, page.body.bytes]]);
  return { original, source, page, selector: { directory: address, homes: ['probe'] }, files };
}

test('only a completed exact page publishes arrays and a scoped source charge', async () => {
  const f = await fixture(), scope = new Scope('compiled page'), allocator = new ResidencyAllocator(), urls: string[] = [], signals: AbortSignal[] = [];
  const actual = await readCompiledGridStrips(f.selector, f.original, 'probe', { scope, allocator }, (url, signal) => {
    urls.push(url); signals.push(signal); const bytes = f.files.get(url); if (bytes === undefined) throw new Error('Unexpected request');
    return Promise.resolve(new Response(Uint8Array.from(bytes).buffer));
  }, () => Promise.resolve());
  if (actual === null) throw new Error('Missing compiled page'); sameStrips(actual, f.original.strips);
  expect(urls).toEqual([f.selector.directory.url, f.page.header.address.url, f.page.body.address.url]);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(allocator.entries().map(row => row.id)).toEqual(['product:grid:seams:probe:source']);
  scope.dispose(); expect(allocator.entries()).toEqual([]);
});

test('optional misses start no body reads; corrupt declared data refuses and releases claims', async () => {
  const f = await fixture(), scope = new Scope('refused page'), allocator = new ResidencyAllocator();
  const urls: string[] = [];
  const read = (url: string): Promise<Response> => {
    urls.push(url); const bytes = f.files.get(url); if (bytes === undefined) throw new Error('Unexpected request');
    const output = Uint8Array.from(bytes); if (url === f.page.body.address.url) output[0] = (output[0] ?? 0) ^ 1;
    return Promise.resolve(new Response(output.buffer));
  };
  await expect(readCompiledGridStrips(undefined, f.original, 'probe', { scope, allocator }, read, () => Promise.resolve())).resolves.toBeNull();
  await expect(readCompiledGridStrips(f.selector, f.original, 'other', { scope, allocator }, read, () => Promise.resolve())).resolves.toBeNull(); expect(urls).toEqual([]);
  await expect(readCompiledGridStrips(f.selector, f.original, 'probe', { scope, allocator }, read, () => Promise.resolve())).rejects.toThrow('differs');
  expect(allocator.entries()).toEqual([]); scope.dispose();
});

test('a retiring owner aborts before publication and leaves no source reservation', async () => {
  const f = await fixture(), scope = new Scope('retiring page'), allocator = new ResidencyAllocator();
  const signals: AbortSignal[] = [];
  await expect(readCompiledGridStrips(f.selector, f.original, 'probe', { scope, allocator }, (url, signal) => {
    signals.push(signal); if (url === f.page.header.address.url) scope.dispose();
    const bytes = f.files.get(url); if (bytes === undefined) throw new Error('Unexpected request');
    return Promise.resolve(new Response(Uint8Array.from(bytes).buffer));
  }, () => Promise.resolve())).rejects.toThrow('scope disposed');
  expect(signals.every(signal => signal.aborted)).toBe(true); expect(allocator.entries()).toEqual([]);
});

test('the plain app step ships exact assets only inside the existing I12 ceiling', async () => {
  const f = await fixture(), root = mkdtempSync(resolve('tmp/grid-strip-assets-'));
  try {
    const source = '{"plans":[],"edges":[]}', asset = gridSeamAsset(source);
    mkdirSync(join(root, 'out/.app'), { recursive: true }); writeFileSync(join(root, 'out/.app/grid-seams.json'), source);
    const report = writeGridStripPages(root, asset.address.sha256, [f.page], [{ name: 'fixture', bytes: 100, ceiling: CONTENT_CAPS.playing }]);
    expect(report.rows[0]?.included).toBe(true); expect(report.rows[0]?.added).toBeGreaterThan(0);
    const built = readGridSeams(root); expect(built.address.geometry?.homes).toEqual(['probe']); expect(built.source).toBe(source);
    writeGridSeams(join(root, 'dist'), root);
    for (const file of built.files ?? []) expect(readFileSync(join(root, 'dist', file.url.slice(1))).length).toBe(file.bytes);
    const refused = writeGridStripPages(root, asset.address.sha256, [f.page], [{ name: 'fixture', bytes: 100, ceiling: 100 }]);
    expect(refused.geometry).toBeUndefined(); expect(refused.files).toEqual([]); expect(refused.rows[0]?.added).toBe(0);
    expect(readGridSeams(root).address.geometry).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
