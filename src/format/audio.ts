import * as v from 'valibot';
import {AudioBankSchema} from './audioBank';
import { AudioRoutingSchema, AudioVoiceBindingsSchema } from './audioRouting';
import { AudioLoopEmitterSchema, AudioPlaybackSchema, AudioSurfaceSchema, AudioLoopGraphSchema, AudioObservationSystemSchema, AudioPcmProgramSchema, AudioMusicSchema, AudioSamplesSchema, AudioZonesSchema, AudioPhraseProgramSchema, AudioPhraseScheduleSchema } from './audioProfiles';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const recordingPath = v.pipe(v.string(), v.maxLength(256), v.regex(/^\/assets\/(?:music|sfx)\/(?:[a-zA-Z0-9][a-zA-Z0-9._-]*\/)+[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:m4a|wav)$/u));
const recordingRef = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
const recordings = v.pipe(v.record(recordingPath, recordingRef), v.check(rows => Object.keys(rows).length <= 1024, 'bounded audio recording bindings'));
const finite = v.pipe(v.number(), v.finite());
const wind = v.strictObject({ frequency: v.pipe(finite, v.minValue(20), v.maxValue(20000)), q: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), pan: v.pipe(finite, v.minValue(-1), v.maxValue(1)), rate: v.pipe(finite, v.minValue(0.01), v.maxValue(10)), cutoff: v.exactOptional(v.pipe(finite, v.minValue(20), v.maxValue(20000))), gain: v.pipe(finite, v.minValue(0), v.maxValue(0.2)) });
/** Positive, ordered seconds/gain ranges for one shared wind/gust driver. */
const range = v.pipe(v.tuple([v.pipe(finite,v.minValue(0.001),v.maxValue(600)),v.pipe(finite,v.minValue(0.001),v.maxValue(600))]),v.check(values=>values[0]<=values[1]));
const gust = v.strictObject({ scope:id, scopeFirst:v.boolean(), startTap:id, tap:id, wait:range, rise:range, fall:range, amount:range, gentle:v.pipe(finite,v.minValue(0.1),v.maxValue(10)) });
/** The thin audio declaration: catalogue voices, bounded wind beds and a silent/default score. */
/** Bounded native owner references; no executable shard adapters cross this boundary. */
const reference = v.strictObject({ owner:id, path:v.pipe(v.array(id),v.maxLength(4),v.check(path=>path.every(field=>!['__proto__','prototype','constructor'].includes(field)))) });
const references = v.pipe(v.record(id,reference),v.check(rows=>Object.keys(rows).length<=32));
const command = v.variant('kind',[
  v.strictObject({kind:v.literal('scene'),system:id,state:id,on:id,off:id}),
  v.strictObject({kind:v.literal('combat'),gain:finite}),
  v.strictObject({kind:v.literal('shot'),family:id}),
  v.strictObject({kind:v.literal('emitter'),id}),
  v.strictObject({kind:v.literal('frame')}),
  v.strictObject({kind:v.literal('log'),on:id,off:id,detail:v.exactOptional(reference),precision:v.exactOptional(v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(8))),ok:v.exactOptional(v.boolean())}),
]);
const gameplay = v.strictObject({
  entered:v.boolean(),score:v.boolean(),activate:v.boolean(),restoreShade:v.boolean(),
  inputs:references,writers:v.pipe(v.record(id,v.variant('kind',[
    v.strictObject({kind:v.literal('night')}),v.strictObject({kind:v.literal('dusk')})
  ])),v.check(rows=>Object.keys(rows).length<=32)),entities:references,
  commands:v.pipe(v.record(id,command),v.check(rows=>Object.keys(rows).length<=32)),
  environment:v.exactOptional(v.strictObject({
    objects:references,near:references,floors:v.pipe(v.record(id,v.pipe(v.array(reference),v.maxLength(32))),v.check(rows=>Object.keys(rows).length<=16)),
    dusk:reference,emitter:v.strictObject({id,profile:id,point:reference,height:finite}),
    publish:v.strictObject({id,values:references}),
  })),
  cues:v.exactOptional(v.strictObject({underwater:v.boolean(),melee:v.strictObject({fire:id,hitPrefix:id,materials:v.pipe(v.record(id,id),v.check(rows=>Object.keys(rows).length<=32)),fallback:id,death:id,deathGain:finite,clangPrefix:id})})),
  doors:v.exactOptional(v.strictObject({open:id,close:id})),
  diagnostic:v.exactOptional(v.strictObject({name:id,system:id,state:id})),
});
/** Declared gameplay owner bindings for the existing observation and entered phases. */
export type AudioGameplay = v.InferOutput<typeof gameplay>;
const rawAudioSchema = v.pipe(v.strictObject({ cues: v.pipe(v.array(v.strictObject({ id, voice: id })), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique cue ids')),
  entry:v.exactOptional(v.pipe(v.record(id,v.strictObject({wind:v.boolean(),score:v.boolean()})),v.check(rows=>Object.keys(rows).length<=4))), gameplay:v.exactOptional(gameplay), bank:v.exactOptional(AudioBankSchema), emitters:v.exactOptional(v.pipe(v.record(id,AudioLoopEmitterSchema),v.check(rows=>Object.keys(rows).length<=32))), playback:v.exactOptional(AudioPlaybackSchema), surfaces:v.exactOptional(AudioSurfaceSchema), loopGraphs:v.exactOptional(v.pipe(v.record(id,AudioLoopGraphSchema),v.check(rows=>Object.keys(rows).length<=32))), observations:v.exactOptional(v.pipe(v.array(AudioObservationSystemSchema),v.maxLength(16),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length))), pcm:v.exactOptional(v.pipe(v.record(id,AudioPcmProgramSchema),v.check(rows=>Object.keys(rows).length<=64))), synth:v.exactOptional(v.pipe(v.record(id,AudioPhraseProgramSchema),v.check(rows=>Object.keys(rows).length<=32))), recordings: v.optional(recordings), music: v.optional(AudioMusicSchema), samples: v.optional(AudioSamplesSchema), zones: v.optional(AudioZonesSchema),
  voiceBindings:v.exactOptional(AudioVoiceBindingsSchema), routing: v.optional(AudioRoutingSchema, []), ambience: v.nullable(v.strictObject({ phrases:v.exactOptional(v.pipe(v.array(AudioPhraseScheduleSchema),v.maxLength(8))), gust: v.exactOptional(gust), bed: id, winds: v.pipe(v.array(wind), v.minLength(1), v.maxLength(4)) })), score: v.picklist(['silent', 'default']) }),v.check(audio=>Object.values(audio.emitters??{}).every(row=>audio.loopGraphs?.[row.graph]!==undefined),'declared loop emitter graph'),v.check(audio=>Object.values(audio.bank?.families??{}).every(row=>row.source.kind!=='pcm'||audio.pcm?.[row.source.id]!==undefined)&&Object.values(audio.bank?.spatial??{}).every(row=>audio.synth?.[row.phrase]!==undefined),'declared voice bank programs'),v.check(audio=>audio.bank===undefined||(audio.playback!==undefined&&(audio.bank.barks===undefined||audio.bank.catalogue!==undefined)),'declared bank playback/catalogue'));
