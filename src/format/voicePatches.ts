import * as v from 'valibot';
import { AudioMixExpressionSchema as expr } from './audioProfiles';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const n=v.pipe(v.number(),v.finite());
const values=v.pipe(v.array(v.tuple([id,expr])),v.maxLength(32));
const range=v.tuple([n,n]);
const filter=v.tuple([v.picklist(['lowpass','bandpass','highpass']),n,n]);
/** Bounded client-only voice patches: sampled takes, synth phrases and ordered layers. */
export const VoicePatchesSchema=v.strictObject({
 initial:v.record(id,n),bed:id,
 calls:v.pipe(v.array(v.strictObject({id,cue:id,gap:v.exactOptional(n),reach:v.exactOptional(v.tuple([n,n])),sampled:v.exactOptional(v.boolean()),surface:v.exactOptional(v.boolean())})),v.maxLength(64)),
 cues:v.record(id,v.strictObject({defaults:v.record(id,n),values,when:v.exactOptional(expr),tap:v.exactOptional(id),
  throttle:v.exactOptional(expr),bus:v.exactOptional(v.strictObject({gain:expr,cutoff:expr,pan:expr})),
  sample:v.exactOptional(v.strictObject({id,surface:v.boolean(),variants:v.exactOptional(v.record(id,id)),gain:expr,rate:expr,delay:expr,when:v.exactOptional(expr),cutoff:v.exactOptional(expr),pan:v.exactOptional(expr)})),
  phrase:v.exactOptional(id),
  layers:v.pipe(v.array(v.strictObject({cue:id,count:v.pipe(n,v.integer(),v.minValue(1),v.maxValue(64)),values,afterSample:v.boolean()})),v.maxLength(8))})),
 groups:v.record(id,v.strictObject({persistent:v.boolean(),active:expr,sampleSinks:v.pipe(v.array(id),v.maxLength(8)),sampleInputs:v.pipe(v.array(id),v.maxLength(8)),
  winds:v.pipe(v.array(v.strictObject({id,args:v.tuple([n,n,n,n,n,n])})),v.maxLength(8)),
  noise:v.pipe(v.array(v.strictObject({id,rate:range,offset:n,filters:v.pipe(v.array(filter),v.maxLength(8))})),v.maxLength(16)),
  lfos:v.pipe(v.array(v.strictObject({target:id,rate:n,depth:n})),v.maxLength(8)),
  controls:v.pipe(v.array(v.strictObject({target:id,param:v.picklist(['gain','frequency']),value:expr,tau:n})),v.maxLength(32)),
  schedules:v.pipe(v.array(v.strictObject({tick:id,wait:range,when:expr,cue:id,values})),v.maxLength(8))
 }))
});
export type VoicePatches=v.InferOutput<typeof VoicePatchesSchema>;
