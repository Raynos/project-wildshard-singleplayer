/**
 * Bilberry shrub (E315 M2): Low round-leaf bilberry shrubs at the floor's and the grass's edges: four crossed quads, a round-leaf texture.
 * Built in code by the forest floor's field (src/world/Undergrowth.ts) and drawn by it — one InstancedMesh for every
 * copy, culled per 32 m cell round the forest's view, faded past the tier's range, swayed in the shader — so `place`
 * is told the copies are drawn already (`drawnInto`). Walked through: no collider.
 */
import { defineModel } from '../../../models/model';
import { underPart } from '../world/undergrowthKit';

export const shrub = defineModel<Record<string, never>>({
  id: 'pine-hollow/bilberry-shrub', name: 'Bilberry shrub', category: 'nature', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/shrub.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'shrubs'),
});
