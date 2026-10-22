import * as v from 'valibot';

// the grammar the layout boot's wire schema (geometry/layout.json) already validates: plain strings and numbers
const cells = v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * G571: a baked irradiance volume (game/looks/lightVolume): a deflated product file of `size` RGBA8 voxels, the box it
 * samples (`min`, its minimum corner, and `inv`, one over its extent) and the brightest light it holds (`maximum`).
 */
export const LightVolumeRowSchema = v.strictObject({ file: v.string(), size: v.tuple([cells, cells, cells]), min: v.array(v.number()), inv: v.array(v.number()), maximum: v.number() });
export type LightVolumeRow = v.InferOutput<typeof LightVolumeRowSchema>;
