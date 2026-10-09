/**
 * The sailboat (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; its builder was in src/shards/driftwood-isle/world/Boat.ts) — the
 * little low-poly dinghy you arrived in, moored beside Driftwood Isle's pier. Flat-shaded, vertex-coloured, no
 * textures. Three meshes: the hull (a solid, planked dinghy with its thwarts, mast and timbers, single-sided so it can't
 * shadow itself, the thin gear its child, which receives but never casts) and the sail + rigging (two-sided, casts,
 * never receives). ~2.3k triangles, 3 draw calls.
 *
 * Built in its own space, as it always was: the origin is the hull's waterline centre at rest, the bow toward −z. It is
 * placed `single` — it moves: the world rides it on the swell and runs its mooring lines to the pier
 * (src/shards/driftwood-isle/world/Boat.ts) — and its colliders ride it (`follows: 'copy'`): the four gunwale / bow / stern walls and the floor.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { BOAT_HULL_GEOMETRY, BOAT_SAIL_GEOMETRY, BOAT_GEAR_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

export const LENGTH = 6.4, BEAM = 2.2;
/** the floor boards' top over the waterline (own y): where you stand in it */
export const BOAT_FLOOR = 0.32;
export const BOAT_DECK_T = 0.105;

/** a hull station, bow (t = 0, −z) → transom (t = 1); y = 0 is the waterline */
export interface BoatStation { t: number; z: number; w: number; sheer: number; keel: number; floor: number }
export function boatStation(t: number): BoatStation {
  const W = BEAM / 2 - 0.03, FLOOR = BOAT_FLOOR, DECK_T = BOAT_DECK_T;
  const fore = Math.min(1, t / 0.42), aft = Math.max(0, (t - 0.55) / 0.45);
  const w = W * Math.sin(fore * Math.PI / 2) ** 0.85 * (1 - 0.3 * aft ** 1.5);
  const sheer = 0.7 + 0.46 * Math.max(0, 1 - t / 0.5) ** 2.2 + 0.2 * aft ** 2;
  const keel = -0.52 + 0.34 * Math.max(0, 1 - t / 0.35) ** 2 + 0.14 * aft ** 2;
  return { t, z: -LENGTH / 2 + t * LENGTH, w, sheer, keel, floor: t <= DECK_T ? sheer : FLOOR };
}

/** the bow and stern cleats the mooring lines start from, own space (z along the hull, y over the waterline) */
export const BOAT_CLEATS: readonly { readonly z: number; readonly y: number }[] =
  [-LENGTH / 2 + 0.3, LENGTH / 2 - 0.3].map((z) => ({ z, y: boatStation((z + LENGTH / 2) / LENGTH).sheer + 0.06 }));

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

/** Original three-mesh hierarchy and material/shadow policy; only geometry comes from the offline bake. */
function buildBoat(ctx: ModelContext): THREE.Group {
  const mesh = new THREE.Mesh(BOAT_HULL_GEOMETRY.copy(), lowPolyMaterial(ctx.sky, 'solid', (m) => { m.side = THREE.FrontSide; }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  const sail = new THREE.Mesh(BOAT_SAIL_GEOMETRY.copy(), lowPolyMaterial(ctx.sky));
  sail.castShadow = true; sail.receiveShadow = false;
  sail.customDepthMaterial = swayDepthMaterial();
  const gearMesh = new THREE.Mesh(BOAT_GEAR_GEOMETRY.copy(), lowPolyMaterial(ctx.sky));
  gearMesh.castShadow = false; gearMesh.receiveShadow = true;
  mesh.add(gearMesh);
  const group = new THREE.Group();
  group.add(mesh, sail);
  return group;
}

export const boat = defineModel<Record<string, never>>({
  id: 'driftwood-isle/boat', name: 'Sailboat', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/boat.ts', surface: 'planks',
  defaults: {},
  build: (ctx) => fixedGeometryReady() ? buildBoat(ctx) : loadingSpecimen('driftwood-isle/boat', [BEAM, 5.6, LENGTH], async () => {
    await loadFixedGeometry();
    return buildBoat(ctx);
  }),
  colliders: () => boatColliders(),
});
