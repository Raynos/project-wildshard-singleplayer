import * as v from 'valibot';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';

const finite = v.pipe(v.number(), v.finite());
const points = { north: [0, 0, 250], south: [0, 0, -250], east: [250, 0, 0], west: [-250, 0, 0] } as const;
/** A legal 500 m cube has exactly one opening at each edge midpoint, meeting the highway at y=0. */
export const EntrywaysSchema = v.pipe(v.array(v.strictObject({ edge: v.picklist(['north', 'east', 'south', 'west']), at: v.tuple([finite, finite, finite]),
  width: v.pipe(finite, v.minValue(0.1), v.maxValue(60)) }), 'illegal shard: four midpoint entryways are required'),
v.length(4, 'illegal shard: exactly four midpoint entryways are required'),
v.check((rows) => new Set(rows.map((row) => row.edge)).size === 4 && rows.every((row) => row.at.every((coordinate, axis) => coordinate === points[row.edge][axis])),
  'illegal shard: entryways must be unique edge midpoints at road height y=0'));
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
  return source.entryways.some((row) => source.edge[row.edge].roadHeight !== 0 || !flatOpening(source.edge[row.edge].heights, row.width))
    ? ['illegal shard: entryway opening must meet road height y=0 across its width'] : [];
}
/** Verify critical baked collision bytes instead of trusting a forged zero-height declaration. */
export function validateEntrywayTerrain(source: { entryways: ShardEntryways; terrain: { collider: string } | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  if (source.terrain === null) return;
  const bytes = assets.get(source.terrain.collider); if (bytes === undefined) throw new Error('Missing entryway terrain');
  const terrain = decodeTerrainTile(bytes);
  for (const entry of source.entryways) {
    const heights = Array.from({ length: terrain.resolution }, (_, i) => {
      const along = -250 + i * 500 / (terrain.resolution - 1);
      return terrainTileHeight(terrain, entry.edge === 'east' ? 250 : entry.edge === 'west' ? -250 : along, entry.edge === 'north' ? 250 : entry.edge === 'south' ? -250 : along);
    });
    if (!flatOpening(heights, entry.width)) throw new Error('illegal shard: baked entryway does not meet road height y=0');
  }
}
