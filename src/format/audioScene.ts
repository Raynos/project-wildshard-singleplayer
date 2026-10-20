import * as v from 'valibot';
import { AudioMixExpressionSchema as expr } from './audioProfiles';

const n=v.pipe(v.number(),v.finite()),id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const point=v.tuple([n,n]);
const values=v.pipe(v.array(v.tuple([id,expr])),v.maxLength(64));
/** Client-only audio scene observations, geometry, cue subscriptions and score rows. */
export const AudioSceneSchema=v.strictObject({
 fields:v.strictObject({res:v.pipe(n,v.integer(),v.minValue(2),v.maxValue(2048)),size:v.pipe(n,v.minValue(.001),v.maxValue(100000)),channels:v.pipe(v.record(id,v.pipe(v.array(v.pipe(v.string(),v.minLength(1),v.maxLength(4096))),v.minLength(1),v.maxLength(977),v.check(chunks=>chunks.reduce((sum,chunk)=>sum+chunk.length,0)<=4000000))),v.check(channels=>Object.keys(channels).length<=16))}),
 profiles:v.record(id,v.strictObject({x0:n,step:n,values:v.pipe(v.array(point),v.minLength(2),v.maxLength(4096))})),
 paths:v.record(id,v.pipe(v.array(point),v.maxLength(2048))),
 probes:v.record(id,v.variant('kind',[
  v.strictObject({kind:v.literal('point'),x:n,z:n,inner:n,outer:n,gain:n}),
  v.strictObject({kind:v.literal('path'),path:id,inner:n,outer:n,gain:n}),
  v.strictObject({kind:v.literal('profile'),profile:id,inner:n,outer:n,gain:n})
 ])),
 surfaces:v.strictObject({fallback:v.picklist(['grass','gravel','wood']),rules:v.pipe(v.array(v.variant('kind',[
  v.strictObject({kind:v.literal('rect'),x:n,z:n,width:n,depth:n,surface:v.picklist(['grass','gravel','wood'])}),
  v.strictObject({kind:v.literal('field'),id,above:n,surface:v.picklist(['grass','gravel','wood'])}),
  v.strictObject({kind:v.literal('path'),ids:v.array(id),below:n,surface:v.picklist(['grass','gravel','wood'])})
 ])),v.maxLength(32))}),
 hoofKinds:v.pipe(v.array(id),v.maxLength(64)),initial:v.record(id,n),values,voiceGroup:id,voice:values,mix:values,
 score:v.pipe(v.array(v.strictObject({key:id,when:expr,on:v.union([v.string(),v.boolean(),v.null()]),off:v.union([v.string(),v.boolean(),v.null()])})),v.maxLength(16)),
 events:v.record(id,id),charges:v.pipe(v.array(v.strictObject({weapon:id,phase:id,cue:id,full:v.exactOptional(id),cancelDeferred:v.boolean()})),v.maxLength(32)),
 deferred:v.strictObject({owner:id,cue:id}),
 chorus:v.strictObject({initial:n,wait:v.tuple([n,n]),idle:n,when:expr,active:expr,call:id,distance:v.tuple([n,n]),up:n})
});
export type AudioScene=v.InferOutput<typeof AudioSceneSchema>;

/** Sample-only scene policy on the same native director: cue recipes, floor
 * material aliases and positional loop loans from the resident object book. */
export const SampledAudioSceneSchema=v.strictObject({
 system:id,tick:id,debug:id,points:id,loopTap:id,countLabel:id,eye:n,
 surfaces:v.record(id,v.picklist(['rock','planks','metal','grass','gravel','sand','wetSand','stone','water','litter','mud','wet'])),fallback:v.picklist(['rock','planks','metal','grass','gravel','sand','wetSand','stone','water','litter','mud','wet']),
 step:v.strictObject({id,voices:v.record(id,id),fallback:id,count:v.pipe(n,v.integer(),v.minValue(1),v.maxValue(16)),walkGain:n,runGain:n}),
 voices:v.pipe(v.record(id,v.strictObject({family:id,tap:id,handled:v.optional(v.boolean(),true),sequence:v.optional(v.boolean(),false),pan:v.exactOptional(n)})),v.check(rows=>Object.keys(rows).length<=128)),
 score:v.pipe(v.array(v.strictObject({key:id,value:id})),v.maxLength(16))
});
export type SampledAudioScene=v.InferOutput<typeof SampledAudioSceneSchema>;
