import { NativeReturnRowsSchema } from './populationRespawn';
import * as v from 'valibot';
import { PopulationEnvironmentSchema } from './populationEnvironment';
import { BodySlotsSchema } from './bodySlots';

const finite = v.pipe(v.number(), v.finite());
const stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
export const PopulationKeeperRowsSchema: v.GenericSchema<PopulationKeeperRowsInput, PopulationKeeperRows> = v.strictObject({ environment: PopulationEnvironmentSchema, seed: finite,
  bodyPhase: v.strictObject({ animateWithin: v.pipe(finite, v.minValue(0)), clearWithin: v.pipe(finite, v.minValue(0)) }),
  volley: BodySlotsSchema,
  ecology: NativeReturnRowsSchema,
  fauna: v.strictObject({ seed: finite, centres: v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(32)),
    rows: v.pipe(v.array(v.strictObject({ id: v.string(), herd: finite, seed: finite, x: finite, z: finite, yaw: finite, stream })), v.maxLength(64)), stream }),
  variants: v.pipe(v.array(v.strictObject({ kind: v.string(), rows: v.pipe(v.array(v.strictObject({ id: v.string(), scale: v.tuple([finite, finite]) })), v.maxLength(32)) })), v.maxLength(32)),
  herds: v.pipe(v.array(v.strictObject({ kind: v.string(), x: finite, z: finite })), v.maxLength(32)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, x: finite, z: finite,
    yaw: finite, seed: finite, scale: finite, fauna: v.boolean(), practice: v.boolean(), stream: v.nullable(stream) })), v.maxLength(256)) });

/** Admitted data contracts, independent of validator implementation metadata. */
interface PopulationKeeperRowsInputFields {
    environment: v.InferInput<typeof PopulationEnvironmentSchema>;
    seed: number;
    bodyPhase: {
        animateWithin: number;
        clearWithin: number;
    };
    volley: v.InferInput<typeof BodySlotsSchema>;
    ecology: v.InferInput<typeof NativeReturnRowsSchema>;
    fauna: {
        seed: number;
        centres: ([
            number,
            number
        ])[];
        rows: ({
            id: string;
            herd: number;
            seed: number;
            x: number;
            z: number;
            yaw: number;
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
        })[];
        stream: {
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        };
    };
    variants: ({
        kind: string;
        rows: ({
            id: string;
            scale: [
                number,
                number
            ];
        })[];
    })[];
    herds: ({
        kind: string;
        x: number;
        z: number;
    })[];
    bodies: ({
        id: string;
        kind: string;
        variant: string;
        herd: number;
        x: number;
        z: number;
        yaw: number;
        seed: number;
        scale: number;
        fauna: boolean;
        practice: boolean;
        stream: ({
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        }) | null;
    })[];
}
export type PopulationKeeperRowsInput = { [Key in keyof PopulationKeeperRowsInputFields]: PopulationKeeperRowsInputFields[Key] };
interface PopulationKeeperRowsFields {
    environment: v.InferOutput<typeof PopulationEnvironmentSchema>;
    seed: number;
    bodyPhase: {
        animateWithin: number;
        clearWithin: number;
    };
    volley: v.InferOutput<typeof BodySlotsSchema>;
    ecology: v.InferOutput<typeof NativeReturnRowsSchema>;
    fauna: {
        seed: number;
        centres: ([
            number,
            number
        ])[];
        rows: ({
            id: string;
            herd: number;
            seed: number;
            x: number;
            z: number;
            yaw: number;
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
        })[];
        stream: {
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        };
    };
    variants: ({
        kind: string;
        rows: ({
            id: string;
            scale: [
                number,
                number
            ];
        })[];
    })[];
    herds: ({
        kind: string;
        x: number;
        z: number;
    })[];
    bodies: ({
        id: string;
        kind: string;
        variant: string;
        herd: number;
        x: number;
        z: number;
        yaw: number;
        seed: number;
        scale: number;
        fauna: boolean;
        practice: boolean;
        stream: ({
            version: 1;
            state: number;
            initial: number;
            scrambledFork: boolean;
        }) | null;
    })[];
}
export type PopulationKeeperRows = { [Key in keyof PopulationKeeperRowsFields]: PopulationKeeperRowsFields[Key] };
