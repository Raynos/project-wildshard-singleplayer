import {isJsonData} from './json';
import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const real = v.pipe(v.number(), v.minValue(0), v.maxValue(10000));
/** Client-only trails follow actual native population groups in their local
 * world frame. Looks and timing are data; there are no owner callbacks. */
export const ClientTrailsSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientTrailsRowsInput['kind'], ClientTrailsRows['kind']>; readonly rows: v.GenericSchema<ClientTrailsRowsInput['rows'], ClientTrailsRows['rows']>; }, undefined> = v.strictObject({ kind: v.literal('fx.trail'), rows: v.pipe(v.array(v.strictObject({
  id, group: id, library: id, look: id, name: id,
  points: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(2048)),
  every: v.pipe(real, v.minValue(0.001)), width: real, minimum: real, movementSq: real,
})), v.maxLength(64), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'Unique trail systems')) });

/** A predicted line uses prepared widths and a finite fade envelope. */
export const ProjectedTrailSchema: v.GenericSchema<ProjectedTrailRowsInput, ProjectedTrailRows>=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  points:v.pipe(v.number(),v.integer(),v.minValue(2),v.maxValue(256)),
  width:v.tuple([real,real]),lifetime:v.pipe(real,v.minValue(.001)),fade:real,
  color:v.tuple([real,real,real]),order:v.pipe(v.number(),v.integer(),v.minValue(-100),v.maxValue(100)),
}));


/** Admitted data contracts, independent of validator implementation metadata. */
export type ClientTrailsRowsInput = ClientTrailsRows;
interface ClientTrailsRowsFields {
    kind: 'fx.trail';
    rows: ({
        id: string;
        group: string;
        library: string;
        look: string;
        name: string;
        points: number;
        every: number;
        width: number;
        minimum: number;
        movementSq: number;
    })[];
}
export type ClientTrailsRows = { [Key in keyof ClientTrailsRowsFields]: ClientTrailsRowsFields[Key] };
export type ProjectedTrailRowsInput = unknown;
interface ProjectedTrailRowsFields {
    points: number;
    width: [
        number,
        number
    ];
    lifetime: number;
    fade: number;
    color: [
        number,
        number,
        number
    ];
    order: number;
}
export type ProjectedTrailRows = { [Key in keyof ProjectedTrailRowsFields]: ProjectedTrailRowsFields[Key] };
