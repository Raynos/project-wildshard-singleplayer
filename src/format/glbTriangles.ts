/** A renderer-independent vertex in the admitted GLB scene's local frame. */
export interface GlbVertex { x: number; y: number; z: number }
interface Accessor { n: number; component: unknown; type: unknown; offset: number; stride: number; width: number; dimension: number; normalized: boolean }
interface GeometryData {
  nodes: readonly Record<string, unknown>[]; meshes: readonly Record<string, unknown>[];
  accessors: readonly Accessor[]; parents: ReadonlyMap<number, number>;
  read: (accessor: Accessor, row: number, component: number) => number;
}
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('GLB geometry object');
  return value as Record<string, unknown>;
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('GLB geometry array'); return value; }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('GLB geometry number'); return value; }
function at(matrix: readonly number[], i: number): number { return number(matrix[i]); }
function multiply(a: readonly number[], b: readonly number[]): number[] {
  return Array.from({ length: 16 }, (_, i) => {
    let sum = 0; for (let k = 0; k < 4; k++) sum += at(a, i % 4 + k * 4) * at(b, k + Math.floor(i / 4) * 4);
    return sum;
  });
}
/** Affine GLB TRS, including instance transforms, without a Three.js dependency. */
export function glbTransform(input: { translation?: unknown; rotation?: unknown; scale?: unknown; matrix?: unknown }): number[] {
  if (input.matrix !== undefined) {
    const matrix = list(input.matrix).map(number);
    if (matrix.length !== 16 || matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) throw new Error('GLB geometry requires an affine matrix');
    return matrix;
  }
  const translation = input.translation === undefined ? [0, 0, 0] : list(input.translation).map(number);
  const rotation = input.rotation === undefined ? [0, 0, 0, 1] : list(input.rotation).map(number);
  const scale = input.scale === undefined ? [1, 1, 1] : list(input.scale).map(number);
  const x = at(rotation, 0), y = at(rotation, 1), z = at(rotation, 2), w = at(rotation, 3);
  const sx = at(scale, 0), sy = at(scale, 1), sz = at(scale, 2);
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    at(translation, 0), at(translation, 1), at(translation, 2), 1];
}
/** Apply an admitted affine scene transform to an actual binary position. */
export function glbPoint(matrix: readonly number[], p: GlbVertex): GlbVertex {
  const result = { x: at(matrix, 0) * p.x + at(matrix, 4) * p.y + at(matrix, 8) * p.z + at(matrix, 12),
    y: at(matrix, 1) * p.x + at(matrix, 5) * p.y + at(matrix, 9) * p.z + at(matrix, 13),
    z: at(matrix, 2) * p.x + at(matrix, 6) * p.y + at(matrix, 10) * p.z + at(matrix, 14) };
  if (![result.x, result.y, result.z].every(Number.isFinite)) throw new Error('Nonfinite GLB geometry');
  return result;
}
/** Walk admitted static triangles, respecting hierarchy, indices and GPU instancing; never trust accessor bounds. */
export function visitGlbGeometry(data: GeometryData, visit: (triangle: readonly GlbVertex[]) => void): void {
  const { nodes, meshes, accessors, parents, read } = data, worlds = new Map<number, readonly number[]>();
  const accessor = (value: unknown): Accessor => {
    const a = accessors[number(value)]; if (a === undefined) throw new Error('Missing GLB geometry accessor'); return a;
  };
  const world = (id: number): readonly number[] => {
    const existing = worlds.get(id); if (existing !== undefined) return existing;
    const node = nodes[id]; if (node === undefined) throw new Error('Missing GLB geometry node');
    const parent = parents.get(id), local = glbTransform(node), result = parent === undefined ? local : multiply(world(parent), local);
    worlds.set(id, result); return result;
  };
  const mesh = (id: number, matrix: readonly number[]) => {
    const row = meshes[id]; if (row === undefined) throw new Error('Missing GLB geometry mesh');
    for (const value of list(row['primitives'])) {
      const primitive = object(value), position = accessor(object(primitive['attributes'])['POSITION']);
      if (position.component !== 5126) throw new Error('Static GLB positions must be floats');
      const indices = primitive['indices'] === undefined ? undefined : accessor(primitive['indices']);
      for (let i = 0; i < (indices?.n ?? position.n); i += 3) {
        const triangle = Array.from({ length: 3 }, (_, j) => {
          const index = indices === undefined ? i + j : read(indices, i + j, 0);
          if (!Number.isSafeInteger(index) || index < 0 || index >= position.n) throw new Error('GLB geometry index outside positions');
          return glbPoint(matrix, { x: read(position, index, 0), y: read(position, index, 1), z: read(position, index, 2) });
        });
        visit(triangle);
      }
    }
  };
  nodes.forEach((node, id) => {
    if (node['mesh'] === undefined) return;
    if (node['skin'] !== undefined) throw new Error('Static prop footprint cannot use a deforming skin');
    const transform = world(id);
    if (node['extensions'] === undefined) { mesh(number(node['mesh']), transform); return; }
    const attributes = object(object(object(node['extensions'])['EXT_mesh_gpu_instancing'])['attributes']);
    const entries = Object.entries(attributes).map(([key, value]) => ({ key, a: accessor(value) })), count = entries[0]?.a.n ?? 0;
    for (let i = 0; i < count; i++) {
      const instance: Record<string, unknown> = {};
      for (const { key, a } of entries) instance[key.toLowerCase()] = Array.from({ length: key === 'ROTATION' ? 4 : 3 }, (_, c) => read(a, i, c));
      mesh(number(node['mesh']), multiply(transform, glbTransform(instance)));
    }
  });
  if (nodes.length === 0) meshes.forEach((_mesh, id) => mesh(id, identity));
}
