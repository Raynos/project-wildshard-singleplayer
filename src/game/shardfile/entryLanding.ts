import { decodeTerrainTile } from '@wildshard/engine/world/terrainTileData';
import type { ShardEntryways } from './entryways';
import type { ShardProps } from './props';
import { entryFootprints, clipEntryPolygon, type EntryFootprint, type EntryVertex } from './entryGeometry';
import { glbPoint, glbTransform } from './glbTriangles';
import type { ShardMeshCollision } from './meshCollision';
import { visitMeshTriangles } from './meshEntryways';

type Box = Extract<ShardProps['colliders'][number]['shapes'][number], { kind: 'box' }>;
function boxTop(box: Box): EntryVertex[][] {
  const q = box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) };
  const matrix = glbTransform({ translation: [box.x, box.y, box.z], rotation: [q.x, q.y, q.z, q.w] });
  const at = (x: number, z: number) => glbPoint(matrix, { x, y: box.hy, z });
  const a = at(-box.hx, -box.hz), b = at(box.hx, -box.hz), c = at(-box.hx, box.hz), d = at(box.hx, box.hz);
  return [[a, b, c], [d, c, b]];
}
function farLine(edge: ShardEntryways[number]['edge'], footprint: EntryFootprint): EntryFootprint {
  switch (edge) {
    case 'north': return { ...footprint, maxZ: footprint.minZ };
    case 'south': return { ...footprint, minZ: footprint.maxZ };
    case 'east': return { ...footprint, maxX: footprint.minX };
    case 'west': return { ...footprint, minX: footprint.maxX };
    default: throw new Error('Invalid entryway edge');
  }
}

/** Socket floors may bridge below-road ground only when actual collision surfaces meet their entire shard-side edge. */
export function validateSocketLandings(source: { entryways: ShardEntryways; terrain: { collider: string } | null; props: ShardProps | null; meshCollision?: ShardMeshCollision | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  const sockets = source.entryways.filter((entry) => entry.kind === 'socketOverWater');
  if (sockets.length === 0) return;
  const terrainBytes = source.terrain === null ? undefined : assets.get(source.terrain.collider);
  if (source.terrain !== null && terrainBytes === undefined) throw new Error('Missing socket landing terrain');
  const terrain = terrainBytes === undefined ? undefined : decodeTerrainTile(terrainBytes);
  const decks: EntryVertex[][] = [];
  for (const row of source.props?.colliders ?? []) {
    // Potential future / moving collision states and visible-only GLBs cannot prove a permanent walk surface.
    if (!row.initialActive || row.panel !== null) continue;
    for (const shape of row.shapes) {
      if (shape.kind === 'box') decks.push(...boxTop(shape));
      else {
        const dx = shape.to.x - shape.from.x, dz = shape.to.z - shape.from.z, run = Math.hypot(dx, dz) / shape.count, rise = (shape.to.y - shape.from.y) / shape.count;
        for (let i = 0; i < shape.count; i++) {
          const f = (i + 0.5) / shape.count, hy = Math.max(0.01, rise * (i + 1) / 2);
          decks.push(...boxTop({ kind: 'box', x: shape.from.x + dx * f, y: shape.from.y + hy, z: shape.from.z + dz * f, hx: shape.width / 2, hy, hz: run / 2, yaw: Math.atan2(dx, dz) }));
        }
      }
    }
  }
  for (const entry of sockets) {
    const footprint = entryFootprints([entry])[0]; if (footprint === undefined) throw new Error('Missing socket footprint');
    const line = farLine(entry.edge, footprint), axis = line.minX === line.maxX ? 'z' : 'x', intervals: [number, number][] = [];
    const inspect = (triangle: readonly EntryVertex[]): void => {
      const clipped = clipEntryPolygon(triangle, line);
      if (clipped.length === 0 || clipped.some((point) => point.y !== 0)) return;
      const values = clipped.map((point) => point[axis]); intervals.push([Math.min(...values), Math.max(...values)]);
    };
    for (const triangle of decks) inspect(triangle);
    // Interactive mesh panels may disappear; only permanent static chunks prove a landing.
    for (const row of source.meshCollision?.tiles ?? []) visitMeshTriangles(row.file, assets, inspect);
    if (terrain !== undefined) {
      const n = terrain.resolution - 1, stride = terrain.size / n;
      const vertex = (x: number, z: number): EntryVertex => {
        const y = terrain.heights[z * terrain.resolution + x]; if (y === undefined) throw new Error('Missing landing terrain sample');
        return { x: terrain.x + x * stride, y, z: terrain.z + z * stride };
      };
      const x0 = Math.max(0, Math.floor((line.minX - terrain.x) / stride)), x1 = Math.min(n - 1, Math.floor((line.maxX - terrain.x) / stride));
      const z0 = Math.max(0, Math.floor((line.minZ - terrain.z) / stride)), z1 = Math.min(n - 1, Math.floor((line.maxZ - terrain.z) / stride));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const a = vertex(x, z), b = vertex(x + 1, z), c = vertex(x, z + 1), d = vertex(x + 1, z + 1);
        inspect([a, b, c]); inspect([d, c, b]);
      }
    }
    const min = axis === 'x' ? line.minX : line.minZ, max = axis === 'x' ? line.maxX : line.maxZ;
    let reached = min;
    for (const [start, end] of intervals.sort((a, b) => a[0] - b[0])) {
      if (start > reached) break;
      reached = Math.max(reached, end);
    }
    if (reached < max) throw new Error('illegal shard: socket entryway requires a full-width collision landing at road height y=0');
  }
}
