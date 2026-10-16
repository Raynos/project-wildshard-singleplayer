/**
 * Driftwood Isle's three rock families as rows (E306 M0b, E315 M1: models on the contract, src/engine/models/model.ts).
 * Each is a rockKit rock read from the baked rock table (public/assets/models/driftwood-blender/geometry.bin), smooth
 * painted with moss on its crown; each copy has its own shape: its size and squash from its params, the rest from the
 * placement group's rng stream (the old loops' streams, so the baked recipes match).
 *
 * - shore boulder: beach granite along the water line (world/Boulders.ts), sunk a third into the sand; over 0.9 m it
 *   collides as the convex hull of what it draws.
 * - small rock: one detail step lighter (~400 in the cove, world/BlenderIsland.ts, each where the Blender rock it replaces
 *   stood), the ground line a little under the centre so a shallow rock is not all foot and AO; no colliders.
 * - reef rock: the cove's wet reef palette, squashed low, round the wreck (world/Wreck.ts) and on the cove flats
 *   (world/Cove.ts), welded into the site's smooth-shaded mesh.
 */
import type { Rng } from '@wildshard/engine/core/rng';
import { rockGeometry, rockMaterial, rockSpecimen, type RockOpts } from '../../world/rockKit';
import { REEF_ROCK, SHORE_ROCK } from '../const';
import { islandKnobs } from '../tiers';
import { defineModel, type ModelDef, type ModelPart, type ModelVariant } from '@wildshard/engine/models/model';

export interface ShoreBoulderParams { readonly r: number; readonly squash: number }
export interface SmallRockParams { readonly r: number; readonly sq: number }
export interface ReefRockParams { readonly r: number; readonly squash: number; readonly moss: number }

interface RockRow<P extends { readonly r: number }> {
  readonly id: string; readonly name: string; readonly seed: number; readonly defaults: P;
  readonly variants: readonly ModelVariant<P>[];
  /** the rock's paint options; moss read from the stream first, as the old loops did */
  readonly opts: (p: P, rng: Rng) => RockOpts;
  /** the tier's boulder-shadow knob decides its shadow (else it always casts) */
  readonly tierShadow?: true;
  readonly colliders?: ModelDef<P>['colliders'];
}

function rockModel<P extends { readonly r: number }>(row: RockRow<P>): ModelDef<P> {
  const id = `driftwood-isle/${row.id}`;
  const parts = (...[ctx, p, rng]: Parameters<ModelDef<P>['build']>): ModelPart[] => [{
    geometry: rockGeometry(p.r, rng, row.opts(p, rng)), material: rockMaterial(ctx.sky),
    castShadow: row.tierShadow === undefined || islandKnobs().boulderShadows, receiveShadow: true,
  }];
  return defineModel<P>({
    id, name: row.name, category: 'nature', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/shoreBoulder.ts', surface: 'rock',
    defaults: row.defaults, variants: row.variants, seed: row.seed, build: parts,
    specimen: (ctx, p, rng) => rockSpecimen(id, [p.r * 2, p.r * 2, p.r * 2], () => parts(ctx, p, rng)),
    ...(row.colliders === undefined ? {} : { colliders: row.colliders }),
  });
}

export const shoreBoulder = rockModel<ShoreBoulderParams>({
  id: 'shore-boulder', name: 'Shore boulder', seed: 0x5ea1 ^ 0x70c5, defaults: { r: 1.8, squash: 0.72 }, tierShadow: true,
  variants: [{ id: 'medium', label: 'Medium', params: {} }, { id: 'small', label: 'Small', params: { r: 0.8, squash: 0.7 } }, { id: 'big', label: 'Big', params: { r: 3.6, squash: 0.62 } }],
  opts: (p, rng) => ({ moss: rng.range(0.25, 0.85), squash: p.squash, palette: SHORE_ROCK, ground: -0.35 * p.r * p.squash }),
  colliders: (p) => (p.r > 0.9 ? [{ kind: 'drawn-hull' }] : []),
});
export const smallRock = rockModel<SmallRockParams>({
  id: 'small-rock', name: 'Small rock', seed: 0x5a11 ^ 0x70c8, defaults: { r: 0.35, sq: 0.7 },
  variants: [{ id: 'round', label: 'Round', params: {} }, { id: 'flat', label: 'Flat', params: { sq: 0.45 } }, { id: 'big', label: 'Big', params: { r: 0.6, sq: 0.8 } }],
  opts: (p, rng) => ({ moss: rng.range(0.3, 0.8), squash: p.sq, palette: SHORE_ROCK, ground: -0.25 * p.r * p.sq, detail: -1 }),
});
export const reefRock = rockModel<ReefRockParams>({
  id: 'reef-rock', name: 'Reef rock', seed: 0x5a11 ^ 0x70c5, defaults: { r: 1.2, squash: 0.62, moss: 0.9 },
  variants: [{ id: 'mossy', label: 'Mossy', params: {} }, { id: 'bare', label: 'Bare', params: { moss: 0.5 } }, { id: 'tall', label: 'Tall', params: { r: 0.9, squash: 0.95, moss: 0.3 } }],
  opts: (p) => ({ squash: p.squash, palette: REEF_ROCK, moss: p.moss, ground: -0.2 * p.r }),
});
