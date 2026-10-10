import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { CHUNK_HALF, TERRAIN_RES } from '@wildshard/engine/core/config';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { CELL } from '@wildshard/engine/world/blenderArea';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { editShader, type ShaderEditRow } from './shaderEdits';
import { ShaderFamily } from './shaderFamily';

/**
 * A baked island's generic parts (SHARD-PLATFORM M3; ex a shard's Blender-island install): an area of the world rebuilt
 * from an offline bake (terrain tiles with baked AO and bounce lightmaps, prototypes and their placements) over the
 * procedural ground it replaces. The shard keeps what is its own — its files, its area, its models and colliders — and
 * gives its looks as rows: the GLSL edits (`ShaderEditRow`s, `@{name}` splicing the numbers this module formats), the
 * patch ids and program keys, the materials' settings, the tile counts and the name patterns that sort the placements.
 *
 * - `bakedTerrainMaterial` / `bakedPropsMaterial`: the toon standard materials of the baked terrain and props (fog, the
 *   sky rig's setup, the AO edits, per-instance tint and the cover's fade-out past each plant's own edge).
 * - `clipInstancedRect`, `clipGridTerrain`, `dropTriangles`, `dropNearestTriangles`: hide what the area replaces.
 * - `simplifiedProto`: a prototype's far copy (meshoptimizer), so a tile's far copies keep its near copies' shape.
 * - `protosFromMeshes`, `droppedPlacements`, `usedPlacements`, `placementSets`, `tileRect`: read and sort the bake.
 * - `encodeFloatBlock` / `decodeFloatBlock`: a baked float block's file (a 16-byte header, then the f32s).
 * - `sunBounceLevel`: how much of the baked bounce the live sun lights.
 */

/** a prototype as the bake holds it: world-space positions, Uint8 RGBA (alpha: its baked AO), index */
export interface IslandProto { pos: Float32Array; col: Uint8Array; index: Uint32Array }

/** an axis-aligned rect in world xz */
export interface IslandRect { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }

/** a patch as data: its patch id, its program key and its edit rows (`@{name}` splices what the caller formats) */
export interface IslandPatchRow {
  readonly patch: string;
  readonly key: string;
  readonly edits: readonly ShaderEditRow[];
}

/** the baked terrain's material settings and its patch (`@{aoDirect}`: the share of the AO on the direct sun) */
export interface BakedTerrainRow extends IslandPatchRow {
  readonly roughness: number;
  readonly aoDirect: number;
}

/** the baked props' material settings and patches: the AO edits, the per-instance tint and the cover fade */
export interface BakedPropsRow {
  readonly patch: string;
  /** the program key of an uncovered props material */
  readonly key: string;
  /** appended to the program key of a tinted (instanced) material */
  readonly tintKey: string;
  readonly roughness: number;
  readonly ao: readonly ShaderEditRow[];
  readonly tint: readonly ShaderEditRow[];
  /** `@{edgeNear}`, `@{far}`, `@{grow}`: the cover's reach, formatted to one decimal */
  readonly fade: readonly ShaderEditRow[];
}

/** a cover fade: every plant stands to `near`, each has its own edge in [near + grow, far] and takes on its ground's
 *  colour over the `grow` m before it; `key` is its program key */
export interface IslandCoverFade { readonly near: number; readonly far: number; readonly grow: number; readonly key: string }

const SPLICE = new ShaderFamily({}, {});

/** `rows` with every `@{name}` in their text replaced from `extra` */
function spliced(rows: readonly ShaderEditRow[], extra: Readonly<Record<string, string>>): ShaderEditRow[] {
  return rows.map((r) => (typeof r.put === 'string' ? { stage: r.stage, find: r.find, put: SPLICE.glsl(r.put, extra) } : r));
}

/** The baked terrain's toon material: vertex colours, flat shading, the baked AO and the bounce lightmap (intensity 0
 *  until `sunBounceLevel` sets it), fog and the sky rig's setup. */
export function bakedTerrainMaterial(row: BakedTerrainRow, ao: THREE.Texture, bounce: THREE.Texture, sky: Sky): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.roughness, metalness: 0, aoMap: ao, aoMapIntensity: 1, lightMap: bounce, lightMapIntensity: 0 });
  const edits = spliced(row.edits, { aoDirect: row.aoDirect.toFixed(2) });
  patchShader(mat, row.patch, PATCH_ORDER.material, (sh) => {
    attachFogUniforms(sh);
    editShader(sh, edits);
  }, { mode: 'replace', key: row.key });
  sky.setupMaterial(mat);
  return mat;
}

