import * as v from 'valibot';
import { isJsonData } from './json';
import { ToonLightingSchema } from './toonLighting';

/** Numeric channel contract for a toon day: sky palette, two-band light, fog and disc. */
export const TOON_DAY_PRESET: { readonly sky: { readonly zenith: 'colour'; readonly horizon: 'colour'; readonly below: 'colour'; readonly sunGlow: 'colour'; readonly cloudLit: 'colour'; readonly cloudShade: 'colour'; readonly night: 'number'; }; readonly light: 'colour'; readonly lightI: 'number'; readonly hemiSky: 'colour'; readonly hemiGround: 'colour'; readonly hemiI: 'number'; readonly lift: 'colour'; readonly rim: 'colour'; readonly fogNear: 'colour'; readonly fogSun: 'colour'; readonly disc: 'colour'; readonly cloudShadow: 'number'; readonly dusk: 'number'; } = {
  sky: { zenith: 'colour', horizon: 'colour', below: 'colour', sunGlow: 'colour', cloudLit: 'colour', cloudShade: 'colour', night: 'number' },
  light: 'colour', lightI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  lift: 'colour', rim: 'colour', fogNear: 'colour', fogSun: 'colour', disc: 'colour', cloudShadow: 'number', dusk: 'number',
} as const;
const n = v.pipe(v.number(), v.finite()), positive = v.pipe(n, v.minValue(.0001));
const pair = v.tuple([n, n]), rgb = v.tuple([n, n, n]), colour = v.union([n, rgb]);
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const skyPalette = v.strictObject({ zenith: colour, horizon: colour, below: colour, sunGlow: colour, cloudLit: colour, cloudShade: colour, night: n });
const preset = v.strictObject({ sky: skyPalette, light: colour, lightI: n, hemiSky: colour, hemiGround: colour, hemiI: n,
  lift: colour, rim: colour, fogNear: colour, fogSun: colour, disc: colour, cloudShadow: n, dusk: n });
/** A toon palette clock is plain data and may also run in the authoritative simulation. */
export const ToonDaySchema: v.GenericSchema<ToonDayDataInput, ToonDayData> = v.pipe(v.unknown(), v.check(isJsonData, 'Toon day requires plain JSON'), v.strictObject({
  dayFraction: v.pipe(n, v.minValue(.001), v.maxValue(.999)), start: n,
  schedule: v.pipe(v.array(v.strictObject({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: n, to: n, minutes: positive })), v.maxLength(32)),
  presets: v.pipe(v.record(id, preset), v.maxEntries(64)), frames: v.pipe(v.array(v.tuple([n, id])), v.minLength(2), v.maxLength(128)),
  phases: v.exactOptional(v.record(id, n)),
  fixed: v.strictObject({ midday: n, golden: n, sunset: n, night: n }), namedPhases: v.strictObject({ dawn: n, noon: n, dusk: n, night: n }),
  sun: v.strictObject({ rise: n, sweep: n, noon: n, nightRise: n, nightSweep: n, nadir: n }), moon: v.strictObject({ rise: n, sweep: n, base: n, arc: n }),
  night: v.strictObject({ eve: v.exactOptional(v.strictObject({ span: pair, height: n })), rise: pair, fall: pair }),
  fade: v.strictObject({ sunY: pair, moonIn: pair, moonOut: pair }), dusk: v.exactOptional(pair), dawn: v.exactOptional(v.strictObject({ at: n, width: pair })),
  shadowStepDeg: positive, envRefresh: positive, envSize: v.pipe(positive, v.integer(), v.maxValue(2048)), startSun: rgb,
  planetHaze: rgb, planetHazeDay: n, moonDisc: n, sunIBase: positive,
}), v.check(row => row.frames.every(([phase, key], i) => phase >= 0 && phase <= 1 && phase >= (row.frames[i - 1]?.[0] ?? 0) && row.presets[key] !== undefined), 'Invalid toon day frame'));
type ReadonlyRow<T> = T extends object ? { readonly [K in keyof T]: ReadonlyRow<T[K]> } : T;
export type ToonDayRow = ReadonlyRow<v.InferOutput<typeof ToonDaySchema>>;

/** Client-only toon presentation: two-band lighting, ramp fog, faceted terrain and a graph sky.
 * Source geometry, material graphs, puffs and numeric channel groups are product-owned ids/data. */
export const ToonLookSchema: v.GenericSchema<ToonLookRowInput, ToonLookRow> = v.pipe(v.unknown(), v.check(isJsonData, 'Toon look requires plain JSON'), v.strictObject({
  id, lighting: ToonLightingSchema,
  fog: v.pipe(v.strictObject({ start: n, end: n, near: rgb, zenith: rgb, order: n }), v.check(row => row.start < row.end)),
  shadows: v.strictObject({ rig: v.picklist(['tier', 'phoneSplits']), filter: v.exactOptional(v.literal('tent')), fade: v.exactOptional(v.boolean()),
    normalBias: n, radius: n, texelBias: v.exactOptional(v.literal('phone')), depth16: v.exactOptional(v.literal('phone')) }),
  ground: v.strictObject({ materials: v.strictObject({ ground: id, slab: id }), files: v.strictObject({ ground: id, slab: id }), kit: v.record(id, id) }),
  sky: v.strictObject({ day: ToonDaySchema, cycleSeconds: positive, name: id, channels: id,
    dome: v.strictObject({ look: id, radius: positive, segments: v.tuple([v.pipe(positive, v.integer()), v.pipe(positive, v.integer())]), order: n }),
    // the cumulus: one icosahedron of `detail` subdivisions instanced per puff row, shaped and lit by the `look` graph
    clouds: v.strictObject({ look: id, order: n, puffs: v.pipe(v.array(v.tuple([n, n, n, positive, n, n, n])), v.minLength(1), v.maxLength(8192)),
      detail: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(3)) }),
    midday: v.strictObject({ zenith: rgb, horizon: rgb, cloudLit: rgb, sunGlow: rgb }),
    environment: v.strictObject({ near: positive, far: positive }), crisp: n,
  }),
}));

