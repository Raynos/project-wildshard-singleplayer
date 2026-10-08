import * as v from 'valibot';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { AccentSchema } from '../shardfile/accent';

const id = v.pipe(v.string(), v.regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const signed = v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(1));
const local = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
/** one number panel: a cell-local spot (metres, x east, y up, z north) on the copy's own structures, facing `yaw` (0 = +z) */
const mark = v.strictObject({ x: local, y: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(250)), z: local, yaw: v.pipe(v.number(), v.finite()), size: v.pipe(v.number(), v.minValue(0.5), v.maxValue(12)) });
/**
 * Playtest 1 (SF52 / G220): a shared product's copy identity, data only. Its HUD accent inside the cell and where its
 * number stands (copyIdentity.ts); the copies keep sharing one product's bytes.
 */
const identity = v.strictObject({ accent: AccentSchema, marks: v.pipe(v.array(mark), v.maxLength(8)) });
const placement = v.strictObject({ instance: id, slug: id, cell: v.tuple([signed, signed]), identity: v.optional(identity) });
/** G198 / G219: an open plot, a platform cell with no shard (the void floor, four entry showrooms and a centrepiece). */
const plot = v.strictObject({ instance: id, cell: v.tuple([signed, signed]) });
const channel = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1));
const colour = v.tuple([channel, channel, channel]);
const distance = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Platform placement data, independent of package content and standalone shard coordinates. */
export const GridCatalogueSchema = v.pipe(v.strictObject({ version: v.literal(0), pitch: v.literal(CONTENT_CAPS.pitch),
  cells: v.pipe(v.array(placement), v.minLength(1), v.maxLength(9)), plots: v.optional(v.pipe(v.array(plot), v.maxLength(8)), []), developer: v.pipe(v.array(placement), v.maxLength(9)), devserver: v.pipe(v.array(placement), v.maxLength(9)),
  emptyNeighbour: v.strictObject({ kind: v.literal('sea'), level: v.literal(0), edgeColour: colour,
    fog: v.pipe(v.strictObject({ colour, near: distance, far: distance }), v.check((row) => row.far > row.near, 'increasing fog distance')) }),
}), v.check((rows) => {
  const valid = (entries: readonly { instance: string; cell: readonly [number, number] }[]): boolean => new Set(entries.map((row) => row.instance)).size === entries.length && new Set(entries.map((row) => row.cell.join(','))).size === entries.length;
  // the base layout is complete: shards and open plots fill all nine cells once; an override replaces a base cell or a plot
  const base = [...rows.cells, ...rows.plots], spans = (axis: 0 | 1): boolean => [-1, 0, 1].every((n) => rows.cells.some((row) => row.cell[axis] === n));
  return valid(base) && base.length === 9 && valid(rows.developer) && valid(rows.devserver) && spans(0) && spans(1)
    && [...rows.developer, ...rows.devserver].every((row) => base.some((at) => at.cell[0] === row.cell[0] && at.cell[1] === row.cell[1]));
}, 'unique stable instance identities and complete signed cell layout'));
/** Admitted assembly input; a cell remains a mutable placement attribute, never a save namespace. */
export type GridCatalogue = v.InferOutput<typeof GridCatalogueSchema>;
/** A copy's declared identity: its accent and its number panels (copyIdentity.ts). */
export type CopyIdentity = v.InferOutput<typeof identity>;
/** Catalogue placement before its render origin is derived. */
export type GridPlacement = GridCatalogue['cells'][number];
/** An open plot's placement (G198): no shard, so no slug, no save namespace and no simulation. */
export type GridPlotPlacement = GridCatalogue['plots'][number];
/** Runtime switches originate from Settings and build-time DEVSERVER; Nine Dragon defaults on only in DEVSERVER. */
export interface GridMode { developer: boolean; devserver: boolean; nineDragon?: boolean }
/** Reject malformed or duplicate placement data before allocating an assembly. */
export function parseGridCatalogue(input: unknown): GridCatalogue { return v.parse(GridCatalogueSchema, input); }
