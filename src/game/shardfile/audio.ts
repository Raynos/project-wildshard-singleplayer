import * as v from 'valibot';
import { AudioRoutingSchema } from './audioRouting';
import { AudioMusicSchema, AudioSamplesSchema, AudioZonesSchema } from './audioProfiles';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const wind = v.strictObject({ frequency: v.pipe(finite, v.minValue(20), v.maxValue(20000)), q: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), pan: v.pipe(finite, v.minValue(-1), v.maxValue(1)), rate: v.pipe(finite, v.minValue(0.01), v.maxValue(10)), gain: v.pipe(finite, v.minValue(0), v.maxValue(0.2)) });
/** The thin audio declaration: catalogue voices, bounded wind beds and a silent/default score. */
export const AudioDataSchema = v.strictObject({ cues: v.pipe(v.array(v.strictObject({ id, voice: id })), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique cue ids')),
  music: v.optional(AudioMusicSchema), samples: v.optional(AudioSamplesSchema), zones: v.optional(AudioZonesSchema),
  routing: v.optional(AudioRoutingSchema, []), ambience: v.nullable(v.strictObject({ bed: id, winds: v.pipe(v.array(wind), v.minLength(1), v.maxLength(4)) })), score: v.picklist(['silent', 'default']) });
/** Validated audio data; voice ids are resolved only through the platform's admitted catalogue. */
export type AudioData = v.InferOutput<typeof AudioDataSchema>;
/** Compile the TypeScript-authored cue map, ambience and score without executable audio closures. */
export function parseAudioData(input: unknown): AudioData { return v.parse(AudioDataSchema, input); }
