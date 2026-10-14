import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const gain = v.pipe(finite, v.minValue(0), v.maxValue(8));
const list = v.pipe(v.array(id), v.minLength(1), v.maxLength(32));
/** Boot inventory/overlay policy; playback and decoders retain the original recordings. */
const catalogue = v.strictObject({ ownMusic: v.boolean(), priorityOwn: v.boolean(), overlaySamples: v.boolean(),
  inventoryOmitSlots: v.pipe(v.array(id), v.maxLength(32)), loopOrder: v.pipe(v.array(id), v.maxLength(32)) });
const optionalIds = v.optional(v.pipe(v.array(id), v.maxLength(128), v.check((ids) => new Set(ids).size === ids.length, 'unique sample ids')));
const scalar = v.union([finite, v.boolean(), id, v.null()]);
const conditions = v.pipe(v.array(v.strictObject({ field: id, op: v.picklist(['equals', 'not-equals', 'greater']), value: scalar })), v.maxLength(16));
/** Bounded numerical mix expressions over supplied listener/clock/geometry values. */
export type AudioMixOp = '+' | '-' | '*' | '/' | 'min' | 'max' | '%' | 'pow' | 'cos' | 'exp' | 'tanh' | 'lerp' | 'round' | 'floor' | 'abs' | 'sin' | 'hypot' | 'ss' | 'in' | 'lt' | 'gt' | 'if' | 'and' | 'or' | 'not' | 'clamp' | 'zone' | 'dist';
/** Recursive bounded scalar expression; schema metadata keeps its lazy factory opaque. */
export type AudioMixExpr = number | string | readonly [AudioMixOp, ...AudioMixExpr[]];
function boundedMix(expr:AudioMixExpr):boolean {
  const pending:{value:AudioMixExpr;depth:number}[]=[{value:expr,depth:0}];
  for(let count=0;count<256;count++){
    const current=pending.pop();if(current===undefined)return true;if(current.depth>16)return false;
    if(typeof current.value!=='number'&&typeof current.value!=='string') {
      const arity=current.value.length-1,op=current.value[0];
      const wanted=op==='ss'||op==='in'||op==='if'||op==='clamp'||op==='lerp'?3:op==='-'||op==='/'||op==='min'||op==='max'||op==='hypot'||op==='lt'||op==='gt'||op==='%'||op==='pow'?2:op==='round'||op==='floor'||op==='abs'||op==='sin'||op==='not'||op==='zone'||op==='dist'||op==='cos'||op==='exp'||op==='tanh'?1:null;
      if(arity<1||arity>8||(wanted!==null&&arity!==wanted)||((op==='dist'||op==='zone')&&typeof current.value[1]!=='string'))return false;
      for(const value of current.value.slice(1))pending.push({value,depth:current.depth+1});
    }
  }
  return pending.length===0;
}
const mixExpr:v.GenericSchema<AudioMixExpr> = v.pipe(v.lazy(()=>v.union([finite,id,v.tupleWithRest([v.picklist(['+','-','*','/','min','max','%','pow','cos','exp','tanh','lerp','round','floor','abs','sin','hypot','ss','in','lt','gt','if','and','or','not','clamp','zone','dist'])],mixExpr)])),v.check(value=>boundedMix(value),'bounded mix expression'));
const mixValues=(max:number)=>v.pipe(v.array(v.tuple([id,mixExpr])),v.maxLength(max));
/** Ordered weights, levels, filters, sends and diagnostics. All graph/geometry ports remain native. */
export const AudioMixSchema = v.strictObject({values:mixValues(256),levels:mixValues(64),cutoffs:mixValues(16),
  rooms:v.pipe(v.array(v.strictObject({id,weight:mixExpr,level:mixExpr})),v.maxLength(16)),diag:mixValues(64),zones:mixValues(32),
  zoneMode:v.picklist(['first','max']),zoneFloor:v.pipe(finite,v.minValue(0),v.maxValue(1)),defaultZone:id,
  shade:v.exactOptional(v.tuple([mixExpr,mixExpr]))});
