import * as v from 'valibot';
import { createV2QuerySnapshotSchema } from './scriptQueryStateV2';
import { ScriptArtifactV2Schema } from './scriptAdmissionV2';
import { ObservationColumnsV2Schema } from './scriptObservationColumnsV2';
import { ScriptInputStateV2Schema } from './scriptInputStateV2';

const natural = v.pipe(v.number(),v.safeInteger(),v.minValue(0));
const identity = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite = v.pipe(v.number(),v.finite());
/** Explicit operation rights; concrete entered owners are lent separately. */
const worldActions = v.strictObject({
  targets: v.pipe(v.array(v.strictObject({ handle: v.pipe(natural,v.minValue(1),v.maxValue(256)),identity,
    kind: v.picklist(['player','mount','cell-field']) })),v.minLength(1),v.maxLength(256)),
  operations: v.pipe(v.array(v.picklist([14,23,24])),v.minLength(1),v.maxLength(3)),
  maxCommands: v.pipe(natural,v.minValue(1),v.maxValue(32)),
  bounds: v.strictObject({ coordinate: v.pipe(finite,v.minValue(Number.MIN_VALUE)),velocity: v.pipe(finite,v.minValue(0)) }),
});
/** Explicit production actor-module selection. No Developer gate or byte
 * sniffing selects an ABI. Empty bytes are resolved by the product reader. */
export const SpawnScriptV2Schema: v.GenericSchema<SpawnScriptV2RowsInput, SpawnScriptV2Rows> = v.strictObject({ version: v.literal(1),
  artifact: v.strictObject({ ...ScriptArtifactV2Schema.entries,lane: v.literal('sim'),
    hash: v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/)) }),
  bytes: v.string(),io: v.pipe(natural,v.maxValue(4*65536)),
  capacities: v.pipe(v.array(v.strictObject({ kind: v.pipe(natural,v.minValue(1),v.maxValue(22)),capacity: v.pipe(natural,v.maxValue(4096)) })),v.maxLength(22)),
  divisor: v.union([v.literal(2),v.literal(6)]),
  fuel: v.pipe(natural,v.minValue(1),v.maxValue(0x7fffffff)),initFuel: v.pipe(natural,v.maxValue(0x7fffffff)),
  queries: v.exactOptional(v.strictObject({ pending: v.pipe(natural,v.minValue(1),v.maxValue(32)),
    operations: v.pipe(v.array(v.strictObject({ op: v.picklist([4,5,8,9,10,11,12,13]),scalars: v.pipe(natural,v.maxValue(4096)) })),v.minLength(1),v.maxLength(8)) })),
  effects: v.exactOptional(v.strictObject({ world: v.exactOptional(worldActions),elites: v.exactOptional(v.literal(true)) })),
  self: v.exactOptional(v.pipe(v.string(),v.minLength(1),v.maxLength(128))),columns: ObservationColumnsV2Schema,
});

/** Only logical input/quarantine state joins the SAME SpawnScript envelope.
 * No module bytes, Wasm memory, cached observations or native body is saved. */
export const SpawnInputV2Schema: v.GenericSchema<SpawnInputV2Input, SpawnInputV2> = v.strictObject({ version: v.literal(1),contract: v.string(),input: ScriptInputStateV2Schema,
  failures: v.pipe(natural,v.maxValue(3)),queries: v.exactOptional(createV2QuerySnapshotSchema({ bindings: 64,requests: 4096,scalars: 4096 })) });


/** Admitted data contracts, independent of validator implementation metadata. */
interface SpawnScriptV2RowsInputFields {
    version: 1;
    artifact: Omit<v.InferInput<typeof ScriptArtifactV2Schema>, keyof ({
        lane: 'sim';
        hash: string;
    })> & {
        lane: 'sim';
        hash: string;
    };
    bytes: string;
    io: number;
    capacities: ({
        kind: number;
        capacity: number;
    })[];
    divisor: (2) | (6);
    fuel: number;
    initFuel: number;
    queries?: {
        pending: number;
        operations: ({
            op: 4 | 5 | 8 | 9 | 10 | 11 | 12 | 13;
            scalars: number;
        })[];
    };
    effects?: {
        world?: {
            targets: ({
                handle: number;
                identity: string;
                kind: 'player' | 'mount' | 'cell-field';
            })[];
            operations: (14 | 23 | 24)[];
            maxCommands: number;
            bounds: {
                coordinate: number;
                velocity: number;
            };
        };
        elites?: true;
    };
    self?: string;
    columns: v.InferInput<typeof ObservationColumnsV2Schema>;
}
export type SpawnScriptV2RowsInput = { [Key in keyof SpawnScriptV2RowsInputFields]: SpawnScriptV2RowsInputFields[Key] };
interface SpawnScriptV2RowsFields {
    version: 1;
    artifact: Omit<v.InferOutput<typeof ScriptArtifactV2Schema>, keyof ({
        lane: 'sim';
        hash: string;
    })> & {
        lane: 'sim';
        hash: string;
    };
    bytes: string;
    io: number;
    capacities: ({
        kind: number;
        capacity: number;
    })[];
    divisor: (2) | (6);
    fuel: number;
    initFuel: number;
    queries?: {
        pending: number;
        operations: ({
            op: 4 | 5 | 8 | 9 | 10 | 11 | 12 | 13;
            scalars: number;
        })[];
    };
    effects?: {
        world?: {
            targets: ({
                handle: number;
                identity: string;
                kind: 'player' | 'mount' | 'cell-field';
            })[];
            operations: (14 | 23 | 24)[];
            maxCommands: number;
            bounds: {
                coordinate: number;
                velocity: number;
            };
        };
        elites?: true;
    };
    self?: string;
    columns: v.InferOutput<typeof ObservationColumnsV2Schema>;
}
export type SpawnScriptV2Rows = { [Key in keyof SpawnScriptV2RowsFields]: SpawnScriptV2RowsFields[Key] };
interface SpawnInputV2InputFields {
    version: 1;
    contract: string;
    input: v.InferInput<typeof ScriptInputStateV2Schema>;
    failures: number;
    queries?: v.InferInput<ReturnType<typeof createV2QuerySnapshotSchema>>;
}
export type SpawnInputV2Input = { [Key in keyof SpawnInputV2InputFields]: SpawnInputV2InputFields[Key] };
interface SpawnInputV2Fields {
    version: 1;
    contract: string;
    input: v.InferOutput<typeof ScriptInputStateV2Schema>;
    failures: number;
    queries?: v.InferOutput<ReturnType<typeof createV2QuerySnapshotSchema>>;
}
export type SpawnInputV2 = { [Key in keyof SpawnInputV2Fields]: SpawnInputV2Fields[Key] };
