import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const order = { system: id, before: v.pipe(v.array(id), v.maxLength(16)), after: v.exactOptional(v.pipe(v.array(id), v.maxLength(16))) };
const audioInput=v.strictObject({name:id,source:v.variant('kind',[
  v.strictObject({kind:v.literal('wind'),field:v.picklist(['speed','gust'])}),
  v.strictObject({kind:v.literal('weather'),owner:id,field:v.picklist(['sun','dark','storm'])}),
  v.strictObject({kind:v.literal('arena'),owner:id,field:v.picklist(['inside','engaged'])}),
])});
/** Native owner/registration glue only. Rows never contain a clock, math law or callback. */
export const WorldUpdatesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'World updates require plain JSON data'), v.array(v.variant('kind', [
  v.strictObject({ kind: v.literal('entered-owner'), ...order, owner: id, phase: v.picklist(['update', 'late']) }),
  v.strictObject({ kind: v.literal('wind'), ...order }),
  v.strictObject({ kind: v.literal('painted-world'), ...order, world: id, weather: id }),
  v.strictObject({ kind: v.literal('rope-deck'), ...order, deck: id, chain: id }),
  v.strictObject({ kind: v.literal('toon-look'), ...order, look: id }),
  v.strictObject({ kind: v.literal('buildings'), ...order, owner: id }),
  v.strictObject({kind:v.literal('audio-scene'),...order,inputs:v.pipe(v.array(audioInput),v.minLength(1),v.maxLength(32),v.check(rows=>new Set(rows.map(row=>row.name)).size===rows.length))}),
  v.strictObject({kind:v.literal('cosmetic-finishes'),...order,elite:id,every:v.pipe(v.number(),v.finite(),v.minValue(.001),v.maxValue(60))}),
])), v.minLength(1), v.maxLength(32));
export type WorldUpdatesRows = v.InferOutput<typeof WorldUpdatesSchema>;
