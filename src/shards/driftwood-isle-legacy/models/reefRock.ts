/**
 * The reef rock (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts): a rockKit rock in the
 * cove's wet reef palette (E114: smooth painted, E310 T2 B), squashed low, moss on its crown. They stand in the water
 * round the wreck (src/shards/driftwood-isle/world/Wreck.ts) and on the cove flats (src/shards/driftwood-isle/world/Cove.ts). Each copy has its own shape: its
 * radius, squash and moss are its params, the rest the stream of the world that lays it — which welds its copies into
 * one smooth-shaded mesh (their normals can't join the flat-shaded kits) and places the model `drawnInto` it.
 */
import { rockGeometry, rockMaterial, REEF_ROCK } from '../world/rockKit';
import { defineModel } from '@wildshard/engine/models/model';

export interface ReefRockParams {
  /** radius, metres */
  readonly r: number;
  /** height over width */
  readonly squash: number;
  /** 0 … 1 moss on the crown */
  readonly moss: number;
}

export const reefRock = defineModel<ReefRockParams>({
  id: 'driftwood-isle/reef-rock', name: 'Reef rock', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reefRock.ts', surface: 'rock',
  defaults: { r: 1.2, squash: 0.62, moss: 0.9 },
  variants: [
    { id: 'mossy', label: 'Mossy', params: {} }, { id: 'bare', label: 'Bare', params: { moss: 0.5 } },
    { id: 'tall', label: 'Tall', params: { r: 0.9, squash: 0.95, moss: 0.3 } },
  ],
  seed: 0x5a11 ^ 0x70c5,
  build: (ctx, p, rng) => [{
    geometry: rockGeometry(p.r, rng, { squash: p.squash, palette: REEF_ROCK, moss: p.moss, ground: -0.2 * p.r }),
    material: rockMaterial(ctx.sky), castShadow: true, receiveShadow: true,
  }],
});
