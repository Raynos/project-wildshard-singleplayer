import * as v from 'valibot';
import { AudioMixExpressionSchema as expr } from './audioProfiles';
import { ScalarChannelSchema } from './scalarChannel';

const n=v.pipe(v.number(),v.finite()),id=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const point=v.tuple([n,n]);
const values=v.pipe(v.array(v.tuple([id,expr])),v.maxLength(64));
/** Client-only audio scene observations, geometry, cue subscriptions and score rows. */
export const AudioSceneSchema: v.GenericSchema<AudioSceneInput, AudioScene>=v.strictObject({
 fields:v.pipe(v.strictObject({res:v.pipe(n,v.integer(),v.minValue(2),v.maxValue(2048)),size:v.pipe(n,v.minValue(.001),v.maxValue(100000)),channels:v.pipe(v.record(id,v.union([v.pipe(v.array(v.pipe(v.string(),v.minLength(1),v.maxLength(4096))),v.minLength(1),v.maxLength(977),v.check(chunks=>chunks.reduce((sum,chunk)=>sum+chunk.length,0)<=4000000)),ScalarChannelSchema])),v.check(channels=>Object.keys(channels).length<=16))}),v.check(row=>Object.values(row.channels).every(channel=>Array.isArray(channel)||(channel.type==='f32'&&channel.count===row.res*row.res)),'Audio field requires one f32 per sample')),
 profiles:v.record(id,v.strictObject({x0:n,step:n,values:v.pipe(v.array(point),v.minLength(2),v.maxLength(4096))})),
 paths:v.record(id,v.pipe(v.array(point),v.maxLength(2048))),
 probes:v.record(id,v.variant('kind',[
  v.strictObject({kind:v.literal('point'),x:n,z:n,inner:n,outer:n,gain:n}),
  v.strictObject({kind:v.literal('path'),path:id,inner:n,outer:n,gain:n}),
  v.strictObject({kind:v.literal('profile'),profile:id,inner:n,outer:n,gain:n})
 ])),
 surfaces:v.strictObject({fallback:v.picklist(['grass','gravel','wood']),rules:v.pipe(v.array(v.variant('kind',[
  v.strictObject({kind:v.literal('rect'),x:n,z:n,width:n,depth:n,surface:v.picklist(['grass','gravel','wood'])}),
  v.strictObject({kind:v.literal('field'),id,above:n,surface:v.picklist(['grass','gravel','wood'])}),
  v.strictObject({kind:v.literal('path'),ids:v.array(id),below:n,surface:v.picklist(['grass','gravel','wood'])})
 ])),v.maxLength(32))}),
 hoofKinds:v.pipe(v.array(id),v.maxLength(64)),initial:v.record(id,n),values,voiceGroup:id,voice:values,mix:values,
 score:v.pipe(v.array(v.strictObject({key:id,when:expr,on:v.union([v.string(),v.boolean(),v.null()]),off:v.union([v.string(),v.boolean(),v.null()])})),v.maxLength(16)),
 events:v.record(id,id),charges:v.pipe(v.array(v.strictObject({weapon:id,phase:id,cue:id,full:v.exactOptional(id),cancelDeferred:v.boolean()})),v.maxLength(32)),
 deferred:v.strictObject({owner:id,cue:id}),
 chorus:v.strictObject({initial:n,wait:v.tuple([n,n]),idle:n,when:expr,active:expr,call:id,distance:v.tuple([n,n]),up:n})
});


/** Sample-only scene policy on the same native director: cue recipes, floor
 * material aliases and positional loops at the poses of an admitted scene placement file, one per world variant
 * (standalone or a grid cell). */
