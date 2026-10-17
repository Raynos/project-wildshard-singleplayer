import { driftwoodRows } from '../boot/rows';
/**
 * The sailboat (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; its builder was in src/shards/driftwood-isle/world/Boat.ts) — the
 * little low-poly dinghy you arrived in, moored beside Driftwood Isle's pier. Flat-shaded, vertex-coloured, no
 * textures. Three meshes: the hull (a solid, planked dinghy with its thwarts, mast and timbers, single-sided so it can't
 * shadow itself), the thin gear (receives but never casts) and the sail + rigging (two-sided, casts,
 * never receives). ~2.3k triangles, 3 draw calls.
 *
 * Built in its own space, as it always was: the origin is the hull's waterline centre at rest, the bow toward −z. It is
 * placed `single` — it moves: the world rides it on the swell and runs its mooring lines to the pier
 * (src/shards/driftwood-isle/world/Boat.ts) — and its colliders ride it (`follows: 'copy'`): the four gunwale / bow / stern walls and the floor.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { libraryModel } from '@wildshard/game/models/libraryModel';
import { fixedGeometryReady, loadFixedGeometry, fixedDraw } from '../boot/blobAssets';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';

export const boatLayout = (): ReturnType<typeof driftwoodRows<'custom/fixedLayouts'>>['nativeView']['BOAT_LAYOUT'] => driftwoodRows('custom/fixedLayouts').nativeView.BOAT_LAYOUT;

const DRAWS = { hull: fixedDraw('boatHull'), sail: fixedDraw('boatSail'), gear: fixedDraw('boatGear') };

/** The hull (one-sided: it never shadows itself), the sail + rigging (casts, never receives) and the thin gear (receives,
 *  never casts); only the geometry comes from the offline bake. */
export const boat = defineModel<Record<string, never>>({
  id: 'driftwood-isle/boat', name: 'Sailboat', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/boat.ts', surface: 'planks',
  defaults: {},
  ...libraryModel<Record<string, never>, keyof typeof DRAWS, keyof typeof DRAWS>({
    draws: () => [{ draw: 'hull', material: 'hull', castShadow: true, receiveShadow: true }, { draw: 'sail', material: 'sail', castShadow: true },
      { draw: 'gear', material: 'gear', receiveShadow: true }],
    geometry: (_, draw) => DRAWS[draw].copy(),
    material: (ctx, key) => key === 'hull' ? lowPolyLookMaterial(ctx.sky, 'solid', (m) => { m.side = THREE.FrontSide; }) : lowPolyLookMaterial(ctx.sky, key === 'gear' ? 'still' : 'default'),
    colliders: () => structuredClone(driftwoodRows('custom/fixedLayouts').boat.colliders),
    loading: { id: 'driftwood-isle/boat', ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [boatLayout().beam, 5.6, boatLayout().length] },
  }),
});
