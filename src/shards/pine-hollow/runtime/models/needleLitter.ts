/**
 * Needle litter (E315 M2): Twig and needle litter lying flat under the trees: one ground quad, a litter alpha texture.
 * Built in code by the forest floor's field (src/shards/pine-hollow/world/undergrowth.ts: its geometry, texture and shader material); `place`
 * draws every copy in one InstancedMesh, culled per 32 m cell round the forest's view (../world/drawnModels.ts), and the
 * field's shader fades them past the tier's range and sways them. The Explorer's specimen wears a plain material.
 * Walked through: no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

export const needleLitter = defineModel<Record<string, never>>({
  id: 'pine-hollow/needle-litter', name: 'Needle litter', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/needleLitter.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'litter'),
  specimen: (ctx) => underSpecimen(ctx, 'litter'),
});
