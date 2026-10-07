import { expect, it } from 'vitest';
import { simplifyWorldPrimitive, WORLD_LOD_TOOL } from '../src/sdk/bake/worldLod';
import type { WorldPrimitive } from '../src/sdk/bake/world';

function grid(y = 0, material = 0): WorldPrimitive {
  const size = 17, positions = new Float64Array(size * size * 3), normals = new Float32Array(size * size * 3), uv = new Float32Array(size * size * 2), colours = new Float32Array(size * size * 4), tangents = new Float32Array(size * size * 4), indices: number[] = [];
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const vertex = z * size + x;
    positions.set([x, y, z], vertex * 3); normals.set([0, 1, 0], vertex * 3); uv.set([x / 16, z / 16], vertex * 2); colours.set([x / 16, z / 16, 0.5, 1], vertex * 4); tangents.set([1, 0, 0, 1], vertex * 4);
    if (x < 16 && z < 16) indices.push(vertex, vertex + size, vertex + 1, vertex + 1, vertex + size, vertex + size + 1);
  }
  return { node: 'Bridge', objectId: 'bridge', material, terrain: false, positions, normals, uv, colours, tangents, indices: Uint32Array.from(indices) };
}
function points(source: WorldPrimitive): number[][] { return Array.from({ length: source.positions.length / 3 }, (_, i) => Array.from(source.positions.subarray(i * 3, i * 3 + 3))); }