export type AudioMixRecipe = v.InferOutput<typeof AudioMixSchema>;

/** Bounded music catalogue selection; the engine keeps today's bar-grid calm/tension/boss stem decoding. */
export const AudioMusicSchema = v.pipe(v.strictObject({ id, base: id, slots: list, bootSlots: list,
  synthLead: v.picklist(['pluck', 'marimba']), minFade: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  source: v.nullable(v.strictObject({ dir: v.pipe(v.string(), v.regex(/^\/assets\/music\/[a-z0-9_-]+\/$/u)), manifestKey: id })),
  sets: v.record(id, id), selection: v.pipe(v.array(v.strictObject({ slots: list, when: conditions })), v.minLength(1), v.maxLength(64)),
  selectMode: v.picklist(['first', 'all']),
  catalogue: v.exactOptional(v.strictObject({ mode: v.picklist(['slots','bank']), extraStings: v.pipe(v.array(v.picklist(['pickup','death','chunk','dawn'])),v.maxLength(4)), stingSets: v.strictObject({ pickup:v.exactOptional(id),death:v.exactOptional(id),chunk:v.exactOptional(id),dawn:v.exactOptional(id) }) })),
}), v.check((music) => new Set(music.slots).size === music.slots.length && music.slots.includes(music.base)
  && music.bootSlots.every((slot) => slot === 'title' || music.slots.includes(slot))
  && music.selection.every((row) => row.slots.every((slot) => music.slots.includes(slot)))
  && Object.keys(music.sets).every((slot) => music.slots.includes(slot)), 'every selected, base and boot slot belongs to the score (the platform title is allowed)'));
/** Same-byte sample catalogue and loop gain selection, without author decoder callbacks. */
export const AudioSamplesSchema = v.strictObject({ catalogue: v.exactOptional(catalogue), set: id, bed: id, loopGains: v.pipe(v.record(id, gain), v.check((gains) => Object.keys(gains).length <= 32, 'bounded loop gains')), omitLoops: optionalIds, omitShots: optionalIds, omitSlots: optionalIds });
/** A biquad: its type, frequency (Hz) and Q (default 0.7). */
export type SynthFilterRow = readonly [BiquadFilterType, number, number?];

/** An LFO summed onto a parameter: rate (Hz), depth (the parameter's units) and waveform (default sine). */
export interface SynthLfoRow {
  readonly rate: number;
  readonly depth: number;
  readonly type?: OscillatorType;
}

/** A gain stage after the filters: its level, LFOs on that level and a flutter (a noise through filters, × depth, onto it). */
export interface SynthStageRow {
  readonly gain: number;
  readonly lfos?: readonly SynthLfoRow[];
  readonly flutter?: { readonly noise: SynthNoise; readonly filters: readonly SynthFilterRow[]; readonly depth: number };
}

/** A pooled looping noise. */
export type SynthNoise = 'noise-white' | 'noise-pink' | 'native-white';

/** One chain into a bed: exactly one of noise / osc (Hz) / sample, then filters, stages and an optional named panner. */
export interface SynthChainRow {
  readonly noise?: SynthNoise;
  readonly osc?: number;
  readonly sample?: string;
  readonly filters?: readonly SynthFilterRow[];
  /** LFOs on a filter's frequency: its index in `filters`, then the LFO */
  readonly sweeps?: readonly (readonly [number, SynthLfoRow])[];
  readonly stages?: readonly SynthStageRow[];
  /** a stereo panner after the stages, returned under this name for the caller to steer */
  readonly pan?: string;
  /** the bed it feeds */
  readonly to: string;
}

/** A bed: its id in the zones, where it goes (another bed's id or a caller-named node) and its starting level (default 0). */
export interface SynthBedRow {
  readonly id: string;
  readonly out: string;
  readonly gain?: number;
  readonly pan?: number;
  readonly lfos?: readonly SynthLfoRow[];
}

/** A mark among the chains: the caller's `marks[mark]` runs at that point of the build (a scheduler whose first draw from
 *  the shared random stream must stay in its place). */
