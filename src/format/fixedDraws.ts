import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** A shard's named fixed draws: each slot a product GLB file, its channels renamed as declared (source, name). */
export const FixedDrawRowsSchema = v.pipe(v.array(v.strictObject({ slot: text, file: text, channels: v.pipe(v.array(v.tuple([text, text])), v.maxLength(16)) })),
  v.minLength(1), v.maxLength(128));