/** The baked props' toon material (double-sided, vertex colours whose alpha is the baked AO), tinted per instance when
 *  `tinted`, with the cover's fade when `cover` is given. */
export function bakedPropsMaterial(row: BakedPropsRow, sky: Sky, cover: IslandCoverFade | null, tinted = true): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.roughness, metalness: 0, side: THREE.DoubleSide });
  const edits = [...row.ao, ...(tinted ? row.tint : [])];
  if (cover !== null) edits.push(...spliced(row.fade, { edgeNear: (cover.near + cover.grow).toFixed(1), far: cover.far.toFixed(1), grow: cover.grow.toFixed(1) }));
  patchShader(mat, row.patch, PATCH_ORDER.material, (s) => {
    attachFogUniforms(s);
    editShader(s, edits);
  }, { mode: 'replace', key: (cover !== null ? cover.key : row.key) + (tinted ? row.tintKey : '') });
  sky.setupMaterial(mat);
  return mat;
}

/** Collapses an instance of `mat` whose origin is inside `rect` (vertex shader, no discard, no CPU per frame):
 *  `@{x0}` … `@{z1}` splice the rect to three decimals; the program key gains `|<row.key>`. */
export function clipInstancedRect(mat: THREE.Material, rect: IslandRect, row: IslandPatchRow): void {
  const f = (v: number) => v.toFixed(3);
  const edits = spliced(row.edits, { x0: f(rect.x0), x1: f(rect.x1), z0: f(rect.z0), z1: f(rect.z1) });
  patchShader(mat, row.patch, PATCH_ORDER.decorate, (shader) => {
    editShader(shader, edits);
  }, { key: (k) => `${k}|${row.key}` });
  mat.needsUpdate = true;
}

/** Keeps only the triangles `keep(cx, cz)` accepts (centroid, world xz: the geometry is built in world space); returns
 *  a third of the dropped count. */
export function dropTriangles(geo: THREE.BufferGeometry, keep: (x: number, z: number) => boolean): number {
  const pos = geo.getAttribute('position');
  const src = geo.getIndex();
  const n = src ? src.count : pos.count;
  const out: number[] = [];
  let dropped = 0;
  for (let t = 0; t < n; t += 3) {
    const a = src ? src.getX(t) : t, b = src ? src.getX(t + 1) : t + 1, c = src ? src.getX(t + 2) : t + 2;
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (keep(x, z)) out.push(a, b, c); else dropped++;
  }
  if (dropped > 0) geo.setIndex(out);
  return dropped / 3;
}

/** The procedural low-poly terrain loses `rect`'s whole cells (its index is (iz·(res−1) + ix)·6); a terrain of another
 *  layout loses the triangles `inside` holds. */
export function clipGridTerrain(mesh: THREE.Mesh, rect: IslandRect, inside: (x: number, z: number) => boolean): void {
  const idx = mesh.geometry.getIndex();
  if (idx === null) return;
  const n = TERRAIN_RES - 1;
  if (idx.count !== n * n * 6) { dropTriangles(mesh.geometry, (x, z) => !inside(x, z)); return; }
  const cx0 = Math.round((rect.x0 + CHUNK_HALF) / CELL), cx1 = Math.round((rect.x1 + CHUNK_HALF) / CELL);
  const cz0 = Math.round((rect.z0 + CHUNK_HALF) / CELL), cz1 = Math.round((rect.z1 + CHUNK_HALF) / CELL);
  const out = new Uint32Array(idx.count - (cx1 - cx0) * (cz1 - cz0) * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    if (ix >= cx0 && ix < cx1 && iz >= cz0 && iz < cz1) continue;
    const o = (iz * n + ix) * 6;
    for (let j = 0; j < 6; j++) out[k++] = idx.getX(o + j);
  }
  mesh.geometry.setIndex(new THREE.BufferAttribute(out, 1));
}

/** Each triangle belongs to the nearest of `points` (searched in `cell` m buckets, the 3×3 round it); drops the
 *  triangles whose owner `drop` names (e.g. a merged palm mesh losing the palms standing in an area). */