export interface SynthMarkRow {
  readonly mark: string;
}

/** A synth bed graph: its beds (in order: a bed's `out` bed comes first), its chains (and marks) and the tap's id prefix. */
export interface SynthBedGraph {
  readonly tap?: string;
  readonly beds: readonly SynthBedRow[];
  readonly chains: readonly (SynthChainRow | SynthMarkRow)[];
}


/** Named buses, filters and positional emitters; output and point ids are native graph loans. */
export const AudioNodeSchema = v.pipe(v.strictObject({id,out:v.exactOptional(id),input:v.exactOptional(id),gain:v.exactOptional(mixExpr),
  filter:v.exactOptional(v.union([v.tuple([v.picklist(['lowpass','highpass','bandpass','lowshelf','highshelf','peaking','notch','allpass']),finite]),v.tuple([v.picklist(['lowpass','highpass','bandpass','lowshelf','highshelf','peaking','notch','allpass']),finite,finite])])),
  panner:v.exactOptional(v.tuple([finite,finite,finite])),at:v.exactOptional(id),
  follow:v.exactOptional(v.strictObject({zone:id,rays:v.pipe(finite,v.safeInteger(),v.minValue(1),v.maxValue(8192)),step:v.pipe(finite,v.minValue(0.001)),refine:v.pipe(finite,v.safeInteger(),v.minValue(0),v.maxValue(64)),diag:id}))}),
  v.check(row=>Number(row.gain!==undefined)+Number(row.filter!==undefined)+Number(row.panner!==undefined)===1,'one audio node kind'),
  v.check(row=>(row.at===undefined&&row.follow===undefined)||row.panner!==undefined,'positional emitter fields require a panner'));
export type AudioNodeRow = v.InferOutput<typeof AudioNodeSchema>;
/** Ordered bounded WebAudio graphs; output ids and scheduler marks are supplied by the native host. */
const synthFrequency = v.pipe(finite,v.minValue(0),v.maxValue(96000));
const synthWave = v.picklist(['sine','square','sawtooth','triangle']);
const synthNoise = v.picklist(['noise-white','noise-pink','native-white']);
const synthLfo = v.strictObject({rate:synthFrequency,depth:finite,type:v.exactOptional(synthWave)});
const synthFilter = v.union([
  v.tuple([v.picklist(['lowpass','highpass','bandpass','lowshelf','highshelf','peaking','notch','allpass']),synthFrequency]),
  v.tuple([v.picklist(['lowpass','highpass','bandpass','lowshelf','highshelf','peaking','notch','allpass']),synthFrequency,finite])]);
const synthFilters = v.pipe(v.array(synthFilter),v.maxLength(16));
const synthStage = v.strictObject({gain,lfos:v.exactOptional(v.pipe(v.array(synthLfo),v.maxLength(8))),
  flutter:v.exactOptional(v.strictObject({noise:synthNoise,filters:synthFilters,depth:finite}))});
const synthChain = v.pipe(v.strictObject({noise:v.exactOptional(synthNoise),osc:v.exactOptional(synthFrequency),sample:v.exactOptional(id),
  filters:v.exactOptional(synthFilters),sweeps:v.exactOptional(v.pipe(v.array(v.tuple([v.pipe(finite,v.safeInteger(),v.minValue(0),v.maxValue(15)),synthLfo])),v.maxLength(16))),
  stages:v.exactOptional(v.pipe(v.array(synthStage),v.maxLength(16))),pan:v.exactOptional(id),to:id}),
  v.check(row=>Number(row.noise!==undefined)+Number(row.osc!==undefined)+Number(row.sample!==undefined)===1,'one synth source'),
  v.check(row=>(row.sweeps??[]).every(([index])=>index<(row.filters?.length??0)),'declared sweep filter'));
