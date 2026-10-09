/**
 * Hatchet (E315 M2): Poly Haven's CC0 `hatchet` scan, set about the cabins and the hamlet by their builders (by the
 * doors, under the eaves, on the porches and the tables). Drawn by the homestead — one InstancedMesh per scan part across
 * the three cabins (only the cabins in detail range), the hamlet's own — so `place` is told the copies are drawn already
 * (`drawnInto`). No collider of its own: it sits in its chopping block's (its building's).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { propPart } from '../world/cabinKit';

export const hatchet = defineModel<Record<string, never>>({
  id: 'pine-hollow/hatchet', name: 'Hatchet', category: 'props', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/hatchet.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => propPart(ctx, 'hatchet'),
});