export function dropNearestTriangles<P extends { readonly x: number; readonly z: number }>(geo: THREE.BufferGeometry, points: readonly P[], cell: number, drop: (p: P) => boolean): void {
  const cellOf = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, P[]>();
  for (const p of points) { const k = cellOf(p.x, p.z); const l = grid.get(k); if (l) l.push(p); else grid.set(k, [p]); }
  dropTriangles(geo, (x, z) => {
    let best: P | null = null, bd = Infinity;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; }
    }
    return best === null || !drop(best);
  });
}

/** `p` with its triangles simplified (to `ratio` of them, never past `error` of its size) and its vertices compacted to
 *  the ones they use. Await `MeshoptSimplifier.ready` (`simplifierReady`) first. */
export function simplifiedProto(p: IslandProto, ratio: number, error: number): IslandProto {
  const target = Math.max(3, Math.floor((p.index.length * ratio) / 3) * 3);
  const [idx] = MeshoptSimplifier.simplify(p.index, p.pos, 3, target, error);
  const remap = new Int32Array(p.pos.length / 3).fill(-1);
  let n = 0;
  for (const v of idx) if ((remap[v] ?? 0) < 0) remap[v] = n++;
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 4), index = new Uint32Array(idx.length);
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v] ?? -1;
    if (r < 0) continue;
    pos.set(p.pos.subarray(v * 3, v * 3 + 3), r * 3);
    col.set(p.col.subarray(v * 4, v * 4 + 4), r * 4);
  }
  for (let i = 0; i < idx.length; i++) index[i] = remap[idx[i] ?? 0] ?? 0;
  return { pos, col, index };
}

/** Resolves once meshoptimizer's simplifier is loaded. */
export const simplifierReady = (): Promise<void> => MeshoptSimplifier.ready;

/** The prototypes from a loaded scene's meshes (world-space positions, Uint8 colour + baked AO), by `names`' index
 *  (a mesh named `<prefix><name>`). */
export function protosFromMeshes(found: readonly THREE.Mesh[], names: readonly string[], prefix: string): IslandProto[] {
  const protos: IslandProto[] = [];
  const protoIndex = new Map<string, number>(names.map((name, i) => [`${prefix}${name}`, i]));
  const v = new THREE.Vector3();
  for (const o of found) {
    const pi = protoIndex.get(o.name);
    if (pi === undefined) continue;
    const g = o.geometry, p = g.getAttribute('position'), c = g.getAttribute('color'), idx = g.getIndex();
    const pos = new Float32Array(p.count * 3), col = new Uint8Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      col[i * 4] = Math.round(THREE.MathUtils.clamp(c.getX(i), 0, 1) * 255);
      col[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(c.getY(i), 0, 1) * 255);
      col[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(c.getZ(i), 0, 1) * 255);
      col[i * 4 + 3] = c.itemSize > 3 ? Math.round(THREE.MathUtils.clamp(c.getW(i), 0, 1) * 255) : 255;
    }
    const index = new Uint32Array(idx ? idx.count : p.count);
    for (let i = 0; i < index.length; i++) index[i] = idx ? idx.getX(i) : i;
    protos[pi] = { pos, col, index };
  }
  return protos;
}

/** The placements file (f32 × 10: proto, x, y, z, quaternion, scale, tint) with each placement's y lowered by `drop`. */
export function droppedPlacements(buf: ArrayBuffer, drop: number): Float32Array {
  const f = new Float32Array(buf);
  for (let i = 0; i < f.length / 10; i++) f[i * 10 + 2] = (f[i * 10 + 2] ?? 0) - drop;
  return f;
}

/** How many placements a tier builds: the first `mustDraw` always, and `share` of the rest (the file is ordered so the
 *  tier's set is a prefix). */
export function usedPlacements(f: Float32Array, mustDraw: number, share: number): number {
  return mustDraw + Math.round((f.length / 10 - mustDraw) * share);
}

/** How the placements sort: by prototype kind and name (RegExp sources), and the tile counts per side. */
export interface PlacementSetsRow {
  /** tiles per side of the casters' set and of the two cover sets */
  readonly casterTiles: number;
  readonly coverTiles: number;
  /** the kinds that cast (their own tile set, with far copies) */
  readonly casterKinds: readonly string[];
  /** names never placed here (drawn by something else) */
  readonly skip: string;
  /** names set apart for the caller (rebuilt otherwise) */
  readonly apart: string;
  /** cover names that go to the big cover's set */
  readonly big: string;
}

