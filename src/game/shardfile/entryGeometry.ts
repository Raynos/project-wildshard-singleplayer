import { ENTRY_ASPHALT } from '@wildshard/engine/core/config';
import type { ShardEntryways } from './entryways';

/** Shard-local, closed road approach rectangle; its depth comes from the platform contract. */
export interface EntryFootprint { minX: number; maxX: number; minZ: number; maxZ: number }
/** A point on an admitted collision or visual triangle, independent of a renderer or physics world. */
export interface EntryVertex { x: number; y: number; z: number }
/** The authored ground under the platform socket, with north on positive z. */
export function entryFootprints(entries: readonly Pick<ShardEntryways[number], 'edge' | 'width'>[]): EntryFootprint[] {
  return entries.map((entry) => {
    const half = entry.width / 2;
    switch (entry.edge) {
      case 'north': return { minX: -half, maxX: half, minZ: 250 - ENTRY_ASPHALT, maxZ: 250 };
      case 'south': return { minX: -half, maxX: half, minZ: -250, maxZ: -250 + ENTRY_ASPHALT };
      case 'east': return { minX: 250 - ENTRY_ASPHALT, maxX: 250, minZ: -half, maxZ: half };
      case 'west': return { minX: -250, maxX: -250 + ENTRY_ASPHALT, minZ: -half, maxZ: half };
      default: throw new Error('Invalid entryway edge');
    }
  });
}
/** Clip actual triangles to a footprint, preserving height at every intersection; no sampling gaps. */
export function clipEntryPolygon(vertices: readonly EntryVertex[], rect: EntryFootprint): EntryVertex[] {
  let polygon = [...vertices];
  for (const [axis, limit, direction] of [['x', rect.minX, 1], ['x', rect.maxX, -1], ['z', rect.minZ, 1], ['z', rect.maxZ, -1]] as const) {
    const input = polygon; polygon = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length]; if (a === undefined || b === undefined) continue;
      const da = (a[axis] - limit) * direction, db = (b[axis] - limit) * direction;
      if (da >= 0) polygon.push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db);
        polygon.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      }
    }
  }
  return polygon;
}
/** Does any triangle surface rise above the road inside its open clearance rectangle? Touching a side wall is legal. */
export function obstructsEntry(vertices: readonly EntryVertex[], rect: EntryFootprint): boolean {
  const clipped = clipEntryPolygon(vertices, rect), above: EntryVertex[] = [];
  for (let i = 0; i < clipped.length; i++) {
    const a = clipped[i], b = clipped[(i + 1) % clipped.length]; if (a === undefined || b === undefined) continue;
    if (a.y >= 0) above.push(a);
    if ((a.y < 0) !== (b.y < 0)) { const t = a.y / (a.y - b.y); above.push({ x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t }); }
  }
  if (!above.some((point) => point.y > 0)) return false;
  const x = above.reduce((sum, p) => sum + p.x, 0) / above.length, z = above.reduce((sum, p) => sum + p.z, 0) / above.length;
  return x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ;
}
