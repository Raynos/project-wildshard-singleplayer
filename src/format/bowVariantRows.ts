import * as v from 'valibot';
import {isJsonData} from './json';
import {ReturnProgramSchema} from './namedJsonContracts';
import {ProjectedTrailSchema} from './clientTrails';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(512)),finite=v.pipe(v.number(),v.finite()),positive=v.pipe(finite,v.minValue(0));
const tag=v.custom<`${string}.${string}`>(input=>typeof input==='string'&&/^[^.]+\..+$/u.test(input));
const tags=v.pipe(v.array(tag),v.maxLength(64));
const weapon=v.custom<`weapon.${string}`>(input=>typeof input==='string'&&/^weapon\.[a-z0-9.-]+$/u.test(input));
/** Original source rules are evaluated only by the variant baker. */
export const BowSourceMultipliersSchema=v.pipe(v.array(v.strictObject({id:text,when:v.strictObject({sourceTags:v.exactOptional(tags),targetTags:v.exactOptional(tags),weaponTags:v.exactOptional(tags),targetState:v.exactOptional(tags)}),mul:positive})),v.maxLength(128));
const scales=v.strictTuple([positive,positive]);
/** Build-only admission of the held variant; its native bow and actor owner stay charged. */
export const BowVariantSchema=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  id:weapon,name:text,style:v.picklist(['recurve','golden','sky-wolf']),drawSpeed:v.pipe(positive,v.minValue(.001)),
  program:ReturnProgramSchema,signal:text,threshold:positive,pierce:positive,crush:positive,crushKinds:v.pipe(v.array(text),v.maxLength(32)),
  sourceTag:tag,damageScale:v.strictObject({base:scales,kinds:v.record(text,scales)}),
  flight:v.strictObject({base:positive,draw:positive,offset:positive,step:v.pipe(positive,v.minValue(.001)),from:positive,gap:v.pipe(positive,v.minValue(.001))}),
  trail:ProjectedTrailSchema,
}));
export type BowVariantRows=v.InferOutput<typeof BowVariantSchema>;
