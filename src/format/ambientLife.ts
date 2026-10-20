import * as v from 'valibot';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite=v.pipe(v.number(),v.finite());
const positive=v.pipe(finite,v.minValue(0.001),v.maxValue(100000));
const count=v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(256));
const model=v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(31));
const range=v.pipe(v.tuple([finite,finite]),v.check(pair=>pair[0]<=pair[1]));
const burst=v.strictObject({phase:v.pipe(v.array(positive),v.minLength(2),v.maxLength(3)),amplitude:finite,foldPhase:finite,foldAmplitude:finite,rest:v.tuple([finite,finite]),rates:v.tuple([positive,positive]),glide:range,beats:v.pipe(v.tuple([count,count]),v.check(pair=>pair[0]<=pair[1]&&pair[1]<=64))});
const posture=v.tuple([finite,finite,finite,finite,finite,finite]);
/** One ambient forager row (G466 H6, `@wildshard/engine/ai/ambientForager`): grazing gait, scare radii, sentries and the
 *  escape (zig-zag bounds away, or a run home and down the burrow). Posture rows: [sit, rate, head pitch, rate, ears, rate]. */
export const ForagerPolicySchema=v.strictObject({
  scare:range,crouched:v.exactOptional(positive),alertMargin:finite,releaseMargin:finite,alertPause:range,grazePause:range,settlePause:range,turn:range,
  grazing:v.variant('gait',[v.strictObject({gait:v.literal('hop'),chance:v.pipe(finite,v.minValue(0),v.maxValue(1)),length:range,duration:positive,height:positive}),v.strictObject({gait:v.literal('walk'),speed:positive,wander:range})]),
  escape:v.variant('to',[v.strictObject({to:v.literal('away'),distance:range,pause:range,length:positive,duration:positive,height:positive,zigSteps:v.tuple([count,count]),spread:range,steer:positive}),
    v.strictObject({to:v.literal('home'),speed:positive,reach:positive,hide:range,emerge:positive,sink:positive})]),
  /** where a forager may step (null: anywhere): chunk margin, height above water, pond / cabin mask ceilings, creeks, min normal y, trunk clearance */
  ground:v.nullable(v.strictObject({margin:finite,aboveWater:finite,pond:finite,cabin:finite,stream:v.boolean(),slope:finite,trunk:finite})),
  sentry:v.nullable(v.strictObject({chance:v.pipe(finite,v.minValue(0),v.maxValue(1)),duration:range,sight:positive,alarm:v.boolean()})),
  posture:v.strictObject({graze:posture,alert:posture,flee:posture,sentry:v.exactOptional(posture),hide:v.exactOptional(posture)}),
});
export type ForagerPolicyRows=v.InferOutput<typeof ForagerPolicySchema>;
/** One forager population (`@wildshard/engine/ai/ambientForager#ForagerPopulation`): `count` rows at most, clock ids
 *  `<id>:<n>`, placed as `colonies` round burrow sites (size per site, ring radius, home offset, first timer) or `roam`ing
 *  round the viewer (seat / re-seat rings, draw range, visible range, re-seat retry, view cosines [draw, seat], blind range). */
export const ForagerPopulationSchema=v.strictObject({id,count,policy:ForagerPolicySchema,place:v.variant('kind',[
  v.strictObject({kind:v.literal('colonies'),size:v.tuple([count,count]),radius:range,home:finite,timer:range}),
  v.strictObject({kind:v.literal('roam'),seat:range,reseat:range,range:positive,visibleRange:positive,retry:positive,view:v.tuple([finite,finite,positive])})])});
/** Native forager view: prepared model book, material tuning and body projection. */
export const ForagerDrawSchema=v.strictObject({name:id,books:v.strictObject({phone:id,desktop:id}),model:id,
  rim:finite,bands:finite,tilt:finite,sink:finite});
