/**
 * Porch lantern (E315 M2): Poly Haven's CC0 `Lantern_01` scan, hung on its iron bracket by the door, swinging in the wind, its glass lit on the clock (its brass rebuilt plain: the scan's tangents bloomed NaNs). Dressed and drawn by each building that has one
 * (src/engine/world/Cabin.ts), so `place` is told the copies are drawn already (`drawnInto`).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { dressedCopy } from '../world/cabinKit';

export const porchLantern = defineModel<Record<string, never>>({
  id: 'pine-hollow/porch-lantern', name: 'Porch lantern', category: 'props', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/porchLantern.ts',
  defaults: {},
  build: (ctx) => dressedCopy(ctx, 'lantern'),
});
