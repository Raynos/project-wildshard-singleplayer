import type { BlenderArea as IslandRect } from '@wildshard/engine/world/blenderArea';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import ISLAND_TERRAIN_CLIP from '../../data/islandClips.generated.json' with { type: 'json' };
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { editShader, spliceEdits, type ShaderEditRow } from '@wildshard/game/plugin/shaderFamily';
import type { ISLAND_PROPS, ISLAND_TERRAIN } from './islandLook';
import type { ISLAND_LOOK } from '../../data/islandRows';

/**
 * A baked island's generic parts (SHARD-PLATFORM M3; ex a shard's Blender-island install): an area of the world rebuilt
 * from an offline bake (terrain tiles with baked AO and bounce lightmaps, prototypes and their placements) over the
 * procedural ground it replaces. The shard keeps what is its own — its files, its area, its models and colliders — and
 * gives its looks as rows: the GLSL edits (`ShaderEditRow`s, `@{name}` splicing the numbers this module formats), the
 * patch ids and program keys, the materials' settings, the tile counts and the name patterns that sort the placements.
 *
 * - `bakedTerrainMaterial` / `bakedPropsMaterial`: the toon standard materials of the baked terrain and props (fog, the
 *   sky rig's setup, the AO edits, per-instance tint and the cover's fade-out past each plant's own edge).
 * - `clipGridTerrain`: install the authored terrain clipping facts.
 * - `simplifiedProto`: a prototype's far copy (meshoptimizer), so a tile's far copies keep its near copies' shape.
 * - `protosFromMeshes`, `droppedPlacements`, `usedPlacements`, `placementSets`, `tileRect`: read and sort the bake.
 * - `decodeFloatBlock`: a baked float block's file (a 16-byte header, then the f32s; the generator writes it).
 * - `sunBounceLevel`: how much of the baked bounce the live sun lights.
 */

/** a prototype as the bake holds it: world-space positions, Uint8 RGBA (alpha: its baked AO), index */
export interface IslandProto { pos: Float32Array; col: Uint8Array; index: Uint32Array }

/** a cover fade: every plant stands to `near`, each has its own edge in [near + grow, far] and takes on its ground's
 *  colour over the `grow` m before it; `key` is its program key */
export interface IslandCoverFade { readonly near: number; readonly far: number; readonly grow: number; readonly key: string }

/** The baked terrain's toon material: vertex colours, flat shading, the baked AO and the bounce lightmap (intensity 0
 *  until `sunBounceLevel` sets it), fog and the sky rig's setup. */
export function bakedTerrainMaterial(row: typeof ISLAND_TERRAIN, ao: THREE.Texture, bounce: THREE.Texture, sky: Sky): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.roughness, metalness: 0, aoMap: ao, aoMapIntensity: 1, lightMap: bounce, lightMapIntensity: 0 });
  return toon(mat, row.patch, spliceEdits(row.edits, { aoDirect: row.aoDirect.toFixed(2) }), row.key, sky);
}

/** `mat` with the island's fog and edits (its whole program replaced, keyed `key`) and the sky rig's setup */
function toon(mat: THREE.MeshStandardMaterial, patch: string, edits: readonly ShaderEditRow[], key: string, sky: Sky): THREE.MeshStandardMaterial {
  patchShader(mat, patch, PATCH_ORDER.material, (sh) => {
    attachFogUniforms(sh);
    editShader(sh, edits);
  }, { mode: 'replace', key });
  sky.setupMaterial(mat);
  return mat;
}

/** The baked props' toon material (double-sided, vertex colours whose alpha is the baked AO), tinted per instance when
 *  `tinted`, with the cover's fade when `cover` is given. */
export function bakedPropsMaterial(row: typeof ISLAND_PROPS, sky: Sky, cover: IslandCoverFade | null, tinted = true): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.roughness, metalness: 0, side: THREE.DoubleSide });
  const edits: ShaderEditRow[] = [...row.ao, ...(tinted ? row.tint : [])];
  if (cover !== null) edits.push(...spliceEdits(row.fade, { edgeNear: (cover.near + cover.grow).toFixed(1), far: cover.far.toFixed(1), grow: cover.grow.toFixed(1) }));
  return toon(mat, row.patch, edits, (cover !== null ? cover.key : row.key) + (tinted ? row.tintKey : ''), sky);
}

/** Install the authored grid's retained index runs; another topology is not this island bake. */
export function clipGridTerrain(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry, source = geometry.getIndex();
  if (source === null || source.count !== ISLAND_TERRAIN_CLIP.sourceIndices || geometry.getAttribute('position').count !== ISLAND_TERRAIN_CLIP.sourceVertices || ISLAND_TERRAIN_CLIP.ranges.length > 512) throw new Error('Baked island terrain topology differs; rebuild its declared clipping facts');
  const out = new Uint32Array(ISLAND_TERRAIN_CLIP.outputIndices); let offset = 0;
  for (let i = 0; i < 512; i++) { // At most two retained runs per authored grid row.
    const row = ISLAND_TERRAIN_CLIP.ranges[i]; if (row === undefined) break;
    out.set(source.array.subarray(row.start, row.start + row.count), offset); offset += row.count;
  }
  geometry.setIndex(new THREE.BufferAttribute(out, 1));
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

/** How the placements sort: by prototype kind and name (data/islandRows.ts `names`), and the tile counts per side (the
 *  casters' set and the two cover sets). */
type PlacementSetsRow = typeof ISLAND_LOOK.names & { readonly casterTiles: number; readonly coverTiles: number };

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

/** A baked float block (a 16-byte header: magic, version, the placements it was baked from, floats; then the f32s,
 *  little-endian), or null when the file is not this build's (another magic, version, placement count or size). */
export function decodeFloatBlock(buf: ArrayBuffer, used: number, floats: number, magic: number, version: number): Float32Array | null {
  if (buf.byteLength !== BLOCK_HEADER + floats * 4) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== magic || view.getUint32(4, true) !== version || view.getUint32(8, true) !== used || view.getUint32(12, true) !== floats) return null;
  if(new Uint8Array(new Uint32Array([1]).buffer)[0]!==1)return null;
  return new Float32Array(buf,BLOCK_HEADER,floats);
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
