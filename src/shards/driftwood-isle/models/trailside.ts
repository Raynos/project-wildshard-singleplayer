/**
 * The trail dressing's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Trailside.ts): the rope-fence POST (a thick weathered piling with a rope lashing under its cap), the
 * SIGNPOST (a post with an arrow board per direction, stacked, each lettered with the place it points to — E318) and the
 * PLANK STEP let into a climb. Flat-shaded vertex colour, per-face jitter from the stream they are handed.
 *
 * Each builds in its own space, its foot at the origin: the trail (src/shards/driftwood-isle/world/Trailside.ts) builds them in its layout's
 * order from ONE rng stream, between the geometry that is the trail's own (the ropes sagging between the posts, the
 * steps' side rails, the trestle stairs), welds everything into one mesh (one draw, as before) and places each model
 * `drawnInto` it. The posts and signposts collide as the boxes they always had (own space, carried to each placement).
 */
import type * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { trailSpecimen } from '../runtime/boot/trailSpecimens';

/** the trail's one material (the dressing and the trail's own geometry share it: one draw) */
export function trailMaterial(ctx: ModelContext): THREE.Material { return ctx.once('driftwood-isle/trail:material', () => lowPolyLookMaterial(ctx.sky, 'still')); }

export const fencePost = defineModel<Record<string, never>>({
  id: 'driftwood-isle/fence-post', name: 'Fence post', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: {},
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, _p) => trailSpecimen('fence-post', {}, trailMaterial(ctx)),
  // from 1 m under the ground to its cap (the legacy box)
  colliders: () => [{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 0.16, hy: 1.1, hz: 0.16 }],
});

export interface SignpostParams {
  /** the arrow boards, top down: each points this way (radians about +Y, 0 = +z: world (sin, cos)) */
  readonly arrows: readonly number[];
  /** each board's lettering, top down (E318: Jake, "letter them" — a blank board is a placeholder); '' or none = blank */
  readonly labels?: readonly string[];
}

export const signpost = defineModel<SignpostParams>({
  id: 'driftwood-isle/signpost', name: 'Signpost', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { arrows: [-1.27, 0.35], labels: ['HUT', 'LOOKOUT'] },
  variants: [{ id: 'two', label: 'Two arrows', params: {} }, { id: 'one', label: 'One arrow', params: { arrows: [1.2], labels: ['WRECK'] } }, { id: 'three', label: 'Three arrows', params: { arrows: [0.45, 0.75, -0.87], labels: ['LOOKOUT', 'WRECK', 'SHRINE'] } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p) => trailSpecimen('signpost', p, trailMaterial(ctx)),
  colliders: () => [{ kind: 'box', x: 0, y: 0.7, z: 0, hx: 0.12, hy: 1.7, hz: 0.12 }],
});

export interface PlankStepParams {
  /** width across the climb, metres */
  readonly w: number;
  /** its roll with the ground across it, radians (E118) */
  readonly roll: number;
  /** which way the climb runs, radians about +Y */
  readonly yaw: number;
  readonly dark: boolean;
}

export const plankStep = defineModel<PlankStepParams>({
  id: 'driftwood-isle/plank-step', name: 'Plank step', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { w: 2.4, roll: 0, yaw: 0, dark: false },
  variants: [{ id: 'light', label: 'Light', params: {} }, { id: 'dark', label: 'Dark', params: { dark: true } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p) => trailSpecimen('plank-step', p, trailMaterial(ctx)),
});
