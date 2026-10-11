import * as v from 'valibot';
import { WIRE_CELL } from './wireLimits';
import { SocketLiftSchema } from './socketLift';
import { PortalLinkSchema } from './portalLink';

const ENTRY_WIDTH = WIRE_CELL.entryWidth;
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