/** Validated audio data; voice ids are resolved only through the platform's admitted catalogue. */
export interface AudioData {
  cues: { id: string; voice: string }[];
  gameplay?:AudioGameplay;
  entry?:Record<string,{wind:boolean;score:boolean}>;
  bank?: v.InferOutput<typeof AudioBankSchema>;
  emitters?: Record<string, v.InferOutput<typeof AudioLoopEmitterSchema>>;
  playback?: v.InferOutput<typeof AudioPlaybackSchema>;
  surfaces?: v.InferOutput<typeof AudioSurfaceSchema>;
  loopGraphs?: Record<string, v.InferOutput<typeof AudioLoopGraphSchema>>;
  observations?: v.InferOutput<typeof AudioObservationSystemSchema>[];
  pcm?: Record<string, v.InferOutput<typeof AudioPcmProgramSchema>>;
  synth?: Record<string, v.InferOutput<typeof AudioPhraseProgramSchema>>;
  recordings?: Record<string, string> | undefined;
  music?: v.InferOutput<typeof AudioMusicSchema> | undefined;
  samples?: v.InferOutput<typeof AudioSamplesSchema> | undefined;
  zones?: v.InferOutput<typeof AudioZonesSchema> | undefined;
  voiceBindings?: v.InferOutput<typeof AudioVoiceBindingsSchema>;
  routing: v.InferOutput<typeof AudioRoutingSchema>;
  ambience: {
    phrases?: v.InferOutput<typeof AudioPhraseScheduleSchema>[];
    gust?: v.InferOutput<typeof gust>;
    bed: string;
    winds: v.InferOutput<typeof wind>[];
  } | null;
  score: 'silent' | 'default';
}
/** The defining validator is unchanged; its public output is independently named. */
export const AudioDataSchema: v.GenericSchema<unknown, AudioData> = rawAudioSchema;
/** Compile the TypeScript-authored cue map, ambience and score without executable audio closures. */
export function parseAudioData(input: unknown): AudioData { return v.parse(AudioDataSchema, input); }
