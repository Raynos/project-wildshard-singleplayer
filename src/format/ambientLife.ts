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
export const ForagerPolicySchema: v.GenericSchema<ForagerPolicyRows> =v.strictObject({
  scare:range,crouched:v.exactOptional(positive),alertMargin:finite,releaseMargin:finite,alertPause:range,grazePause:range,settlePause:range,turn:range,
  grazing:v.variant('gait',[v.strictObject({gait:v.literal('hop'),chance:v.pipe(finite,v.minValue(0),v.maxValue(1)),length:range,duration:positive,height:positive}),v.strictObject({gait:v.literal('walk'),speed:positive,wander:range})]),
  escape:v.variant('to',[v.strictObject({to:v.literal('away'),distance:range,pause:range,length:positive,duration:positive,height:positive,zigSteps:v.tuple([count,count]),spread:range,steer:positive}),
    v.strictObject({to:v.literal('home'),speed:positive,reach:positive,hide:range,emerge:positive,sink:positive})]),
  /** where a forager may step (null: anywhere): chunk margin, height above water, pond / cabin mask ceilings, creeks, min normal y, trunk clearance */
  ground:v.nullable(v.strictObject({margin:finite,aboveWater:finite,pond:finite,cabin:finite,stream:v.boolean(),slope:finite,trunk:finite})),
  sentry:v.nullable(v.strictObject({chance:v.pipe(finite,v.minValue(0),v.maxValue(1)),duration:range,sight:positive,alarm:v.boolean()})),
  posture:v.strictObject({graze:posture,alert:posture,flee:posture,sentry:v.exactOptional(posture),hide:v.exactOptional(posture)}),
});

/** One forager population (`@wildshard/engine/ai/ambientForager#ForagerPopulation`): `count` rows at most, clock ids
 *  `<id>:<n>`, placed as `colonies` round burrow sites (size per site, ring radius, home offset, first timer) or `roam`ing
 *  round the viewer (seat / re-seat rings, draw range, visible range, re-seat retry, view cosines [draw, seat], blind range). */
export const ForagerPopulationSchema: v.StrictObjectSchema<{
 readonly id: v.GenericSchema<string>;
 readonly count: v.GenericSchema<number>;
 readonly policy: typeof ForagerPolicySchema;
 readonly place: v.GenericSchema<ForagerPopulationRows['place']>;
}, undefined> =v.strictObject({id,count,policy:ForagerPolicySchema,place:v.variant('kind',[
  v.strictObject({kind:v.literal('colonies'),size:v.tuple([count,count]),radius:range,home:finite,timer:range}),
  v.strictObject({kind:v.literal('roam'),seat:range,reseat:range,range:positive,visibleRange:positive,retry:positive,view:v.tuple([finite,finite,positive])})])});
/** Native forager view: prepared model book, material tuning and body projection. */
export const ForagerDrawSchema: v.GenericSchema<ForagerDrawRows> =v.strictObject({name:id,books:v.strictObject({phone:id,desktop:id}),model:id,
  rim:finite,bands:finite,tilt:finite,sink:finite});

const uint=v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),frame=v.pipe(v.number(),v.integer(),v.minValue(-1)),nonneg=v.pipe(finite,v.minValue(0));
const clock=v.strictObject({elapsed:nonneg,credit:nonneg,frame,dt:nonneg,last:finite,due:v.boolean(),tickFrame:frame});
/** A population's saved state: rows (state 0 graze, 1 sentry / alert, 2 flee, 3 hide), its Rng and band clocks. */
export const ForagerContinuation: v.GenericSchema<ForagerSnapshot> =v.strictObject({
  retired:v.exactOptional(v.pipe(v.array(v.pipe(uint,v.maxValue(255))),v.maxLength(256))),
  rows:v.pipe(v.array(v.strictObject({x:finite,z:finite,bx:finite,bz:finite,yaw:finite,stand:finite,sink:finite,state:v.picklist([0,1,2,3]),t:finite,tx:finite,tz:finite})),v.maxLength(256)),acc:nonneg,
  rng:v.strictObject({version:v.literal(1),state:uint,initial:uint,scrambledFork:v.boolean()}),
  bands:v.strictObject({rates:uint,time:nonneg,frame:v.pipe(v.number(),v.integer(),v.minValue(0)),frameDt:nonneg,
    rows:v.pipe(v.array(v.strictObject({id:v.string(),rate:v.literal('fx'),brain:clock,body:clock})),v.maxLength(256))})});

