/**
 * The Ridge's native placements and two-resolution face skins, authored over
 * Pine's original terrain. The charged Scene partitions the original draws
 * into world tiles; the shared reader reconstructs each source geometry.
 * Native materials, view-profile selection and near/far culling stay in crags.ts.
 */
import type * as THREE from 'three';
import * as v from 'valibot';
import { BEAR_CAVE } from '../../data/layout';
import type { WholeGeometryView } from '@wildshard/game/plugin/geometry';
import { loadSiteTimbers } from '../../world/timberSites';
import cragJson from '../../data/crags.json' with { type: 'json' };

/** the kit's modules (nodes `<id>` and `<id>-lod1`: the cliff bands, buttress and slab in crags-b.glb, the rest in crags.glb) */
export const CRAG_IDS = ['cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab', 'tor-a', 'tor-b', 'boulder-a', 'boulder-b', 'boulder-c', 'scree-a', 'scree-b'] as const;
/** crags-b.glb's own module: the lookout's hero crag */
export const CRAG_HERO = 'hero';
export type CragId = (typeof CRAG_IDS)[number] | typeof CRAG_HERO;
/** one placed module: position (its base centre), a turn about +Y (its front, local +Z, faces (sin yaw, cos yaw)), a tilt */
export interface CragPlace { id: CragId; x: number; y: number; z: number; yaw: number; scale: number; tiltX: number; tiltZ: number }

/** the cave's frame: its mouth at BEAR_CAVE, local +Z into the rock (the mouth faces local −Z), y is world height */
export const CAVE_FRAME = { x: BEAR_CAVE.x, z: BEAR_CAVE.z, yaw: BEAR_CAVE.rot };

const num = v.pipe(v.number(), v.finite());
const Place = v.strictObject({ id: v.picklist([...CRAG_IDS, CRAG_HERO]), x: num, y: num, z: num, yaw: num, scale: num, tiltX: num, tiltZ: num });
/** a tile: its near and far geometries' vertex and index counts (the binary holds, per geometry: position f32 ×3, the
 *  vertex AO f32 ×1, the index u16, each block padded to 4 bytes) */
const Tile = v.tuple([num, num, num, num]);
const Skin = v.strictObject({ bin: v.string(), bytes: num, tiles: v.array(Tile) });
export const CragRowsSchema = v.strictObject({ places: v.array(Place), skin: v.strictObject({ phone: Skin, desktop: Skin }) });
export type CragRows = v.InferOutput<typeof CragRowsSchema>;
type Tier = keyof CragRows['skin'];

/** the bake's rows, parsed strictly once */
export const CRAG_ROWS: CragRows = v.parse(CragRowsSchema, cragJson);
/** the bake's `cdata` / `ctint`, named as the granite's graph reads them (`aCdata` / `aCtint`, ../data/cragLook.ts) */
function graphNamed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  renamed(g, 'cdata', 'aCdata'); renamed(g, 'ctint', 'aCtint');
  return g;
}
function renamed(g: THREE.BufferGeometry, from: string, to: string): void {
  if (!g.hasAttribute(from)) return;
  const a = g.getAttribute(from); g.deleteAttribute(from); g.setAttribute(to, a);
}
/** most skin tiles a tier's bake holds (18 today; throws past it) */
const MAX_SKIN_TILES = 256;
/** most original views the site-timber source admits (throws past it) */
const MAX_SOURCE_VIEWS = 4096;

/** Original per-tier draws reconstructed from the charged Scene's exact source ordinals. */
export class CragSkin {
  private readonly views: ReadonlyMap<string, WholeGeometryView>;
  private readonly tier: Tier;
  constructor(views: ReadonlyMap<string, WholeGeometryView>, tier: Tier) { this.views = views; this.tier = tier; }
  /** Original tile and near/far order; normals arrive as exact authored attributes. */
  async tiles(yieldTask: () => Promise<void>): Promise<[THREE.BufferGeometry, THREE.BufferGeometry][]> {
    const out: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];
    const count = CRAG_ROWS.skin[this.tier].tiles.length;
    if (count > MAX_SKIN_TILES) throw new Error(`[crags] ${String(count)} skin tiles, over ${String(MAX_SKIN_TILES)}`);
    for (let i = 0; i < Math.min(count, MAX_SKIN_TILES); i++) {
      const geometry = (resolution: string): THREE.BufferGeometry => {
        const key = `${this.tier}-skin-${String(i)}-${resolution}`, view = this.views.get(key);
        if (view === undefined) throw new Error(`[crags] missing original source ${key}`);
        const shape = graphNamed(view.geometry); shape.computeBoundingBox(); shape.computeBoundingSphere(); return shape;
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
    const keys = [...views.keys()];
    if (keys.length > MAX_SOURCE_VIEWS) throw new Error(`[crags] ${String(keys.length)} source views, over ${String(MAX_SOURCE_VIEWS)}`);
    for (let i = 0; i < Math.min(keys.length, MAX_SOURCE_VIEWS); i++) {
      const key = keys[i], view = key === undefined ? undefined : views.get(key);
      if (key === undefined || view === undefined || !key.startsWith(`${unused}-skin-`)) continue;
      view.release?.(); views.delete(key);
    }
    return new CragSkin(views, tier);
  } catch (error: unknown) {
    console.error('[pine-hollow] the baked crag skin did not load:', error);
    return null;
  }
}
