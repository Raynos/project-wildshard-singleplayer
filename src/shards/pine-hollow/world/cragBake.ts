/**
 * The Ridge's native placements and two-resolution face skins, authored over
 * Pine's original terrain. The charged Scene partitions the original draws
 * into world tiles; the shared reader reconstructs each source geometry.
 * Native materials, view-profile selection and near/far culling stay in crags.ts.
 */
import type * as THREE from 'three';
import * as v from 'valibot';
import { BEAR_CAVE } from '../data/layout';
import type { WholeGeometryView } from '@wildshard/game/plugin/geometry';
import { loadSiteTimbers } from './timberSites';
import cragJson from '../data/crags.json' with { type: 'json' };

/** the kit's modules (nodes `<id>` and `<id>-lod1`: the cliff bands, buttress and slab in crags-b.glb, the rest in crags.glb) */
export const CRAG_IDS = ['cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab', 'tor-a', 'tor-b', 'boulder-a', 'boulder-b', 'boulder-c', 'scree-a', 'scree-b'] as const;
/** crags-b.glb's own module: the lookout's hero crag */
export const CRAG_HERO = 'hero';
export type KitId = (typeof CRAG_IDS)[number];
export type CragId = KitId | typeof CRAG_HERO;
/** a module's footprint in its own frame (metres, before the placement's scale): half width (x), half depth (z), height */
export interface CragSize { hw: number; hd: number; h: number }
/** every module's footprint; the hero's only when crags-b.glb loaded */
export type CragSizes = Record<KitId, CragSize> & Partial<Record<typeof CRAG_HERO, CragSize>>;
/** one placed module: position (its base centre), a turn about +Y (its front, local +Z, faces (sin yaw, cos yaw)), a tilt */
export interface CragPlace { id: CragId; x: number; y: number; z: number; yaw: number; scale: number; tiltX: number; tiltZ: number }

/** the skin's tiles (m) */
export const SKIN_TILE = 64;
/** the skin's two resolutions (m) per tier: near, far */
export const SKIN_STEPS: Record<Tier, readonly [number, number]> = { phone: [1.0, 2.6], desktop: [0.7, 2.0] };

/** the cave's frame: its mouth at BEAR_CAVE, local +Z into the rock (the mouth faces local −Z), y is world height */
export const CAVE_FRAME = { x: BEAR_CAVE.x, z: BEAR_CAVE.z, yaw: BEAR_CAVE.rot };
/** world (x, z) → cave-local (lx, lz) */
export function caveLocal(x: number, z: number): [number, number] {
  const c = Math.cos(CAVE_FRAME.yaw), s = Math.sin(CAVE_FRAME.yaw), dx = x - CAVE_FRAME.x, dz = z - CAVE_FRAME.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** cave-local (lx, lz) → world (x, z) */
export function caveWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(CAVE_FRAME.yaw), s = Math.sin(CAVE_FRAME.yaw);
  return [CAVE_FRAME.x + lx * c + lz * s, CAVE_FRAME.z - lx * s + lz * c];
}

const num = v.pipe(v.number(), v.finite());
const Place = v.strictObject({ id: v.picklist([...CRAG_IDS, CRAG_HERO]), x: num, y: num, z: num, yaw: num, scale: num, tiltX: num, tiltZ: num });
/** a tile: its near and far geometries' vertex and index counts (the binary holds, per geometry: position f32 ×3, the
 *  vertex AO f32 ×1, the index u16, each block padded to 4 bytes) */
const Tile = v.tuple([num, num, num, num]);
const Skin = v.strictObject({ bin: v.string(), bytes: num, tiles: v.array(Tile) });
export const CragRowsSchema = v.strictObject({ places: v.array(Place), skin: v.strictObject({ phone: Skin, desktop: Skin }) });
export type CragRows = v.InferOutput<typeof CragRowsSchema>;
type Tier = keyof CragRows['skin'];
export type SkinRows = CragRows['skin'][Tier];

/** the bake's rows, parsed strictly once */
export const CRAG_ROWS: CragRows = v.parse(CragRowsSchema, cragJson);
/** Original per-tier draws reconstructed from the charged Scene's exact source ordinals. */
export class CragSkin {
  private readonly views: ReadonlyMap<string, WholeGeometryView>;
  private readonly tier: Tier;
  constructor(views: ReadonlyMap<string, WholeGeometryView>, tier: Tier) { this.views = views; this.tier = tier; }
  /** Original tile and near/far order; normals arrive as exact authored attributes. */
  async tiles(yieldTask: () => Promise<void>): Promise<[THREE.BufferGeometry, THREE.BufferGeometry][]> {
    const out: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];
    for (const [i] of CRAG_ROWS.skin[this.tier].tiles.entries()) {
      const geometry = (resolution: string): THREE.BufferGeometry => {
        const key = `${this.tier}-skin-${String(i)}-${resolution}`, view = this.views.get(key);
        if (view === undefined) throw new Error(`[crags] missing original source ${key}`);
        const shape = view.geometry; shape.computeBoundingBox(); shape.computeBoundingSphere(); return shape;
      };
      out.push([geometry('near'), geometry('far')]);
      await yieldTask();
    }
    return out;
  }
}

/** Load admitted original draws; missing sources remain a page fault and never fabricate geometry. */
export async function loadCragSkin(tier: Tier, ctx: Parameters<typeof loadSiteTimbers>[0]): Promise<CragSkin | null> {
  try {
    const views = await loadSiteTimbers(ctx);
    const unused = tier === 'phone' ? 'desktop' : 'phone';
    for (const [key, view] of views) if (key.startsWith(`${unused}-skin-`)) {
      view.release?.(); views.delete(key);
    }
    return new CragSkin(views, tier);
  } catch (error: unknown) {
    console.error('[pine-hollow] the baked crag skin did not load:', error);
    return null;
  }
}
