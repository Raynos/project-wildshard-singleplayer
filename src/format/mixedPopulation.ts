import * as v from 'valibot';
import { NumericPoseSchema } from './clientChannels';

const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: finite, z: finite });
/** Mixed native roster policy, pose, reserve and physical volley composition. */
export const MixedPopulationSchema: v.StrictObjectSchema<{ readonly step: v.GenericSchema<MixedPopulationRowsInput['step'], MixedPopulationRows['step']>; readonly limit: v.GenericSchema<MixedPopulationRowsInput['limit'], MixedPopulationRows['limit']>; readonly attackTurnCap: v.GenericSchema<MixedPopulationRowsInput['attackTurnCap'], MixedPopulationRows['attackTurnCap']>; readonly hunted: v.GenericSchema<MixedPopulationRowsInput['hunted'], MixedPopulationRows['hunted']>; readonly floorKinds: v.GenericSchema<MixedPopulationRowsInput['floorKinds'], MixedPopulationRows['floorKinds']>; readonly practice: v.GenericSchema<MixedPopulationRowsInput['practice'], MixedPopulationRows['practice']>; readonly reserve: v.GenericSchema<MixedPopulationRowsInput['reserve'], MixedPopulationRows['reserve']>; readonly volley: v.GenericSchema<MixedPopulationRowsInput['volley'], MixedPopulationRows['volley']>; readonly poses: v.GenericSchema<MixedPopulationRowsInput['poses'], MixedPopulationRows['poses']>; readonly perch: v.GenericSchema<MixedPopulationRowsInput['perch'], MixedPopulationRows['perch']>; }, undefined> = v.strictObject({
  step: key, limit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)),
  attackTurnCap: finite, hunted: v.array(key), floorKinds: v.array(key),
  practice: v.strictObject({ at: point, fade: finite, delay: finite, away: finite }),
  reserve: v.strictObject({ kind: key, variant: key, scale: v.tuple([finite, finite]), legacyMemory: v.array(v.strictObject({ from: key, to: key, axis: v.picklist(['x', 'z', 'zero']) })) }),
  volley: v.strictObject({ owner: key, strike: key, tags: v.array(v.custom<`${string}.${string}`>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))) }),
  poses: v.array(v.strictObject({ kind: key, clips: v.array(NumericPoseSchema),
    lift: v.exactOptional(v.tuple([finite, finite, finite, finite])) })),
  perch: v.strictObject({ kind: key, strike: key, sound: key, sourceHeight: finite, targetHeight: finite,
    attackStream: v.exactOptional(v.picklist(['ai', 'spawn', 'gameplay', 'cosmetic'])),
    actions: v.strictObject({ stateKey: key, states: v.array(key), actions: v.array(v.strictObject({ state: finite, phase: finite, effect: key,
      once: v.strictObject({ key, value: finite, test: v.picklist(['falsy', 'not-value']) }),
      when: v.exactOptional(v.strictObject({ key, test: v.picklist(['truthy', 'falsy']) })) })) }),
    score: key, height: key, heightChannel: key,
    root: v.strictObject({ drop: key, velocity: key, land: key, climb: key, height: key, baseX: key, baseZ: key, x: key, z: key,
      gravity: finite, speed: finite, landing: finite }) }),
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface MixedPopulationRowsInputFields {
    step: string;
    limit: number;
    attackTurnCap: number;
    hunted: (string)[];
    floorKinds: (string)[];
    practice: {
        at: {
            x: number;
            z: number;
        };
        fade: number;
        delay: number;
        away: number;
    };
    reserve: {
        kind: string;
        variant: string;
        scale: [
            number,
            number
        ];
        legacyMemory: ({
            from: string;
            to: string;
            axis: 'x' | 'z' | 'zero';
        })[];
    };
    volley: {
        owner: string;
        strike: string;
        tags: (`${string}.${string}`)[];
    };
    poses: ({
        kind: string;
        clips: (v.InferInput<typeof NumericPoseSchema>)[];
        lift?: [
            number,
            number,
            number,
            number
        ];
    })[];
    perch: {
        kind: string;
        strike: string;
        sound: string;
        sourceHeight: number;
        targetHeight: number;
        attackStream?: 'ai' | 'spawn' | 'gameplay' | 'cosmetic';
        actions: {
            stateKey: string;
            states: (string)[];
            actions: ({
                state: number;
                phase: number;
                effect: string;
                once: {
                    key: string;
                    value: number;
                    test: 'falsy' | 'not-value';
                };
                when?: {
                    key: string;
                    test: 'truthy' | 'falsy';
                };
            })[];
        };
        score: string;
        height: string;
        heightChannel: string;
        root: {
            drop: string;
            velocity: string;
            land: string;
            climb: string;
            height: string;
            baseX: string;
            baseZ: string;
            x: string;
            z: string;
            gravity: number;
            speed: number;
            landing: number;
        };
    };
}
export type MixedPopulationRowsInput = { [Key in keyof MixedPopulationRowsInputFields]: MixedPopulationRowsInputFields[Key] };
interface MixedPopulationRowsFields {
    step: string;
    limit: number;
    attackTurnCap: number;
    hunted: (string)[];
    floorKinds: (string)[];
    practice: {
        at: {
            x: number;
            z: number;
        };
        fade: number;
        delay: number;
        away: number;
    };
    reserve: {
        kind: string;
        variant: string;
        scale: [
            number,
            number
        ];
        legacyMemory: ({
            from: string;
            to: string;
            axis: 'x' | 'z' | 'zero';
        })[];
    };
    volley: {
        owner: string;
        strike: string;
        tags: (`${string}.${string}`)[];
    };
    poses: ({
        kind: string;
        clips: (v.InferOutput<typeof NumericPoseSchema>)[];
        lift?: [
            number,
            number,
            number,
            number
        ];
    })[];
    perch: {
        kind: string;
        strike: string;
        sound: string;
        sourceHeight: number;
        targetHeight: number;
        attackStream?: 'ai' | 'spawn' | 'gameplay' | 'cosmetic';
        actions: {
            stateKey: string;
            states: (string)[];
            actions: ({
                state: number;
                phase: number;
                effect: string;
                once: {
                    key: string;
                    value: number;
                    test: 'falsy' | 'not-value';
                };
                when?: {
                    key: string;
                    test: 'truthy' | 'falsy';
                };
            })[];
        };
        score: string;
        height: string;
        heightChannel: string;
        root: {
            drop: string;
            velocity: string;
            land: string;
            climb: string;
            height: string;
            baseX: string;
            baseZ: string;
            x: string;
            z: string;
            gravity: number;
            speed: number;
            landing: number;
        };
    };
}
export type MixedPopulationRows = { [Key in keyof MixedPopulationRowsFields]: MixedPopulationRowsFields[Key] };
