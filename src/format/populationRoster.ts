import * as v from 'valibot';
import { LimbPopulationSchema } from './limbPopulation';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1024));
const point = v.strictObject({ x: finite, z: finite });
const identity = v.strictObject({ kind: key, variant: key });
/** Ordered native population boot program: herds, reserved-identity replacements, dormant recipes, then scripted homes.
 * All rows are data. Fight decisions and pose implementation remain owned by their existing services. */
export const NativePopulationRowsSchema: v.GenericSchema<NativePopulationRowsInput, NativePopulationRows> = v.strictObject({
  version: v.literal(1), environment: key, step: key, seed: finite, bodyCount: count, limit: v.pipe(count, v.minValue(1)),
  limbPose: v.exactOptional(LimbPopulationSchema),
  scripted: key, encounter: key, poseKinds: v.array(key), spawn: point,
  fauna: v.array(v.strictObject({ kind: key, count,
    variants: v.exactOptional(v.array(key)),
    anchor: v.exactOptional(v.strictObject({ x: finite, z: finite, rMin: finite, rMax: finite })),
    canopy: v.boolean(), trailBand: v.tuple([finite, finite]),
  })),
  identities: v.array(identity), ordinary: v.record(key, v.array(key)),
  reserves: v.array(v.strictObject({ kind: key, variant: v.nullable(key) })),
  homes: v.array(v.strictObject({ ...identity.entries, x: finite, z: finite, stream: key })),
});

/** Admit once, before any native actor or RNG draw is installed. */
export function parseNativePopulationRows(input: unknown): NativePopulationRows {
  const rows = v.parse(NativePopulationRowsSchema, input);
  if (rows.bodyCount > rows.limit || rows.fauna.length > rows.limit || rows.homes.length > rows.limit || rows.reserves.length > rows.limit)
    throw new Error('Invalid native population row bounds');
  return rows;
}

/** Admitted data contracts, independent of validator implementation metadata. */
interface NativePopulationRowsInputFields {
    version: 1;
    environment: string;
    step: string;
    seed: number;
    bodyCount: number;
    limit: number;
    limbPose?: v.InferInput<typeof LimbPopulationSchema>;
    scripted: string;
    encounter: string;
    poseKinds: (string)[];
    spawn: {
        x: number;
        z: number;
    };
    fauna: ({
        kind: string;
        count: number;
        variants?: (string)[];
        anchor?: {
            x: number;
            z: number;
            rMin: number;
            rMax: number;
        };
        canopy: boolean;
        trailBand: [
            number,
            number
        ];
    })[];
    identities: ({
        kind: string;
        variant: string;
    })[];
    ordinary: Record<string, (string)[]>;
    reserves: ({
        kind: string;
        variant: (string) | null;
    })[];
    homes: (Omit<{
        kind: string;
        variant: string;
    }, keyof ({
        x: number;
        z: number;
        stream: string;
    })> & {
        x: number;
        z: number;
        stream: string;
    })[];
}
export type NativePopulationRowsInput = { [Key in keyof NativePopulationRowsInputFields]: NativePopulationRowsInputFields[Key] };
interface NativePopulationRowsFields {
    version: 1;
    environment: string;
    step: string;
    seed: number;
    bodyCount: number;
    limit: number;
    limbPose?: v.InferOutput<typeof LimbPopulationSchema>;
    scripted: string;
    encounter: string;
    poseKinds: (string)[];
    spawn: {
        x: number;
        z: number;
    };
    fauna: ({
        kind: string;
        count: number;
        variants?: (string)[];
        anchor?: {
            x: number;
            z: number;
            rMin: number;
            rMax: number;
        };
        canopy: boolean;
        trailBand: [
            number,
            number
        ];
    })[];
    identities: ({
        kind: string;
        variant: string;
    })[];
    ordinary: Record<string, (string)[]>;
    reserves: ({
        kind: string;
        variant: (string) | null;
    })[];
    homes: (Omit<{
        kind: string;
        variant: string;
    }, keyof ({
        x: number;
        z: number;
        stream: string;
    })> & {
        x: number;
        z: number;
        stream: string;
    })[];
}
export type NativePopulationRows = { [Key in keyof NativePopulationRowsFields]: NativePopulationRowsFields[Key] };
