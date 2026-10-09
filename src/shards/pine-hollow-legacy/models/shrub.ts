/**
 * Bilberry shrub (E315 M2): Low round-leaf bilberry shrubs at the floor's and the grass's edges: four crossed quads, a round-leaf texture.
 * Built in code by the forest floor's field (src/shards/pine-hollow/world/undergrowth.ts: its geometry, texture and shader material); `place`
 * draws every copy in one InstancedMesh, culled per 32 m cell round the forest's view (../world/drawnModels.ts), and the
 * field's shader fades them past the tier's range and sways them. The Explorer's specimen wears a plain material.
 * Walked through: no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

export const shrub = defineModel<Record<string, never>>({
  id: 'pine-hollow/bilberry-shrub', name: 'Bilberry shrub', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/shrub.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'shrubs'),
  specimen: (ctx) => underSpecimen(ctx, 'shrubs'),
});
