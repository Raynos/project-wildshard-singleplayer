import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const count = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16_777_216));
const slot = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(127));
const geometry = v.strictObject({ library: id, model: id });
const distance = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1e12));
const instance = v.strictObject({ near: distance, far: distance,
  lod0: slot, lod1: slot, matrix: v.pipe(v.array(finite), v.length(16)),
  sphere: v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))]) });

/** One reserved client draw shared by named placements and ordered fixed LOD instances. */
export const WorldSceneBatchSchema = v.pipe(v.strictObject({ id, tier: v.exactOptional(v.picklist(['phone', 'desktop'])), material: id, name: v.optional(id, 'world-scene-batch'),
  capacity: v.strictObject({ instances: v.pipe(count, v.maxValue(8192)), vertices: count, indices: count }),
  sortObjects: v.optional(v.boolean(), false), perObjectFrustumCulled: v.optional(v.boolean(), true),
  castShadow: v.optional(v.boolean(), false), receiveShadow: v.optional(v.boolean(), false),
  cull: v.optional(v.strictObject({ frustum: v.exactOptional(v.boolean()), radiusBias: v.exactOptional(finite),
    step: v.exactOptional(v.pipe(finite, v.minValue(0))) }), {}),
  geometry: v.optional(v.pipe(v.array(geometry), v.maxLength(128)), []),
  fixed: v.optional(v.pipe(v.array(instance), v.maxLength(8192)), []),
}), v.check(row => row.fixed.length <= row.capacity.instances
  && row.fixed.every(part => part.lod0 < row.geometry.length && part.lod1 < row.geometry.length), 'Fixed batch slots fit their declaration'));
export type WorldSceneBatchRow = v.InferOutput<typeof WorldSceneBatchSchema>;
