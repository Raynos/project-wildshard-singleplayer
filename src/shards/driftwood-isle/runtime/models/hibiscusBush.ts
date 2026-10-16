/**
 * The hibiscus bush (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; it was src/world/bushKit.ts) —
 * Driftwood Isle's LEAF CLUMP the user picked (E116, 2026-09-25): a dark welded core wrapped in 50 (phone) / 90 broad
 * folded leaves (6 tris each) fanning up and out, the palms' frond language at bush scale; flat-shaded on the shared
 * lowPolyLookMaterial (no program of its own); dark inside → sunlit tips. ~350 tris a bush on the phone.
 *
 *   Every flowering bush (the scatter's 28 %) wears 4–7 five-petal hibiscus (18 tris: rounded cupped petals, dark
 *   throat, yellow stamen; red mostly, deep red / pink / coral per bush) and 2–3 closed buds, facing out and up.
 *
 * Built in its own space, its base at the origin: one non-indexed part (position, color, flat normals, aSway). Every
 * copy has its own shape from the placement group's rng stream (the old Bushes.build loop's, so the move is exact);
 * `aSway` (the M5 wind, wind.ts) rises from the ground to the crown, its phase set by the world from where the bush
 * stands (src/shards/driftwood-isle/world/Bushes.ts). No colliders: you walk through bushes.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { islandKnobs } from '../../tiers';
import { copyHibiscusVariant, loadHibiscusVariants, hibiscusVariantsReady } from '../boot/hibiscusGeometry';
import { loadingSpecimen } from '@wildshard/engine/models/gear';

/** one bush: its radius (0.7–1.5 m), whether it is in flower, and its sway's phase (the world's: from where it stands) */
export interface HibiscusBushParams { readonly r: number; readonly flowers: boolean; readonly phase: number }

// ── the model ─────────────────────────────────────────────────────────────────────────────────────

export const hibiscusBush = defineModel<HibiscusBushParams>({
  id: 'driftwood-isle/hibiscus-bush', name: 'Hibiscus bush', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/hibiscusBush.ts',
  defaults: { r: 1.3, flowers: true, phase: 0 },
  variants: [
    { id: 'flowering', label: 'In flower', params: {} },
    { id: 'leaf', label: 'Leaf only', params: { flowers: false } },
    { id: 'small', label: 'Small', params: { r: 0.8 } },
  ],
  seed: 0x5ea1 ^ 0xb5 ^ 0xe116,
  // the shared kit material (no program of its own) and the swaying shadow pass; the shadows are the tier's call
  prepare: loadHibiscusVariants,
  build: (ctx, p) => hibiscusVariantsReady() ? [{ geometry: copyHibiscusVariant(p), material: lowPolyLookMaterial(ctx.sky), castShadow: islandKnobs().bushShadows, receiveShadow: true }] : loadingSpecimen('driftwood-isle/hibiscus-bush', [p.r * 2, p.r * 2, p.r * 2], async () => {
    await loadHibiscusVariants();
    const mesh = new THREE.Mesh(copyHibiscusVariant(p), lowPolyLookMaterial(ctx.sky));
    mesh.castShadow = islandKnobs().bushShadows; mesh.receiveShadow = true; return mesh;
  }),
});
