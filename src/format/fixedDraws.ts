import { isJsonData } from './json';
import * as v from 'valibot';
import { SceneBakedGeometrySchema } from './sceneDressing';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const offset = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2 ** 31));
/** A shard's named fixed draws, each slot from exactly one source, its channels renamed as declared (source, name):
 *  - `file`: a product file: one GLB mesh, or, with `baked`, exactly one baked geometry block (format/sceneDressing's
 *    layout: each attribute, then the index as int32 deltas, 4-byte aligned; `expand` draws it non-indexed);
 *  - `lane`: a baked block at `offset` in a lane-shuffled bake (`url`, fetched once for every row naming it);
 *  - `inline`: a baked block, zlib-deflated and base64 in the row (small shapes a view builds at once).
 *  `lane` and `inline` always carry `baked`. */
const channels = v.pipe(v.array(v.strictTuple([text, text])), v.maxLength(16));
export const FixedDrawRowsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Fixed draws require plain JSON'), v.array(v.union([
  v.strictObject({ slot: text, channels, file: text, baked: v.exactOptional(SceneBakedGeometrySchema) }),
  v.strictObject({ slot: text, channels, lane: v.strictObject({ url: text, offset }), baked: SceneBakedGeometrySchema }),
  v.strictObject({ slot: text, channels, inline: v.pipe(v.string(), v.minLength(1), v.maxLength(1048576)), baked: SceneBakedGeometrySchema }),
])), v.minLength(1), v.maxLength(128));

