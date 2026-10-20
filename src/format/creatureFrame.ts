import * as v from 'valibot';
import { isJsonData } from './json';
import { NumericPoseSchema, ClientChannelProgramSchema } from './clientChannels';

const number=v.pipe(v.number(),v.finite()),key=v.pipe(v.string(),v.minLength(1),v.maxLength(96),v.check(value=>!['__proto__','prototype','constructor'].includes(value)));
/** Retained visual fields and a detached observation group over numeric joints. */
export const CreatureFrameSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({
  defaults:v.record(key,number),smooth:v.pipe(v.array(v.object({input:key,output:key,rate:number,initial:v.nullable(number)})),v.maxLength(16)),
  floor:v.object({field:key,lift:key,death:key,delay:number,rate:number}),look:v.tuple([number,number,number]),
  group:key,observations:v.pipe(v.array(ClientChannelProgramSchema),v.maxLength(32)),pose:NumericPoseSchema,
}));

export type CreatureFrameRows=v.InferOutput<typeof CreatureFrameSchema>;
