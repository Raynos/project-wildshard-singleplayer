/**
 * Driftwood Isle's two fixed-site buildings (E306 / E315 M1: models on the contract, src/engine/models/model.ts), both
 * fixed bakes (SHARD-PLATFORM M3, G285): the builders run offline where each stands, over the native terrain
 * (src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs), and the page reads back their geometry
 * (baked/fixed-models/*.glb) and their layouts (the product's custom/fixedLayouts, from data/hutBake.json and
 * data/lookoutBake.json: the legacy boxes, the physics descriptors, the anchors and the floor), all in own space. A
 * changed site needs a rebake; `bakedSite` refuses one it was not baked for.
 *
 * - The castaway's hut on the plateau (generators/hut.ts): a plank cabin on log stilts with a wrap-around porch, a deep
 *   thatched hip roof, steps down the front and a furnished inside; the kit mesh and the unlit flames. Origin: the
 *   cabin's centre on the ground, the door at −z turned by the site's `rot`. Anchors: npc (by the campfire), hutChest
 *   (against the back wall), door, porch.
 * - The lookout tower on the headland summit (generators/lookout.ts): splayed log posts, a plank platform, a thatch roof,
 *   the swaying banner, a stair and a zipline post facing the sea cave (its `zipTo`); one kit mesh with the banner's sway
 *   channel (its shadow moves with it, M5). Origin: the tower's centre on the ground, the stair descending local −z.
 *   Anchors (y = platform unless noted): beacon, shard, zipTop (the cable leaves the pulley 2.5 m above it), stairFoot.
 *
 * Each walkable floor is a deck rectangle plus a ramp down to the ground (the hut's steps, the tower's stair).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { libraryModel } from '@wildshard/game/models/libraryModel';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { driftwoodRows } from '../boot/rows';
import { HUT_FLAMES_GEOMETRY, HUT_KIT_GEOMETRY, LOOKOUT_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

/** Where a building stands: its centre (world xz) and which way its front faces (rot, radians). */
export interface SiteXz { readonly x: number; readonly z: number; readonly rot: number }
/** A named spot of a building (own space, yaw = facing, 0 = +Z). */
export interface SiteAnchor { x: number; y: number; z: number; yaw: number }
/** The tower's placement adds the world point its zipline pulley faces. */
export interface SitePlacement { readonly site: SiteXz; readonly zipTo?: { readonly x: number; readonly z: number } }

/** A building's layout (own space): its legacy boxes, physics descriptors, anchors and the floor under a point. */
export interface SiteLayout {
  readonly colliders: Collider[];
  readonly anchors: Record<string, SiteAnchor>;
  readonly colliderDescs: () => ReturnType<typeof readColliderRows>;
  readonly floorHeightAt: (x: number, z: number) => number | undefined;
}

const descsOf = (kind: 'hut' | 'lookout'): ReturnType<typeof readColliderRows> => readColliderRows(driftwoodRows('custom/fixedLayouts')[kind].descs, { kinds: ['box', 'treads'], surfaces: [] });

/** The baked site's origin (its centre on the ground, world) and its layout (fresh copies: the caller may place them). */
export function bakedSite(kind: 'hut' | 'lookout', p: SitePlacement): { origin: { x: number; y: number; z: number }; layout: SiteLayout } {
  const rows = driftwoodRows('custom/fixedLayouts'), row = rows[kind], zip = kind === 'lookout' ? rows.lookout.zipTo : undefined;
  if (p.site.x !== row.site.x || p.site.z !== row.site.z || p.site.rot !== row.site.rot || p.zipTo?.x !== zip?.x || p.zipTo?.z !== zip?.z) throw new Error(`Driftwood ${kind} site changed; regenerate its fixed geometry`);
  // the deck (half sizes about its centre z) and the ramp below its top edge z0, `drop` metres over `len`
  const f = rows.hut.floor, l = rows.lookout.floor;
  const { cos, sin, top, deck, ramp } = kind === 'hut'
    ? { cos: f.cos, sin: f.sin, top: rows.hut.floorY, deck: { hw: f.deck.w / 2, z: f.deck.z, hd: f.deck.d / 2 }, ramp: { hw: f.steps.w / 2, z0: f.steps.z0, len: f.steps.len, drop: f.lift } }
    : { cos: l.cos, sin: l.sin, top: rows.lookout.platformY, deck: { hw: l.plat / 2 + 0.1, z: 0, hd: l.plat / 2 + 0.1 }, ramp: { hw: l.stair.w / 2 + 0.1, z0: l.stair.x0, len: l.stair.len, drop: l.h } };
  const descs = descsOf(kind);
  return { origin: { ...row.origin }, layout: {
    colliders: structuredClone(row.colliders), anchors: structuredClone(row.anchors), colliderDescs: () => descs,
    floorHeightAt: (x, z) => {
      const lz = x * sin + z * cos, lx = x * cos - z * sin;
      if (Math.abs(lx) <= deck.hw && Math.abs(lz - deck.z) <= deck.hd) return top;
      if (Math.abs(lx) <= ramp.hw && lz < ramp.z0 && lz > ramp.z0 - ramp.len) return top - ramp.drop * ((ramp.z0 - lz) / ramp.len);
      return undefined;
    },
  } };
}

const DRAWS = { kit: HUT_KIT_GEOMETRY, flames: HUT_FLAMES_GEOMETRY, lookout: LOOKOUT_GEOMETRY };
const site = (kind: 'hut' | 'lookout', name: string, size: readonly [number, number, number]) => defineModel<Record<string, never>>({
  id: `driftwood-isle/${kind}`, name, category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/hut.ts', surface: 'planks',
  defaults: {},
  ...libraryModel<Record<string, never>, 'kit' | 'still' | 'flames', keyof typeof DRAWS>({
    draws: () => kind === 'lookout' ? [{ draw: 'lookout', material: 'kit', castShadow: true, receiveShadow: true }]
      : [{ draw: 'kit', material: 'still', castShadow: true, receiveShadow: true }, { draw: 'flames', material: 'flames' }],
    geometry: (_, draw) => DRAWS[draw].copy(),
    material: (ctx, key) => key === 'kit' ? lowPolyLookMaterial(ctx.sky) : key === 'still' ? lowPolyLookMaterial(ctx.sky, 'still')
      : ctx.once('driftwood-isle/hut:flames', () => new THREE.MeshBasicMaterial({ vertexColors: true })),
    colliders: () => descsOf(kind),
    loading: { id: `driftwood-isle/${kind}`, ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [...size] },
  }),
});
export const hut = site('hut', 'Hut', [11, 7, 8]), lookout = site('lookout', 'Lookout tower', [6, 11, 9]);
