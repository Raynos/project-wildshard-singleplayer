import * as v from 'valibot';
import { BodySlotsSchema } from './bodySlots';
import { BodyLaunchSchema } from './nativeItems';
import { ConeWeaponProfileSchema } from './weaponProfiles';
import { ReturnProgramSchema } from './namedJsonContracts';
import { EncounterScheduleSchema } from './encounterRows';

const n = v.pipe(v.number(), v.finite()), key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: n, z: n }), position = v.tuple([n, n, n]);
const stream = v.strictObject({ version: v.literal(1), state: n, initial: n, scrambledFork: v.boolean() });
const spawn = v.strictObject({ kind: key, variant: v.nullable(key), ...point.entries, yaw: n, herd: n, practice: v.exactOptional(v.literal(true)) });
const page = v.strictObject({ stream, herds: n, centres: v.array(point), kinds: v.array(key), enemies: v.array(spawn),
  perches: v.array(v.strictObject({ crown: position, base: position })) });
const action = v.strictObject({ state: n, from: v.exactOptional(n), fromNot: v.exactOptional(n), sound: v.exactOptional(key), splash: v.exactOptional(n) });
/** Client-only population projection: physical volleys, pooled splash particles,
 * memory observations and lights share the existing animal manager lifetime. */
export const PopulationProjectionSchema: v.GenericSchema<PopulationProjectionRowsInput, PopulationProjectionRows> = v.strictObject({
  id: key, seed: n, random: n, page: v.strictObject({ phone: page, desktop: page }),
  counts: v.record(key, v.strictObject({ kind: key, groups: v.boolean(), practice: v.boolean() })),
  practice: v.strictObject({ program: ReturnProgramSchema, law: EncounterScheduleSchema }),
  hold: v.strictObject({ kind: key, ...point.entries, r: n, guardR: n, step: n, floor: v.array(v.nullable(n)) }),
  volley: BodySlotsSchema, launch: BodyLaunchSchema, strike: v.strictObject({ id: key, damage: n, tags: ConeWeaponProfileSchema.entries.gust.entries.tags }),
  contact: v.strictObject({ sound: key, landSound: key, landAge: n, splash: n }),
  husk: v.strictObject({ colour: v.string(), detail: n }),
  splash: v.strictObject({ capacity: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(240)), gravity: n,
    colour: v.tuple([n, n, n]), size: n, opacity: n, count: n, radius: n,
    height: v.tuple([n, n]), speed: v.tuple([n, n]), up: v.tuple([n, n]), life: v.tuple([n, n]) }),
  effects: v.array(v.strictObject({ kind: key, state: key, actions: v.array(action),
    periodic: v.strictObject({ state: n, interval: n, chance: n, x: key, z: key, radius: n, splash: n }) })),
  light: v.strictObject({ colour: n, distance: n, decay: n, headY: n, deathSplash: n, fade: n,
    intensity: n, rise: key, rising: key, range: n, flicker: v.tuple([n, n, n, n, n]),
    streamRate: n, streamHeight: v.tuple([n, n]), streamSplash: n }),
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface PopulationProjectionRowsInputFields {
    id: string;
    seed: number;
    random: number;
    page: {
        phone: {
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
            herds: number;
            centres: ({
                x: number;
                z: number;
            })[];
            kinds: (string)[];
            enemies: (Omit<Omit<{
                kind: string;
                variant: (string) | null;
            }, keyof ({
                x: number;
                z: number;
            })> & {
                x: number;
                z: number;
            }, keyof ({
                yaw: number;
                herd: number;
                practice?: true;
            })> & {
                yaw: number;
                herd: number;
                practice?: true;
            })[];
            perches: ({
                crown: [
                    number,
                    number,
                    number
                ];
                base: [
                    number,
                    number,
                    number
                ];
            })[];
        };
        desktop: {
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
            herds: number;
            centres: ({
                x: number;
                z: number;
            })[];
            kinds: (string)[];
            enemies: (Omit<Omit<{
                kind: string;
                variant: (string) | null;
            }, keyof ({
                x: number;
                z: number;
            })> & {
                x: number;
                z: number;
            }, keyof ({
                yaw: number;
                herd: number;
                practice?: true;
            })> & {
                yaw: number;
                herd: number;
                practice?: true;
            })[];
            perches: ({
                crown: [
                    number,
                    number,
                    number
                ];
                base: [
                    number,
                    number,
                    number
                ];
            })[];
        };
    };
    counts: Record<string, {
        kind: string;
        groups: boolean;
        practice: boolean;
    }>;
    practice: {
        program: v.InferInput<typeof ReturnProgramSchema>;
        law: v.InferInput<typeof EncounterScheduleSchema>;
    };
    hold: Omit<Omit<{
        kind: string;
    }, keyof ({
        x: number;
        z: number;
    })> & {
        x: number;
        z: number;
    }, keyof ({
        r: number;
        guardR: number;
        step: number;
        floor: ((number) | null)[];
    })> & {
        r: number;
        guardR: number;
        step: number;
        floor: ((number) | null)[];
    };
    volley: v.InferInput<typeof BodySlotsSchema>;
    launch: v.InferInput<typeof BodyLaunchSchema>;
    strike: {
        id: string;
        damage: number;
        tags: v.InferInput<(typeof ConeWeaponProfileSchema)['entries']['gust']['entries']['tags']>;
    };
    contact: {
        sound: string;
        landSound: string;
        landAge: number;
        splash: number;
    };
    husk: {
        colour: string;
        detail: number;
    };
    splash: {
        capacity: number;
        gravity: number;
        colour: [
            number,
            number,
            number
        ];
        size: number;
        opacity: number;
        count: number;
        radius: number;
        height: [
            number,
            number
        ];
        speed: [
            number,
            number
        ];
        up: [
            number,
            number
        ];
        life: [
            number,
            number
        ];
    };
    effects: ({
        kind: string;
        state: string;
        actions: ({
            state: number;
            from?: number;
            fromNot?: number;
            sound?: string;
            splash?: number;
        })[];
        periodic: {
            state: number;
            interval: number;
            chance: number;
            x: string;
            z: string;
            radius: number;
            splash: number;
        };
    })[];
    light: {
        colour: number;
        distance: number;
        decay: number;
        headY: number;
        deathSplash: number;
        fade: number;
        intensity: number;
        rise: string;
        rising: string;
        range: number;
        flicker: [
            number,
            number,
            number,
            number,
            number
        ];
        streamRate: number;
        streamHeight: [
            number,
            number
        ];
        streamSplash: number;
    };
}
export type PopulationProjectionRowsInput = { [Key in keyof PopulationProjectionRowsInputFields]: PopulationProjectionRowsInputFields[Key] };
interface PopulationProjectionRowsFields {
    id: string;
    seed: number;
    random: number;
    page: {
        phone: {
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
            herds: number;
            centres: ({
                x: number;
                z: number;
            })[];
            kinds: (string)[];
            enemies: (Omit<Omit<{
                kind: string;
                variant: (string) | null;
            }, keyof ({
                x: number;
                z: number;
            })> & {
                x: number;
                z: number;
            }, keyof ({
                yaw: number;
                herd: number;
                practice?: true;
            })> & {
                yaw: number;
                herd: number;
                practice?: true;
            })[];
            perches: ({
                crown: [
                    number,
                    number,
                    number
                ];
                base: [
                    number,
                    number,
                    number
                ];
            })[];
        };
        desktop: {
            stream: {
                version: 1;
                state: number;
                initial: number;
                scrambledFork: boolean;
            };
            herds: number;
            centres: ({
                x: number;
                z: number;
            })[];
            kinds: (string)[];
            enemies: (Omit<Omit<{
                kind: string;
                variant: (string) | null;
            }, keyof ({
                x: number;
                z: number;
            })> & {
                x: number;
                z: number;
            }, keyof ({
                yaw: number;
                herd: number;
                practice?: true;
            })> & {
                yaw: number;
                herd: number;
                practice?: true;
            })[];
            perches: ({
                crown: [
                    number,
                    number,
                    number
                ];
                base: [
                    number,
                    number,
                    number
                ];
            })[];
        };
    };
    counts: Record<string, {
        kind: string;
        groups: boolean;
        practice: boolean;
    }>;
    practice: {
        program: v.InferOutput<typeof ReturnProgramSchema>;
        law: v.InferOutput<typeof EncounterScheduleSchema>;
    };
    hold: Omit<Omit<{
        kind: string;
    }, keyof ({
        x: number;
        z: number;
    })> & {
        x: number;
        z: number;
    }, keyof ({
        r: number;
        guardR: number;
        step: number;
        floor: ((number) | null)[];
    })> & {
        r: number;
        guardR: number;
        step: number;
        floor: ((number) | null)[];
    };
    volley: v.InferOutput<typeof BodySlotsSchema>;
    launch: v.InferOutput<typeof BodyLaunchSchema>;
    strike: {
        id: string;
        damage: number;
        tags: v.InferOutput<(typeof ConeWeaponProfileSchema)['entries']['gust']['entries']['tags']>;
    };
    contact: {
        sound: string;
        landSound: string;
        landAge: number;
        splash: number;
    };
    husk: {
        colour: string;
        detail: number;
    };
    splash: {
        capacity: number;
        gravity: number;
        colour: [
            number,
            number,
            number
        ];
        size: number;
        opacity: number;
        count: number;
        radius: number;
        height: [
            number,
            number
        ];
        speed: [
            number,
            number
        ];
        up: [
            number,
            number
        ];
        life: [
            number,
            number
        ];
    };
    effects: ({
        kind: string;
        state: string;
        actions: ({
            state: number;
            from?: number;
            fromNot?: number;
            sound?: string;
            splash?: number;
        })[];
        periodic: {
            state: number;
            interval: number;
            chance: number;
            x: string;
            z: string;
            radius: number;
            splash: number;
        };
    })[];
    light: {
        colour: number;
        distance: number;
        decay: number;
        headY: number;
        deathSplash: number;
        fade: number;
        intensity: number;
        rise: string;
        rising: string;
        range: number;
        flicker: [
            number,
            number,
            number,
            number,
            number
        ];
        streamRate: number;
        streamHeight: [
            number,
            number
        ];
        streamSplash: number;
    };
}
export type PopulationProjectionRows = { [Key in keyof PopulationProjectionRowsFields]: PopulationProjectionRowsFields[Key] };
