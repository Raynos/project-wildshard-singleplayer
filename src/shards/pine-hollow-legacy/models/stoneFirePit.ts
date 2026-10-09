/**
 * Stone fire pit (E315 M2): Poly Haven's CC0 `stone_fire_pit` scan, ringed with charred logs in front of the cabins that have one, its fire lit on the clock. Dressed and drawn by each building that has one
 * (src/engine/world/Cabin.ts), so `place` is told the copies are drawn already (`drawnInto`).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { dressedCopy } from '../world/cabinKit';

export const stoneFirePit = defineModel<Record<string, never>>({
  id: 'pine-hollow/stone-fire-pit', name: 'Stone fire pit', category: 'props', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/stoneFirePit.ts',
  defaults: {},
  build: (ctx) => dressedCopy(ctx, 'firePit'),
});