export const SynthBedGraphSchema = v.pipe(v.strictObject({tap:v.exactOptional(id),
  beds:v.pipe(v.array(v.strictObject({id,out:id,gain:v.exactOptional(gain),pan:v.exactOptional(v.pipe(finite,v.minValue(-1),v.maxValue(1))),
    lfos:v.exactOptional(v.pipe(v.array(synthLfo),v.maxLength(8)))})),v.minLength(1),v.maxLength(64)),
  chains:v.pipe(v.array(v.union([synthChain,v.strictObject({mark:id})])),v.maxLength(256))}),
  v.check(graph=>new Set(graph.beds.map(row=>row.id)).size===graph.beds.length,'unique synth bed ids'),
  v.check(graph=>graph.chains.every(row=>'mark' in row||graph.beds.some(bed=>bed.id===row.to)),'declared synth bed target'));
/** Bounded ordered mixer primitives. Randomness is an explicit numeric input named `random`. */
const phraseTone = v.strictObject({kind:v.literal('tone'),when:v.exactOptional(mixExpr),out:id,type:v.exactOptional(synthWave),
  f0:mixExpr,gain:mixExpr,decay:mixExpr,t:v.exactOptional(mixExpr),f1:v.exactOptional(mixExpr),glide:v.exactOptional(mixExpr),
  attack:v.exactOptional(mixExpr),hold:v.exactOptional(mixExpr),lowpass:v.exactOptional(mixExpr),
  vibrato:v.exactOptional(v.strictObject({rate:mixExpr,depth:mixExpr})),envelope:v.exactOptional(v.strictObject({end:mixExpr,stop:v.pipe(v.array(mixExpr),v.maxLength(16))}))});
const phraseBurst = v.strictObject({kind:v.literal('burst'),when:v.exactOptional(mixExpr),out:id,type:v.exactOptional(v.picklist(['lowpass','highpass','bandpass','lowshelf','highshelf','peaking','notch','allpass'])),
  freq:mixExpr,gain:mixExpr,decay:mixExpr,t:v.exactOptional(mixExpr),freqEnd:v.exactOptional(mixExpr),q:v.exactOptional(mixExpr),
  attack:v.exactOptional(mixExpr),hold:v.exactOptional(mixExpr),rate:v.exactOptional(mixExpr)});
const phraseValue = v.strictObject({kind:v.literal('value'),when:v.exactOptional(mixExpr),id,value:mixExpr});
const phraseEnvelope = v.strictObject({kind:v.literal('envelope'),out:id,t:mixExpr,ramps:v.pipe(v.array(v.variant('kind',[v.strictObject({kind:v.literal('linear'),value:mixExpr,t:mixExpr}),v.strictObject({kind:v.literal('target'),value:mixExpr,t:mixExpr,tau:mixExpr})])),v.maxLength(16))});
const phraseBody = v.variant('kind',[phraseValue,phraseTone,phraseBurst]);
export const AudioPhraseProgramSchema = v.pipe(v.strictObject({tap:v.exactOptional(id),steps:v.pipe(v.array(v.variant('kind',[phraseValue,phraseTone,phraseBurst,phraseEnvelope,
  v.strictObject({kind:v.literal('bus'),id,out:id,gain:mixExpr,pan:mixExpr,alwaysPan:v.exactOptional(v.boolean()),filter:v.exactOptional(v.strictObject({type:v.picklist(['lowpass','highpass','bandpass']),frequency:mixExpr,q:v.exactOptional(mixExpr)}))}),
  v.strictObject({kind:v.literal('repeat'),eachTest:v.exactOptional(v.boolean()),index:v.exactOptional(id),count:mixExpr,max:v.pipe(finite,v.safeInteger(),v.minValue(1),v.maxValue(32)),body:v.pipe(v.array(phraseBody),v.maxLength(64))})])),v.maxLength(64))}),
  v.check(program=>program.steps.reduce((sum,step)=>sum+(step.kind==='repeat'?step.max*step.body.length:1),0)<=1024,'bounded phrase work'));
