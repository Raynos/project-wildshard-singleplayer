import * as v from 'valibot';
import { NativeRidingSchema } from './nativeRiding';
import { StreamWaterSchema } from './water';

const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: finite, z: finite });
/** Native habitat observations are immutable data; the host owns every query. */
export const PopulationEnvironmentSchema = v.strictObject({
  id: key, seed: finite, chunkHalf: v.pipe(finite, v.minValue(1)), normalEpsilon: v.pipe(finite, v.minValue(.001), v.maxValue(4)),
  sampling: v.picklist(['bilinear', 'column-triangles']), water: finite, sea: v.boolean(),
  trails: v.nullable(v.pipe(v.array(v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(1024))), v.maxLength(128))),
  cabins: v.pipe(v.array(point), v.maxLength(1024)), pond: v.nullable(v.strictObject({ ...point.entries, r: finite })),
  trees: v.pipe(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), v.maxLength(16384)),
  /** the habitat's water: a declared stream (format water), its rest surface the wading and dry-ground test */
  stream: v.nullable(StreamWaterSchema),
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
