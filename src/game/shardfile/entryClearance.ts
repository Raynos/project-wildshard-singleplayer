import type { ShardEntryways } from './entryways';
import type { ShardProps } from './props';
import type { ShardWater } from './water';
import { entryFootprints, clipEntryPolygon, obstructsEntry, type EntryVertex, type EntryFootprint } from './entryGeometry';
import { visitGlbTriangles } from './assets';
import { glbPoint, glbTransform } from './glbTriangles';
import { WAVES } from '@wildshard/engine/world/waves';

type Box = Extract<ShardProps['colliders'][number]['shapes'][number], { kind: 'box' }>;
function boxTriangles(box: Box, visit: (triangle: readonly EntryVertex[]) => void): void {
  const q = box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) };
  const matrix = glbTransform({ translation: [box.x, box.y, box.z], rotation: [q.x, q.y, q.z, q.w] });
  const points = Array.from({ length: 8 }, (_, i) => glbPoint(matrix, { x: (i & 1) === 0 ? -box.hx : box.hx, y: (i & 2) === 0 ? -box.hy : box.hy, z: (i & 4) === 0 ? -box.hz : box.hz }));
  for (const face of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) {
    const vertices = face.map((i) => { const p = points[i]; if (p === undefined) throw new Error('Missing box vertex'); return p; });
    const a = vertices[0], b = vertices[1], c = vertices[2], d = vertices[3]; if (a === undefined || b === undefined || c === undefined || d === undefined) throw new Error('Missing box face');
    visit([a, b, c]); visit([a, c, d]);
  }
}
function circleIntersects(x: number, z: number, radius: number, rect: EntryFootprint): boolean {
  return Math.hypot(x - Math.max(rect.minX, Math.min(rect.maxX, x)), z - Math.max(rect.minZ, Math.min(rect.maxZ, z))) < radius;
}
function segmentIntersects(a: EntryVertex, b: EntryVertex, radius: number, rect: EntryFootprint): boolean {
  if (clipEntryPolygon([a, b], rect).length > 0) return true;
  if (circleIntersects(a.x, a.z, radius, rect) || circleIntersects(b.x, b.z, radius, rect)) return true;
  const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz;
  return [[rect.minX, rect.minZ], [rect.maxX, rect.minZ], [rect.maxX, rect.maxZ], [rect.minX, rect.maxZ]].some(([x, z]) => {
    if (x === undefined || z === undefined) throw new Error('Missing rectangle corner');
    const t = n === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / n));
    return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < radius;
  });
}
/** Refuse declared props, potential collision states and water throughout each socket before allocating a world. */
export function validateEntrywayClearance(source: { entryways: ShardEntryways; props: ShardProps | null; water: ShardWater }, assets: ReadonlyMap<string, Uint8Array>): void {
  const rectangles = entryFootprints(source.entryways);
  const inspect = (triangle: readonly EntryVertex[]) => {
    if (rectangles.some((rect) => obstructsEntry(triangle, rect))) throw new Error('illegal shard: entryway footprint must be clear of props and colliders above road height');
  };
  if (source.props !== null) {
    const props = source.props;
    // Library models are reusable local assets, not placed objects. All actual tiles, far proxies and panels are placed.
    const hashes = new Set([...props.tiles.map((tile) => tile.file), ...props.panels.map((panel) => panel.file), ...(props.far === null ? [] : [props.far])]);
    for (const hash of hashes) { const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Missing entryway prop asset'); visitGlbTriangles(bytes, inspect); }
    // Hidden/inactive panels can become active, so their authored shapes still count.
    for (const row of props.colliders) for (const shape of row.shapes) {
      if (shape.kind === 'box') boxTriangles(shape, inspect);
      else {
        const dx = shape.to.x - shape.from.x, dz = shape.to.z - shape.from.z, run = Math.hypot(dx, dz) / shape.count, rise = (shape.to.y - shape.from.y) / shape.count;
        for (let i = 0; i < shape.count; i++) {
          const f = (i + 0.5) / shape.count, hy = Math.max(0.01, rise * (i + 1) / 2);
          boxTriangles({ kind: 'box', x: shape.from.x + dx * f, y: shape.from.y + hy, z: shape.from.z + dz * f, hx: shape.width / 2, hy, hz: run / 2, yaw: Math.atan2(dx, dz) }, inspect);
        }
      }
    }
  }
  for (const water of source.water) for (const [index, rect] of rectangles.entries()) {
    const entry = source.entryways[index]; if (entry === undefined) throw new Error('Missing water entryway');
    if (water.dryEntries?.includes(entry.edge)) continue;
    const socket = entry.kind === 'socketOverWater' || entry.kind === 'socketLift' || entry.kind === 'portalLink';
    let wet = false;
    // Sum of absolute amplitudes bounds every swell phase; a below-road sea is safe only below that crest.
    if (water.kind === 'sea') wet = socket || water.level + (water.waves ? WAVES.reduce((sum, wave) => sum + Math.abs(wave[2]), 0) : 0) >= 0;
    else if (water.kind === 'pool' && (socket || water.level >= 0)) {
      const shape = water.shape;
      wet = shape.kind === 'circle' ? circleIntersects(shape.x, shape.z, shape.radius, rect)
        : clipEntryPolygon(shape.points.map(([x, z]) => ({ x, y: water.level, z })), rect).length > 0;
    } else if (water.kind === 'stream') {
      for (let i = 1; i < water.points.length; i++) {
        const a = water.points[i - 1], b = water.points[i]; if (a === undefined || b === undefined || (!socket && Math.max(a.level, b.level) < 0)) continue;
        if (socket) { wet ||= segmentIntersects({ x: a.x, y: 0, z: a.z }, { x: b.x, y: 0, z: b.z }, water.width / 2, rect); continue; }
        const t = a.level === b.level ? 0 : Math.max(0, Math.min(1, -a.level / (b.level - a.level)));
        const at = { x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t };
        const start = a.level < 0 ? at : { x: a.x, y: a.level, z: a.z }, end = b.level < 0 ? at : { x: b.x, y: b.level, z: b.z };
        wet ||= segmentIntersects(start, end, water.width / 2, rect);
      }
    }
    if (wet) throw new Error('illegal shard: entryway footprint must be dry');
  }
}
