/**
 * Moss patch (E315 M2): Soft mottled moss patches hugging the trunks' feet: one ground quad, a moss alpha texture.
 * Built in code by the forest floor's field (src/world/Undergrowth.ts) and drawn by it — one InstancedMesh for every
 * copy, culled per 32 m cell round the forest's view, faded past the tier's range, swayed in the shader — so `place`
 * is told the copies are drawn already (`drawnInto`). Walked through: no collider.
 */
import { defineModel } from '../../../models/model';
import { underPart } from '../world/undergrowthKit';

export const moss = defineModel<Record<string, never>>({
  id: 'pine-hollow/moss-patch', name: 'Moss patch', category: 'nature', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/moss.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'moss'),
});