/** The placements of a baked set by set and tile, and the ones set apart. */
export interface PlacementSets { casters: number[][]; covers: number[][]; bigs: number[][]; apart: number[] }

/** The tile of `rect` (`n` × `n`) holding (x, z), clamped to the rect. */
function tileOf(rect: IslandRect, x: number, z: number, n: number): number {
  const tx = Math.min(n - 1, Math.max(0, Math.floor((x - rect.x0) / (rect.x1 - rect.x0) * n)));
  const tz = Math.min(n - 1, Math.max(0, Math.floor((z - rect.z0) / (rect.z1 - rect.z0) * n)));
  return tz * n + tx;
}

/** The first `used` placements by set and tile (the casters `casterTiles`², the small and big cover `coverTiles`²). */
export function placementSets(f: Float32Array, protos: readonly { readonly name: string; readonly kind: string }[], used: number, rect: IslandRect, row: PlacementSetsRow): PlacementSets {
  const CT = row.casterTiles, VT = row.coverTiles;
  const skip = new RegExp(row.skip), apartRe = new RegExp(row.apart), big = new RegExp(row.big);
  const casters: number[][] = Array.from({ length: CT * CT }, () => []), covers: number[][] = Array.from({ length: VT * VT }, () => []), bigs: number[][] = Array.from({ length: VT * VT }, () => []);
  const apart: number[] = [];
  for (let i = 0; i < used; i++) {
    const pi = f[i * 10] ?? 0, kind = protos[pi]?.kind ?? 'small';
    const x = f[i * 10 + 1] ?? 0, z = f[i * 10 + 3] ?? 0;
    const name = protos[pi]?.name ?? '';
    if (skip.test(name)) continue;
    if (apartRe.test(name)) { apart.push(i); continue; }
    if (row.casterKinds.includes(kind)) casters[tileOf(rect, x, z, CT)]?.push(i); else (big.test(name) ? bigs : covers)[tileOf(rect, x, z, VT)]?.push(i);
  }
  return { casters, covers, bigs, apart };
}

/** Tile `k` of `rect` split `n` × `n`. */
export function tileRect(rect: IslandRect, k: number, n: number): IslandRect {
  const w = (rect.x1 - rect.x0) / n, d = (rect.z1 - rect.z0) / n, tx = k % n, tz = Math.floor(k / n);
  return { x0: rect.x0 + tx * w, x1: rect.x0 + (tx + 1) * w, z0: rect.z0 + tz * d, z1: rect.z0 + (tz + 1) * d };
}

const BLOCK_HEADER = 16;

/** A baked float block's file: a 16-byte header (magic, version, the placements it was baked from, floats) and the
 *  block's f32s, little-endian. */
export function encodeFloatBlock(block: Float32Array, used: number, magic: number, version: number): Uint8Array {
  const out = new Uint8Array(BLOCK_HEADER + block.length * 4), view = new DataView(out.buffer);
  view.setUint32(0, magic, true); view.setUint32(4, version, true); view.setUint32(8, used, true); view.setUint32(12, block.length, true);
  for (let i = 0; i < block.length; i++) view.setFloat32(BLOCK_HEADER + i * 4, block[i] ?? 0, true);
  return out;
}

/** The baked block, or null when the file is not this build's (another magic, version, placement count or size). */
export function decodeFloatBlock(buf: ArrayBuffer, used: number, floats: number, magic: number, version: number): Float32Array | null {
  if (buf.byteLength !== BLOCK_HEADER + floats * 4) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== magic || view.getUint32(4, true) !== version || view.getUint32(8, true) !== used || view.getUint32(12, true) !== floats) return null;
  const out = new Float32Array(floats);
  for (let i = 0; i < floats; i++) out[i] = view.getFloat32(BLOCK_HEADER + i * 4, true);
  return out;
}

/** The live sun's share of a baked bounce: its luminance × intensity × its elevation over the bake's reference
 *  (`refSunY`, floored at 0.2), or null before the sky has a sun light. */
export function sunBounceLevel(sky: Sky, refSunY: number): number | null {
  const l = sky.csm.lights[0];
  if (!l) return null;
  const lum = l.intensity * (0.2126 * l.color.r + 0.7152 * l.color.g + 0.0722 * l.color.b);
  const elev = Math.max(0, sky.sunDir.y) / Math.max(0.2, refSunY);
  return lum * elev;
}
