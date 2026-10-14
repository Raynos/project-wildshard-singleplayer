/** Build-time cover splat; the page only admits and installs its declared file. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as v from 'valibot';
import { CoverGrid, triAreas, type CoverTri } from '../world/coverTint';
import { area } from '../world/blenderArea';
import { WORLD_DROP } from '../world/sea';
import { ISLAND_LOOK, ISLAND_TIERS } from '../data/islandRows';
import { droppedPlacements, placementSets, protosFromMeshes, usedPlacements, type IslandProto } from '../runtime/looks/bakedIsland';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { Tier } from '@wildshard/engine/core/tier';

/** one cover triangle in world space (`a`, `b`, `d` its corners) and its mean tinted colour */
export interface CoverTriangle { ax: number; ay: number; az: number; bx: number; by: number; bz: number; dx: number; dy: number; dz: number; r: number; g: number; b: number }

/**
 * E156: each cover triangle's corners and colour, in world space, exactly as the instanced tiles draw them (f32
 * positions, the truncated tinted Uint8 colour), set by set, tile by tile, each tile's placements in order (placements:
 * f32 × 10 each: proto, x, y, z, quaternion, scale, tint).
 */
export function* coverTrianglesOf(protos: readonly (IslandProto | undefined)[], f: Float32Array, sets: readonly (readonly (readonly number[])[])[]): Generator<CoverTriangle> {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), e = m.elements;
  const o: CoverTriangle = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, dx: 0, dy: 0, dz: 0, r: 0, g: 0, b: 0 };
  const w = new Float32Array(9);
  for (const tiles of sets) for (const items of tiles) for (const i of items) {
    const pr = protos[f[i * 10] ?? 0];
    if (pr === undefined) continue;
    const k = i * 10, tint = f[k + 9] ?? 1, sc = f[k + 8] ?? 1;
    t.set(f[k + 1] ?? 0, f[k + 2] ?? 0, f[k + 3] ?? 0); q.set(f[k + 4] ?? 0, f[k + 5] ?? 0, f[k + 6] ?? 0, f[k + 7] ?? 1);
    m.compose(t, q, s.set(sc, sc, sc));
    const ch = (vi: number, c: number) => Math.trunc(Math.min(255, (pr.col[vi * 4 + c] ?? 0) * tint)) / 255;
    for (let tri = 0; tri + 2 < pr.index.length; tri += 3) {
      for (let j = 0; j < 3; j++) {
        const vi = pr.index[tri + j] ?? 0, px = pr.pos[vi * 3] ?? 0, py = pr.pos[vi * 3 + 1] ?? 0, pz = pr.pos[vi * 3 + 2] ?? 0;
        w[j * 3] = e[0] * px + e[4] * py + e[8] * pz + e[12];
        w[j * 3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
        w[j * 3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
      }
      o.ax = w[0] ?? 0; o.ay = w[1] ?? 0; o.az = w[2] ?? 0; o.bx = w[3] ?? 0; o.by = w[4] ?? 0; o.bz = w[5] ?? 0; o.dx = w[6] ?? 0; o.dy = w[7] ?? 0; o.dz = w[8] ?? 0;
      const a = pr.index[tri] ?? 0, b = pr.index[tri + 1] ?? 0, d = pr.index[tri + 2] ?? 0;
      o.r = (ch(a, 0) + ch(b, 0) + ch(d, 0)) / 3; o.g = (ch(a, 1) + ch(b, 1) + ch(d, 1)) / 3; o.b = (ch(a, 2) + ch(b, 2) + ch(d, 2)) / 3;
      yield o;
    }
  }
}

/**
 * The cells of `grid` inside [x0, x1] × [z0, z1] splatted from triangles of cover geometry (world space), row by row as
 * `CoverGrid.writeBlock` takes them: each triangle adds its ground (top) and upright (side) areas × its colour to its
 * cell; `k` scales area to optical depth (fronds overlap). r, g, b, top, side (1 − e^−τ) per cell.
 */
export function splatBlock(grid: InstanceType<typeof CoverGrid>, tris: Iterable<CoverTri>, x0: number, x1: number, z0: number, z1: number, k: number): Float32Array {
  const step = grid.step, n = grid.n, half = CHUNK_HALF;
  const ix = (at: number) => Math.max(0, Math.min(n - 1, Math.round((at + half) / step)));
  const acc = new Map<number, [number, number, number, number, number]>();
  for (const t of tris) {
    const c = Math.round((t.z + half) / step) * n + Math.round((t.x + half) / step);
    const s = acc.get(c) ?? [0, 0, 0, 0, 0], w = t.top + t.side;
    s[0] += t.r * w; s[1] += t.g * w; s[2] += t.b * w; s[3] += t.top; s[4] += t.side;
    acc.set(c, s);
  }
  const i0 = ix(x0), i1 = ix(x1), k0 = ix(z0), k1 = ix(z1), cell = step * step, out = new Float32Array(grid.blockLength(x0, x1, z0, z1));
  let o = 0;
  for (let kk = k0; kk <= k1; kk++) for (let i = i0; i <= i1; i++, o += 5) {
    const s = acc.get(kk * n + i), w = s ? s[3] + s[4] : 0;
    if (s && w > 0) out.set([s[0] / w, s[1] / w, s[2] / w, 1 - Math.exp(-(s[3] / cell) * k), 1 - Math.exp(-(s[4] / cell) * k)], o);
  }
  return out;
}

/** A baked float block's file: a 16-byte header (magic, version, the placements it was baked from, floats) and the
 *  block's f32s, little-endian (`decodeFloatBlock` reads it back). */
export function encodeFloatBlock(block: Float32Array, used: number, magic: number, version: number): Uint8Array {
  const out = new Uint8Array(16 + block.length * 4), view = new DataView(out.buffer);
  view.setUint32(0, magic, true); view.setUint32(4, version, true); view.setUint32(8, used, true); view.setUint32(12, block.length, true);
  for (let i = 0; i < block.length; i++) view.setFloat32(16 + i * 4, block[i] ?? 0, true);
  return out;
}

interface CoverMeta { protos: { name: string; kind: string }[]; mustDraw: number }
/** E156 / G144: each cover triangle's centre, ground / upright areas and colour, for CoverGrid.splat, from the instanced
 *  placements in world space */
function* instancedCoverTriangles(tris: Iterable<CoverTriangle>): Generator<CoverTri> {
  const o: CoverTri = { x: 0, z: 0, top: 0, side: 0, r: 0, g: 0, b: 0 };
  for (const t of tris) {
    const ar = triAreas(t.ax, t.ay, t.az, t.bx, t.by, t.bz, t.dx, t.dy, t.dz);
    o.top = ar.top; o.side = ar.side;
    o.x = (t.ax + t.bx + t.dx) / 3; o.z = (t.az + t.bz + t.dz) / 3;
    o.r = t.r; o.g = t.g; o.b = t.b;
    yield o;
  }
}

/** The declared tier-specific cover output. */
export const islandCoverUrl = (tier: Tier): string => (tier === 'phone' ? ISLAND_TIERS.phone.coverUrl : ISLAND_TIERS.desktop.coverUrl);

/** the area's splatted block (`splatBlock`) from the cover sets' triangles */
export function islandCoverBlock(tris: Iterable<CoverTriangle>): Float32Array {
  return splatBlock(new CoverGrid(), instancedCoverTriangles(tris), area.x0, area.x1, area.z0, area.z1, ISLAND_LOOK.coverDepth);
}

/** the baked file: a 16-byte header ('WSIC', version, placements used, floats) and the block's f32s, little-endian */
export const encodeIslandCover = (block: Float32Array, used: number): Uint8Array => encodeFloatBlock(block, used, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);

/** the prototypes from island.glb's meshes (world-space positions, Uint8 colour + baked AO), by island.json's index */
export const islandProtos = (found: readonly THREE.Mesh[], meta: CoverMeta): IslandProto[] => protosFromMeshes(found, meta.protos.map((p) => p.name), ISLAND_LOOK.protoPrefix);

/** placements.bin as the build reads it: each placement's y dropped with the world (G164) */
export const islandPlacements = (buf: ArrayBuffer): Float32Array => droppedPlacements(buf, WORLD_DROP);

/** how many placements this tier builds (every palm / rock / log, and the tier's share of the small cover: a prefix) */
export const islandUsed = (f: Float32Array, meta: CoverMeta, phone: boolean): number => usedPlacements(f, meta.mustDraw, phone ? ISLAND_TIERS.phone.share : ISLAND_TIERS.desktop.share);

/**
 * The placements by set and tile: casters CT×CT, small cover and big cover VT×VT; the small rocks rockKit rebuilds.
 * E114: the loose rocks are rockKit's — the boulders (rock*, rockb*: the shore boulders' spots, drawn by Boulders.ts
 * instead) are skipped, the small scattered rocks (smallrock*) rebuilt below. The crag plates on the cliffs (cliff*) stay
 * the Blender ones.
 */
export function islandSets(f: Float32Array, meta: CoverMeta, used: number, phone: boolean): { casters: number[][]; covers: number[][]; bigs: number[][]; smallRocks: number[] } {
  const look = phone ? ISLAND_TIERS.phone : ISLAND_TIERS.desktop;
  const { casters, covers, bigs, apart } = placementSets(f, meta.protos, used, area, { casterTiles: look.casterTiles, coverTiles: look.coverTiles, ...ISLAND_LOOK.names });
  return { casters, covers, bigs, smallRocks: apart };
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
async function bakeCover(readAsset: (url: string) => Uint8Array, phone: boolean): Promise<Uint8Array> {
  const base = '/assets/models/driftwood-blender/';
  const meta = v.parse(v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })), mustDraw: v.number() }), JSON.parse(new TextDecoder().decode(readAsset(`${base}island.json`))));
  await MeshoptDecoder.ready;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(readAsset(`${base}island.glb`)).buffer, '');
  try {
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse(o => { if (isMesh(o)) meshes.push(o); });
    const protos = islandProtos(meshes, meta), f = islandPlacements(Uint8Array.from(readAsset(`${base}placements.bin`)).buffer);
    const used = islandUsed(f, meta, phone), sets = islandSets(f, meta, used, phone);
    return encodeIslandCover(islandCoverBlock(coverTrianglesOf(protos, f, [sets.covers, sets.bigs])), used);
  } finally {
    gltf.scene.traverse(o => { if (isMesh(o)) { o.geometry.dispose(); for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.dispose(); } });
  }
}

/** Cheap required phone boot file, emitted by the SDK's confined byte producer. */
export const phoneIslandCover = (readAsset: (url: string) => Uint8Array): Promise<Uint8Array> => bakeCover(readAsset, true);
/** Cheap required desktop boot file, emitted by the SDK's confined byte producer. */
export const desktopIslandCover = (readAsset: (url: string) => Uint8Array): Promise<Uint8Array> => bakeCover(readAsset, false);

