import * as v from 'valibot';
import { AudioRoutingSchema } from './audioRouting';
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
export const AudioDataSchema = v.pipe(v.strictObject({ cues: v.pipe(v.array(v.strictObject({ id, voice: id })), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique cue ids')),
  emitters:v.exactOptional(v.pipe(v.record(id,AudioLoopEmitterSchema),v.check(rows=>Object.keys(rows).length<=32))), playback:v.exactOptional(AudioPlaybackSchema), surfaces:v.exactOptional(AudioSurfaceSchema), loopGraphs:v.exactOptional(v.pipe(v.record(id,AudioLoopGraphSchema),v.check(rows=>Object.keys(rows).length<=32))), observations:v.exactOptional(v.pipe(v.array(AudioObservationSystemSchema),v.maxLength(16),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length))), pcm:v.exactOptional(v.pipe(v.record(id,AudioPcmProgramSchema),v.check(rows=>Object.keys(rows).length<=64))), synth:v.exactOptional(v.pipe(v.record(id,AudioPhraseProgramSchema),v.check(rows=>Object.keys(rows).length<=32))), recordings: v.optional(recordings), music: v.optional(AudioMusicSchema), samples: v.optional(AudioSamplesSchema), zones: v.optional(AudioZonesSchema),
  routing: v.optional(AudioRoutingSchema, []), ambience: v.nullable(v.strictObject({ phrases:v.exactOptional(v.pipe(v.array(AudioPhraseScheduleSchema),v.maxLength(8))), gust: v.exactOptional(gust), bed: id, winds: v.pipe(v.array(wind), v.minLength(1), v.maxLength(4)) })), score: v.picklist(['silent', 'default']) }),v.check(audio=>Object.values(audio.emitters??{}).every(row=>audio.loopGraphs?.[row.graph]!==undefined),'declared loop emitter graph')); 
/** Validated audio data; voice ids are resolved only through the platform's admitted catalogue. */
export type AudioData = v.InferOutput<typeof AudioDataSchema>;
/** Compile the TypeScript-authored cue map, ambience and score without executable audio closures. */
export function parseAudioData(input: unknown): AudioData { return v.parse(AudioDataSchema, input); }