export const SampledAudioSceneSchema: v.GenericSchema<SampledAudioSceneInput, SampledAudioScene>=v.strictObject({
 system:id,tick:id,debug:id,points:v.strictObject({standalone:id,cell:id}),loopTap:id,countLabel:id,eye:n,
 surfaces:v.record(id,v.picklist(['rock','planks','metal','grass','gravel','sand','wetSand','stone','water','litter','mud','wet'])),fallback:v.picklist(['rock','planks','metal','grass','gravel','sand','wetSand','stone','water','litter','mud','wet']),
 step:v.strictObject({id,voices:v.record(id,id),fallback:id,count:v.pipe(n,v.integer(),v.minValue(1),v.maxValue(16)),walkGain:n,runGain:n}),
 voices:v.pipe(v.record(id,v.strictObject({family:id,tap:id,handled:v.optional(v.boolean(),true),sequence:v.optional(v.boolean(),false),pan:v.exactOptional(n)})),v.check(rows=>Object.keys(rows).length<=128)),
 score:v.pipe(v.array(v.strictObject({key:id,value:id})),v.maxLength(16))
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface AudioSceneInputFields {
    fields: {
        res: number;
        size: number;
        channels: Record<string, unknown>;
    };
    profiles: Record<string, {
        x0: number;
        step: number;
        values: ([
            number,
            number
        ])[];
    }>;
    paths: Record<string, ([
        number,
        number
    ])[]>;
    probes: Record<string, ({
        kind: 'point';
        x: number;
        z: number;
        inner: number;
        outer: number;
        gain: number;
    }) | ({
        kind: 'path';
        path: string;
        inner: number;
        outer: number;
        gain: number;
    }) | ({
        kind: 'profile';
        profile: string;
        inner: number;
        outer: number;
        gain: number;
    })>;
    surfaces: {
        fallback: 'grass' | 'gravel' | 'wood';
        rules: (({
            kind: 'rect';
            x: number;
            z: number;
            width: number;
            depth: number;
            surface: 'grass' | 'gravel' | 'wood';
        }) | ({
            kind: 'field';
            id: string;
            above: number;
            surface: 'grass' | 'gravel' | 'wood';
        }) | ({
            kind: 'path';
            ids: (string)[];
            below: number;
            surface: 'grass' | 'gravel' | 'wood';
        }))[];
    };
    hoofKinds: (string)[];
    initial: Record<string, number>;
    values: ([
        string,
        v.InferInput<typeof expr>
    ])[];
    voiceGroup: string;
    voice: ([
        string,
        v.InferInput<typeof expr>
    ])[];
    mix: ([
        string,
        v.InferInput<typeof expr>
    ])[];
    score: ({
        key: string;
        when: v.InferInput<typeof expr>;
        on: (string) | (boolean) | (null);
        off: (string) | (boolean) | (null);
    })[];
    events: Record<string, string>;
    charges: ({
        weapon: string;
        phase: string;
        cue: string;
        full?: string;
        cancelDeferred: boolean;
    })[];
    deferred: {
        owner: string;
        cue: string;
    };
    chorus: {
        initial: number;
        wait: [
            number,
            number
        ];
        idle: number;
        when: v.InferInput<typeof expr>;
        active: v.InferInput<typeof expr>;
        call: string;
        distance: [
            number,
            number
        ];
        up: number;
    };
}
export type AudioSceneInput = { [Key in keyof AudioSceneInputFields]: AudioSceneInputFields[Key] };
interface AudioSceneFields {
    fields: {
        res: number;
        size: number;
        channels: Record<string, ((string)[]) | (v.InferOutput<typeof ScalarChannelSchema>)>;
    };
    profiles: Record<string, {
        x0: number;
        step: number;
        values: ([
            number,
            number
        ])[];
    }>;
    paths: Record<string, ([
        number,
        number
    ])[]>;
    probes: Record<string, ({
        kind: 'point';
        x: number;
        z: number;
        inner: number;
        outer: number;
        gain: number;
    }) | ({
        kind: 'path';
        path: string;
        inner: number;
        outer: number;
        gain: number;
    }) | ({
        kind: 'profile';
        profile: string;
        inner: number;
        outer: number;
        gain: number;
    })>;
    surfaces: {
        fallback: 'grass' | 'gravel' | 'wood';
        rules: (({
            kind: 'rect';
            x: number;
            z: number;
            width: number;
            depth: number;
            surface: 'grass' | 'gravel' | 'wood';
        }) | ({
            kind: 'field';
            id: string;
            above: number;
            surface: 'grass' | 'gravel' | 'wood';
        }) | ({
            kind: 'path';
            ids: (string)[];
            below: number;
            surface: 'grass' | 'gravel' | 'wood';
        }))[];
    };
    hoofKinds: (string)[];
    initial: Record<string, number>;
    values: ([
        string,
        v.InferOutput<typeof expr>
    ])[];
    voiceGroup: string;
    voice: ([
        string,
        v.InferOutput<typeof expr>
    ])[];
    mix: ([
        string,
        v.InferOutput<typeof expr>
    ])[];
    score: ({
        key: string;
        when: v.InferOutput<typeof expr>;
        on: (string) | (boolean) | (null);
        off: (string) | (boolean) | (null);
    })[];
    events: Record<string, string>;
    charges: ({
        weapon: string;
        phase: string;
        cue: string;
        full?: string;
        cancelDeferred: boolean;
    })[];
    deferred: {
        owner: string;
        cue: string;
    };
    chorus: {
        initial: number;
        wait: [
            number,
            number
        ];
        idle: number;
        when: v.InferOutput<typeof expr>;
        active: v.InferOutput<typeof expr>;
        call: string;
        distance: [
            number,
            number
        ];
        up: number;
    };
}
export type AudioScene = { [Key in keyof AudioSceneFields]: AudioSceneFields[Key] };
interface SampledAudioSceneInputFields {
    system: string;
    tick: string;
    debug: string;
    points: {
        standalone: string;
        cell: string;
    };
    loopTap: string;
    countLabel: string;
    eye: number;
    surfaces: Record<string, 'rock' | 'planks' | 'metal' | 'grass' | 'gravel' | 'sand' | 'wetSand' | 'stone' | 'water' | 'litter' | 'mud' | 'wet'>;
    fallback: 'rock' | 'planks' | 'metal' | 'grass' | 'gravel' | 'sand' | 'wetSand' | 'stone' | 'water' | 'litter' | 'mud' | 'wet';
    step: {
        id: string;
        voices: Record<string, string>;
        fallback: string;
        count: number;
        walkGain: number;
        runGain: number;
    };
    voices: Record<string, {
        family: string;
        tap: string;
        handled?: boolean | undefined;
        sequence?: boolean | undefined;
        pan?: number;
    }>;
    score: ({
        key: string;
        value: string;
    })[];
}
export type SampledAudioSceneInput = { [Key in keyof SampledAudioSceneInputFields]: SampledAudioSceneInputFields[Key] };
interface SampledAudioSceneFields {
    system: string;
    tick: string;
    debug: string;
    points: {
        standalone: string;
        cell: string;
    };
    loopTap: string;
    countLabel: string;
    eye: number;
    surfaces: Record<string, 'rock' | 'planks' | 'metal' | 'grass' | 'gravel' | 'sand' | 'wetSand' | 'stone' | 'water' | 'litter' | 'mud' | 'wet'>;
    fallback: 'rock' | 'planks' | 'metal' | 'grass' | 'gravel' | 'sand' | 'wetSand' | 'stone' | 'water' | 'litter' | 'mud' | 'wet';
    step: {
        id: string;
        voices: Record<string, string>;
        fallback: string;
        count: number;
        walkGain: number;
        runGain: number;
    };
    voices: Record<string, {
        family: string;
        tap: string;
        handled: boolean;
        sequence: boolean;
        pan?: number;
    }>;
    score: ({
        key: string;
        value: string;
    })[];
}
export type SampledAudioScene = { [Key in keyof SampledAudioSceneFields]: SampledAudioSceneFields[Key] };
