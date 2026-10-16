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
import { BOAT_HULL_GEOMETRY, BOAT_SAIL_GEOMETRY, BOAT_GEAR_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { BOAT_LAYOUT } from '../const';

export const LENGTH = BOAT_LAYOUT.length, BEAM = BOAT_LAYOUT.beam;
/** the floor boards' top over the waterline (own y): where you stand in it */
export const BOAT_FLOOR = BOAT_LAYOUT.floor;

/**
 * PHYSICS P4, own space: the four gunwale / bow / stern walls (they keep you in the boat once you're in, and keep a
 * swimmer out of the hull; from the pier deck you step over them) and the floor boards as a slab whose top is the
 * floor, widened to the walls' inner faces so the tub is closed. A kinematic body re-poses them every step.
 */
export function boatColliders(): ColliderDesc[] {
  const yTop = 0.8, yBottom = -1.2, wy = (yTop + yBottom) / 2, wh = (yTop - yBottom) / 2, t = 0.08;
  const wall = (x: number, z: number, hx: number, hz: number): ColliderDesc => ({ kind: 'box', x, y: wy, z, hx, hy: wh, hz });
  const floorTop = BOAT_FLOOR, fh = 0.1;
  return [
    wall(-BEAM / 2, 0, t, LENGTH / 2), wall(BEAM / 2, 0, t, LENGTH / 2), wall(0, -LENGTH / 2, BEAM / 2, t), wall(0, LENGTH / 2, BEAM / 2, t),
    { kind: 'box', x: 0, y: floorTop - fh, z: 0, hx: BEAM / 2 - t, hy: fh, hz: LENGTH / 2 - t },
  ];
}

const DRAWS = { hull: BOAT_HULL_GEOMETRY, sail: BOAT_SAIL_GEOMETRY, gear: BOAT_GEAR_GEOMETRY };

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
    colliders: () => boatColliders(),
    loading: { id: 'driftwood-isle/boat', ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [BEAM, 5.6, LENGTH] },
  }),
});
