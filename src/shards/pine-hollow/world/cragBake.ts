/**
 * The Ridge's crags from their offline bake (G285, SF72 "bake the code-built worlds"). Where the kit's modules stand and the
 * face skin's tiles are built at build time (`../generators/crags.ts`, `scripts/bake-pine-crags.mjs`) over the page's own
 * baked terrain: `../data/crags.json` holds every placement and each tier's tile table, and
 * `public/assets/pine-hollow/baked/crags.<tier>.bin` (zlib) each tier's two skin resolutions. Here a tile becomes the
 * geometry the crags' one batch draws (./crags.ts), exactly as the builder made it. The file is the binary's bytes split
 * into four lanes (every 4-byte word's first bytes, then its second …) before zlib: floats compress ~30 % better so.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import type { Tier } from '@wildshard/engine/core/tier';
import { BEAR_CAVE } from '../layout';
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
export type SkinRows = CragRows['skin'][Tier];

/** the bake's rows, parsed strictly once */
export const CRAG_ROWS: CragRows = v.parse(CragRowsSchema, cragJson);
/** the bake's binary for a tier (`scripts/bake-pine-crags.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const cragBakeUrl = (tier: Tier): string => (tier === 'phone' ? '/assets/pine-hollow/baked/crags.phone.bin' : '/assets/pine-hollow/baked/crags.desktop.bin');

const pad4 = (bytes: number): number => Math.ceil(bytes / 4) * 4;
/** a geometry's bytes in the binary */
export function skinBytes(vertices: number, indices: number): number { return pad4(vertices * 12) + pad4(vertices * 4) + pad4(indices * 2); }

/**
 * A skin geometry from its blocks, as the builder finished it: position, `cdata` (AO, 1, 0, 1), `ctint` (0, 1: the skin's
 * mark for the facet projection), the index, its smoothed normals and bounds.
 */
export function skinGeometry(pos: Float32Array, ao: Float32Array, index: Uint16Array): THREE.BufferGeometry {
  const k = ao.length;
  const cd = new Float32Array(k * 4), ct = new Float32Array(k * 2);
  for (let i = 0; i < k; i++) { cd[i * 4] = ao[i] ?? 0; cd[i * 4 + 1] = 1; cd[i * 4 + 3] = 1; ct[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cdata', new THREE.BufferAttribute(cd, 4));
  g.setAttribute('ctint', new THREE.BufferAttribute(ct, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** The binary from its shipped lanes (`../generators/crags.ts` `shuffleLanes` reversed). */
export function unshuffleLanes(lanes: Uint8Array): Uint8Array {
  if (lanes.length % 4 !== 0) throw new Error('[crags] the skin bake is not whole words');
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

/** The decoded binary of one tier: each tile's near and far geometry, in the builder's order (nothing is shared). */
export class CragSkin {
  private readonly buffer: ArrayBuffer;
  constructor(bytes: Uint8Array, readonly rows: SkinRows) {
    if (bytes.length !== rows.bytes) throw new Error(`[crags] the skin bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
    if (rows.tiles.reduce((sum, [v0, i0, v1, i1]) => sum + skinBytes(v0, i0) + skinBytes(v1, i1), 0) !== bytes.length) throw new Error('[crags] the skin bake does not match its rows');
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
  }
  /** every tile, a `yieldTask` apart (each builds its normals) */
  async tiles(yieldTask: () => Promise<void>): Promise<[THREE.BufferGeometry, THREE.BufferGeometry][]> {
    const out: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];
    let offset = 0;
    const read = (vertices: number, indices: number): THREE.BufferGeometry => {
      const pos = new Float32Array(this.buffer, offset, vertices * 3); offset += pad4(vertices * 12);
      const ao = new Float32Array(this.buffer, offset, vertices); offset += pad4(vertices * 4);
      const index = new Uint16Array(this.buffer, offset, indices); offset += pad4(indices * 2);
      return skinGeometry(pos.slice(), ao, index.slice());
    };
    for (const [v0, i0, v1, i1] of this.rows.tiles) {
      out.push([read(v0, i0), read(v1, i1)]);
      await yieldTask();
    }
    return out;
  }
}

/** Fetch and inflate a tier's skin bake; a bake that fails to load is a page fault (`console.error`), and the skin stands absent. */
export async function loadCragSkin(tier: Tier): Promise<CragSkin | null> {
  const url = cragBakeUrl(tier);
  try {
    const response = await fetch(url);
    if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
    return new CragSkin(unshuffleLanes(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer())), CRAG_ROWS.skin[tier]);
  } catch (error: unknown) {
    console.error('[pine-hollow] the baked crag skin did not load:', error);
    return null;
  }
}
