/**
 * The shore boulder (E306 M0b: the first model on the contract, src/engine/models/model.ts). A rockKit rock in beach granite,
 * smooth-painted with moss on the crown. Each copy has its own shape: the size and squash come from its params, the
 * rest from the placement group's rng stream (the old Boulders.build loop's stream, so the move is bit-identical).
 * Its placement sinks it about a third into the sand and leans it with the slope (src/shards/driftwood-isle/world/Boulders.ts). A rock over
 * 0.9 m collides as the convex hull of what it draws; the small ones stay walk-through.
 */
import { rockGeometry, rockMaterial, SHORE_ROCK } from '../world/rockKit';
import { islandKnobs } from '../tiers';
import { defineModel } from '@wildshard/engine/models/model';

export interface ShoreBoulderParams {
  /** radius, metres */
  readonly r: number;
  /** height over width */
  readonly squash: number;
}

export const shoreBoulder = defineModel<ShoreBoulderParams>({
  id: 'driftwood-isle/shore-boulder', name: 'Shore boulder', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/shoreBoulder.ts', surface: 'rock',
  defaults: { r: 1.8, squash: 0.72 },
  variants: [
    { id: 'medium', label: 'Medium', params: {} },
    { id: 'small', label: 'Small', params: { r: 0.8, squash: 0.7 } },
    { id: 'big', label: 'Big', params: { r: 3.6, squash: 0.62 } },
  ],
  seed: 0x5ea1 ^ 0x70c5,
  // the order the old loop drew in: the moss first, then the rock's own shape
  build: (ctx, p, rng) => [{
    geometry: rockGeometry(p.r, rng, { squash: p.squash, palette: SHORE_ROCK, moss: rng.range(0.25, 0.85), ground: -0.35 * p.r * p.squash }),
    material: rockMaterial(ctx.sky), castShadow: islandKnobs().boulderShadows, receiveShadow: true,
  }],
  colliders: (p) => (p.r > 0.9 ? [{ kind: 'drawn-hull' }] : []),
});
