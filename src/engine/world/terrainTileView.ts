/**
 * The render half of a baked terrain tile (SHARD-PLATFORM SF15a, SF9a's wire format): one mesh per admitted tile, its
 * triangles split along the same diagonal as the Rapier heightfield collider (`terrainTileHeight`), so the drawn ground is
 * the ground the player stands on. The tile's lifetime is the scope it is handed: the scope owns the geometry and takes
 * the mesh out of the scene on dispose. Only the coarse tile's index stays on the CPU (refinement rewrites it in place);
 * the other vertex data is GPU-only after its first upload.
 *
 * - **Coarse tiles** (L1: 125 m, 17 × 17 samples) can hide any of their four quadrants in place while fine tiles cover
 *   them (`maskTerrainTile`): one index allocation, one draw, no overlapping surfaces.
 * - **Every other tile** (L0) hangs a skirt below its four edges, so the step where a fine edge meets a coarse neighbour's
 *   straighter edge never opens a crack. The skirt sits under the surface and never changes where the ground is.
 * - Normals come from the height grid itself (central differences; second-order one-sided at a tile edge), so two tiles
 *   that share an edge light it alike.
 */
import { BufferAttribute, BufferGeometry, Mesh, type Material, type Object3D } from 'three';
import type { Scope } from '../app/scope';
import { gpuOnlyAttributes } from '../core/gpuOnly';
import { decodeTerrainTile, type TerrainTileData } from './terrainTileData';

/** the coarse (L1) tile a quadrant mask applies to: 17 × 17 samples over 125 m, four 8 × 8-cell quadrants */
const COARSE = { resolution: 17, size: 125, half: 8 } as const;

interface TileState { readonly indices: BufferAttribute; readonly resolution: number }
const coarseTiles = new WeakMap<Mesh, TileState>();

/** True when this tile is a coarse tile whose quadrants refinement may hide. */
function isCoarse(data: TerrainTileData): boolean { return data.resolution === COARSE.resolution && data.size === COARSE.size; }

/** Grid normals: central differences inside, second-order one-sided differences on an edge (both tiles agree to O(h²)). */
function gridNormals(data: TerrainTileData, out: Float32Array): void {
  const r = data.resolution, step = data.size / (r - 1), h = (x: number, z: number): number => data.heights[z * r + x] ?? 0;
  const slope = (at: number, sample: (i: number) => number): number => {
    if (r === 2) return (sample(1) - sample(0)) / step;
    if (at === 0) return (-3 * sample(0) + 4 * sample(1) - sample(2)) / (2 * step);
    if (at === r - 1) return (3 * sample(r - 1) - 4 * sample(r - 2) + sample(r - 3)) / (2 * step);
    return (sample(at + 1) - sample(at - 1)) / (2 * step);
  };
  for (let z = 0; z < r; z++) for (let x = 0; x < r; x++) {
    const dx = slope(x, (i) => h(i, z)), dz = slope(z, (i) => h(x, i)), length = Math.hypot(dx, 1, dz), at = (z * r + x) * 3;
    out[at] = -dx / length; out[at + 1] = 1 / length; out[at + 2] = -dz / length;
  }
}

/** The perimeter in walk order (+x along z = 0, +z along x = r − 1, −x along z = r − 1, −z along x = 0): skirts face outward. */
function perimeter(r: number): number[] {
  const ring: number[] = [];
  for (let x = 0; x < r - 1; x++) ring.push(x);
  for (let z = 0; z < r - 1; z++) ring.push(z * r + r - 1);
  for (let x = r - 1; x > 0; x--) ring.push((r - 1) * r + x);
  for (let z = r - 1; z > 0; z--) ring.push(z * r);
  return ring;
}

/**
 * Install one admitted terrain render tile under `root`; `scope` owns its geometry and its place in the scene.
 * The mesh receives shadows; it casts them only when `shadow` is set (an L0 tile wholly inside the shadow disc). `material`
 * stays the caller's (one family material shared by every tile).
 */