export type ForagerPopulationRows=v.InferOutput<typeof ForagerPopulationSchema>;
const uint=v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),frame=v.pipe(v.number(),v.integer(),v.minValue(-1)),nonneg=v.pipe(finite,v.minValue(0));
const clock=v.strictObject({elapsed:nonneg,credit:nonneg,frame,dt:nonneg,last:finite,due:v.boolean(),tickFrame:frame});
/** A population's saved state: rows (state 0 graze, 1 sentry / alert, 2 flee, 3 hide), its Rng and band clocks. */
export const ForagerContinuation=v.strictObject({
  rows:v.pipe(v.array(v.strictObject({x:finite,z:finite,bx:finite,bz:finite,yaw:finite,stand:finite,sink:finite,state:v.picklist([0,1,2,3]),t:finite,tx:finite,tz:finite})),v.maxLength(256)),acc:nonneg,
  rng:v.strictObject({version:v.literal(1),state:uint,initial:uint,scrambledFork:v.boolean()}),
  bands:v.strictObject({rates:uint,time:nonneg,frame:v.pipe(v.number(),v.integer(),v.minValue(0)),frameDt:nonneg,
    rows:v.pipe(v.array(v.strictObject({id:v.string(),rate:v.literal('fx'),brain:clock,body:clock})),v.maxLength(256))})});
export type ForagerSnapshot=v.InferOutput<typeof ForagerContinuation>;
const share=v.pipe(finite,v.minValue(0),v.maxValue(1));
const offset=v.tuple([finite,finite,finite]);
const channel=v.union([v.picklist(['flap','fold','head','legs','peck','body']),finite]);
const depart=v.strictObject({distance:finite,up:range,speed:positive,lift:finite,spread:finite});
/** One ambient flock (G466 H6): perched, wheeling, flushed and guiding flyers as rows; the platform owns the frame. */
export const AmbientFlockSchema=v.strictObject({
  seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),count,scale:positive,foot:finite,wingbeat:id,
  /** Optional presentation gates. Light is the night fraction; weather names numeric channels, never shard code. */
  when:v.exactOptional(v.strictObject({light:v.exactOptional(range),weather:v.exactOptional(v.pipe(v.record(id,range),v.check(rows=>Object.keys(rows).length<=16)))})),
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
  /** null: no sites. `gather` borrows hidden birds to a kill: they arrive, circle, land round it and feed, lift when flushed, leave fed */
  scavenge:v.nullable(v.strictObject({arrive:v.strictObject({far:range,up:range,near:finite,height:finite,speed:positive,lift:finite}),
    circle:v.strictObject({radius:range,low:range,high:range,speed:range,timer:range,beat:finite,call:finite}),
    land:v.strictObject({speed:positive,lift:finite,ring:range,stand:finite,pause:range,pitch:finite}),
    feed:v.strictObject({pecks:v.tuple([count,count]),pause:range,hop:share,squabble:share,rate:positive,time:range,leave:positive,reland:finite,look:v.tuple([finite,finite]),wings:v.tuple([finite,finite]),peck:v.tuple([finite,finite,finite]),hopTime:positive,hopHeight:finite}),
    /** flush radius walking, fast; the lift back up to circling */
    flush:v.tuple([positive,positive]),lift:v.strictObject({up:range,side:finite,speed:positive,lift:finite}),depart,
    voices:v.strictObject({call:id,pair:id,flap:id,gain:finite,flapGain:finite,gap:range,flapGap:finite})})),
  /** null: no visitor. One bird to a perch near the player while `light` is in `enter`, until it leaves `stay` */
  visit:v.nullable(v.strictObject({enter:range,stay:range,every:positive,near:range,
    from:v.variant('kind',[v.strictObject({kind:v.literal('behind'),back:finite,up:finite}),v.strictObject({kind:v.literal('beyond'),back:finite,up:finite})]),
    speed:positive,lift:finite,approach:v.tuple([finite,finite]),cling:finite,sag:finite,
    pose:v.strictObject({pitch:finite,body:finite,legs:finite,stand:finite,peck:finite}),sway:finite,stare:finite,stareTurn:finite,look:v.tuple([finite,finite]),
    within:finite,callCue:v.nullable(id),flushCall:v.boolean(),gain:finite,call:v.nullable(v.strictObject({cue:id,every:range,first:range,within:finite})),
    acts:v.nullable(v.strictObject({first:range,every:range,hitch:v.tuple([share,finite]),call:share,
      drum:v.nullable(v.strictObject({cue:id,length:range,voiced:positive,within:finite,rate:positive,peck:v.tuple([finite,finite])}))})),
    flush:finite,flushLegs:finite,relocate:range,aim:v.boolean(),leave:finite,leaveWait:finite,depart})),
  /** the posed draw's per-instance channels: a pose name or a constant, four per vec4 */
  channels:v.tuple([v.tuple([channel,channel,channel,channel]),v.nullable(v.tuple([channel,channel,channel,channel]))]),
  attributes:v.tuple([id,v.nullable(id)]),
  system:v.strictObject({id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),
});
/** Numeric spawn/perch sites for an ambient group. Radius selects bark-clinging
 * arrival; weight biases site selection. No runtime function may cross the row. */
