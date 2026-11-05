import * as v from 'valibot';
import { NativeRidingSchema } from './nativeRiding.ts';
import { StreamWaterSchema } from './water.ts';
import { ForagerContinuation } from './ambientLife.ts';

const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: finite, z: finite });
/** G1004/G872: this approved single-user native input has exactly 155 authored
 * canopy entries and at most six ledges. A changed source count refuses until
 * this contract is reviewed; the original author/native count checks remain. */
export const PopulationHabitatSchema:v.GenericSchema<PopulationHabitatRows,PopulationHabitatRows>=v.strictObject({
  trees:v.pipe(v.array(v.tuple([finite,finite,v.pipe(finite,v.minValue(0))])),v.length(155)),
  tops:v.pipe(v.array(finite),v.length(155)),
  ledges:v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite,r:v.pipe(finite,v.minValue(0))})),v.maxLength(6)),
  marmots:ForagerContinuation,
});
export interface PopulationHabitatRows {
  trees:[number,number,number][];tops:number[];ledges:{x:number;y:number;z:number;r:number}[];
  marmots:v.InferOutput<typeof ForagerContinuation>;
}
/** Native habitat observations are immutable data; the host owns every query. */
export const PopulationEnvironmentSchema: v.GenericSchema<PopulationEnvironmentRowsInput, PopulationEnvironmentRows> = v.strictObject({
  id: key, seed: finite, chunkHalf: v.pipe(finite, v.minValue(1)), normalEpsilon: v.pipe(finite, v.minValue(.001), v.maxValue(4)),
  sampling: v.picklist(['bilinear', 'column-triangles']), water: finite, sea: v.boolean(),
  trails: v.nullable(v.pipe(v.array(v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(1024))), v.maxLength(128))),
  cabins: v.pipe(v.array(point), v.maxLength(1024)), pond: v.nullable(v.strictObject({ ...point.entries, r: finite })),
  trees: v.pipe(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), v.maxLength(16384)),
  /** the habitat's water: a declared stream (format water), its rest surface the wading and dry-ground test */
  stream: v.nullable(StreamWaterSchema),
});

const zone = v.strictObject({ ...point.entries, r: finite, h: finite });
/** Native field geography uses admitted rasters and uniform cross-section rows,
 * never content-owned terrain or grass query functions. */
export const PopulationFieldSchema: v.GenericSchema<PopulationFieldRowsInput, PopulationFieldRows> = v.strictObject({
  seed: finite, world: NativeRidingSchema.entries.world,
  trails: v.pipe(v.array(v.pipe(v.array(v.tuple([finite,finite])), v.maxLength(1024))), v.maxLength(128)),
  river: v.strictObject({ from: finite, step: v.pipe(finite,v.minValue(Number.MIN_VALUE)),
    values: v.pipe(v.array(v.tuple([finite,finite])),v.minLength(2),v.maxLength(4096)) }),
  meadow: v.strictObject({ short: v.array(zone), tall: v.array(zone), bare: v.array(zone), valley: finite, plateau: finite }),
});

/** Admitted data contracts, independent of validator implementation metadata. */
interface PopulationEnvironmentRowsInputFields {
    id: string;
    seed: number;
    chunkHalf: number;
    normalEpsilon: number;
    sampling: 'bilinear' | 'column-triangles';
    water: number;
    sea: boolean;
    trails: ((([
        number,
        number
    ])[])[]) | null;
    cabins: ({
        x: number;
        z: number;
    })[];
    pond: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        r: number;
    })> & {
        r: number;
    }) | null;
    trees: ([
        number,
        number,
        number
    ])[];
    stream: (v.InferInput<typeof StreamWaterSchema>) | null;
}
export type PopulationEnvironmentRowsInput = { [Key in keyof PopulationEnvironmentRowsInputFields]: PopulationEnvironmentRowsInputFields[Key] };
interface PopulationEnvironmentRowsFields {
    id: string;
    seed: number;
    chunkHalf: number;
    normalEpsilon: number;
    sampling: 'bilinear' | 'column-triangles';
    water: number;
    sea: boolean;
    trails: ((([
        number,
        number
    ])[])[]) | null;
    cabins: ({
        x: number;
        z: number;
    })[];
    pond: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        r: number;
    })> & {
        r: number;
    }) | null;
    trees: ([
        number,
        number,
        number
    ])[];
    stream: (v.InferOutput<typeof StreamWaterSchema>) | null;
}
export type PopulationEnvironmentRows = { [Key in keyof PopulationEnvironmentRowsFields]: PopulationEnvironmentRowsFields[Key] };
interface PopulationFieldRowsInputFields {
    seed: number;
    world: v.InferInput<(typeof NativeRidingSchema)['entries']['world']>;
    trails: (([
        number,
        number
    ])[])[];
    river: {
        from: number;
        step: number;
        values: ([
            number,
            number
        ])[];
    };
    meadow: {
        short: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        tall: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        bare: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        valley: number;
        plateau: number;
    };
}
export type PopulationFieldRowsInput = { [Key in keyof PopulationFieldRowsInputFields]: PopulationFieldRowsInputFields[Key] };
interface PopulationFieldRowsFields {
    seed: number;
    world: v.InferOutput<(typeof NativeRidingSchema)['entries']['world']>;
    trails: (([
        number,
        number
    ])[])[];
    river: {
        from: number;
        step: number;
        values: ([
            number,
            number
        ])[];
    };
    meadow: {
        short: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        tall: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        bare: (Omit<{
            x: number;
            z: number;
        }, keyof ({
            r: number;
            h: number;
        })> & {
            r: number;
            h: number;
        })[];
        valley: number;
        plateau: number;
    };
}
export type PopulationFieldRows = { [Key in keyof PopulationFieldRowsFields]: PopulationFieldRowsFields[Key] };
