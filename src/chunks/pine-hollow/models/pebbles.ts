/**
 * Pebbles (E315 M2): Dark pebble clusters lying flat on the forest floor: one ground quad, a pebble texture.
 * Built in code by the forest floor's field (src/world/Undergrowth.ts) and drawn by it — one InstancedMesh for every
 * copy, culled per 32 m cell round the forest's view, faded past the tier's range, swayed in the shader — so `place`
 * is told the copies are drawn already (`drawnInto`). Walked through: no collider.
 */
import { defineModel } from '../../../models/model';
import { underPart } from '../world/undergrowthKit';

export const pebbles = defineModel<Record<string, never>>({
  id: 'pine-hollow/pebbles', name: 'Pebbles', category: 'nature', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/pebbles.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'stones'),
});
