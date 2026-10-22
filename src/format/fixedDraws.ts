import * as v from 'valibot';
import { SceneBakedGeometrySchema } from './sceneDressing';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** A shard's named fixed draws: each slot a product file, its channels renamed as declared (source, name). The file is
 *  one GLB mesh, or, with `baked`, exactly one baked geometry block (format/sceneDressing's layout: each attribute, then
 *  the index as int32 deltas, 4-byte aligned; `expand` draws it non-indexed). */
export const FixedDrawRowsSchema = v.pipe(v.array(v.strictObject({ slot: text, file: text, channels: v.pipe(v.array(v.tuple([text, text])), v.maxLength(16)),
  baked: v.exactOptional(SceneBakedGeometrySchema) })),
  v.minLength(1), v.maxLength(128));

