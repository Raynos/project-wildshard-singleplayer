import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const vector = v.tuple([finite, finite, finite]);
/** Shared presentation lighting identity, initialized from admitted data. */
export const ToonLightingSchema: v.GenericSchema<ToonLightingRowInput, ToonLightingRow> = v.strictObject({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  initial: v.strictObject({ uToonLift: vector, uToonRim: vector,
    uCloudShadow: finite, uToonNight: finite, uSeaLevel: finite, uCloudTime: finite }) });


/** Admitted data contracts, independent of validator implementation metadata. */
export type ToonLightingRowInput = ToonLightingRow;
interface ToonLightingRowFields {
    id: string;
    initial: {
        uToonLift: [
            number,
            number,
            number
        ];
        uToonRim: [
            number,
            number,
            number
        ];
        uCloudShadow: number;
        uToonNight: number;
        uSeaLevel: number;
        uCloudTime: number;
    };
}
export type ToonLightingRow = { [Key in keyof ToonLightingRowFields]: ToonLightingRowFields[Key] };