/** Validated tone/noise envelopes and owned filtered buses; no executable author callbacks. */
export type AudioPhraseProgram = v.InferOutput<typeof AudioPhraseProgramSchema>;
/** A native graph mark scheduler; predicates read actual mixer observations. */
export const AudioOneShotScheduleSchema = v.strictObject({mark:id,tick:id,every:v.tuple([v.pipe(finite,v.minValue(0.001),v.maxValue(600)),v.pipe(finite,v.minValue(0),v.maxValue(600)),v.pipe(finite,v.minValue(0),v.maxValue(10))]),when:v.exactOptional(mixExpr),program:id,targets:v.pipe(v.array(id),v.minLength(1),v.maxLength(32))});
export type AudioOneShotSchedule = v.InferOutput<typeof AudioOneShotScheduleSchema>;
/** A scoped ambient scheduler for an admitted phrase. */
export const AudioPhraseScheduleSchema = v.strictObject({tick:id,wait:v.pipe(v.tuple([finite,finite]),v.check(values=>values[0]>0&&values[1]>=values[0]&&values[1]<=600)),program:AudioPhraseProgramSchema});
export type AudioPhraseSchedule = v.InferOutput<typeof AudioPhraseScheduleSchema>;

const zone = v.pipe(v.strictObject({ id, x: finite, z: finite, inner: v.pipe(finite, v.minValue(0), v.maxValue(2000)), outer: v.pipe(finite, v.minValue(0), v.maxValue(2000)), gain,
  fade: v.optional(v.pipe(finite, v.minValue(0.001), v.maxValue(2000))), open: v.optional(v.boolean()), source: v.optional(id) }), v.check((row) => row.inner < row.outer && (row.fade === undefined || row.outer === row.inner + row.fade), 'audio zone fade must extend outside its inner radius'));
