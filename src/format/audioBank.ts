import * as v from 'valibot';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite=v.pipe(v.number(),v.finite());
const positive=v.pipe(finite,v.minValue(0.001));
const family=v.strictObject({n:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(16)),ch:v.picklist([1,2]),half:v.boolean(),
 source:v.variant('kind',[v.strictObject({kind:v.literal('pcm'),id}),v.strictObject({kind:v.literal('impact'),material:v.picklist(['flesh','shell','wood','stone'])})])});
/** Native sample/procedural bank policies. Programs and recordings remain in their existing audio sections. */
export const AudioBankSchema=v.strictObject({
 families:v.optional(v.pipe(v.record(id,family),v.check(rows=>Object.keys(rows).length<=64)),{}),
 catalogue:v.exactOptional(v.strictObject({set:id,tolerance:v.pipe(finite,v.minValue(0),v.maxValue(1)),arrayFamilies:v.boolean(),familyGain:v.boolean(),loopGain:v.pipe(finite,v.minValue(0),v.maxValue(8))})),
 barks:v.exactOptional(v.strictObject({prefix:id,gain:v.pipe(finite,v.minValue(0),v.maxValue(8))})),
 spatial:v.optional(v.pipe(v.record(id,v.strictObject({sample:id,phrase:id,reach:positive,scale:positive,power:positive,startTap:id,tap:id})),v.check(rows=>Object.keys(rows).length<=32)),{}),
});
export type AudioBank=v.InferOutput<typeof AudioBankSchema>;
