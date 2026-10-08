import { decodeMeshCollision } from '@wildshard/engine/core/meshCollision';
import type { ShardMeshCollision } from './meshCollision';
import type { ShardEntryways } from './entryways';
import { clipEntryPolygon, entryFootprints, obstructsEntry, type EntryVertex } from './entryGeometry';
import { convexEntryHull, entryCoverage } from './entryCoverage';

/** Visit immutable collision triangles without allocating a physics world or retaining decoded chunks. */
export function visitMeshTriangles(file: string, assets: ReadonlyMap<string, Uint8Array>, visit: (triangle: readonly EntryVertex[]) => void): void {
  const bytes = assets.get(file); if (bytes === undefined) throw new Error('Missing mesh collision asset');
  const mesh = decodeMeshCollision(bytes);
  const vertex = (index: number): EntryVertex => {
    const x = mesh.vertices[index * 3], y = mesh.vertices[index * 3 + 1], z = mesh.vertices[index * 3 + 2];
    if (x === undefined || y === undefined || z === undefined) throw new Error('Missing mesh collision vertex');
    return { x, y, z };
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
    if (a === undefined || b === undefined || c === undefined) throw new Error('Missing mesh collision triangle');
    visit([vertex(a), vertex(b), vertex(c)]);
  }
}

/** Prove continuous road-height mesh ground; future panel states cannot supply ground or conceal obstructions. */
export function validateMeshEntryways(source: { meshCollision: ShardMeshCollision | null; entryways: ShardEntryways }, assets: ReadonlyMap<string, Uint8Array>): void {
  const data = source.meshCollision; if (data === null) return;
  const footprints = entryFootprints(source.entryways), surfaces = footprints.map((): EntryVertex[][] => []);
  const inspect = (triangle: readonly EntryVertex[], permanent: boolean): void => {
    for (const [index, rect] of footprints.entries()) {
      const entry = source.entryways[index], flat = surfaces[index];
      if (entry === undefined || flat === undefined) throw new Error('Missing mesh entry footprint');
      if (obstructsEntry(triangle, rect)) throw new Error(`illegal shard: mesh entryway ${entry.edge} footprint obstructed above road height`);
      if (!permanent || (entry.kind ?? 'ground') !== 'ground') continue;
      const clipped = clipEntryPolygon(triangle, rect);
      if (clipped.length >= 3 && clipped.every(point => point.y === 0)) flat.push(convexEntryHull(clipped));
    }
  };
  for (const row of data.tiles) visitMeshTriangles(row.file, assets, triangle => inspect(triangle, true));
  for (const row of data.panels) visitMeshTriangles(row.file, assets, triangle => inspect(triangle, false));
  for (const [index, rect] of footprints.entries()) {
    const entry = source.entryways[index], flat = surfaces[index];
    if (entry === undefined || flat === undefined) throw new Error('Missing mesh entry footprint');
    if ((entry.kind ?? 'ground') !== 'ground') continue;
    entryCoverage(flat)([{ x: rect.minX, y: 0, z: rect.minZ }, { x: rect.maxX, y: 0, z: rect.minZ },
      { x: rect.maxX, y: 0, z: rect.maxZ }, { x: rect.minX, y: 0, z: rect.maxZ }],
    `illegal shard: mesh entryway ${entry.edge} requires continuous road-height ground across the full footprint`);
  }
}