const share=v.pipe(finite,v.minValue(0),v.maxValue(1));
const offset=v.tuple([finite,finite,finite]);
const channel=v.union([v.picklist(['flap','fold','head','legs','peck','body']),finite]);
const depart=v.strictObject({distance:finite,up:range,speed:positive,lift:finite,spread:finite});
/** One ambient flock (G466 H6): perched, wheeling, flushed and guiding flyers as rows; the platform owns the frame. */
export const AmbientFlockSchema: v.GenericSchema<AmbientFlockData> =v.strictObject({
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
export const AmbientPerchesSchema: v.GenericSchema<AmbientPerches> =v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite,r:v.exactOptional(positive),w:v.exactOptional(positive)})),v.maxLength(4096));

export function parseAmbientPerches(value:unknown):AmbientPerches {return v.parse(AmbientPerchesSchema,value);}

export function parseAmbientFlock(value:unknown):AmbientFlockData {return v.parse(AmbientFlockSchema,value);}
/** Ambient populations borrow actual models and world owners. No resources or callbacks are encoded in rows. */
export const ForestLifeSchema: v.GenericSchema<AmbientLifeData> =v.pipe(v.strictObject({kind:v.literal('forest-community'),seed:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(0xffffffff)),
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

export function parseAmbientLife(value:unknown):AmbientLifeData {return v.parse(ForestLifeSchema,value);}

/** Validated ambient data independent of validator implementation metadata. */
export interface ForagerPolicyRows { scare: [number, number]; crouched?: number; alertMargin: number; releaseMargin: number; alertPause: [number, number]; grazePause: [number, number]; settlePause: [number, number]; turn: [number, number]; grazing: ({ gait: 'hop'; chance: number; length: [number, number]; duration: number; height: number; }) | ({ gait: 'walk'; speed: number; wander: [number, number]; }); escape: ({ to: 'away'; distance: [number, number]; pause: [number, number]; length: number; duration: number; height: number; zigSteps: [number, number]; spread: [number, number]; steer: number; }) | ({ to: 'home'; speed: number; reach: number; hide: [number, number]; emerge: number; sink: number; }); ground: ({ margin: number; aboveWater: number; pond: number; cabin: number; stream: boolean; slope: number; trunk: number; }) | null; sentry: ({ chance: number; duration: [number, number]; sight: number; alarm: boolean; }) | null; posture: { graze: [number, number, number, number, number, number]; alert: [number, number, number, number, number, number]; flee: [number, number, number, number, number, number]; sentry?: [number, number, number, number, number, number]; hide?: [number, number, number, number, number, number]; }; }
export interface ForagerPopulationRows { id: string; count: number; policy: ForagerPolicyRows; place: ({ kind: 'colonies'; size: [number, number]; radius: [number, number]; home: number; timer: [number, number]; }) | ({ kind: 'roam'; seat: [number, number]; reseat: [number, number]; range: number; visibleRange: number; retry: number; view: [number, number, number]; }); }
export interface ForagerDrawRows { name: string; books: { phone: string; desktop: string; }; model: string; rim: number; bands: number; tilt: number; sink: number; }
// oxlint-disable-next-line typescript/consistent-type-definitions -- The alias retains the implicit dictionary signature required by SimValue snapshots.
export type ForagerSnapshot = { retired?: (number)[]; rows: ({ x: number; z: number; bx: number; bz: number; yaw: number; stand: number; sink: number; state: 0 | 1 | 2 | 3; t: number; tx: number; tz: number; })[]; acc: number; rng: { version: 1; state: number; initial: number; scrambledFork: boolean; }; bands: { rates: number; time: number; frame: number; frameDt: number; rows: ({ id: string; rate: 'fx'; brain: { elapsed: number; credit: number; frame: number; dt: number; last: number; due: boolean; tickFrame: number; }; body: { elapsed: number; credit: number; frame: number; dt: number; last: number; due: boolean; tickFrame: number; }; })[]; }; };
export interface AmbientFlockData { seed: number; count: number; scale: number; foot: number; wingbeat: string; when?: { light?: [number, number]; weather?: Record<string, [number, number]>; }; flight: { wave: number; amplitude: number; pitch: number; pitchRate: number; bank: number; bankLimit: number; bankRate: number; directionEpsilon?: number; }; wingbeats: Record<string, { phase: (number)[]; amplitude: number; foldPhase: number; foldAmplitude: number; rest: [number, number]; rates: [number, number]; glide: [number, number]; beats: [number, number]; }>; wheeling: ({ centre: { x: number; z: number; }; radius: number; loops: ([number, number])[]; loopRadius: [number, number]; speed: [number, number]; altitude: [number, number]; bodyScale: [number, number]; bodyAltitude: [number, number]; perchAfter: [number, number]; bank: number; wheel: { xAmplitude: number; xFrequency: number; zScale: number; zAmplitude: number; zFrequency: number; altitudeFrequency: number; altitudeAmplitude: number; detailFrequency: number; detailAmplitude: number; }; }) | null; perch: ({ share: number; flush: number; flushJitter: [number, number]; settle: number; clear: number; idle: [number, number]; every: [number, number]; hop: { chance: number; duration: number; height: number; turn: number; }; head: { rate: number; range: number; duration: [number, number]; }; takeoff: { duration: number; out: number; up: number; beats: number; bank: number; }; landing: { speed: number; minimum: number; rise: number; flare: number; bank: number; }; }) | null; guide: ({ speed: number; borrow: number; start: [number, number, number]; pass: [number, number, number]; end: { min: number; max: number; up: number; }; formation: ([number, number, number])[]; stagger: number; call: (number) | null; bank: number; after: ({ ahead: number; up: number; speed: number; }) | null; }) | null; call: ({ cue: string; every: [number, number]; first: number; }) | null; scavenge: ({ arrive: { far: [number, number]; up: [number, number]; near: number; height: number; speed: number; lift: number; }; circle: { radius: [number, number]; low: [number, number]; high: [number, number]; speed: [number, number]; timer: [number, number]; beat: number; call: number; }; land: { speed: number; lift: number; ring: [number, number]; stand: number; pause: [number, number]; pitch: number; }; feed: { pecks: [number, number]; pause: [number, number]; hop: number; squabble: number; rate: number; time: [number, number]; leave: number; reland: number; look: [number, number]; wings: [number, number]; peck: [number, number, number]; hopTime: number; hopHeight: number; }; flush: [number, number]; lift: { up: [number, number]; side: number; speed: number; lift: number; }; depart: { distance: number; up: [number, number]; speed: number; lift: number; spread: number; }; voices: { call: string; pair: string; flap: string; gain: number; flapGain: number; gap: [number, number]; flapGap: number; }; }) | null; visit: ({ enter: [number, number]; stay: [number, number]; every: number; near: [number, number]; from: ({ kind: 'behind'; back: number; up: number; }) | ({ kind: 'beyond'; back: number; up: number; }); speed: number; lift: number; approach: [number, number]; cling: number; sag: number; pose: { pitch: number; body: number; legs: number; stand: number; peck: number; }; sway: number; stare: number; stareTurn: number; look: [number, number]; within: number; callCue: (string) | null; flushCall: boolean; gain: number; call: ({ cue: string; every: [number, number]; first: [number, number]; within: number; }) | null; acts: ({ first: [number, number]; every: [number, number]; hitch: [number, number]; call: number; drum: ({ cue: string; length: [number, number]; voiced: number; within: number; rate: number; peck: [number, number]; }) | null; }) | null; flush: number; flushLegs: number; relocate: [number, number]; aim: boolean; leave: number; leaveWait: number; depart: { distance: number; up: [number, number]; speed: number; lift: number; spread: number; }; }) | null; channels: [[('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number)], ([('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number), ('flap' | 'fold' | 'head' | 'legs' | 'peck' | 'body') | (number)]) | null]; attributes: [string, (string) | null]; system: { id: string; after: (string)[]; before: (string)[]; }; }
export type AmbientPerches = ({ x: number; y: number; z: number; r?: number; w?: number; })[];
export interface AmbientLifeData { kind: 'forest-community'; seed: number; scavenger: { flock: AmbientFlockData; arrival: [number, number]; visitors: Record<string, number>; defaultVisitors: number; bodyWidths: Record<string, number>; giveUp: number; reach: number; }; sentinel: { flock: AmbientFlockData; perches: ({ x: number; y: number; z: number; })[]; }; trunkForager: { flock: AmbientFlockData; perches: ({ x: number; y: number; z: number; r: number; w: number; })[]; }; forager: { model: number; scale: number; } & ForagerPopulationRows; guide: { flock: AmbientFlockData; policy: { distance: 'centre'; min: number; max: number; schedule: { kind: 'periodic'; initial: number; period: [number, number]; }; }; }; harvest: { len: number; kneelIn: number; cuts: (number)[]; rise: number; }; system: { id: string; ambient: string; after: (string)[]; before: (string)[]; }; debug: { id: string; window: string; }; sounds: { pair: string; call: string; flap: string; hoot: string; foragerCall: string; drum: string; cutA: string; cutB: string; }; }
