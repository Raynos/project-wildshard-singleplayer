import * as v from 'valibot';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';

const id = v.pipe(v.string(), v.regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const signed = v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(1));
const placement = v.strictObject({ instance: id, slug: id, cell: v.tuple([signed, signed]) });
const channel = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1));
const colour = v.tuple([channel, channel, channel]);
const distance = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Platform placement data, independent of package content and standalone shard coordinates. */
export const GridCatalogueSchema = v.pipe(v.strictObject({ version: v.literal(0), pitch: v.literal(CONTENT_CAPS.pitch),
  cells: v.pipe(v.array(placement), v.length(9)), developer: v.pipe(v.array(placement), v.maxLength(9)), devserver: v.pipe(v.array(placement), v.maxLength(9)),
  emptyNeighbour: v.strictObject({ kind: v.literal('sea'), level: v.literal(0), edgeColour: colour,
    fog: v.pipe(v.strictObject({ colour, near: distance, far: distance }), v.check((row) => row.far > row.near, 'increasing fog distance')) }),
}), v.check((rows) => {
  const valid = (entries: typeof rows.cells): boolean => new Set(entries.map((row) => row.instance)).size === entries.length && new Set(entries.map((row) => row.cell.join(','))).size === entries.length;
  return valid(rows.cells) && valid(rows.developer) && valid(rows.devserver)
    && [...rows.developer, ...rows.devserver].every((row) => rows.cells.some((base) => base.cell[0] === row.cell[0] && base.cell[1] === row.cell[1]));
}, 'unique stable instance identities and complete signed cell layout'));
/** Admitted assembly input; a cell remains a mutable placement attribute, never a save namespace. */
export type GridCatalogue = v.InferOutput<typeof GridCatalogueSchema>;
/** Catalogue placement before its render origin is derived. */
export type GridPlacement = GridCatalogue['cells'][number];
/** Runtime switches originate from Settings and build-time DEVSERVER; Nine Dragon defaults on only in DEVSERVER. */
export interface GridMode { developer: boolean; devserver: boolean; nineDragon?: boolean }
/** Reject malformed or duplicate placement data before allocating an assembly. */
export function parseGridCatalogue(input: unknown): GridCatalogue { return v.parse(GridCatalogueSchema, input); }
