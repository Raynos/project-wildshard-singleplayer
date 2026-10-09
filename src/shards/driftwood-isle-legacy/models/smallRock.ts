/**
 * The small rock (E306 / E315 M1: a model on the contract, src/engine/models/model.ts): a rockKit rock in beach granite, one
 * detail step lighter than the shore boulder (there are ~400 of them), moss on its crown. It stands where the Blender
 * cove scattered its small rocks (E114: each as wide and as tall as the Blender rock it replaces, at that rock's spot,
 * tilt and turn — src/shards/driftwood-isle/world/BlenderIsland.ts turns them into placements) and the cove's copies are merged into one mesh.
 * Each copy has its own shape: its size and squash are its params, the rest the placement group's rng stream (the old
 * loop's, so the move is exact). No colliders: you step over them.
 */
import { rockGeometry, rockMaterial, SHORE_ROCK } from '../world/rockKit';
import { defineModel } from '@wildshard/engine/models/model';

export interface SmallRockParams {
  /** radius, metres */
  readonly r: number;
  /** height over width */
  readonly sq: number;
}

export const smallRock = defineModel<SmallRockParams>({
  id: 'driftwood-isle/small-rock', name: 'Small rock', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/smallRock.ts', surface: 'rock',
  defaults: { r: 0.35, sq: 0.7 },
  variants: [
    { id: 'round', label: 'Round', params: {} },
    { id: 'flat', label: 'Flat', params: { sq: 0.45 } },
    { id: 'big', label: 'Big', params: { r: 0.6, sq: 0.8 } },
  ],
  seed: 0x5a11 ^ 0x70c8,
  // the paint's ground line a little under the centre, as on the shore boulders: these sit only ~0.1 m deep, and a
  // ground line that high put nearly all of a small rock in the foot's dark and the ground's AO (they drew black)
  build: (ctx, p, rng) => [{
    geometry: rockGeometry(p.r, rng, { squash: p.sq, palette: SHORE_ROCK, moss: rng.range(0.3, 0.8), ground: -0.25 * p.r * p.sq, detail: -1 }),
    material: rockMaterial(ctx.sky), castShadow: true, receiveShadow: true,
  }],
});
