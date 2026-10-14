import * as v from 'valibot';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite=v.pipe(v.number(),v.finite());
const positive=v.pipe(finite,v.minValue(0.001),v.maxValue(100000));
const count=v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(256));
const model=v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(31));
const range=v.pipe(v.tuple([finite,finite]),v.check(pair=>pair[0]<=pair[1]));
/** Ambient populations borrow actual models and world owners. No resources or callbacks are encoded in rows. */
export const ForestLifeSchema=v.pipe(v.strictObject({kind:v.literal('forest-community'),seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),
  scavenger:v.strictObject({model,count,scale:positive,stand:finite,flush:positive,flushRun:positive,reland:positive,arrival:range,visitors:v.record(id,count),defaultVisitors:count,bodyWidths:v.record(id,positive),giveUp:positive}),
  sentinel:v.strictObject({model,scale:positive,stand:finite}),trunkForager:v.strictObject({model}),forager:v.strictObject({model,count,scale:positive,range:positive,visibleRange:positive}),
  guide:v.strictObject({count,policy:v.strictObject({distance:v.literal('centre'),min:positive,max:positive,schedule:v.strictObject({kind:v.literal('periodic'),initial:finite,period:range})})}),
  flight:v.strictObject({wave:finite,amplitude:finite,pitch:finite,pitchRate:positive,bank:finite,bankLimit:positive,bankRate:positive}),
  harvest:v.strictObject({len:positive,kneelIn:positive,cuts:v.pipe(v.array(positive),v.maxLength(8)),rise:positive}),
  system:v.strictObject({id,ambient:id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),
  debug:v.strictObject({id,window:id}),sounds:v.strictObject({pair:id,call:id,flap:id,hoot:id,foragerCall:id,drum:id,cutA:id,cutB:id}),taps:v.strictObject({knock:id,drum:id,perch:id})}),
  v.check(row=>row.scavenger.count+row.guide.count+row.forager.count+2<=512,'bounded ambient population'),
  v.check(row=>row.harvest.kneelIn<row.harvest.rise&&row.harvest.rise<row.harvest.len&&row.harvest.cuts.every((value,index)=>value<row.harvest.len&&(index===0||value>(row.harvest.cuts[index-1]??0))),'ordered harvest timeline'));
/** Independent orbit populations borrow their actual view, without a forest herd or harvest owner. */
export const CirclingLifeSchema=v.strictObject({kind:v.literal('circling-flyer'),flight:v.strictObject({wave:finite,amplitude:finite,pitch:finite,pitchRate:positive,bank:finite,bankLimit:positive,bankRate:positive}),system:v.strictObject({id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),flock:v.pipe(v.array(v.strictObject({model,scale:positive,x:finite,y:finite,z:finite,radius:positive,speed:finite,phase:finite,wingSpeed:positive,wingAmplitude:finite})),v.minLength(1),v.maxLength(256))});
export const AmbientLifeSchema=v.variant('kind',[ForestLifeSchema,CirclingLifeSchema]);
export type AmbientLifeData=v.InferOutput<typeof ForestLifeSchema>;
export type CirclingLifeData=v.InferOutput<typeof CirclingLifeSchema>;
export function parseAmbientLife(value:unknown):v.InferOutput<typeof AmbientLifeSchema> {return v.parse(AmbientLifeSchema,value);}
