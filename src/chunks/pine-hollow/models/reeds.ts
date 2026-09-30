/**
 * Reeds (E315 M2): Reed and sedge clumps on the pond's shore and in its shallows: tall thin blades, 0.8–1.2 m.
 * Built in code by the forest floor's field (src/world/Undergrowth.ts) and drawn by it — one InstancedMesh for every
 * copy, culled per 32 m cell round the forest's view, faded past the tier's range, swayed in the shader — so `place`
 * is told the copies are drawn already (`drawnInto`). Walked through: no collider.
 */
import { defineModel } from '../../../models/model';
import { underPart } from '../world/undergrowthKit';

export const reeds = defineModel<Record<string, never>>({
  id: 'pine-hollow/reeds', name: 'Reeds', category: 'nature', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/reeds.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'reeds'),
});
