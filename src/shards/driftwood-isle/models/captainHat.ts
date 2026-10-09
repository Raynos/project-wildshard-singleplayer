/**
 * The Drowned Captain's hat (E314, project/archive/2026-09-30-driftwood-loot.md: the captain's trophy, worn — board 4 C — and a GEAR
 * cosmetic): a black felt tricorne with a gold-braided brim, a faded red cockade on the front-left, and a strand of kelp
 * still hanging off its right-hand corner from the wreck. The brim is one sheet turned up steeply between its three
 * points (front, back-left, back-right) and nearly flat at them, so its silhouette — and its shadow — reads as a
 * tricorne from any side.
 *
 * One mesh, one draw on the island's shared low-poly material. The kelp sways in the island's wind (the kit's `sway`,
 * vertex shader only). It is the world pickup too (it sits level on its crown's rim and brim points) and what the
 * player wears: src/engine/player/Cosmetics.ts hangs it on the player's head socket.
 *
 * Own space: the origin is the centre of the head band (the crown's bottom rim), +Y up, the front point toward +Z.
 * About 0.48 m across the points, 0.13 m tall. No colliders (a pickup is a trigger, not a solid).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { HAT_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

/** A fresh copy of the admitted offline hat; scaling never changes the shared template. */
export function captainHatGeometry(): THREE.BufferGeometry { return HAT_GEOMETRY.copy(); }

/** the hat as one mesh (a pickup, a specimen, the worn hat) */
export function buildCaptainHat(ctx: ModelContext): THREE.Mesh {
  const m = new THREE.Mesh(captainHatGeometry(), lowPolyMaterial(ctx.sky));
  m.name = 'captain-hat';
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = swayDepthMaterial();
  return m;
}

export interface CaptainHatParams {
  /** uniform size (1 = the player's; the captain wears his at his own scale) */
  readonly size: number;
}

export const captainHat = defineModel<CaptainHatParams>({
  id: 'driftwood-isle/captain-hat', name: "Captain's hat", category: 'gear', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/captainHat.ts', surface: 'felt',
  defaults: { size: 1 },
  build: (ctx, p): readonly ModelPart[] | THREE.Object3D => fixedGeometryReady() ? [{
    geometry: ctx.once(`captain-hat:${p.size}`, () => (p.size === 1 ? captainHatGeometry() : captainHatGeometry().scale(p.size, p.size, p.size))),
    material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true, customDepthMaterial: swayDepthMaterial(),
  }] : loadingSpecimen('driftwood-isle/captain-hat', [0.48 * p.size, 0.13 * p.size, 0.48 * p.size], async () => {
    await loadFixedGeometry();
    const mesh = buildCaptainHat(ctx);
    if (p.size !== 1) mesh.geometry.scale(p.size, p.size, p.size);
    return mesh;
  }),
});