export function parseToonLook(input: unknown): ToonLookRow { return v.parse(ToonLookSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type ToonDayDataInput = unknown;
interface ToonDayDataFields {
    dayFraction: number;
    start: number;
    schedule: ({
        phase: 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
        from: number;
        to: number;
        minutes: number;
    })[];
    presets: Record<string, {
        sky: {
            zenith: (number) | ([
                number,
                number,
                number
            ]);
            horizon: (number) | ([
                number,
                number,
                number
            ]);
            below: (number) | ([
                number,
                number,
                number
            ]);
            sunGlow: (number) | ([
                number,
                number,
                number
            ]);
            cloudLit: (number) | ([
                number,
                number,
                number
            ]);
            cloudShade: (number) | ([
                number,
                number,
                number
            ]);
            night: number;
        };
        light: (number) | ([
            number,
            number,
            number
        ]);
        lightI: number;
        hemiSky: (number) | ([
            number,
            number,
            number
        ]);
        hemiGround: (number) | ([
            number,
            number,
            number
        ]);
        hemiI: number;
        lift: (number) | ([
            number,
            number,
            number
        ]);
        rim: (number) | ([
            number,
            number,
            number
        ]);
        fogNear: (number) | ([
            number,
            number,
            number
        ]);
        fogSun: (number) | ([
            number,
            number,
            number
        ]);
        disc: (number) | ([
            number,
            number,
            number
        ]);
        cloudShadow: number;
        dusk: number;
    }>;
    frames: ([
        number,
        string
    ])[];
    phases?: Record<string, number>;
    fixed: {
        midday: number;
        golden: number;
        sunset: number;
        night: number;
    };
    namedPhases: {
        dawn: number;
        noon: number;
        dusk: number;
        night: number;
    };
    sun: {
        rise: number;
        sweep: number;
        noon: number;
        nightRise: number;
        nightSweep: number;
        nadir: number;
    };
    moon: {
        rise: number;
        sweep: number;
        base: number;
        arc: number;
    };
    night: {
        eve?: {
            span: [
                number,
                number
            ];
            height: number;
        };
        rise: [
            number,
            number
        ];
        fall: [
            number,
            number
        ];
    };
    fade: {
        sunY: [
            number,
            number
        ];
        moonIn: [
            number,
            number
        ];
        moonOut: [
            number,
            number
        ];
    };
    dusk?: [
        number,
        number
    ];
    dawn?: {
        at: number;
        width: [
            number,
            number
        ];
    };
    shadowStepDeg: number;
    envRefresh: number;
    envSize: number;
    startSun: [
        number,
        number,
        number
    ];
    planetHaze: [
        number,
        number,
        number
    ];
    planetHazeDay: number;
    moonDisc: number;
    sunIBase: number;
}
export type ToonDayData = { [Key in keyof ToonDayDataFields]: ToonDayDataFields[Key] };
export type ToonLookRowInput = unknown;
interface ToonLookRowFields {
    id: string;
    lighting: v.InferOutput<typeof ToonLightingSchema>;
    fog: {
        start: number;
        end: number;
        near: [
            number,
            number,
            number
        ];
        zenith: [
            number,
            number,
            number
        ];
        order: number;
    };
    shadows: {
        rig: 'tier' | 'phoneSplits';
        filter?: 'tent';
        fade?: boolean;
        normalBias: number;
        radius: number;
        texelBias?: 'phone';
        depth16?: 'phone';
    };
    ground: {
        materials: {
            ground: string;
            slab: string;
        };
        files: {
            ground: string;
            slab: string;
        };
        kit: Record<string, string>;
    };
    sky: {
        day: ToonDayData;
        cycleSeconds: number;
        name: string;
        channels: string;
        dome: {
            look: string;
            radius: number;
            segments: [
                number,
                number
            ];
            order: number;
        };
        clouds: {
            look: string;
            order: number;
            puffs: ([
                number,
                number,
                number,
                number,
                number,
                number,
                number
            ])[];
            detail: number;
        };
        midday: {
            zenith: [
                number,
                number,
                number
            ];
            horizon: [
                number,
                number,
                number
            ];
            cloudLit: [
                number,
                number,
                number
            ];
            sunGlow: [
                number,
                number,
                number
            ];
        };
        environment: {
            near: number;
            far: number;
        };
        crisp: number;
    };
}
export type ToonLookRow = { [Key in keyof ToonLookRowFields]: ToonLookRowFields[Key] };