it('simplifies real indexed textured geometry deterministically and locks every tile-border vertex', async () => {
  const source = grid(), before = structuredClone(source), a = await simplifyWorldPrimitive(source, 0.25, 0.1), b = await simplifyWorldPrimitive(source, 0.25, 0.1);
  expect(a).toEqual(b); expect(source).toEqual(before); expect(a.sourceTriangles).toBe(512); expect(a.triangles).toBeLessThan(512); expect(a.triangles).toBeGreaterThan(0); expect(a.errorMetres).toBeLessThanOrEqual(0.1);
  const surviving = points(a.primitive);
  for (const point of points(source).filter(([x, , z]) => x === 0 || x === 16 || z === 0 || z === 16)) expect(surviving).toContainEqual(point);
  surviving.forEach((point, i) => {
    const original = points(source).findIndex(row => row.every((value, j) => value === point[j]));
    expect(Array.from(a.primitive.uv?.subarray(i * 2, i * 2 + 2) ?? [])).toEqual(Array.from(source.uv?.subarray(original * 2, original * 2 + 2) ?? []));
    expect(Array.from(a.primitive.colours?.subarray(i * 4, i * 4 + 4) ?? [])).toEqual(Array.from(source.colours?.subarray(original * 4, original * 4 + 4) ?? []));
    expect(Array.from(a.primitive.normals?.subarray(i * 3, i * 3 + 3) ?? [])).toEqual([0, 1, 0]);
    expect(Array.from(a.primitive.tangents?.subarray(i * 4, i * 4 + 4) ?? [])).toEqual([1, 0, 0, 1]);
  });
  expect(WORLD_LOD_TOOL).toBe('meshoptimizer@1.2.0');
});
it('keeps separate material surfaces and the bridge above its ground without a heightfield conversion', async () => {
  const ground = await simplifyWorldPrimitive(grid(0, 0), 0.1, 0.2), bridge = await simplifyWorldPrimitive(grid(5, 1), 0.1, 0.2);
  expect(ground.primitive.material).toBe(0); expect(bridge.primitive.material).toBe(1); expect(bridge.primitive.objectId).toBe('bridge');
  expect(points(ground.primitive).every(point => point[1] === 0)).toBe(true); expect(points(bridge.primitive).every(point => point[1] === 5)).toBe(true);
});
it('retains both sides of a duplicated-position UV seam within one material primitive', async () => {
  const a = grid(), b = grid(), n = a.positions.length / 3;
  for (let i = 0; i < a.positions.length; i += 3) { a.positions[i] = (a.positions[i] ?? 0) / 2; b.positions[i] = 8 + (b.positions[i] ?? 0) / 2; }
  if (b.uv === null) throw new Error('UV fixture');
  const joined = { ...a, positions: Float64Array.from([...a.positions, ...b.positions]), normals: null, colours: null, tangents: null, uv: Float32Array.from([...(a.uv ?? []), ...b.uv]), indices: Uint32Array.from([...a.indices, ...b.indices.map(i => i + n)]) };
  const output = (await simplifyWorldPrimitive(joined, 0.25, 0.1)).primitive, vertices = points(output);
  for (const z of new Set(vertices.filter(point => point[0] === 8).map(point => point[2]))) {
    const seam = vertices.flatMap((point, i) => point[0] === 8 && point[2] === z ? [output.uv?.[i * 2]] : []);
    expect(seam.sort((left, right) => (left ?? -1) - (right ?? -1))).toEqual([0, 1]);
  }
  expect(vertices).toContainEqual([8, 0, 0]); expect(vertices).toContainEqual([8, 0, 16]);
  for (let i = 0; i < output.indices.length; i += 3) {
    const triangle = Array.from(output.indices.subarray(i, i + 3), index => output.positions[index * 3] ?? 0);
    expect(triangle.every(x => x <= 8) || triangle.every(x => x >= 8)).toBe(true);
  }
});
it('reports actual retained topology when seam locks prevent the target, and supports position-only primitives', async () => {
  const source = grid(), small = { ...source, positions: Float64Array.of(0, 0, 0, 1, 0, 0, 0, 0, 1), normals: null, uv: null, colours: null, tangents: null, indices: Uint32Array.of(0, 1, 2) };
  const result = await simplifyWorldPrimitive(small, 0.01, 0.01);
  expect(result.triangles).toBe(1); expect(result.errorMetres).toBe(0); expect(result.primitive).toEqual(small); expect(result.primitive.positions).not.toBe(small.positions);
  const bare = { ...source, normals: null, uv: null, colours: null, tangents: null };
  expect((await simplifyWorldPrimitive(bare, 0.25, 0.1)).triangles).toBeLessThan(512);
});
it('keeps float64 source positions unchanged when float32 measurement cannot meet the error ceiling', async () => {
  const source = grid(); source.positions[0] = 0.123456789;
  const result = await simplifyWorldPrimitive(source, 0.1, 1e-12);
  expect(result.triangles).toBe(512); expect(result.errorMetres).toBe(0); expect(points(result.primitive)).toContainEqual([0.123456789, 0, 0]);
});
it('respects tight error on a nonplanar surface without forcing a dishonest triangle target', async () => {
  const source = grid();
  for (let i = 0; i < source.positions.length; i += 3) source.positions[i + 1] = Math.sin((source.positions[i] ?? 0) * 0.7) * Math.cos((source.positions[i + 2] ?? 0) * 0.7);
  const tight = await simplifyWorldPrimitive(source, 0.1, 0.001), loose = await simplifyWorldPrimitive(source, 0.1, 0.5);
  expect(tight.errorMetres).toBeLessThanOrEqual(0.001); expect(loose.errorMetres).toBeLessThanOrEqual(0.5); expect(tight.triangles).toBeGreaterThan(loose.triangles);
});
it.each(['indices', 'nan', 'shape', 'attributes', 'ratio', 'error'] as const)('refuses malformed LOD %s before WASM', async kind => {
  const source = grid();
  if (kind === 'indices') source.indices[0] = 10000;
  if (kind === 'nan') source.positions[0] = Number.NaN;
  if (kind === 'shape') source.positions = new Float64Array(4);
  if (kind === 'attributes') source.uv = new Float32Array(3);
  await expect(simplifyWorldPrimitive(source, kind === 'ratio' ? 0 : 0.5, kind === 'error' ? Infinity : 0.1)).rejects.toThrow('World LOD');
});
