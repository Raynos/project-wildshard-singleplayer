import * as v from 'valibot';
import { VoicePatchesSchema, type VoicePatches } from './voicePatches';
import { AudioSceneSchema, SampledAudioSceneSchema, type SampledAudioScene, type AudioScene } from './audioScene';
import { isJsonData } from './json';
import {AudioBankSchema} from './audioBank';
import { AudioRoutingSchema, AudioVoiceBindingsSchema } from './audioRouting';
import { AudioLoopEmitterSchema, AudioPlaybackSchema, AudioSurfaceSchema, AudioLoopGraphSchema, AudioObservationSystemSchema, AudioPcmProgramSchema, AudioMusicSchema, AudioSamplesSchema, AudioZonesSchema, AudioPhraseProgramSchema, AudioPhraseScheduleSchema } from './audioProfiles';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const recordingPath = v.pipe(v.string(), v.maxLength(256), v.regex(/^\/assets\/(?:music|sfx)\/(?:[a-zA-Z0-9][a-zA-Z0-9._-]*\/)+[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:m4a|wav)$/u));
const recordingRef = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
const recordings = v.pipe(v.record(recordingPath, recordingRef), v.check(rows => Object.keys(rows).length <= 1024, 'bounded audio recording bindings'));
const finite = v.pipe(v.number(), v.finite());
const wind: v.GenericSchema<AudioWindRowsInput, AudioWindRows> = v.strictObject({ frequency: v.pipe(finite, v.minValue(20), v.maxValue(20000)), q: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), pan: v.pipe(finite, v.minValue(-1), v.maxValue(1)), rate: v.pipe(finite, v.minValue(0.01), v.maxValue(10)), cutoff: v.exactOptional(v.pipe(finite, v.minValue(20), v.maxValue(20000))), gain: v.pipe(finite, v.minValue(0), v.maxValue(0.2)) });
/** Positive, ordered seconds/gain ranges for one shared wind/gust driver. */
const range: v.GenericSchema<AudioGustRangeInput, AudioGustRange> = v.pipe(v.tuple([v.pipe(finite,v.minValue(0.001),v.maxValue(600)),v.pipe(finite,v.minValue(0.001),v.maxValue(600))]),v.check(values=>values[0]<=values[1]));
const gust: v.GenericSchema<AudioGustRowsInput, AudioGustRows> = v.strictObject({ scope:id, scopeFirst:v.boolean(), startTap:id, tap:id, wait:range, rise:range, fall:range, amount:range, gentle:v.pipe(finite,v.minValue(0.1),v.maxValue(10)) });
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
const entryLoan = v.pipe(id, v.regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/u));
const entryBounds = v.pipe(v.strictObject({ x:finite, z:finite, r:v.pipe(finite,v.minValue(Number.MIN_VALUE)), yMin:finite, yMax:finite }),
  v.check(row=>row.yMin<=row.yMax,'Ordered audio bounds'));
const entryPoints = v.pipe(v.array(v.strictObject({x:finite,z:finite})),v.maxLength(2048));
/** Finite construction owner ids and detached spatial facts for the entered audio phase.
 * Floors preserve ordered gaps. No callback, object path or replacement owner is admitted. */
