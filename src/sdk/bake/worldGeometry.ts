import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from 'three';
import type { WorldPrimitive } from './world';

interface Channel { key: string; width: number; data: Float32Array | Float64Array }
type Vertex = number[];
function channels(source: WorldPrimitive): Channel[] {
  const n = source.positions.length / 3;
  const rows: Channel[] = [{ key: 'position', width: 3, data: source.positions }];
  for (const [key, data, width] of [['normal', source.normals, 3], ['uv', source.uv, 2], ['color', source.colours, source.colours === null ? 3 : source.colours.length / n], ['tangent', source.tangents, 4]] as const) {
    if (data !== null) rows.push({ key, data, width });
  }
  return rows;
}
function cut(input: readonly Vertex[], axis: number, boundary: number, greater: boolean): Vertex[] {
  const output: Vertex[] = [];
  for (let i = 0; i < input.length; i++) {
    const a = input[i], b = input[(i + 1) % input.length];
    if (a === undefined || b === undefined) continue;
    const av = a[axis] ?? 0, bv = b[axis] ?? 0;
    const insideA = greater ? av >= boundary : av <= boundary, insideB = greater ? bv >= boundary : bv <= boundary;
    if (insideA) output.push(a);
    if (insideA !== insideB) {
      // Canonical endpoints keep adjacent tile cuts byte-identical at their shared boundary.
      const [start, end] = av < bv ? [a, b] : [b, a];
      const t = (boundary - (start[axis] ?? 0)) / ((end[axis] ?? 0) - (start[axis] ?? 0));
      const vertex = start.map((value, at) => value + ((end[at] ?? value) - value) * t);
      vertex[axis] = boundary; output.push(vertex);
    }
  }
  return output;
}

function outsideFirstCuts(positions: Float64Array, a: number, b: number, c: number, bounds: readonly [number, number, number, number]): boolean {
  const ax = positions[a * 3] ?? Number.NaN, bx = positions[b * 3] ?? Number.NaN, cx = positions[c * 3] ?? Number.NaN;
  const insideMin = ax >= bounds[0] && bx >= bounds[0] && cx >= bounds[0];
  if (ax < bounds[0] && bx < bounds[0] && cx < bounds[0]) return true;
  if (insideMin && ax > bounds[1] && bx > bounds[1] && cx > bounds[1]) return true;
  // Only inspect z when both earlier x cuts leave every original vertex intact.
  // Otherwise their rounded intersections must still go through the old clipper.
  if (!insideMin || ax > bounds[1] || bx > bounds[1] || cx > bounds[1]) return false;
  const az = positions[a * 3 + 2] ?? Number.NaN, bz = positions[b * 3 + 2] ?? Number.NaN, cz = positions[c * 3 + 2] ?? Number.NaN;
  if (az < bounds[2] && bz < bounds[2] && cz < bounds[2]) return true;
  return az >= bounds[2] && bz >= bounds[2] && cz >= bounds[2] && az > bounds[3] && bz > bounds[3] && cz > bounds[3];
}

/** Clip every authored vertex channel to one tile, preserving vertical faces and both bridge layers.
 * This is offline render geometry clipping; the independent WMC1 baker remains the collision authority. */
export function worldGeometry(source: WorldPrimitive, bounds?: readonly [number, number, number, number], transform?: readonly number[]): BufferGeometry {
  const rows = channels(source), output = rows.map(() => [] as number[]), matrix = transform === undefined ? null : new Matrix4().fromArray(transform);
  const vertex = (index: number): Vertex => rows.flatMap(row => Array.from(row.data.subarray(index * row.width, (index + 1) * row.width)));
  for (let i = 0; i < source.indices.length; i += 3) {
    const ai = source.indices[i] ?? 0, bi = source.indices[i + 1] ?? 0, ci = source.indices[i + 2] ?? 0;
    if (bounds !== undefined && outsideFirstCuts(source.positions, ai, bi, ci, bounds)) continue;
    let polygon = [vertex(ai), vertex(bi), vertex(ci)];
    if (bounds !== undefined) for (const [axis, boundary, greater] of [[0, bounds[0], true], [0, bounds[1], false], [2, bounds[2], true], [2, bounds[3], false]] as const) polygon = cut(polygon, axis, boundary, greater);
    for (let at = 1; at + 1 < polygon.length; at++) {
      const a = polygon[0], b = polygon[at], c = polygon[at + 1];
      if (a === undefined || b === undefined || c === undefined) continue;
      const pa = new Vector3().fromArray(a), pb = new Vector3().fromArray(b), pc = new Vector3().fromArray(c);
      if (pb.sub(pa).cross(pc.sub(pa)).lengthSq() === 0) continue;
      for (const point of [a, b, c]) {
        let offset = 0;
        rows.forEach((row, channel) => { output[channel]?.push(...point.slice(offset, offset + row.width)); offset += row.width; });
      }
    }
  }
  const geometry = new BufferGeometry();
  rows.forEach((row, at) => { geometry.setAttribute(row.key, new Float32BufferAttribute(output[at] ?? [], row.width)); });
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  if (matrix !== null) geometry.applyMatrix4(matrix);
  return geometry;
}

/** Combine same-material primitives into one draw without changing their authored channels. */
export function mergeWorldGeometry(parts: readonly BufferGeometry[]): BufferGeometry {
  const first = parts[0]; if (first === undefined) throw new Error('World merge needs geometry');
  const keys = Object.keys(first.attributes).sort(), output = new BufferGeometry();
  for (const part of parts) if (Object.keys(part.attributes).sort().join('/') !== keys.join('/')) throw new Error('World material primitives have incompatible vertex channels');
  for (const key of keys) {
    const width = first.getAttribute(key).itemSize, values: number[] = [];
    for (const part of parts) {
      const row = part.getAttribute(key); if (row.itemSize !== width) throw new Error('World material vertex channel width differs');
      for (let vertex = 0; vertex < row.count; vertex++) for (let c = 0; c < width; c++) values.push(row.getComponent(vertex, c));
    }
    output.setAttribute(key, new Float32BufferAttribute(values, width));
  }
  return output;
}
