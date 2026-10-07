import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import type { WorldPrimitive } from './world';

/** Pinned offline WASM simplification; source topology and every attribute stay owned by the author. */
export const WORLD_LOD_TOOL = 'meshoptimizer@1.2.0';
/** Actual triangle count and the tool's absolute appearance-error estimate, including float-position allowance. */
export interface WorldLod { primitive: WorldPrimitive; errorMetres: number; sourceTriangles: number; triangles: number }

function attributes(primitive: WorldPrimitive, vertices: number): { data: Float32Array; stride: number; weights: number[] } {
  const rows: { data: Float32Array; width: number }[] = [];
  if (primitive.colours !== null && ![3, 4].includes(primitive.colours.length / vertices)) throw new Error('World LOD invalid colour attributes');
  for (const [data, width] of [[primitive.normals, 3], [primitive.uv, 2], [primitive.colours, primitive.colours === null ? 3 : primitive.colours.length / vertices], [primitive.tangents, 4]] as const) {
    if (data === null) continue;
    if (!(data instanceof Float32Array) || ![2, 3, 4].includes(width) || data.length !== vertices * width || data.some(value => !Number.isFinite(value))) throw new Error('World LOD invalid vertex attributes');
    rows.push({ data, width });
  }
  const stride = rows.reduce((sum, row) => sum + row.width, 0), data = new Float32Array(vertices * stride);
  for (let vertex = 0; vertex < vertices; vertex++) {
    let offset = vertex * stride;
    for (const row of rows) { data.set(row.data.subarray(vertex * row.width, (vertex + 1) * row.width), offset); offset += row.width; }
  }
  return { data, stride, weights: Array.from({ length: stride }, () => 1) };
}

function compact(source: WorldPrimitive, selected: Uint32Array): WorldPrimitive {
  const vertices = source.positions.length / 3, remap = new Uint32Array(vertices).fill(0xffffffff), kept: number[] = [], indices = new Uint32Array(selected.length);
  selected.forEach((vertex, i) => {
    let at = remap[vertex];
    if (at === undefined) throw new Error('World LOD output index outside source');
    if (at === 0xffffffff) { at = kept.length; kept.push(vertex); remap[vertex] = at; }
    indices[i] = at;
  });
  const copy = (data: Float32Array | null, width: number): Float32Array | null => {
    if (data === null) return null;
    const output = new Float32Array(kept.length * width);
    kept.forEach((vertex, i) => output.set(data.subarray(vertex * width, (vertex + 1) * width), i * width));
    return output;
  };
  const positions = new Float64Array(kept.length * 3);
  kept.forEach((vertex, i) => positions.set(source.positions.subarray(vertex * 3, vertex * 3 + 3), i * 3));
  return { ...source, positions, indices, normals: copy(source.normals, 3), uv: copy(source.uv, 2), colours: copy(source.colours, source.colours === null ? 3 : source.colours.length / vertices), tangents: copy(source.tangents, 4) };
}

/** Simplify one material primitive without moving vertices, flattening overhangs or crossing attribute/border seams.
 * The ratio is a target, not a promise: error/topology locks may retain more triangles. Error is meshopt's estimate,
 * not an independently measured Hausdorff bound. Callers must charge the actual returned geometry.
 */
export async function simplifyWorldPrimitive(source: WorldPrimitive, targetRatio: number, maxErrorMetres: number): Promise<WorldLod> {
  const vertices = source.positions.length / 3, indices = source.indices;
  if (!(source.positions instanceof Float64Array) || !Number.isInteger(vertices) || vertices < 3 || vertices > 4_000_000 || source.positions.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) || !(indices instanceof Uint32Array) || indices.length < 3 || indices.length > 12_000_000 || indices.length % 3 !== 0 || indices.some(index => index >= vertices)) throw new Error('World LOD invalid bounded triangle geometry');
  if (!Number.isFinite(targetRatio) || targetRatio <= 0 || targetRatio > 1 || !Number.isFinite(maxErrorMetres) || maxErrorMetres <= 0 || maxErrorMetres > 500) throw new Error('World LOD invalid ratio or error');
  const packed = attributes(source, vertices), positions = Float32Array.from(source.positions);
  let quantization = 0;
  for (let i = 0; i < positions.length; i += 3) quantization = Math.max(quantization, Math.hypot((positions[i] ?? 0) - (source.positions[i] ?? 0), (positions[i + 1] ?? 0) - (source.positions[i + 1] ?? 0), (positions[i + 2] ?? 0) - (source.positions[i + 2] ?? 0)));
  const allowance = quantization * 2, target = Math.max(3, Math.floor(indices.length / 3 * targetRatio) * 3);
  let selected: Uint32Array = Uint32Array.from(indices);
  let errorMetres = 0;
  if (target < indices.length && allowance < maxErrorMetres) {
    if (!MeshoptSimplifier.supported) throw new Error('World LOD WASM is unavailable');
    await MeshoptSimplifier.ready;
    const [output, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, packed.data, packed.stride, packed.weights, null, target, maxErrorMetres - allowance, ['LockBorder', 'ErrorAbsolute']);
    if (!Number.isFinite(error) || error < 0 || error + allowance > maxErrorMetres || output.length < 3 || output.length > indices.length || output.length % 3 !== 0) throw new Error('World LOD invalid simplifier output');
    selected = output;
    if (output.length < indices.length) errorMetres = error + allowance;
  }
  return { primitive: compact(source, selected), errorMetres, sourceTriangles: indices.length / 3, triangles: selected.length / 3 };
}
