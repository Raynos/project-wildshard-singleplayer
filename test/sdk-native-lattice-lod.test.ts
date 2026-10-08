// oxlint-disable-next-line import/no-nodejs-modules -- The original committed Pine bake is the immutable source witness.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { sliceNativeLattice, type NativeLatticeTile } from '../src/sdk/bake/nativeLattice';
import { simplifyNativeLatticeTile } from '../src/sdk/bake/worldLod';

function tile(): NativeLatticeTile {
  const n = 17, positions = new Float64Array(n * n * 3), indices: number[] = [], splat = new Float64Array(n * n * 4), surf = new Float64Array(n * n * 4);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const at = z * n + x;
    positions.set([x * 125 / 16, 0, z * 125 / 16], at * 3);
    splat.set([x / 16, 1 - x / 16, 0, 0], at * 4); surf.set([z / 16, 0, 1, 0], at * 4);
    if (x < 16 && z < 16 && !(x >= 6 && x < 10 && z >= 6 && z < 10)) indices.push(at, at + n, at + 1, at + 1, at + n, at + n + 1);
  }
  return { lod: 1, x: 2, z: 2, size: 125, positions, indices: Uint32Array.from(indices), attributes: {
    splat: { itemSize: 4, values: splat }, surf: { itemSize: 4, values: surf },
  }, bounds: { min: [0, 0, 0], max: [125, 0, 125] } };
}
function borderEdges(source: NativeLatticeTile): string[] {
  const edges = new Map<string, number>();
  const key = (at: number): string => Array.from(source.positions.subarray(at * 3, at * 3 + 3)).join('/');
  for (let i = 0; i < source.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = source.indices[i + j], b = source.indices[i + (j + 1) % 3];
    if (a === undefined || b === undefined) throw new Error('Missing edge');
    const edge = [key(a), key(b)].sort().join(':'); edges.set(edge, (edges.get(edge) ?? 0) + 1);
  }
  return [...edges].filter(([, count]) => count === 1).map(([edge]) => edge).sort();
}
function assertExactSurvivors(source: NativeLatticeTile, output: NativeLatticeTile): void {
  const key = (values: Float64Array, at: number): string => Array.from(values.subarray(at * 3, at * 3 + 3)).join('/');
  const originals = new Map(Array.from({ length: source.positions.length / 3 }, (_, at) => [key(source.positions, at), at]));
  for (let at = 0; at < output.positions.length / 3; at++) {
    const original = originals.get(key(output.positions, at)); if (original === undefined) throw new Error('Simplifier moved a native vertex');
    for (const [name, channel] of Object.entries(source.attributes)) expect(Array.from(output.attributes[name]?.values.subarray(at * channel.itemSize, (at + 1) * channel.itemSize) ?? []))
      .toEqual(Array.from(channel.values.subarray(original * channel.itemSize, (original + 1) * channel.itemSize)));
  }
}
it('reduces native L1 geometry deterministically while locking tile and hole edges and preserving custom channels exactly', async () => {
  const source = tile(), before = structuredClone(source), a = await simplifyNativeLatticeTile(source, 0.2, 0.1), b = await simplifyNativeLatticeTile(source, 0.2, 0.1);
  expect(a).toEqual(b); expect(source).toEqual(before);
  expect(a.triangles).toBeLessThan(a.sourceTriangles); expect(a.tile.positions.length).toBeLessThan(source.positions.length);
  expect(a.errorMetres).toBeLessThanOrEqual(0.1); expect(borderEdges(a.tile)).toEqual(borderEdges(source));
  assertExactSurvivors(source, a.tile);
});
it('reduces a real Pine native-height L1 tile without changing original terrain bytes or surviving source heights', async () => {
  const bytes = readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.bin', import.meta.url)), before = Uint8Array.from(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), positions = new Float64Array(256 ** 2 * 3), indices: number[] = [];
  for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) {
    const at = z * 256 + x; positions.set([Math.fround(-250 + x * 500 / 255), view.getFloat32(24 + at * 4, true), Math.fround(-250 + z * 500 / 255)], at * 3);
    if (x < 255 && z < 255) indices.push(at, at + 256, at + 1, at + 1, at + 256, at + 257);
  }
  const source = sliceNativeLattice({ resolution: 256, positions, indices: Uint32Array.from(indices), attributes: {} }, 1)[5];
  if (source === undefined) throw new Error('Missing native L1');
  const result = await simplifyNativeLatticeTile(source, 0.25, 0.1);
  expect(result.triangles).toBeLessThan(result.sourceTriangles); expect(result.errorMetres).toBeLessThanOrEqual(0.1);
  expect(borderEdges(result.tile)).toEqual(borderEdges(source)); assertExactSurvivors(source, result.tile);
  expect(Uint8Array.from(bytes)).toEqual(before);
});
it('retains exact geometry when conversion exceeds the requested error and supports empty sliced holes', async () => {
  const source = tile(); source.attributes['surf'] = { itemSize: 4, values: source.attributes['surf']?.values.map(value => value + 0.123456789) ?? new Float64Array() };
  const unchanged = await simplifyNativeLatticeTile(source, 0.1, 1e-12);
  expect(unchanged.triangles).toBe(unchanged.sourceTriangles); expect(unchanged.errorMetres).toBe(0); assertExactSurvivors(source, unchanged.tile);
  const empty = { ...tile(), positions: new Float64Array(), indices: new Uint32Array(), attributes: {} };
  expect((await simplifyNativeLatticeTile(empty, 0.25, 0.1)).tile).toEqual(empty);
});
it('refuses L0, malformed channels, unsupported component counts and understated bounds before simplification', async () => {
  await expect(simplifyNativeLatticeTile({ ...tile(), lod: 0 }, 0.25, 0.1)).rejects.toThrow('bounded tile');
  await expect(simplifyNativeLatticeTile({ ...tile(), attributes: { bad: { itemSize: 4, values: new Float64Array(4) } } }, 0.25, 0.1)).rejects.toThrow('channel');
  const source = tile(); source.bounds.max[1] = -1;
  await expect(simplifyNativeLatticeTile(source, 0.25, 0.1)).rejects.toThrow('bounds');
  const tooMany = { ...tile(), attributes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`channel${i}`, { itemSize: 4, values: new Float64Array(17 ** 2 * 4) }])) };
  await expect(simplifyNativeLatticeTile(tooMany, 0.25, 0.1)).rejects.toThrow('32 components');
});