export const AudioEntryEnvironmentSchema: v.GenericSchema<AudioEntryEnvironmentRowsInput, AudioEntryEnvironmentRows> = v.strictObject({
  floors:v.pipe(v.record(id,v.pipe(v.array(v.nullable(entryLoan)),v.maxLength(32))),v.check(rows=>Object.keys(rows).length<=16)),
  bounds:v.pipe(v.record(id,v.nullable(entryBounds)),v.check(rows=>Object.keys(rows).length<=32)),
  near:v.pipe(v.record(id,v.strictObject({phone:entryPoints,desktop:entryPoints})),v.check(rows=>Object.keys(rows).length<=32)),
  dusk:entryLoan,emitter:v.strictObject({id,profile:id,point:entryLoan,height:finite}),
  publish:v.pipe(v.strictObject({id,hum:id,bank:id,surfaces:id,ambience:id}),
    v.check(row=>new Set([row.hum,row.bank,row.surfaces,row.ambience]).size===4,'Distinct audio handle names')),
});
const gameplay: v.GenericSchema<AudioGameplayInput, AudioGameplay> = v.pipe(v.strictObject({
  constants:v.exactOptional(v.pipe(v.record(id,v.unknown()),v.check(rows=>isJsonData(rows)))),
  entered:v.boolean(),score:v.boolean(),activate:v.boolean(),restoreShade:v.boolean(),
  inputs:references,writers:v.pipe(v.record(id,v.variant('kind',[
    v.strictObject({kind:v.literal('night')}),v.strictObject({kind:v.literal('dusk')})
  ])),v.check(rows=>Object.keys(rows).length<=32)),entities:references,
  commands:v.pipe(v.record(id,command),v.check(rows=>Object.keys(rows).length<=32)),
  entryEnvironment:v.exactOptional(AudioEntryEnvironmentSchema),
  environment:v.exactOptional(v.strictObject({
    objects:references,near:references,floors:v.pipe(v.record(id,v.pipe(v.array(reference),v.maxLength(32))),v.check(rows=>Object.keys(rows).length<=16)),
    dusk:reference,emitter:v.strictObject({id,profile:id,point:reference,height:finite}),
    publish:v.strictObject({id,values:references}),
  })),
  cues:v.exactOptional(v.strictObject({underwater:v.boolean(),melee:v.strictObject({fire:id,hitPrefix:id,materials:v.pipe(v.record(id,id),v.check(rows=>Object.keys(rows).length<=32)),fallback:id,death:id,deathGain:finite,clangPrefix:id})})),
  doors:v.exactOptional(v.strictObject({open:id,close:id})),
  diagnostic:v.exactOptional(v.strictObject({name:id,system:id,state:id})),
}),v.check(row=>row.environment===undefined||row.entryEnvironment===undefined,'Exclusive gameplay audio environment'));
/** Declared gameplay owner bindings for the existing observation and entered phases. */

const rawAudioSchema: v.GenericSchema<RawAudioRowsInput, RawAudioRows> = v.pipe(v.strictObject({ cues: v.pipe(v.array(v.strictObject({ id, voice: id })), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique cue ids')),
  sampledScene:v.exactOptional(SampledAudioSceneSchema),patches:v.exactOptional(VoicePatchesSchema),scene:v.exactOptional(AudioSceneSchema),sceneFile:v.exactOptional(id),entry:v.exactOptional(v.pipe(v.record(id,v.strictObject({wind:v.boolean(),score:v.boolean(),scene:v.exactOptional(v.boolean())})),v.check(rows=>Object.keys(rows).length<=4))), gameplay:v.exactOptional(gameplay), bank:v.exactOptional(AudioBankSchema), emitters:v.exactOptional(v.pipe(v.record(id,AudioLoopEmitterSchema),v.check(rows=>Object.keys(rows).length<=32))), playback:v.exactOptional(AudioPlaybackSchema), surfaces:v.exactOptional(AudioSurfaceSchema), loopGraphs:v.exactOptional(v.pipe(v.record(id,AudioLoopGraphSchema),v.check(rows=>Object.keys(rows).length<=32))), observations:v.exactOptional(v.pipe(v.array(AudioObservationSystemSchema),v.maxLength(16),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length))), pcm:v.exactOptional(v.pipe(v.record(id,AudioPcmProgramSchema),v.check(rows=>Object.keys(rows).length<=64))), synth:v.exactOptional(v.pipe(v.record(id,AudioPhraseProgramSchema),v.check(rows=>Object.keys(rows).length<=32))), recordings: v.optional(recordings), music: v.optional(AudioMusicSchema), samples: v.optional(AudioSamplesSchema), zones: v.optional(AudioZonesSchema),
  voiceBindings:v.exactOptional(AudioVoiceBindingsSchema), routing: v.optional(AudioRoutingSchema, []), ambience: v.nullable(v.strictObject({ phrases:v.exactOptional(v.pipe(v.array(AudioPhraseScheduleSchema),v.maxLength(8))), gust: v.exactOptional(gust), bed: id, winds: v.pipe(v.array(wind), v.minLength(1), v.maxLength(4)) })), score: v.picklist(['silent', 'default']) }),v.check(audio=>Object.values(audio.emitters??{}).every(row=>audio.loopGraphs?.[row.graph]!==undefined),'declared loop emitter graph'),v.check(audio=>Object.values(audio.bank?.families??{}).every(row=>row.source.kind!=='pcm'||audio.pcm?.[row.source.id]!==undefined)&&Object.values(audio.bank?.spatial??{}).every(row=>audio.synth?.[row.phrase]!==undefined),'declared voice bank programs'),v.check(audio=>audio.bank===undefined||(audio.playback!==undefined&&(audio.bank.barks===undefined||audio.bank.catalogue!==undefined)),'declared bank playback/catalogue'),v.check(audio=>audio.scene===undefined||audio.sceneFile===undefined,'Exclusive audio scene source'));
