import * as v from 'valibot';
import { ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { decodeTerrainTile } from '@wildshard/engine/world/terrainTileData';
import { clipEntryPolygon, entryFootprints } from './entryGeometry';
import { SocketLiftSchema } from './socketLift';
import { PortalLinkSchema } from './portalLink';

const finite = v.pipe(v.number(), v.finite());
const points = { north: [0, 0, 250], south: [0, 0, -250], east: [250, 0, 0], west: [-250, 0, 0] } as const;
/** A legal 500 m cube has exactly one opening at each edge midpoint, meeting the highway at y=0. */
export const EntrywaysSchema = v.pipe(v.array(v.strictObject({ edge: v.picklist(['north', 'east', 'south', 'west']), at: v.tuple([finite, finite, finite]),
  kind: v.optional(v.picklist(['ground', 'socketOverWater', 'socketLift', 'portalLink'])), lift: v.exactOptional(SocketLiftSchema), portal: v.exactOptional(PortalLinkSchema),
  width: v.literal(ENTRY_WIDTH, 'illegal shard: entryways must be 8 metres wide') }), 'illegal shard: four midpoint entryways are required'),
v.length(4, 'illegal shard: exactly four midpoint entryways are required'),
v.check((rows) => new Set(rows.map((row) => row.edge)).size === 4 && rows.every((row) => row.at.every((coordinate, axis) => coordinate === points[row.edge][axis])),
  'illegal shard: entryways must be unique edge midpoints at road height y=0'),
v.check(rows => rows.every(row => (row.kind === 'socketLift') === (row.lift !== undefined)), 'illegal shard: only socketLift entries require a lift declaration'),
v.check(rows => rows.every(row => (row.kind === 'portalLink') === (row.portal !== undefined)), 'illegal shard: only portalLink entries require a portal declaration'));
/** Width is the full opening in metres along the boundary; it never overrides authored terrain. */
export type ShardEntryways = v.InferOutput<typeof EntrywaysSchema>;
function flatOpening(samples: readonly number[], width: number): boolean {
  const stride = 500 / (samples.length - 1), positions = [-width / 2, width / 2];
  for (let i = 0; i < samples.length; i++) { const position = -250 + i * stride; if (Math.abs(position) <= width / 2) positions.push(position); }
  return positions.every((position) => {
    const at = (position + 250) / stride, index = Math.min(samples.length - 2, Math.floor(at)), fraction = at - index;
    const a = samples[index], b = samples[index + 1]; return a !== undefined && b !== undefined && a + (b - a) * fraction === 0;
  });
}
/** Declared boundary rows must be flat at road height across each opening's full width. */
export function entrywayRules(source: { entryways: ShardEntryways; edge: Record<ShardEntryways[number]['edge'], { heights: readonly number[]; roadHeight: number }> }): string[] {
  return source.entryways.some((row) => source.edge[row.edge].roadHeight !== 0 || ((row.kind ?? 'ground') === 'ground' && !flatOpening(source.edge[row.edge].heights, row.width)))
    ? ['illegal shard: entryway opening must meet road height y=0 across its width'] : [];
}
/** Verify every native collision triangle across the full 8×15 m approach before platform floors exist. */
export function validateEntrywayTerrain(source: { entryways: ShardEntryways; terrain: { collider: string } | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  // The ordinary non-terrain loader supplies its full-cell implicit y=0 ground, independently of entry sockets.
  if (source.terrain === null) return;
  const bytes = assets.get(source.terrain.collider); if (bytes === undefined) throw new Error('Missing entryway terrain');
  const terrain = decodeTerrainTile(bytes);
  validateEntrywayGrid(source.entryways, terrain);
}
/** Inspect the original collision lattice, including fractional footprint boundaries; no resampling or socket floor is credited. */
export function validateEntrywayGrid(entryways: ShardEntryways, terrain: { resolution: number; x: number; z: number; size: number; heights: Float32Array }): void {
  const n = terrain.resolution - 1, stride = terrain.size / n;
  for (const [index, rect] of entryFootprints(entryways).entries()) {
    const kind = entryways[index]?.kind, socket = kind === 'socketOverWater' || kind === 'socketLift' || kind === 'portalLink';
    if (rect.minX < terrain.x || rect.maxX > terrain.x + terrain.size || rect.minZ < terrain.z || rect.maxZ > terrain.z + terrain.size) throw new Error('illegal shard: missing entryway ground footprint');
    const vertex = (x: number, z: number) => {
      const y = terrain.heights[z * terrain.resolution + x]; if (y === undefined) throw new Error('Missing terrain sample');
      return { x: terrain.x + x * stride, y, z: terrain.z + z * stride };
    };
    const x0 = Math.max(0, Math.floor((rect.minX - terrain.x) / stride)), x1 = Math.min(n - 1, Math.floor((rect.maxX - terrain.x) / stride));
    const z0 = Math.max(0, Math.floor((rect.minZ - terrain.z) / stride)), z1 = Math.min(n - 1, Math.floor((rect.maxZ - terrain.z) / stride));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const a = vertex(x, z), b = vertex(x + 1, z), c = vertex(x, z + 1), d = vertex(x + 1, z + 1);
      // Same diagonal as the baked Rapier heightfield, including fractional rectangle boundaries.
      for (const triangle of [[a, b, c], [d, c, b]]) if (clipEntryPolygon(triangle, rect).some((p) => socket ? p.y > 0 : p.y !== 0)) throw new Error(socket
        ? 'illegal shard: socket entryway terrain cannot rise above road height'
        : 'illegal shard: baked entryway footprint must be flat at road height y=0');
    }
  }
}