const rectangle = v.pipe(v.strictObject({ id, zone: id, x0: finite, x1: finite, z0: finite, z1: finite }), v.check((row) => row.x0 < row.x1 && row.z0 < row.z1, 'positive rectangular audio region'));
/** Native audio lifecycle policy; observations and decoded samples are supplied by the resident owner. */
export const AudioAmbienceRoutingSchema = v.strictObject({
  warm:v.pipe(v.array(id),v.maxLength(32)),prewarm:v.pipe(v.array(id),v.maxLength(32)),listener:v.picklist(['context','port']),
  underwater:v.exactOptional(v.tuple([finite,finite])),
  bounds:v.pipe(v.array(v.strictObject({id,from:id,key:id})),v.maxLength(64)),
  near:v.pipe(v.array(v.strictObject({id,radius:v.pipe(finite,v.minValue(0.001))})),v.maxLength(64)),
  steer:v.pipe(v.array(v.strictObject({pan:id,toward:id,width:finite,tau:finite})),v.maxLength(32)),
  rooms:v.strictObject({from:id,to:id,input:v.exactOptional(id),prewarmMissing:v.exactOptional(v.boolean()),
    list:v.pipe(v.array(v.strictObject({id,ir:id,weight:id,level:mixExpr,feeds:v.exactOptional(list)})),v.maxLength(16))}),
  zoneNames:list,
  samples:v.exactOptional(v.strictObject({startDelay:finite,tap:id,
    beds:v.pipe(v.array(v.strictObject({id,out:id,panned:v.boolean()})),v.maxLength(32))})),
  activeGains:v.exactOptional(v.pipe(v.array(v.tuple([id,v.union([id,finite])])),v.maxLength(16)))
});
export type AudioAmbienceRouting = v.InferOutput<typeof AudioAmbienceRoutingSchema>;
/** Bounded zone/mixer data. Terrain, moving emitters and bespoke synthesis remain trusted runtime ports. */
export const AudioZonesSchema = v.strictObject({ id, routing:v.exactOptional(AudioAmbienceRoutingSchema), nodes:v.exactOptional(v.pipe(v.array(AudioNodeSchema),v.maxLength(64))), schedules:v.exactOptional(v.pipe(v.array(AudioOneShotScheduleSchema),v.maxLength(32))), programs:v.exactOptional(v.pipe(v.record(id,AudioPhraseProgramSchema),v.check(rows=>Object.keys(rows).length<=32))), graph:v.exactOptional(SynthBedGraphSchema), mix:v.exactOptional(AudioMixSchema), smoothSeconds: v.pipe(finite, v.minValue(0.001), v.maxValue(10)), tickHz: v.pipe(finite, v.minValue(0.1), v.maxValue(120)),
  silentSeconds: v.pipe(finite, v.minValue(0), v.maxValue(600)), holdSeconds: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  levels: v.pipe(v.record(id, gain), v.check((levels) => Object.keys(levels).length <= 64, 'bounded levels')),
  blendMetres: v.optional(v.pipe(finite, v.minValue(0.001), v.maxValue(2000))),
  rectangles: v.optional(v.pipe(v.array(rectangle), v.maxLength(512), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique rectangular regions'))),
  beds: v.optional(v.pipe(v.array(v.strictObject({ id, zone: id })), v.maxLength(32), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique bed ids'))),
  positional: v.optional(v.strictObject({ sample: id, max: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(32)), reach: v.pipe(finite, v.minValue(0.001), v.maxValue(2000)) })),
  wet: v.pipe(v.record(id, v.pipe(finite, v.minValue(0), v.maxValue(1))), v.check((levels) => Object.keys(levels).length <= 16, 'bounded rooms')),
  zones: v.pipe(v.array(zone), v.maxLength(512), v.check((zones) => new Set(zones.map((row) => row.id)).size === zones.length, 'unique audio zones')) });
/** The validated score's stable catalogue slots and scene rules. */
export type AudioMusic = v.InferOutput<typeof AudioMusicSchema>;
/** The validated same-byte sample selection. */
export type AudioSamples = v.InferOutput<typeof AudioSamplesSchema>;
/** The validated mixer timing and named ambience zones. */
export type AudioZones = v.InferOutput<typeof AudioZonesSchema>;

/** Bounded offline DSP commands; the bank still supplies its actual sample rate and variant seed. */
const pcmModes=v.pipe(v.array(v.tuple([mixExpr,mixExpr,mixExpr])),v.maxLength(16));
const pcmFilter=v.picklist(['lowpass','highpass','bandpass','peaking','notch']);
const pcmStep=v.variant('kind',[
  v.strictObject({kind:v.literal('values'),rows:mixValues(32)}),
  v.strictObject({kind:v.literal('formants'),id,rows:pcmModes}),
  v.strictObject({kind:v.literal('noise'),at:mixExpr,type:pcmFilter,f:mixExpr,f1:v.exactOptional(mixExpr),q:v.exactOptional(mixExpr),attack:mixExpr,decay:mixExpr,gain:mixExpr,pink:v.exactOptional(v.boolean())}),
  v.strictObject({kind:v.literal('thump'),at:mixExpr,args:v.tuple([mixExpr,mixExpr,mixExpr,mixExpr])}),
  v.strictObject({kind:v.literal('grains'),at:mixExpr,rate:mixExpr,dur:mixExpr,f:mixExpr,q:mixExpr,gain:mixExpr,grain:v.exactOptional(mixExpr),shape:v.exactOptional(mixExpr)}),
  v.strictObject({kind:v.literal('strike'),at:mixExpr,modes:pcmModes,gain:mixExpr,jitter:v.exactOptional(mixExpr)}),
  v.strictObject({kind:v.literal('click'),at:mixExpr,args:v.tuple([mixExpr,mixExpr,mixExpr])}),
  v.strictObject({kind:v.literal('bubbles'),at:mixExpr,args:v.tuple([mixExpr,mixExpr,mixExpr,mixExpr,mixExpr])}),
  v.strictObject({kind:v.literal('voice'),at:mixExpr,dur:mixExpr,f0:mixExpr,tense:mixExpr,breath:mixExpr,
    vowel:id,vowelIndex:v.exactOptional(mixExpr),blend:v.exactOptional(v.strictObject({to:id,amount:mixExpr})),env:v.tuple([mixExpr,mixExpr,mixExpr]),gain:mixExpr,
    rough:v.exactOptional(mixExpr),jitter:v.exactOptional(mixExpr),shimmer:v.exactOptional(mixExpr)}),
  v.strictObject({kind:v.literal('saturate'),drive:mixExpr}),
  v.strictObject({kind:v.literal('filter'),type:pcmFilter,f:mixExpr,q:mixExpr}),
  v.strictObject({kind:v.literal('flutter'),f:mixExpr,q:mixExpr,base:mixExpr,depth:mixExpr,drive:mixExpr}),
  v.strictObject({kind:v.literal('sine'),f:mixExpr,gain:mixExpr,envelope:mixExpr})
]);
export const AudioPcmProgramSchema=v.pipe(v.strictObject({seed:v.tuple([finite,finite]),
  values:mixValues(32),duration:mixExpr,
  steps:v.pipe(v.array(v.variant('kind',[...pcmStep.options,
    v.strictObject({kind:v.literal('repeat'),count:mixExpr,max:v.pipe(finite,v.safeInteger(),v.minValue(1),v.maxValue(32)),index:id,while:v.exactOptional(mixExpr),body:v.pipe(v.array(pcmStep),v.maxLength(32))})])),v.maxLength(64)),
  finish:v.tuple([finite,finite])}),v.check(program=>program.steps.reduce((sum,row)=>sum+(row.kind==='repeat'?row.max*row.body.length:1),0)<=2048,'bounded PCM recipe'));
export type AudioPcmProgram=v.InferOutput<typeof AudioPcmProgramSchema>;

/** Ordered gameplay observations; the native owner lends scalar/actor readers and existing sound operations. */
const observationNames=v.pipe(v.array(id),v.maxLength(32));
export const AudioObservationSystemSchema=v.strictObject({id,before:observationNames,after:observationNames,
  inputs:v.pipe(v.array(v.strictObject({id,source:id,path:v.pipe(v.array(id),v.maxLength(8)),op:v.picklist(['number','truth','present','equals']),value:v.exactOptional(scalar),fallback:v.exactOptional(finite)})),v.maxLength(64)),
  interval:v.pipe(finite,v.minValue(0),v.maxValue(60)),initial:v.pipe(v.record(id,finite),v.check(rows=>Object.keys(rows).length<=64)),
  frame:v.pipe(v.array(v.strictObject({write:id,value:mixExpr,when:v.exactOptional(mixExpr)})),v.maxLength(32)),
  steps:v.pipe(v.array(v.variant('kind',[
    v.strictObject({kind:v.literal('state'),id,value:mixExpr,when:v.exactOptional(mixExpr),changed:v.exactOptional(id)}),
    v.strictObject({kind:v.literal('call'),call:id,when:v.exactOptional(mixExpr),remember:v.exactOptional(id)}),
    v.strictObject({kind:v.literal('entities'),list:id,actorKind:id,state:id,exclude:observationNames,
      gap:v.pipe(finite,v.minValue(0),v.maxValue(600)),radius:v.pipe(finite,v.minValue(0),v.maxValue(2000)),remember:id,call:id})
  ])),v.maxLength(64))});
export type AudioObservationSystem=v.InferOutput<typeof AudioObservationSystemSchema>;

/** Ordered persistent oscillator graphs. The caller owns the output and all fade/stop policy. */
export const AudioLoopGraphSchema=v.pipe(v.array(v.variant('kind',[
  v.strictObject({kind:v.literal('gain'),id,value:finite}),
  v.strictObject({kind:v.literal('filter'),id,type:v.picklist(['lowpass','highpass','bandpass']),frequency:finite,q:finite}),
  v.strictObject({kind:v.literal('oscillator'),id,type:v.picklist(['sine','triangle','square','sawtooth']),frequency:finite,midi:v.exactOptional(finite),detune:v.exactOptional(finite)}),
  v.strictObject({kind:v.literal('connect'),from:id,to:id,param:v.exactOptional(v.picklist(['gain','frequency','detune']))}),
  v.strictObject({kind:v.literal('start'),id})
])),v.maxLength(64));
export type AudioLoopGraph=v.InferOutput<typeof AudioLoopGraphSchema>;
