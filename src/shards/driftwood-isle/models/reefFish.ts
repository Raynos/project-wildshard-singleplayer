/**
 * The reef fish (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; it was built inside src/shards/driftwood-isle/world/Seabed.ts):
 * a small faceted fish — a flattened diamond body (8 tris) and a tail fin (2), nose along −z, ~0.35 m long, baked offline
 * (generators/reefFish.ts, the fixed-model template `reef-fish`) — on the kit's
 * still material, its colour per copy (instanceColor). The lagoon places a school of them instanced (one draw) over
 * its densest reef and swims them round a lissajous loop every frame (src/shards/driftwood-isle/world/Seabed.ts).
 */
import * as THREE from 'three';
import { defineModel, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { REEF_FISH_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../runtime/boot/fixedGeometry';

/** the fish's colours: each copy takes one (Placement.color) */
export const REEF_FISH_COLOURS = [0xffb347, 0x4fc3f7, 0xf06292, 0xfff176] as const;

export const reefFish = defineModel<Record<string, never>>({
  id: 'driftwood-isle/reef-fish', name: 'Reef fish', category: 'creatures', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reefFish.ts',
  defaults: {},
  // the baked fish (generators/reefFish.ts), a fixed-model template; a loading box until the island's templates are in
  build: (ctx) => {
    const part = (): ModelPart => ({ geometry: ctx.once('driftwood-isle/reef-fish', () => REEF_FISH_GEOMETRY.copy()), material: lowPolyLookMaterial(ctx.sky, 'still') });
    if (fixedGeometryReady()) return [part()];
    return loadingSpecimen('driftwood-isle/reef-fish', [0.07, 0.14, 0.42], async () => {
      await loadFixedGeometry(); const made = part(); return new THREE.Mesh(made.geometry, made.material);
    });
  },
});