export function installTerrainTile(bytes: Uint8Array, ports: { root: Object3D; scope: Scope; material: Material; shadow: boolean }): Mesh {
  if (ports.scope.disposed) throw new Error('terrain tile: its scope is already disposed');
  const data = decodeTerrainTile(bytes), r = data.resolution, colours = data.colours;
  if (colours === undefined) throw new Error('terrain tile: a render tile needs vertex colours (a heights-only payload is a collider)');
  const coarse = isCoarse(data), ring = coarse ? [] : perimeter(r), grid = r * r, vertices = grid + ring.length;
  const gridIndices = (r - 1) ** 2 * 6, total = gridIndices + ring.length * 6;
  // a coarse tile has no skirt, so it draws the decoded colours as they are; a skirted tile extends a copy
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), colour = coarse ? colours : new Float32Array(vertices * 3);
  const indices = vertices > 65535 ? new Uint32Array(total) : new Uint16Array(total), cell = data.size / (r - 1);
  for (let z = 0; z < r; z++) for (let x = 0; x < r; x++) {
    const vertex = z * r + x, at = vertex * 3;
    positions[at] = x * cell; positions[at + 1] = data.heights[vertex] ?? 0; positions[at + 2] = z * cell;
    // Rapier's split: the triangles (x, z) (x, z+1) (x+1, z) and (x+1, z) (x, z+1) (x+1, z+1), diagonal (x+1, z)–(x, z+1).
    if (x < r - 1 && z < r - 1) indices.set([vertex, vertex + r, vertex + 1, vertex + 1, vertex + r, vertex + r + 1], (z * (r - 1) + x) * 6);
  }
  if (!coarse) colour.set(colours);
  gridNormals(data, normals);
  const depth = data.size / 16;
  ring.forEach((border, i) => {
    const skirt = grid + i, next = (i + 1) % ring.length, from = border * 3, to = skirt * 3;
    positions[to] = positions[from] ?? 0; positions[to + 1] = (positions[from + 1] ?? 0) - depth; positions[to + 2] = positions[from + 2] ?? 0;
    for (let c = 0; c < 3; c++) { normals[to + c] = normals[from + c] ?? 0; colour[to + c] = colour[from + c] ?? 0; }
    const b = ring[next] ?? border;
    indices.set([border, b, skirt, b, grid + next, skirt], gridIndices + i * 6);
  });
  const geometry = ports.scope.own(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colour, 3));
  const index = new BufferAttribute(indices, 1);
  geometry.setIndex(index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  // normals and colours are read by nothing after the upload; position and the index stay for picking raycasts
  gpuOnlyAttributes(geometry, 'shardfile.terrain', ['position']);
  const mesh = new Mesh(geometry, ports.material);
  mesh.name = `terrain:${data.x},${data.z}`; mesh.position.set(data.x, 0, data.z); mesh.receiveShadow = true; mesh.castShadow = ports.shadow;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  if (coarse) coarseTiles.set(mesh, { indices: index, resolution: r });
  ports.root.add(mesh); ports.scope.onDispose(() => { mesh.removeFromParent(); coarseTiles.delete(mesh); });
  return mesh;
}

/**
 * Hide a coarse tile's quadrants (0 = −x −z, 1 = +x −z, 2 = −x +z, 3 = +x +z) in place while fine tiles cover them.
 * The tile's one index buffer is rewritten and its draw range shortened, so no allocation, no extra draw and no
 * overlapping surface. An empty set shows the whole tile again; all four hides it from the draw list. A fine tile has
 * nothing under it: an empty set is a no-op there, any quadrant an error.
 */
export function maskTerrainTile(mesh: Mesh, excluded: ReadonlySet<number>): void {
  for (const quadrant of excluded) if (!Number.isInteger(quadrant) || quadrant < 0 || quadrant > 3) throw new Error('terrain tile: a quadrant is 0..3');
  const tile = coarseTiles.get(mesh);
  if (tile === undefined) {
    if (excluded.size === 0) return;
    throw new Error('terrain tile: only an installed coarse (L1) tile can mask quadrants');
  }
  const r = tile.resolution, array = tile.indices.array; let at = 0;
  for (let z = 0; z < r - 1; z++) for (let x = 0; x < r - 1; x++) {
    if (excluded.has(Number(x >= COARSE.half) + Number(z >= COARSE.half) * 2)) continue;
    const vertex = z * r + x;
    array[at] = vertex; array[at + 1] = vertex + r; array[at + 2] = vertex + 1;
    array[at + 3] = vertex + 1; array[at + 4] = vertex + r; array[at + 5] = vertex + r + 1; at += 6;
  }
  tile.indices.clearUpdateRanges(); tile.indices.addUpdateRange(0, at); tile.indices.needsUpdate = true;
  mesh.geometry.setDrawRange(0, at); mesh.visible = at > 0;
}
