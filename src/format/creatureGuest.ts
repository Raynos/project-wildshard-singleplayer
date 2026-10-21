import * as v from 'valibot';
import { isJsonData } from './json';
import { CreatureStrikeSchema } from './creatures';

const number=v.pipe(v.number(),v.finite()),key=v.pipe(v.string(),v.minLength(1),v.maxLength(96),v.check(value=>!['__proto__','prototype','constructor'].includes(value)));
/** The admitted guest owns every decision. Rows specify observation defaults,
 * retained outputs and native contact/presentation resources. */
export const CreatureGuestSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({
  program:v.unknown(),clock:key,playerKeys:v.tuple([key,key]),
  memory:v.pipe(v.record(key,v.object({value:number,source:v.optional(v.picklist(['x','z','yaw'])),
    when:v.optional(v.object({field:key,equal:number,value:number}))})),v.maxEntries(64)),
  writes:v.pipe(v.array(key),v.maxLength(64)),states:v.pipe(v.array(key),v.maxLength(32)),sounds:v.pipe(v.array(v.string()),v.maxLength(32)),
  attack:v.pipe(number,v.minValue(0)),strike:CreatureStrikeSchema,strikeSound:v.string(),length:v.tuple([number,v.pipe(number,v.minValue(.000001)),number]),
  piercing:v.object({legacy:key,tags:v.pipe(v.array(key),v.maxLength(16)),equipment:v.pipe(v.array(key),v.maxLength(16))}),
}));
export type CreatureGuestRows=v.InferOutput<typeof CreatureGuestSchema>;
