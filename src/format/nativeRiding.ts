import * as v from 'valibot';
import { ScalarChannelSchema } from './scalarChannel';

const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const channel = v.pipe(v.string(), v.maxLength(1048576));
/** Native riding owns motors and poses; content declares identities, terrain masks
 * and guest rows. The caller supplies no world-query or per-frame callback. */
export const NativeRidingSchema: v.StrictObjectSchema<{ readonly step: v.GenericSchema<NativeRidingRowsInput['step'], NativeRidingRows['step']>; readonly herds: v.GenericSchema<NativeRidingRowsInput['herds'], NativeRidingRows['herds']>; readonly mountable: v.GenericSchema<NativeRidingRowsInput['mountable'], NativeRidingRows['mountable']>; readonly kinds: v.GenericSchema<NativeRidingRowsInput['kinds'], NativeRidingRows['kinds']>; readonly adopted: v.GenericSchema<NativeRidingRowsInput['adopted'], NativeRidingRows['adopted']>; readonly speeds: v.GenericSchema<NativeRidingRowsInput['speeds'], NativeRidingRows['speeds']>; readonly pose: v.GenericSchema<NativeRidingRowsInput['pose'], NativeRidingRows['pose']>; readonly world: v.GenericSchema<NativeRidingRowsInput['world'], NativeRidingRows['world']>; readonly roads: v.ExactOptionalSchema<v.GenericSchema<Exclude<NativeRidingRowsInput['roads'], undefined>, Exclude<NativeRidingRows['roads'], undefined>>, undefined>; readonly thrownDamage: v.GenericSchema<NativeRidingRowsInput['thrownDamage'], NativeRidingRows['thrownDamage']>; readonly thrownLabel: v.GenericSchema<NativeRidingRowsInput['thrownLabel'], NativeRidingRows['thrownLabel']>; readonly program: v.GenericSchema<NativeRidingRowsInput['program'], NativeRidingRows['program']>; }, undefined> = v.strictObject({
  step: id, herds: id, mountable: v.pipe(v.array(id), v.maxLength(64)), kinds: v.pipe(v.array(id), v.minLength(1), v.maxLength(16)),
  adopted: v.strictObject({ kind: id, variant: id }),
  speeds: v.strictObject({ walk: positive, trot: positive, canter: positive, gallop: positive }),
  pose: v.strictObject({ gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })),
    pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) }),
  world: v.strictObject({ res: v.pipe(finite, v.integer(), v.minValue(2), v.maxValue(1024)), size: positive, water: finite, wet: v.union([channel,ScalarChannelSchema]), pond: v.union([channel,ScalarChannelSchema]) }),
  roads: v.exactOptional(v.pipe(v.array(v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(1024))), v.maxLength(128))),
  thrownDamage: v.pipe(finite, v.minValue(0)), thrownLabel: v.string(), program: v.unknown(),
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface NativeRidingRowsInputFields {
    step: string;
    herds: string;
    mountable: (string)[];
    kinds: (string)[];
    adopted: {
        kind: string;
        variant: string;
    };
    speeds: {
        walk: number;
        trot: number;
        canter: number;
        gallop: number;
    };
    pose: {
        gait?: {
            trot: number;
            gallop: number;
        };
        pose?: {
            grazeNeck: number;
            gallopTail: number;
        };
    };
    world: {
        res: number;
        size: number;
        water: number;
        wet: unknown;
        pond: unknown;
    };
    roads?: (([
        number,
        number
    ])[])[];
    thrownDamage: number;
    thrownLabel: string;
    program: unknown;
}
export type NativeRidingRowsInput = { [Key in keyof NativeRidingRowsInputFields]: NativeRidingRowsInputFields[Key] };
interface NativeRidingRowsFields {
    step: string;
    herds: string;
    mountable: (string)[];
    kinds: (string)[];
    adopted: {
        kind: string;
        variant: string;
    };
    speeds: {
        walk: number;
        trot: number;
        canter: number;
        gallop: number;
    };
    pose: {
        gait?: {
            trot: number;
            gallop: number;
        };
        pose?: {
            grazeNeck: number;
            gallopTail: number;
        };
    };
    world: {
        res: number;
        size: number;
        water: number;
        wet: string | v.InferOutput<typeof ScalarChannelSchema>;
        pond: (string) | (v.InferOutput<typeof ScalarChannelSchema>);
    };
    roads?: (([
        number,
        number
    ])[])[];
    thrownDamage: number;
    thrownLabel: string;
    program: unknown;
}
export type NativeRidingRows = { [Key in keyof NativeRidingRowsFields]: NativeRidingRowsFields[Key] };
