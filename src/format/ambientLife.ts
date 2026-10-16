import * as v from 'valibot';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite=v.pipe(v.number(),v.finite());
const positive=v.pipe(finite,v.minValue(0.001),v.maxValue(100000));
const count=v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(256));
const model=v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(31));
const range=v.pipe(v.tuple([finite,finite]),v.check(pair=>pair[0]<=pair[1]));
const posture=v.tuple([finite,finite,finite,finite,finite,finite]);
const burst=v.strictObject({phase:v.pipe(v.array(positive),v.minLength(2),v.maxLength(3)),amplitude:finite,foldPhase:finite,foldAmplitude:finite,rest:v.tuple([finite,finite]),rates:v.tuple([positive,positive]),glide:range,beats:v.pipe(v.tuple([count,count]),v.check(pair=>pair[0]<=pair[1]&&pair[1]<=64))});
/** Bodyless grazing/alert/escape policy, independent of renderer and clock ownership. */
export const ForagerPolicySchema=v.strictObject({
  scare:range,alertMargin:positive,releaseMargin:positive,fleeDistance:range,fleePause:range,alertPause:range,grazePause:range,settlePause:range,turn:range,
  grazing:v.strictObject({chance:v.pipe(finite,v.minValue(0),v.maxValue(1)),length:range,duration:positive,height:positive}),
  escape:v.strictObject({length:positive,duration:positive,height:positive,zigSteps:v.tuple([count,count]),spread:range,steer:positive}),
  posture:v.strictObject({graze:posture,alert:posture,flee:posture}),
});
export type ForagerPolicyRows=v.InferOutput<typeof ForagerPolicySchema>;
const share=v.pipe(finite,v.minValue(0),v.maxValue(1));
const offset=v.tuple([finite,finite,finite]);
const channel=v.union([v.picklist(['flap','fold','head','legs']),finite]);
/** One ambient flock (G466 H6): perched, wheeling, flushed and guiding flyers as rows; the platform owns the frame. */
export const AmbientFlockSchema=v.strictObject({
  seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),count,scale:positive,foot:finite,wingbeat:id,
  flight:v.strictObject({wave:finite,amplitude:finite,pitch:finite,pitchRate:positive,bank:finite,bankLimit:positive,bankRate:positive,directionEpsilon:v.exactOptional(v.pipe(finite,v.minValue(1e-9),v.maxValue(1)))}),
  wingbeats:v.pipe(v.record(id,burst),v.check(rows=>Object.keys(rows).length<=16)),
  /** null: idle birds are hidden until a guide pass borrows them */
  wheeling:v.nullable(v.strictObject({centre:v.strictObject({x:finite,z:finite}),radius:positive,loops:v.pipe(v.array(v.tuple([finite,finite])),v.minLength(1),v.maxLength(8)),loopRadius:range,speed:range,altitude:range,bodyScale:range,bodyAltitude:range,perchAfter:range,bank:finite,
    wheel:v.strictObject({xAmplitude:finite,xFrequency:finite,zScale:finite,zAmplitude:finite,zFrequency:finite,altitudeFrequency:finite,altitudeAmplitude:finite,detailFrequency:finite,detailAmplitude:finite})})),
  perch:v.nullable(v.strictObject({share,flush:positive,flushJitter:range,settle:finite,clear:finite,idle:range,every:range,hop:v.strictObject({chance:share,duration:positive,height:finite,turn:finite}),head:v.strictObject({rate:finite,range:finite,duration:range}),
    takeoff:v.strictObject({duration:positive,out:finite,up:finite,beats:count,bank:finite}),landing:v.strictObject({speed:positive,minimum:positive,rise:finite,flare:share,bank:finite})})),
  guide:v.nullable(v.strictObject({speed:positive,borrow:finite,start:offset,pass:offset,end:v.strictObject({min:positive,max:positive,up:finite}),formation:v.pipe(v.array(offset),v.minLength(1),v.maxLength(8)),stagger:finite,call:v.nullable(share),bank:finite,
    /** null: the pass ends hidden; else on along the heading and up, back into a loop */
    after:v.nullable(v.strictObject({ahead:finite,up:finite,speed:positive}))})),
  call:v.nullable(v.strictObject({cue:id,every:range,first:finite})),
  /** the posed draw's per-instance channels: a pose name or a constant, four per vec4 */
  channels:v.tuple([v.tuple([channel,channel,channel,channel]),v.nullable(v.tuple([channel,channel,channel,channel]))]),
  attributes:v.tuple([id,v.nullable(id)]),
  system:v.strictObject({id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),
});
export type AmbientFlockData=v.InferOutput<typeof AmbientFlockSchema>;
export function parseAmbientFlock(value:unknown):AmbientFlockData {return v.parse(AmbientFlockSchema,value);}
/** Ambient populations borrow actual models and world owners. No resources or callbacks are encoded in rows. */
export const ForestLifeSchema=v.pipe(v.strictObject({kind:v.literal('forest-community'),seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),
  scavenger:v.strictObject({model,count,scale:positive,stand:finite,flush:positive,flushRun:positive,reland:positive,arrival:range,visitors:v.record(id,count),defaultVisitors:count,bodyWidths:v.record(id,positive),giveUp:positive}),
  perches:v.pipe(v.strictObject({step:positive,spines:v.pipe(v.array(v.pipe(v.array(v.strictObject({y:finite,cx:finite,cz:finite,r:positive})),v.maxLength(256))),v.minLength(1),v.maxLength(32))}),v.check(row=>row.spines.every(spine=>spine.every((knot,index)=>knot.y===(index+1)*row.step)),'ordered equal-step perch knots')),
  sentinel:v.strictObject({model,scale:positive,stand:finite}),trunkForager:v.strictObject({model}),forager:v.strictObject({model,count,scale:positive,range:positive,visibleRange:positive,policy:ForagerPolicySchema}),
  guide:v.strictObject({flock:AmbientFlockSchema,policy:v.strictObject({distance:v.literal('centre'),min:positive,max:positive,schedule:v.strictObject({kind:v.literal('periodic'),initial:finite,period:range})})}),
  flight:v.strictObject({wave:finite,amplitude:finite,pitch:finite,pitchRate:positive,bank:finite,bankLimit:positive,bankRate:positive}),
  wingbeats:v.pipe(v.record(id,burst),v.check(rows=>Object.keys(rows).length<=16)),
  harvest:v.strictObject({len:positive,kneelIn:positive,cuts:v.pipe(v.array(positive),v.maxLength(8)),rise:positive}),
  system:v.strictObject({id,ambient:id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),
  debug:v.strictObject({id,window:id}),sounds:v.strictObject({pair:id,call:id,flap:id,hoot:id,foragerCall:id,drum:id,cutA:id,cutB:id}),taps:v.strictObject({knock:id,drum:id,perch:id})}),
  v.check(row=>[row.scavenger.model,row.sentinel.model,row.trunkForager.model].every(key=>Object.hasOwn(row.wingbeats,key)),'declared wingbeats for every flyer'),
  v.check(row=>row.scavenger.count+row.forager.count+2<=512,'bounded ambient population'),
  v.check(row=>row.harvest.kneelIn<row.harvest.rise&&row.harvest.rise<row.harvest.len&&row.harvest.cuts.every((value,index)=>value<row.harvest.len&&(index===0||value>(row.harvest.cuts[index-1]??0))),'ordered harvest timeline'));
export type AmbientLifeData=v.InferOutput<typeof ForestLifeSchema>;
export function parseAmbientLife(value:unknown):AmbientLifeData {return v.parse(ForestLifeSchema,value);}
