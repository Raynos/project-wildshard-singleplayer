import * as v from 'valibot';
import { isJsonData } from './json';
import { ToonLightingSchema } from './toonLighting';

/** Numeric channel contract for a toon day: sky palette, two-band light, fog and disc. */
export const TOON_DAY_PRESET = {
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
export const ToonDaySchema = v.pipe(v.unknown(), v.check(isJsonData, 'Toon day requires plain JSON'), v.strictObject({
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
export const ToonLookSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Toon look requires plain JSON'), v.strictObject({
  id, lighting: ToonLightingSchema,
  fog: v.pipe(v.strictObject({ start: n, end: n, near: rgb, zenith: rgb, order: n }), v.check(row => row.start < row.end)),
  shadows: v.strictObject({ rig: v.picklist(['tier', 'phoneSplits']), filter: v.exactOptional(v.literal('tent')), fade: v.exactOptional(v.boolean()),
    normalBias: n, radius: n, texelBias: v.exactOptional(v.literal('phone')), depth16: v.exactOptional(v.literal('phone')) }),
  ground: v.strictObject({ materials: v.strictObject({ ground: id, slab: id }), files: v.strictObject({ ground: id, slab: id }), kit: v.record(id, id) }),
  sky: v.strictObject({ day: ToonDaySchema, cycleSeconds: positive, name: id, channels: id,
    dome: v.strictObject({ look: id, radius: positive, segments: v.tuple([v.pipe(positive, v.integer()), v.pipe(positive, v.integer())]), order: n }),
    clouds: v.strictObject({ look: id, order: n, puffs: v.pipe(v.array(v.tuple([n, n, n, positive, n, n, n])), v.minLength(1), v.maxLength(8192)) }),
    midday: v.strictObject({ zenith: rgb, horizon: rgb, cloudLit: rgb, sunGlow: rgb }),
    environment: v.strictObject({ near: positive, far: positive }), crisp: n,
  }),
}));
export type ToonLookRow = v.InferOutput<typeof ToonLookSchema>;
export function parseToonLook(input: unknown): ToonLookRow { return v.parse(ToonLookSchema, input); }
