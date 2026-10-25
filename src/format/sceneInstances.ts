import * as v from 'valibot';
import { ClientChannelProgramSchema, ClientChannelPropertySchema } from './clientChannels';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(256));
const finite=v.pipe(v.number(),v.finite());
const slot=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(31));
const list=<T extends v.BaseSchema<unknown,unknown,v.BaseIssue<unknown>>>(schema:T,max:number)=>v.pipe(v.array(schema),v.maxLength(max));
const uint=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(0xffffffff));
const input=v.variant('kind',[
  v.strictObject({kind:v.literal('state'),slot}),v.strictObject({kind:v.literal('constant'),value:finite}),
  v.strictObject({kind:v.literal('frame'),property:ClientChannelPropertySchema}),v.strictObject({kind:v.literal('random')}),v.strictObject({kind:v.literal('blocked')}),
]);
/** Z2 client-only instanced pose projection. No actor, player, physics or authoritative state is writable. */
const sceneInstances: v.GenericSchema<SceneInstancesRowsInput, SceneInstancesRows>=list(v.strictObject({
  id,name:v.exactOptional(id),group:id,geometry:id,material:id,step:v.pipe(finite,v.minValue(0)),initialCredit:finite,clock:v.picklist(['elapsed','world']),
  random:v.exactOptional(v.strictObject({id,state:v.strictObject({version:v.literal(1),state:uint,initial:uint,scrambledFork:v.boolean()})})),
  states:list(list(finite,32),8192),pose:v.strictObject({x:slot,z:slot,y:v.exactOptional(slot),yaw:v.exactOptional(slot),pitch:v.exactOptional(slot),roll:v.exactOptional(slot),scale:v.exactOptional(slot),colour:v.exactOptional(slot)}),
  programs:list(v.strictObject({row:ClientChannelProgramSchema,inputs:list(input,128),outputs:list(v.strictObject({property:ClientChannelPropertySchema,slot}),32)}),8),
  blocked:list(v.strictObject({x:finite,z:finite,r:v.pipe(finite,v.minValue(0))}),128),
  ground:finite,near:v.pipe(finite,v.minValue(0)),far:v.nullable(v.pipe(finite,v.minValue(0))),
  bounds:v.tuple([finite,finite,finite,v.pipe(finite,v.minValue(0))]),groundBounds:v.boolean(),castShadow:v.boolean(),receiveShadow:v.boolean(),
  palette:list(v.tuple([finite,finite,finite]),256),attributes:list(v.strictObject({name:id,width:v.picklist([1,2,3,4]),values:list(finite,32768)}),32),
  uniform:v.exactOptional(v.strictObject({look:id,param:id})),
}),32);

export const SceneInstancesSchema:v.GenericSchema<unknown,SceneInstancesRows>=sceneInstances;

/** Admitted data contracts, independent of validator implementation metadata. */
export type SceneInstancesRowsInput = ({
    id: string;
    name?: string;
    group: string;
    geometry: string;
    material: string;
    step: number;
    initialCredit: number;
    clock: 'elapsed' | 'world';
    random?: {
        id: string;
        state: {
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        };
    };
    states: ((number)[])[];
    pose: {
        x: number;
        z: number;
        y?: number;
        yaw?: number;
        pitch?: number;
        roll?: number;
        scale?: number;
        colour?: number;
    };
    programs: ({
        row: v.InferInput<typeof ClientChannelProgramSchema>;
        inputs: (({
            kind: 'state';
            slot: number;
        }) | ({
            kind: 'constant';
            value: number;
        }) | ({
            kind: 'frame';
            property: v.InferInput<typeof ClientChannelPropertySchema>;
        }) | ({
            kind: 'random';
        }) | ({
            kind: 'blocked';
        }))[];
        outputs: ({
            property: v.InferInput<typeof ClientChannelPropertySchema>;
            slot: number;
        })[];
    })[];
    blocked: ({
        x: number;
        z: number;
        r: number;
    })[];
    ground: number;
    near: number;
    far: (number) | null;
    bounds: [
        number,
        number,
        number,
        number
    ];
    groundBounds: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    palette: ([
        number,
        number,
        number
    ])[];
    attributes: ({
        name: string;
        width: 1 | 2 | 3 | 4;
        values: (number)[];
    })[];
    uniform?: {
        look: string;
        param: string;
    };
})[];
export type SceneInstancesRows = ({
    id: string;
    name?: string;
    group: string;
    geometry: string;
    material: string;
    step: number;
    initialCredit: number;
    clock: 'elapsed' | 'world';
    random?: {
        id: string;
        state: {
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        };
    };
    states: ((number)[])[];
    pose: {
        x: number;
        z: number;
        y?: number;
        yaw?: number;
        pitch?: number;
        roll?: number;
        scale?: number;
        colour?: number;
    };
    programs: ({
        row: v.InferOutput<typeof ClientChannelProgramSchema>;
        inputs: (({
            kind: 'state';
            slot: number;
        }) | ({
            kind: 'constant';
            value: number;
        }) | ({
            kind: 'frame';
            property: v.InferOutput<typeof ClientChannelPropertySchema>;
        }) | ({
            kind: 'random';
        }) | ({
            kind: 'blocked';
        }))[];
        outputs: ({
            property: v.InferOutput<typeof ClientChannelPropertySchema>;
            slot: number;
        })[];
    })[];
    blocked: ({
        x: number;
        z: number;
        r: number;
    })[];
    ground: number;
    near: number;
    far: (number) | null;
    bounds: [
        number,
        number,
        number,
        number
    ];
    groundBounds: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    palette: ([
        number,
        number,
        number
    ])[];
    attributes: ({
        name: string;
        width: 1 | 2 | 3 | 4;
        values: (number)[];
    })[];
    uniform?: {
        look: string;
        param: string;
    };
})[];
