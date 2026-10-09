/**
 * The sailcloth cape (E314, project/archive/2026-09-30-driftwood-loot.md: a shop good, look only, and a GEAR cosmetic): a short cape cut
 * from an old sail — weathered canvas panels with a darker seam between them, a stitched-on patch, a faded red stripe
 * above a ragged hem — tied at the throat with a length of rope. It wraps round the shoulders and falls open and
 * flatter to the knees, with soft pleats that deepen toward the hem.
 *
 * One mesh, one draw on the island's shared low-poly material, ~130 triangles. The cloth sways in the island's one wind in
 * the vertex shader (the kit's `sway`: still at the shoulders, most at the hem; nothing runs per frame) and its shadow
 * sways with it (swayDepthMaterial). src/engine/player/Cosmetics.ts hangs it on the player's shoulder socket.
 *
 * Own space: the wearer's axis is x = 0, z = 0, the wearer faces +Z (the cape hangs behind, at −z); y = 0 is the hem's
 * lowest line and the neck is at CAPE_H. No colliders.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { CAPE_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

/** A fresh copy of the admitted cape; worn/specimen scaling never changes its template. */
export function sailclothCapeGeometry(): THREE.BufferGeometry { return CAPE_GEOMETRY.copy(); }

/** the cape as one mesh (a specimen, the worn cape) */
export function buildSailclothCape(ctx: ModelContext): THREE.Mesh {
  const m = new THREE.Mesh(sailclothCapeGeometry(), lowPolyMaterial(ctx.sky));
  m.name = 'sailcloth-cape';
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = swayDepthMaterial();
  return m;
}

export interface SailclothCapeParams {
  /** uniform size (1 = the player's) */
  readonly size: number;
}

export const sailclothCape = defineModel<SailclothCapeParams>({
  id: 'driftwood-isle/sailcloth-cape', name: 'Sailcloth cape', category: 'gear', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/sailclothCape.ts', surface: 'felt',
  defaults: { size: 1 },
  specimenYaw: Math.PI, // the Explorer opens on its outside (the back)
  build: (ctx, p): readonly ModelPart[] | THREE.Object3D => fixedGeometryReady() ? [{
    geometry: ctx.once(`sailcloth-cape:${p.size}`, () => (p.size === 1 ? sailclothCapeGeometry() : sailclothCapeGeometry().scale(p.size, p.size, p.size))),
    material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true, customDepthMaterial: swayDepthMaterial(),
  }] : loadingSpecimen('driftwood-isle/sailcloth-cape', [0.7 * p.size, p.size, 0.4 * p.size], async () => {
    await loadFixedGeometry();
    const mesh = buildSailclothCape(ctx);
    if (p.size !== 1) mesh.geometry.scale(p.size, p.size, p.size);
    return mesh;
  }),
});
