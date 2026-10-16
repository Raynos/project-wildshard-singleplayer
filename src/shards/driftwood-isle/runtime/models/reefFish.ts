/**
 * The reef fish (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; it was built inside src/shards/driftwood-isle/world/Seabed.ts):
 * a small faceted fish — a flattened diamond body (8 tris) and a tail fin (2), nose along −z, ~0.35 m long, baked offline
 * (generators/reefFish.ts, the fixed-model template `reef-fish`) — on the kit's
 * still material, its colour per copy (instanceColor). The lagoon places a school of them instanced (one draw) over
 * its densest reef and swims them on an ambient flock wheel every frame (src/shards/driftwood-isle/world/Seabed.ts).
 */
import { defineModel, type ModelPart } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { REEF_FISH_GEOMETRY, loadFixedGeometry } from '../boot/fixedGeometry';

/** the fish's colours: each copy takes one (Placement.color) */
export const REEF_FISH_COLOURS = [0xffb347, 0x4fc3f7, 0xf06292, 0xfff176] as const;

export const reefFish = defineModel<Record<string, never>>({
  id: 'driftwood-isle/reef-fish', name: 'Reef fish', category: 'creatures', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/reefFish.ts',
  prepare: loadFixedGeometry,
  defaults: {},
  build: (ctx): readonly ModelPart[] => [{ geometry: ctx.once('driftwood-isle/reef-fish', () => REEF_FISH_GEOMETRY.copy()), material: lowPolyLookMaterial(ctx.sky, 'still') }],
});
