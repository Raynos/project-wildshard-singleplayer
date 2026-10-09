/**
 * Pebbles (E315 M2): Dark pebble clusters lying flat on the forest floor: one ground quad, a pebble texture.
 * Built in code by the forest floor's field (src/shards/pine-hollow/world/undergrowth.ts: its geometry, texture and shader material); `place`
 * draws every copy in one InstancedMesh, culled per 32 m cell round the forest's view (../world/drawnModels.ts), and the
 * field's shader fades them past the tier's range and sways them. The Explorer's specimen wears a plain material.
 * Walked through: no collider.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

export const pebbles = defineModel<Record<string, never>>({
  id: 'pine-hollow/pebbles', name: 'Pebbles', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/pebbles.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'stones'),
  specimen: (ctx) => underSpecimen(ctx, 'stones'),
});
