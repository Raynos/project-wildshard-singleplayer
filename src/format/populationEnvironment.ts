import * as v from 'valibot';
import { NativeRidingSchema } from './nativeRiding';

const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: finite, z: finite });
const line = v.strictObject({ from: finite, to: finite, start: finite, offset: finite, span: v.pipe(finite, v.minValue(Number.MIN_VALUE)) });
const profile = v.strictObject({ pieces: v.pipe(v.array(v.strictObject({ until: finite, line })), v.maxLength(64)), last: line });
const value = v.strictObject({ profile, add: finite });
/** A projected water corridor selects an ordered surface band along its centreline.
 * Profiles retain their original arithmetic order; ties retain the first segment. */
const stream = v.strictObject({ halfWidth: v.pipe(finite, v.minValue(0)),
  lines: v.pipe(v.array(v.strictObject({ ...point.entries, vx: finite, vz: finite, l2: v.pipe(finite, v.minValue(0)), arc: finite, length: finite })), v.minLength(1), v.maxLength(1024)),
  bands: v.pipe(v.array(v.strictObject({ until: finite, inclusive: v.boolean(), values: v.pipe(v.array(value), v.minLength(1), v.maxLength(8)) })), v.maxLength(64)),
  last: v.pipe(v.array(value), v.minLength(1), v.maxLength(8)),
});
/** Native habitat observations are immutable data; the host owns every query. */
export const PopulationEnvironmentSchema = v.strictObject({
  id: key, seed: finite, chunkHalf: v.pipe(finite, v.minValue(1)), normalEpsilon: v.pipe(finite, v.minValue(.001), v.maxValue(4)),
  sampling: v.picklist(['bilinear', 'column-triangles']), water: finite, sea: v.boolean(),
  trails: v.nullable(v.pipe(v.array(v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(1024))), v.maxLength(128))),
  cabins: v.pipe(v.array(point), v.maxLength(1024)), pond: v.nullable(v.strictObject({ ...point.entries, r: finite })),
  trees: v.pipe(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), v.maxLength(16384)),
  stream: v.nullable(stream),
});
export type PopulationEnvironmentRows = v.InferOutput<typeof PopulationEnvironmentSchema>;

const zone = v.strictObject({ ...point.entries, r: finite, h: finite });
/** Native field geography uses admitted rasters and uniform cross-section rows,
 * never content-owned terrain or grass query functions. */
export const PopulationFieldSchema = v.strictObject({
  seed: finite, world: NativeRidingSchema.entries.world,
  trails: v.pipe(v.array(v.pipe(v.array(v.tuple([finite,finite])), v.maxLength(1024))), v.maxLength(128)),
  river: v.strictObject({ from: finite, step: v.pipe(finite,v.minValue(Number.MIN_VALUE)),
    values: v.pipe(v.array(v.tuple([finite,finite])),v.minLength(2),v.maxLength(4096)) }),
  meadow: v.strictObject({ short: v.array(zone), tall: v.array(zone), bare: v.array(zone), valley: finite, plateau: finite }),
});
