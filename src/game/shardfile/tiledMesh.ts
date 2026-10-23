/**
 * Tile streaming T3 (G652): a merged recipe mesh (a scene step's rock set, wreck, trail…) by tile. Its triangles are
 * sorted once by the tile of their centroid (cell-local), and the mesh keeps one draw whose index holds only the resident
 * tiles' triangles, so tiling changes what it draws, never how many draws it takes.
 *
 *   const content = tiledMesh('rocks.shore', mesh, mesh.matrixWorld);   // null: nothing to tile
 *   if (content !== null) handles.addTiled(content);                   // the tile driver attaches its tiles
 *
 * A mesh that is instanced, skinned, morphing or multi-material stays whole, as does one whose triangles all fall in a
 * single tile (a moving part, say: its install pose says nothing about where it goes).
 */
import { BufferAttribute, InstancedMesh, type Matrix4, type Mesh, SkinnedMesh } from 'three';
import { compactResident, tileRanges, type TileContent } from './tileContent';

/** The tiles content of `mesh` (its geometry in `toCell` cell-local space), drawing nothing until a tile attaches. */
export function tiledMesh(id: string, mesh: Mesh, toCell: Matrix4): TileContent | null {
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  if (mesh instanceof InstancedMesh || mesh instanceof SkinnedMesh || Array.isArray(mesh.material) || geometry.groups.length > 0
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
  if (tiles.size < 2) return null;
  // the source order stays on the CPU (the index is small next to the vertices); the drawn index is rewritten in place
  const source = index.array.slice(), resident = new Set<number>();
  if (geometry.index === null) geometry.setIndex(index);
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