export const AmbientPerchesSchema=v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite,r:v.exactOptional(positive),w:v.exactOptional(positive)})),v.maxLength(4096));
export type AmbientPerches=v.InferOutput<typeof AmbientPerchesSchema>;
export function parseAmbientPerches(value:unknown):AmbientPerches {return v.parse(AmbientPerchesSchema,value);}
export type AmbientFlockData=v.InferOutput<typeof AmbientFlockSchema>;
export function parseAmbientFlock(value:unknown):AmbientFlockData {return v.parse(AmbientFlockSchema,value);}
/** Ambient populations borrow actual models and world owners. No resources or callbacks are encoded in rows. */
export const ForestLifeSchema=v.pipe(v.strictObject({kind:v.literal('forest-community'),seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),
  /** the kill's ravens: a scavenge flock; visitors per species, the body's half width, when they come, how far you may be */
  scavenger:v.strictObject({flock:AmbientFlockSchema,arrival:range,visitors:v.record(id,count),defaultVisitors:count,bodyWidths:v.record(id,positive),giveUp:positive,reach:positive}),
  /** visit flocks and their baked perches: the night sentinel on snag tops, the day trunk forager on bark sections (r, weight w) */
  sentinel:v.strictObject({flock:AmbientFlockSchema,perches:v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite})),v.maxLength(4096))}),
  trunkForager:v.strictObject({flock:AmbientFlockSchema,perches:v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite,r:positive,w:positive})),v.maxLength(4096))}),
  forager:v.strictObject({model,scale:positive,...ForagerPopulationSchema.entries}),
  guide:v.strictObject({flock:AmbientFlockSchema,policy:v.strictObject({distance:v.literal('centre'),min:positive,max:positive,schedule:v.strictObject({kind:v.literal('periodic'),initial:finite,period:range})})}),
  harvest:v.strictObject({len:positive,kneelIn:positive,cuts:v.pipe(v.array(positive),v.maxLength(8)),rise:positive}),
  system:v.strictObject({id,ambient:id,after:v.pipe(v.array(id),v.maxLength(16)),before:v.pipe(v.array(id),v.maxLength(16))}),
  debug:v.strictObject({id,window:id}),sounds:v.strictObject({pair:id,call:id,flap:id,hoot:id,foragerCall:id,drum:id,cutA:id,cutB:id})}),
  v.check(row=>row.scavenger.flock.count+row.forager.count+2<=512,'bounded ambient population'),
  v.check(row=>row.harvest.kneelIn<row.harvest.rise&&row.harvest.rise<row.harvest.len&&row.harvest.cuts.every((value,index)=>value<row.harvest.len&&(index===0||value>(row.harvest.cuts[index-1]??0))),'ordered harvest timeline'));
export type AmbientLifeData=v.InferOutput<typeof ForestLifeSchema>;
export function parseAmbientLife(value:unknown):AmbientLifeData {return v.parse(ForestLifeSchema,value);}
