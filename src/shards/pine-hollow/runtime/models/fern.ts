/**
 * Fern (E315 M2): Ferns in the shaded floor, along the trail verges and round the pond: nine arched frond quads in a rosette, a procedural pinnate-leaf alpha texture; they cast shadows where the tier does.
 * Built in code by the forest floor's field (src/shards/pine-hollow/world/undergrowth.ts: its geometry, texture and shader material); `place`
 * draws every copy in one InstancedMesh, culled per 32 m cell round the forest's view (../world/drawnModels.ts), and the
 * field's shader fades them past the tier's range and sways them. The Explorer's specimen wears a plain material.
 * Walked through: no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

export const fern = defineModel<Record<string, never>>({
  id: 'pine-hollow/fern', name: 'Fern', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/fern.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'ferns'),
  specimen: (ctx) => underSpecimen(ctx, 'ferns'),
});
