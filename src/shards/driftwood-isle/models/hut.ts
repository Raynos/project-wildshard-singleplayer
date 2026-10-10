/**
 * The castaway's hut (E306 / E315 M1: a model on the contract, src/engine/models/model.ts) — Driftwood Isle's thatched
 * hut on the plateau: a plank cabin on log stilts with a wrap-around porch, a deep thatched hip roof, steps down the
 * front and a furnished inside you can walk into (generators/hut.ts describes it). It is a fixed bake (SHARD-PLATFORM M3,
 * G285): the builder runs offline where the hut stands, over the native terrain, and the page reads back its two
 * geometries (the kit mesh and the unlit flames, baked/fixed-models/hut-*.glb) and its layout (data/hutBake.json: the
 * legacy boxes, the physics descriptors, the anchors and the floor), all in own space — the origin is the cabin's centre
 * on the ground, the door at −z turned by the site's `rot`. A changed site needs a rebake
 * (scripts/bake-driftwood-fixed-models.mjs); `hutLayout` refuses one it was not baked for.
 *
 * Anchors (own space, y = floor, yaw = facing, 0 = +Z): npc (the castaway's spot by his campfire in front of the
 * steps, facing the path), hutChest (against the back wall inside, facing the door), door (the doorway), porch (the
 * porch in front of the door).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import bake from '../data/hutBake.json' with { type: 'json' };
import { HUT_FLAMES_GEOMETRY, HUT_KIT_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

/** Where a hut stands: its centre (world xz) and which way its door faces (rot, radians; 0 = −z). */
export interface HutSite { readonly x: number; readonly z: number; readonly rot: number }
/** A named spot of the hut (own space, y = floor, yaw = facing, 0 = +Z). */
export interface HutAnchor { x: number; y: number; z: number; yaw: number }

/** The hut's layout (own space): its legacy boxes, physics descriptors, anchors, floor y and the floor under a point. */
export interface HutLayout {
  readonly colliders: Collider[];
  readonly anchors: Record<string, HutAnchor>;
  readonly floorY: number;
  readonly colliderDescs: () => ColliderDesc[];
  readonly floorHeightAt: (x: number, z: number) => number | undefined;
}

const n = (v: number | undefined): number => { if (v === undefined) throw new Error('hutBake.json: a descriptor lacks a number'); return v; };
const v3 = (p: { x: number; y: number; z: number } | undefined): { x: number; y: number; z: number } => { if (p === undefined) throw new Error('hutBake.json: treads lack an end'); return { x: p.x, y: p.y, z: p.z }; };
/** The baked physics descriptors, typed again (fresh objects each call): boxes and the front steps' treads. */
const bakedDescs = (): ColliderDesc[] => bake.descs.map((d): ColliderDesc => d.kind === 'treads'
  ? { kind: 'treads', from: v3(d.from), to: v3(d.to), width: n(d.width), count: n(d.count) }
  : { kind: 'box', x: n(d.x), y: n(d.y), z: n(d.z), hx: n(d.hx), hy: n(d.hy), hz: n(d.hz), yaw: n(d.yaw) });
const sameSite = (site: HutSite): boolean => site.x === bake.site.x && site.z === bake.site.z && site.rot === bake.site.rot;

/** The baked site's origin: its centre on the ground (world). */
export function hutOrigin(site: HutSite): { x: number; y: number; z: number } {
  if (!sameSite(site)) throw new Error('Hut site changed; regenerate its fixed geometry');
  return { ...bake.origin };
}

/** The hut's layout on its baked site (fresh copies: the caller may place them). */
export function hutLayout(site: HutSite): HutLayout {
  if (!sameSite(site)) throw new Error('Hut site changed; regenerate its fixed geometry');
  const descs = bakedDescs();
  const { cos, sin, lift, deck, steps } = bake.floor, floorY = bake.floorY;
  return {
    colliders: structuredClone(bake.colliders), anchors: structuredClone(bake.anchors), floorY,
    colliderDescs: () => descs,
    floorHeightAt: (x, z) => {
      const lz = x * sin + z * cos, lx = x * cos - z * sin;
      if (Math.abs(lx) <= deck.w / 2 && Math.abs(lz - deck.z) <= deck.d / 2) return floorY;
      if (Math.abs(lx) <= steps.w / 2 && lz < steps.z0 && lz > steps.z0 - steps.len) return floorY - (steps.z0 - lz) / steps.len * lift;
      return undefined;
    },
  };
}

const own = (g: THREE.BufferGeometry): THREE.BufferGeometry => { g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
function hutParts(ctx: ModelContext): ModelPart[] {
  return [
    { geometry: own(HUT_KIT_GEOMETRY.copy()), material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true },
    { geometry: own(HUT_FLAMES_GEOMETRY.copy()), material: new THREE.MeshBasicMaterial({ vertexColors: true }) },
  ];
}

export const hut = defineModel<Record<string, never>>({
  id: 'driftwood-isle/hut', name: 'Hut', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/hut.ts', surface: 'planks',
  defaults: {},
  build: (ctx) => fixedGeometryReady() ? hutParts(ctx) : loadingSpecimen('driftwood-isle/hut', [11, 7, 8], async () => {
    await loadFixedGeometry();
    const group = new THREE.Group();
    for (const p of hutParts(ctx)) group.add(new THREE.Mesh(p.geometry, p.material));
    return group;
  }),
  colliders: () => bakedDescs(),
});
