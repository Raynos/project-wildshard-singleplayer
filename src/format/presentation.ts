import * as v from 'valibot';

const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Optional immutable SHARD SELECT content; images are local, charged library hashes, never author URLs. */
export const PresentationSchema = v.strictObject({
  biome: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  blurb: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  card: v.strictObject({ thumb: hash, portrait: hash, landscape: hash }),
});
/** Data-only card metadata accepted by the full shardfile schema. */
export type Presentation = v.InferOutput<typeof PresentationSchema>;

/** Baked full-cell map: an immutable charged image and the authoring inputs freshness hash. */
export const MapSchema = v.strictObject({ image: hash, tilesHash: hash });
