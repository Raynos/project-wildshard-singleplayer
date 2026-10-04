/**
 * Wine barrel (E315 M2): Poly Haven's CC0 `wine_barrel_01` scan, set about the cabins and the hamlet by their builders (by the
 * doors, under the eaves, on the porches and the tables). Drawn by the homestead — one InstancedMesh per scan part across
 * the three cabins (only the cabins in detail range), the hamlet's own — so `place` is told the copies are drawn already
 * (`drawnInto`). Each copy collides as its own box, the scan's bounds (`propBox`, E315).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { propBox, propPart } from '../world/cabinKit';

export const wineBarrel = defineModel<Record<string, never>>({
  id: 'pine-hollow/wine-barrel', name: 'Wine barrel', category: 'props', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/wineBarrel.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => propPart(ctx, 'barrel'),
  colliders: () => propBox('barrel'),
});
