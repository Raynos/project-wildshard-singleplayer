import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import ISLAND_TERRAIN_CLIP from '../../data/islandClips.generated.json' with { type: 'json' };
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { GraphLiteral } from '@wildshard/format/materialGraph';

/**
 * A baked island's generic parts (SHARD-PLATFORM M3; ex a shard's Blender-island install): an area of the world rebuilt
 * from an offline bake (terrain tiles with baked AO and bounce lightmaps, prototypes and their placements) over the
 * procedural ground it replaces. The shard keeps what is its own — its files, its area, its models and colliders — and
 * gives its looks as graph toon materials (data/islandLook.ts) and rows: the tile counts and the name patterns that sort
 * the placements.
 *
 * - `setIslandLooks` / `islandLooks`: the compiled graph looks the runtime lends the island before the world builds.
 * - `clipGridTerrain`: install the authored terrain clipping facts.
 * - `simplifiedProto`: a prototype's far copy (meshoptimizer), so a far copy keeps its near copy's shape.
 * - `protosFromMeshes`, `droppedPlacements`, `usedPlacements`: read and sort the bake.
 * - `decodeFloatBlock`: a baked float block's file (a 16-byte header, then the f32s; the generator writes it).
 * - `sunBounceLevel`: how much of the baked bounce the live sun lights.
 */

/** a prototype as the bake holds it: world-space positions, Uint8 RGBA (alpha: its baked AO), index */
export interface IslandProto { pos: Float32Array; col: Uint8Array; index: Uint32Array }

/** The island's compiled graph looks (look.materials, data/islandLook.ts) with their param / texture writers and their toon
 *  look's once-a-frame follow of the day clock. */
export interface IslandLooks {
  readonly material: (id: string) => THREE.Material;
  readonly param: (id: string, name: string, value: GraphLiteral) => void;
  readonly texture: (id: string, name: string, texture: THREE.Texture) => void;
  readonly follow: () => void;
}
let lent: IslandLooks | null = null;

/** Hand the island its compiled graph looks, their writers and their toon look's follow, before the world builds. */
export function setIslandLooks(materials: ReadonlyMap<string, THREE.Material>, param: IslandLooks['param'], texture: IslandLooks['texture'], follow: () => void): void {
  lent = { follow, param, texture, material: (id) => { const m = materials.get(id); if (m === undefined) throw new Error(`Baked island: look.materials lacks ${id}`); return m; } };
}

/** The island's lent looks; throws when the runtime lent none (there is no classic stand-in). */
export function islandLooks(): IslandLooks {
  if (lent === null) throw new Error('Baked island: no graph looks lent (the runtime compiles them before the world builds)');
  return lent;
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
