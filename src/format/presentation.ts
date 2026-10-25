import * as v from 'valibot';

const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Optional immutable SHARD SELECT content; images are local, charged library hashes, never author URLs. */
export const PresentationSchema: v.GenericSchema<PresentationInput, Presentation> = v.strictObject({
  biome: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  blurb: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  card: v.strictObject({ thumb: hash, portrait: hash, landscape: hash }),
});
/** Data-only card metadata accepted by the full shardfile schema. */


/** Baked full-cell map: an immutable charged image and the authoring inputs freshness hash. */
export const MapSchema: v.GenericSchema<MapRowsInput, MapRows> = v.strictObject({ image: hash, tilesHash: hash });

/** Admitted data contracts, independent of validator implementation metadata. */
export type PresentationInput = Presentation;
interface PresentationFields {
    biome: string;
    blurb: string;
    card: {
        thumb: string;
        portrait: string;
        landscape: string;
    };
}
export type Presentation = { [Key in keyof PresentationFields]: PresentationFields[Key] };
export type MapRowsInput = MapRows;
interface MapRowsFields {
    image: string;
    tilesHash: string;
}
export type MapRows = { [Key in keyof MapRowsFields]: MapRowsFields[Key] };
