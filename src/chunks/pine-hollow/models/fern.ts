/**
 * Fern (E315 M2): Ferns in the shaded floor, along the trail verges and round the pond: nine arched frond quads in a rosette, a procedural pinnate-leaf alpha texture; they cast shadows where the tier does.
 * Built in code by the forest floor's field (src/world/Undergrowth.ts) and drawn by it — one InstancedMesh for every
 * copy, culled per 32 m cell round the forest's view, faded past the tier's range, swayed in the shader — so `place`
 * is told the copies are drawn already (`drawnInto`). Walked through: no collider.
 */
import { defineModel } from '../../../models/model';
import { underPart } from '../world/undergrowthKit';

export const fern = defineModel<Record<string, never>>({
  id: 'pine-hollow/fern', name: 'Fern', category: 'nature', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/fern.ts',
  defaults: {},
  build: (ctx) => underPart(ctx, 'ferns'),
});
