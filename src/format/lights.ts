import * as v from 'valibot';

/**
 * Light rows (DS1.4): the local lights a scene places — a three.js `PointLight` or `SpotLight` read by the SDK scene
 * reader (`@wildshard/sdk/scene` `readScene`). The sun, sky / ground and ambient are look rows (`look.keys`), never light
 * rows. A row is pure data in three.js's own units: `colour` is linear (three's working colour space), `intensity` is
 * candela, `distance` is the cutoff in metres (0 = none) and `decay` the falloff exponent (2 = physical). A spot adds its
 * world-space `target`, its cone half-angle `angle` (radians) and `penumbra` (0 hard … 1 soft).
 *
 * Bounded so a scene can never ask the renderer for an unbounded light loop: at most `LIGHT_ROWS_MAX` rows.
 */

/** the most light rows a scene may declare */
export const LIGHT_ROWS_MAX = 64;

const finite = v.pipe(v.number(), v.finite());
const nonNegative = v.pipe(finite, v.minValue(0));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const vec3 = v.tuple([finite, finite, finite]);
const colour = v.tuple([nonNegative, nonNegative, nonNegative]);
const base = { id, position: vec3, colour, intensity: v.pipe(nonNegative, v.maxValue(1e6)), distance: v.pipe(nonNegative, v.maxValue(10_000)), decay: v.pipe(nonNegative, v.maxValue(8)) };

/** One point light: an omnidirectional emitter at `position`. */
export const PointLightRowSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<PointLightRowInput['kind'], PointLightRow['kind']>; readonly id: v.GenericSchema<PointLightRowInput['id'], PointLightRow['id']>; readonly position: v.GenericSchema<PointLightRowInput['position'], PointLightRow['position']>; readonly colour: v.GenericSchema<PointLightRowInput['colour'], PointLightRow['colour']>; readonly intensity: v.GenericSchema<PointLightRowInput['intensity'], PointLightRow['intensity']>; readonly distance: v.GenericSchema<PointLightRowInput['distance'], PointLightRow['distance']>; readonly decay: v.GenericSchema<PointLightRowInput['decay'], PointLightRow['decay']>; }, undefined> = v.strictObject({ kind: v.literal('point'), ...base });
/** One spot light: a cone from `position` toward `target`. */
export const SpotLightRowSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<SpotLightRowInput['kind'], SpotLightRow['kind']>; readonly id: v.GenericSchema<SpotLightRowInput['id'], SpotLightRow['id']>; readonly position: v.GenericSchema<SpotLightRowInput['position'], SpotLightRow['position']>; readonly colour: v.GenericSchema<SpotLightRowInput['colour'], SpotLightRow['colour']>; readonly intensity: v.GenericSchema<SpotLightRowInput['intensity'], SpotLightRow['intensity']>; readonly distance: v.GenericSchema<SpotLightRowInput['distance'], SpotLightRow['distance']>; readonly decay: v.GenericSchema<SpotLightRowInput['decay'], SpotLightRow['decay']>; readonly target: v.GenericSchema<SpotLightRowInput['target'], SpotLightRow['target']>; readonly angle: v.GenericSchema<SpotLightRowInput['angle'], SpotLightRow['angle']>; readonly penumbra: v.GenericSchema<SpotLightRowInput['penumbra'], SpotLightRow['penumbra']>; }, undefined> = v.strictObject({
  kind: v.literal('spot'), ...base, target: vec3,
  angle: v.pipe(finite, v.minValue(1e-4), v.maxValue(Math.PI / 2)), penumbra: v.pipe(finite, v.minValue(0), v.maxValue(1)),
});
/** Any light row, discriminated by `kind`. */
export const LightRowSchema: v.GenericSchema<LightRowInput, LightRow> = v.variant('kind', [PointLightRowSchema, SpotLightRowSchema]);
/** A scene's light rows: unique ids, at most `LIGHT_ROWS_MAX`. */
export const LightRowsSchema: v.GenericSchema<LightRowsInput, LightRows> = v.pipe(
  v.array(LightRowSchema), v.maxLength(LIGHT_ROWS_MAX),
  v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'light row ids are unique'),
);
/** A validated light row. */


/** Validate light rows; throws a readable error on bad data. */
export function parseLightRows(input: unknown): LightRow[] {
  const r = v.safeParse(LightRowsSchema, input);
  if (!r.success) throw new Error(`light rows: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type PointLightRowInput = PointLightRow;
export type PointLightRow = Omit<{
    kind: 'point';
}, keyof ({
    id: string;
    position: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    intensity: number;
    distance: number;
    decay: number;
})> & {
    id: string;
    position: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    intensity: number;
    distance: number;
    decay: number;
};
export type SpotLightRowInput = SpotLightRow;
export type SpotLightRow = Omit<Omit<{
    kind: 'spot';
}, keyof ({
    id: string;
    position: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    intensity: number;
    distance: number;
    decay: number;
})> & {
    id: string;
    position: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    intensity: number;
    distance: number;
    decay: number;
}, keyof ({
    target: [
        number,
        number,
        number
    ];
    angle: number;
    penumbra: number;
})> & {
    target: [
        number,
        number,
        number
    ];
    angle: number;
    penumbra: number;
};
export type LightRowInput = (PointLightRowInput) | (SpotLightRowInput);
export type LightRow = (PointLightRow) | (SpotLightRow);
export type LightRowsInput = (LightRowInput)[];
export type LightRows = (LightRow)[];