/** Validated audio data; voice ids are resolved only through the platform's admitted catalogue. */
export interface AudioData {
  sampledScene?:SampledAudioScene;
  cues: { id: string; voice: string }[];
  patches?:VoicePatches;
  scene?:AudioScene;
  sceneFile?:string;
  gameplay?:AudioGameplay;
  entry?:Record<string,{wind:boolean;score:boolean;scene?:boolean}>;
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

/** Admitted data contracts, independent of validator implementation metadata. */
export type AudioWindRowsInput = AudioWindRows;
interface AudioWindRowsFields {
    frequency: number;
    q: number;
    pan: number;
    rate: number;
    cutoff?: number;
    gain: number;
}
export type AudioWindRows = { [Key in keyof AudioWindRowsFields]: AudioWindRowsFields[Key] };
export type AudioGustRangeInput = AudioGustRange;
export type AudioGustRange = [
    number,
    number
];
interface AudioGustRowsInputFields {
    scope: string;
    scopeFirst: boolean;
    startTap: string;
    tap: string;
    wait: AudioGustRangeInput;
    rise: AudioGustRangeInput;
    fall: AudioGustRangeInput;
    amount: AudioGustRangeInput;
    gentle: number;
}
export type AudioGustRowsInput = { [Key in keyof AudioGustRowsInputFields]: AudioGustRowsInputFields[Key] };
interface AudioGustRowsFields {
    scope: string;
    scopeFirst: boolean;
    startTap: string;
    tap: string;
    wait: AudioGustRange;
    rise: AudioGustRange;
    fall: AudioGustRange;
    amount: AudioGustRange;
    gentle: number;
}
export type AudioGustRows = { [Key in keyof AudioGustRowsFields]: AudioGustRowsFields[Key] };
export type AudioEntryEnvironmentRowsInput = AudioEntryEnvironmentRows;
interface AudioEntryEnvironmentRowsFields {
    floors: Record<string, ((string) | null)[]>;
    bounds: Record<string, ({
        x: number;
        z: number;
        r: number;
        yMin: number;
        yMax: number;
    }) | null>;
    near: Record<string, {
        phone: ({
            x: number;
            z: number;
        })[];
        desktop: ({
            x: number;
            z: number;
        })[];
    }>;
    dusk: string;
    emitter: {
        id: string;
        profile: string;
        point: string;
        height: number;
    };
    publish: {
        id: string;
        hum: string;
        bank: string;
        surfaces: string;
        ambience: string;
    };
}
export type AudioEntryEnvironmentRows = { [Key in keyof AudioEntryEnvironmentRowsFields]: AudioEntryEnvironmentRowsFields[Key] };
interface AudioGameplayInputFields {
    constants?: Record<string, unknown>;
    entered: boolean;
    score: boolean;
    activate: boolean;
    restoreShade: boolean;
    inputs: Record<string, {
        owner: string;
        path: (string)[];
    }>;
    writers: Record<string, ({
        kind: 'night';
    }) | ({
        kind: 'dusk';
    })>;
    entities: Record<string, {
        owner: string;
        path: (string)[];
    }>;
    commands: Record<string, ({
        kind: 'scene';
        system: string;
        state: string;
        on: string;
        off: string;
    }) | ({
        kind: 'combat';
        gain: number;
    }) | ({
        kind: 'shot';
        family: string;
    }) | ({
        kind: 'emitter';
        id: string;
    }) | ({
        kind: 'frame';
    }) | ({
        kind: 'log';
        on: string;
        off: string;
        detail?: {
            owner: string;
            path: (string)[];
        };
        precision?: number;
        ok?: boolean;
    })>;
    entryEnvironment?: AudioEntryEnvironmentRowsInput;
    environment?: {
        objects: Record<string, {
            owner: string;
            path: (string)[];
        }>;
        near: Record<string, {
            owner: string;
            path: (string)[];
        }>;
        floors: Record<string, ({
            owner: string;
            path: (string)[];
        })[]>;
        dusk: {
            owner: string;
            path: (string)[];
        };
        emitter: {
            id: string;
            profile: string;
            point: {
                owner: string;
                path: (string)[];
            };
            height: number;
        };
        publish: {
            id: string;
            values: Record<string, {
                owner: string;
                path: (string)[];
            }>;
        };
    };
    cues?: {
        underwater: boolean;
        melee: {
            fire: string;
            hitPrefix: string;
            materials: Record<string, string>;
            fallback: string;
            death: string;
            deathGain: number;
            clangPrefix: string;
        };
    };
    doors?: {
        open: string;
        close: string;
    };
    diagnostic?: {
        name: string;
        system: string;
        state: string;
    };
}
export type AudioGameplayInput = { [Key in keyof AudioGameplayInputFields]: AudioGameplayInputFields[Key] };
interface AudioGameplayFields {
    constants?: Record<string, unknown>;
    entered: boolean;
    score: boolean;
    activate: boolean;
    restoreShade: boolean;
    inputs: Record<string, {
        owner: string;
        path: (string)[];
    }>;
    writers: Record<string, ({
        kind: 'night';
    }) | ({
        kind: 'dusk';
    })>;
    entities: Record<string, {
        owner: string;
        path: (string)[];
    }>;
    commands: Record<string, ({
        kind: 'scene';
        system: string;
        state: string;
        on: string;
        off: string;
    }) | ({
        kind: 'combat';
        gain: number;
    }) | ({
        kind: 'shot';
        family: string;
    }) | ({
        kind: 'emitter';
        id: string;
    }) | ({
        kind: 'frame';
    }) | ({
        kind: 'log';
        on: string;
        off: string;
        detail?: {
            owner: string;
            path: (string)[];
        };
        precision?: number;
        ok?: boolean;
    })>;
    entryEnvironment?: AudioEntryEnvironmentRows;
    environment?: {
        objects: Record<string, {
            owner: string;
            path: (string)[];
        }>;
        near: Record<string, {
            owner: string;
            path: (string)[];
        }>;
        floors: Record<string, ({
            owner: string;
            path: (string)[];
        })[]>;
        dusk: {
            owner: string;
            path: (string)[];
        };
        emitter: {
            id: string;
            profile: string;
            point: {
                owner: string;
                path: (string)[];
            };
            height: number;
        };
        publish: {
            id: string;
            values: Record<string, {
                owner: string;
                path: (string)[];
            }>;
        };
    };
    cues?: {
        underwater: boolean;
        melee: {
            fire: string;
            hitPrefix: string;
            materials: Record<string, string>;
            fallback: string;
            death: string;
            deathGain: number;
            clangPrefix: string;
        };
    };
    doors?: {
        open: string;
        close: string;
    };
    diagnostic?: {
        name: string;
        system: string;
        state: string;
    };
}
export type AudioGameplay = { [Key in keyof AudioGameplayFields]: AudioGameplayFields[Key] };
interface RawAudioRowsInputFields {
    cues: ({
        id: string;
        voice: string;
    })[];
    sampledScene?: v.InferInput<typeof SampledAudioSceneSchema>;
    patches?: v.InferInput<typeof VoicePatchesSchema>;
    scene?: v.InferInput<typeof AudioSceneSchema>;
    sceneFile?: string;
    entry?: Record<string, {
        wind: boolean;
        score: boolean;
        scene?: boolean;
    }>;
    gameplay?: AudioGameplayInput;
    bank?: v.InferInput<typeof AudioBankSchema>;
    emitters?: Record<string, v.InferInput<typeof AudioLoopEmitterSchema>>;
    playback?: v.InferInput<typeof AudioPlaybackSchema>;
    surfaces?: v.InferInput<typeof AudioSurfaceSchema>;
    loopGraphs?: Record<string, v.InferInput<typeof AudioLoopGraphSchema>>;
    observations?: (v.InferInput<typeof AudioObservationSystemSchema>)[];
    pcm?: Record<string, v.InferInput<typeof AudioPcmProgramSchema>>;
    synth?: Record<string, v.InferInput<typeof AudioPhraseProgramSchema>>;
    recordings?: Record<string, string> | undefined;
    music?: v.InferInput<typeof AudioMusicSchema> | undefined;
    samples?: v.InferInput<typeof AudioSamplesSchema> | undefined;
    zones?: v.InferInput<typeof AudioZonesSchema> | undefined;
    voiceBindings?: v.InferInput<typeof AudioVoiceBindingsSchema>;
    routing?: v.InferInput<typeof AudioRoutingSchema> | undefined;
    ambience: ({
        phrases?: (v.InferInput<typeof AudioPhraseScheduleSchema>)[];
        gust?: AudioGustRowsInput;
        bed: string;
        winds: (AudioWindRowsInput)[];
    }) | null;
    score: 'silent' | 'default';
}
export type RawAudioRowsInput = { [Key in keyof RawAudioRowsInputFields]: RawAudioRowsInputFields[Key] };
interface RawAudioRowsFields {
    cues: ({
        id: string;
        voice: string;
    })[];
    sampledScene?: v.InferOutput<typeof SampledAudioSceneSchema>;
    patches?: v.InferOutput<typeof VoicePatchesSchema>;
    scene?: v.InferOutput<typeof AudioSceneSchema>;
    sceneFile?: string;
    entry?: Record<string, {
        wind: boolean;
        score: boolean;
        scene?: boolean;
    }>;
    gameplay?: AudioGameplay;
    bank?: v.InferOutput<typeof AudioBankSchema>;
    emitters?: Record<string, v.InferOutput<typeof AudioLoopEmitterSchema>>;
    playback?: v.InferOutput<typeof AudioPlaybackSchema>;
    surfaces?: v.InferOutput<typeof AudioSurfaceSchema>;
    loopGraphs?: Record<string, v.InferOutput<typeof AudioLoopGraphSchema>>;
    observations?: (v.InferOutput<typeof AudioObservationSystemSchema>)[];
    pcm?: Record<string, v.InferOutput<typeof AudioPcmProgramSchema>>;
    synth?: Record<string, v.InferOutput<typeof AudioPhraseProgramSchema>>;
    recordings?: Record<string, string> | undefined;
    music?: v.InferOutput<typeof AudioMusicSchema> | undefined;
    samples?: v.InferOutput<typeof AudioSamplesSchema> | undefined;
    zones?: v.InferOutput<typeof AudioZonesSchema> | undefined;
    voiceBindings?: v.InferOutput<typeof AudioVoiceBindingsSchema>;
    routing: v.InferOutput<typeof AudioRoutingSchema>;
    ambience: ({
        phrases?: (v.InferOutput<typeof AudioPhraseScheduleSchema>)[];
        gust?: AudioGustRows;
        bed: string;
        winds: (AudioWindRows)[];
    }) | null;
    score: 'silent' | 'default';
}
export type RawAudioRows = { [Key in keyof RawAudioRowsFields]: RawAudioRowsFields[Key] };
