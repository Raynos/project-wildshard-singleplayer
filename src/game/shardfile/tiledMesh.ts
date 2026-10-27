/**
 * Tile streaming T3 (G652): a merged recipe mesh (a scene step's rock set, wreck, trail…) by tile. Its triangles are
 * sorted once by the tile of their centroid (cell-local), and the mesh keeps one draw whose index holds only the resident
 * tiles' triangles, so tiling changes what it draws, never how many draws it takes.
 *
 *   const content = tiledMesh('rocks.shore', mesh, mesh.matrixWorld);   // null: nothing to tile
 *   if (content !== null) handles.addTiled(content);                   // the tile driver attaches its tiles
 *
 * An instanced part (a step's palms, hibiscus, reef) is sorted by the tile of each instance's position instead, and keeps
 * one draw whose first `count` instances are the resident tiles' (every per-instance attribute compacted alike).
 *
 * A mesh that is skinned, morphing or multi-material stays whole, as does one whose triangles (or instances) all fall in a
 * single tile (a moving part, say: its install pose says nothing about where it goes) and an instanced part with a
 * per-frame hook of its own (a culler that owns its count). Static content (`single`: a frozen weld's mesh) never moves,
 * so a mesh wholly in one tile follows that tile.
 */
import { BufferAttribute, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type Matrix4, type Mesh, Object3D, SkinnedMesh } from 'three';
import { compactResident, tileRanges, type TileContent } from './tileContent';

/** The tiles content of `mesh` (its geometry in `toCell` cell-local space), drawing nothing until a tile attaches. */
export function tiledMesh(id: string, mesh: Mesh, toCell: Matrix4, options: { readonly single?: boolean } = {}): TileContent | null {
  if (instanced(mesh)) return tiledInstances(id, mesh, toCell);
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  if (mesh instanceof SkinnedMesh || Array.isArray(mesh.material) || geometry.groups.length > 0
    || Object.keys(geometry.morphAttributes).length > 0 || !(position instanceof BufferAttribute) || position.count === 0) return null;
  const index = geometry.index ?? new BufferAttribute(position.count > 65535 ? Uint32Array.from({ length: position.count }, (_, k) => k) : Uint16Array.from({ length: position.count }, (_, k) => k), 1);
  const triangles = Math.floor(index.count / 3), centroids = new Float32Array(triangles * 2), e = toCell.elements;
  for (let t = 0; t < triangles; t++) {
    let x = 0, y = 0, z = 0;
    for (let c = 0; c < 3; c++) { const v = index.getX(t * 3 + c); x += position.getX(v); y += position.getY(v); z += position.getZ(v); }
    x /= 3; y /= 3; z /= 3;
    centroids[t * 2] = e[0] * x + e[4] * y + e[8] * z + e[12];
    centroids[t * 2 + 1] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  const ranges = tileRanges(centroids, 2, 0, 1), tiles = new Set<number>();
  ranges.count.forEach((n, key) => { if (n > 0) tiles.add(key); });
  if (tiles.size < (options.single === true ? 1 : 2)) return null;
  // the source order stays on the CPU (the index is small next to the vertices); the drawn index is rewritten in place
  const source = index.array.slice(), resident = new Set<number>();
  if (geometry.index === null) geometry.setIndex(index);
  // rewritten on every tile change: never a static buffer whose CPU copy a GPU-only release may drop (E264)
  index.setUsage(DynamicDrawUsage);
  const draw = (): void => {
    const count = compactResident(ranges, resident, source, index.array, 3);
    geometry.setDrawRange(0, count * 3); index.needsUpdate = true;
  };
  draw();
  return { id, tiles: () => tiles, attach: (tile, scope) => {
    if (!tiles.has(tile) || scope.disposed) return Promise.resolve();
    resident.add(tile); draw();
    scope.onDispose(() => { resident.delete(tile); draw(); });
    return Promise.resolve();
  } };
}

function instanced(mesh: Mesh): mesh is InstancedMesh { return mesh instanceof InstancedMesh; }
/** geometries whose per-instance channels a tiled part already compacts (a shared geometry is never compacted twice) */
const claimed = new WeakSet();

/** An instanced part by tile: each instance's position (cell-local, through `toCell`) picks its tile; the first `count`
 *  instances drawn are the resident tiles', every per-instance attribute rewritten from its CPU copy. */
function tiledInstances(id: string, mesh: InstancedMesh, toCell: Matrix4): TileContent | null {
  if (mesh.onBeforeRender !== Object3D.prototype.onBeforeRender || mesh.count < 2) return null;
  const matrices = mesh.instanceMatrix.array, e = toCell.elements, n = mesh.count, places = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const x = matrices[k * 16 + 12] ?? 0, y = matrices[k * 16 + 13] ?? 0, z = matrices[k * 16 + 14] ?? 0;
    places[k * 2] = e[0] * x + e[4] * y + e[8] * z + e[12];
    places[k * 2 + 1] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  const ranges = tileRanges(places, 2, 0, 1), tiles = new Set<number>();
  ranges.count.forEach((count, key) => { if (count > 0) tiles.add(key); });
  if (tiles.size < 2) return null;
  // the instance matrices, colours and per-instance geometry channels (a seed, a sway phase) move together
  const channels = [mesh.instanceMatrix, ...(mesh.instanceColor === null ? [] : [mesh.instanceColor]),
    ...Object.values(mesh.geometry.attributes).filter((attribute): attribute is InstancedBufferAttribute => attribute instanceof InstancedBufferAttribute)];
  // every channel must hold the part's instances (a per-instance channel on a geometry shared with another part may hold
  // fewer: compacting it would overrun), and a geometry's own channels are compacted by one part only
  const shared = channels.length > 1 + (mesh.instanceColor === null ? 0 : 1);
  if (channels.some(channel => channel.array.length < n * channel.itemSize) || (shared && claimed.has(mesh.geometry))) return null;
  if (shared) claimed.add(mesh.geometry);
  // rewritten on every tile change: never static channels whose CPU copies a GPU-only release drops after upload (E264;
  // a released per-instance channel overran here entering Nine)
  for (const channel of channels) channel.setUsage(DynamicDrawUsage);
  const copies = channels.map(channel => ({ channel, source: channel.array.slice(0, n * channel.itemSize) })), resident = new Set<number>();
  const draw = (): void => {
    let count = 0;
    for (const { channel, source } of copies) { count = compactResident(ranges, resident, source, channel.array, channel.itemSize); channel.needsUpdate = true; }
    mesh.count = count;
  };
  draw();
  return { id, tiles: () => tiles, attach: (tile, scope) => {
    if (!tiles.has(tile) || scope.disposed) return Promise.resolve();
    resident.add(tile); draw();
    scope.onDispose(() => { resident.delete(tile); draw(); });
    return Promise.resolve();
  } };
}
