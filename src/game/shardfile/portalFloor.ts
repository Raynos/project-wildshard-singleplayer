import type { PortalLinkEntry } from './portalLink';
import type { ShardProps } from './props';
import type { ShardMeshCollision } from './meshCollision';
import { glbPoint, glbTransform } from './glbTriangles';
import { visitMeshTriangles } from './meshEntryways';
import { entryFootprints, type EntryVertex } from './entryGeometry';
import { convexEntryHull, entryCoverage } from './entryCoverage';

type Box = Extract<ShardProps['colliders'][number]['shapes'][number], { kind: 'box' }>;
function boxTop(box: Box): EntryVertex[][] {
  const q = box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) };
  const matrix = glbTransform({ translation: [box.x, box.y, box.z], rotation: [q.x, q.y, q.z, q.w] });
  const at = (x: number, z: number) => glbPoint(matrix, { x, y: box.hy, z });
  const a = at(-box.hx, -box.hz), b = at(box.hx, -box.hz), c = at(-box.hx, box.hz), d = at(box.hx, box.hz);
  return [[a, b, c], [d, c, b]];
}
/** Prove the entire named static road deck and each arrival capsule footprint from authored collision triangles. */
export function validatePortalFloors(entries: readonly PortalLinkEntry[], source: { props: ShardProps | null; meshCollision: ShardMeshCollision | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  const cache = new Map<string, EntryVertex[][]>();
  const triangles = (id: string): EntryVertex[][] => {
    const prior = cache.get(id); if (prior !== undefined) return prior;
    const result: EntryVertex[][] = [], row = source.props?.colliders.find(candidate => candidate.id === id);
    if (row !== undefined) {
      if (!row.initialActive || row.panel !== null) throw new Error('Portal floor is not permanent');
      for (const shape of row.shapes) {
        if (shape.kind === 'box') result.push(...boxTop(shape));
        else {
          const dx = shape.to.x - shape.from.x, dz = shape.to.z - shape.from.z, run = Math.hypot(dx, dz) / shape.count, rise = (shape.to.y - shape.from.y) / shape.count;
          for (let i = 0; i < shape.count; i++) {
            const f = (i + 0.5) / shape.count, hy = Math.max(0.01, rise * (i + 1) / 2);
            result.push(...boxTop({ kind: 'box', x: shape.from.x + dx * f, y: shape.from.y + hy, z: shape.from.z + dz * f, hx: shape.width / 2, hy, hz: run / 2, yaw: Math.atan2(dx, dz) }));
          }
        }
      }
    } else {
      const tile = source.meshCollision?.tiles.find(candidate => `mesh.tile.${candidate.x}.${candidate.z}` === id);
      if (tile === undefined) throw new Error('Unknown portal floor');
      visitMeshTriangles(tile.file, assets, triangle => { result.push([...triangle]); });
    }
    cache.set(id, result); return result;
  };
  const cover = (floor: string, y: number, polygon: EntryVertex[]): void => {
    const surfaces = triangles(floor).filter(triangle => triangle.every(vertex => Math.abs(vertex.y - y) <= 1e-9)).map(convexEntryHull);
    entryCoverage(surfaces)(polygon, 'Portal requires continuous named static floor');
  };
  for (const entry of entries) {
    const rect = entryFootprints([{ edge: entry.edge, width: 8 }])[0]; if (rect === undefined) throw new Error('Missing portal road footprint');
    cover(entry.portal.road.floor, 0, [{ x: rect.minX, y: 0, z: rect.minZ }, { x: rect.maxX, y: 0, z: rect.minZ },
      { x: rect.maxX, y: 0, z: rect.maxZ }, { x: rect.minX, y: 0, z: rect.maxZ }]);
    for (const node of [entry.portal.road, entry.portal.destination, entry.portal.exit]) {
      const [x, y, z] = node.at;
      cover(node.floor, y, [{ x: x - 0.35, y, z: z - 0.35 }, { x: x + 0.35, y, z: z - 0.35 },
        { x: x + 0.35, y, z: z + 0.35 }, { x: x - 0.35, y, z: z + 0.35 }]);
    }
  }
}
