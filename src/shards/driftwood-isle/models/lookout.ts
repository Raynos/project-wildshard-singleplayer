/**
 * The lookout tower (E306 / E315 M1: a model on the contract, src/engine/models/model.ts) — the watchtower on Driftwood
 * Isle's headland summit: four splayed log posts with X-bracing, a plank platform with a braced railing, a layered thatch
 * roof, the blue Wildshard banner swaying from the platform's front, a straight stair with rope handrails and a zipline
 * post facing the sea cave (generators/lookout.ts describes it). It is a fixed bake (SHARD-PLATFORM M3, G285): the
 * builder runs offline where the tower stands, over the native terrain, and the page reads back its geometry
 * (baked/fixed-models/lookout.glb, one LowPolyKit mesh with the banner's sway channel) and its layout
 * (data/lookoutBake.json: the legacy boxes, the physics descriptors, the anchors and the floor), all in own space — the
 * origin is the tower's centre on the ground, the stair descending local −z turned by the site's `rot`. A changed site
 * or zipline target needs a rebake (src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs); `lookoutLayout` refuses one it was not
 * baked for.
 *
 * Anchors (own space, y = platform unless noted, yaw = facing, 0 = +Z): beacon (the back-right corner of the platform),
 * shard (the back-left corner), zipTop (the zipline post's foot on the platform corner facing the cave, yaw = toward
 * it; the cable leaves the pulley 2.5 m above it), stairFoot (y = ground).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { libraryModel } from '@wildshard/game/models/libraryModel';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import bake from '../data/lookoutBake.json' with { type: 'json' };
import { LOOKOUT_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

/** Where a lookout stands: its centre (world xz) and which side its stair descends toward (rot, radians). */
export interface LookoutSite { readonly x: number; readonly z: number; readonly rot: number }
/** A named spot of the tower (own space, y = platform unless noted, yaw = facing, 0 = +Z). */
export interface LookoutAnchor { x: number; y: number; z: number; yaw: number }
/** Where the tower stands and the world point its zipline pulley faces (the sea cave). */
export interface LookoutPlacement { readonly site: LookoutSite; readonly zipTo: { readonly x: number; readonly z: number } }

/** The tower's layout (own space): its legacy boxes, physics descriptors, anchors, platform y and the floor under a point. */
export interface LookoutLayout {
  readonly colliders: Collider[];
  readonly anchors: Record<string, LookoutAnchor>;
  readonly platformY: number;
  readonly colliderDescs: () => ReturnType<typeof readColliderRows>;
  readonly floorHeightAt: (x: number, z: number) => number | undefined;
}

const baked = (p: LookoutPlacement): boolean => p.site.x === bake.site.x && p.site.z === bake.site.z && p.site.rot === bake.site.rot && p.zipTo.x === bake.zipTo.x && p.zipTo.z === bake.zipTo.z;

/** The baked site's origin: its centre on the ground (world). */
export function lookoutOrigin(p: LookoutPlacement): { x: number; y: number; z: number } {
  if (!baked(p)) throw new Error('Lookout site changed; regenerate its fixed geometry');
  return { ...bake.origin };
}

/** The tower's layout on its baked site (fresh copies: the caller may place them). */
export function lookoutLayout(p: LookoutPlacement): LookoutLayout {
  if (!baked(p)) throw new Error('Lookout site changed; regenerate its fixed geometry');
  const descs = readColliderRows(bake.descs, { kinds: ['box', 'treads'], surfaces: [] });
  const { cos, sin, plat, h, stair } = bake.floor, platformY = bake.platformY;
  return {
    colliders: structuredClone(bake.colliders), anchors: structuredClone(bake.anchors), platformY,
    colliderDescs: () => descs,
    floorHeightAt: (x, z) => {
      const lz = x * sin + z * cos, lx = x * cos - z * sin;
      if (Math.abs(lx) <= plat / 2 + 0.1 && Math.abs(lz) <= plat / 2 + 0.1) return platformY;
      if (Math.abs(lx) <= stair.w / 2 + 0.1 && lz < stair.x0 && lz > stair.x0 - stair.len) return platformY - h * ((stair.x0 - lz) / stair.len);
      return undefined;
    },
  };
}

// the banner's shadow moves with it (M5)
export const lookout = defineModel<Record<string, never>>({
  id: 'driftwood-isle/lookout', name: 'Lookout tower', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/lookout.ts', surface: 'planks',
  defaults: {},
  ...libraryModel<Record<string, never>, 'kit', 'lookout'>({
    draws: () => [{ draw: 'lookout', material: 'kit', castShadow: true, receiveShadow: true }],
    geometry: () => LOOKOUT_GEOMETRY.copy(), material: (ctx) => lowPolyLookMaterial(ctx.sky), colliders: () => readColliderRows(bake.descs, { kinds: ['box', 'treads'], surfaces: [] }),
    loading: { id: 'driftwood-isle/lookout', ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [6, 11, 9] },
  }),
});
