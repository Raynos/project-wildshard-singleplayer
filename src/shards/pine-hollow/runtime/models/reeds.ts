/**
 * Reeds (E315 M2): Reed and sedge clumps on the pond's shore and in its shallows: tall thin blades, 0.8–1.2 m.
 * Built in code by the forest floor's field (src/shards/pine-hollow/world/undergrowth.ts: its geometry, texture and shader material); `place`
 * draws every copy in one InstancedMesh, culled per 32 m cell round the forest's view (../world/drawnModels.ts), and the
 * field's shader fades them past the tier's range and sways them. The Explorer's specimen wears a plain material.
 * Walked through: no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

export const reeds = defineModel<Record<string, never>>({
  id: 'pine-hollow/reeds', name: 'Reeds', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/reeds.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'reeds'),
  specimen: (ctx) => underSpecimen(ctx, 'reeds'),
});
