import * as v from 'valibot';
import { isJsonData } from './json';

/** Little-endian IEEE scalars in a zlib stream. Count bounds the decoder's
 * allocation independently of compression ratio; neither caller resamples. */
export const ScalarChannelSchema = v.pipe(v.unknown(),v.check(isJsonData,'Scalar channel requires plain JSON'),v.strictObject({
  type: v.picklist(['f32','f64']),count: v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(4194304)),
  data: v.pipe(v.string(),v.minLength(8),v.maxLength(44761088),v.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)),
}));
export type ScalarChannelRows = v.InferOutput<typeof ScalarChannelSchema>;
