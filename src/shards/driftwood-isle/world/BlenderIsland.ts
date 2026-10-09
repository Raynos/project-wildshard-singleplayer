/**
 * The Blender-built island (DRIFTWOOD-REMASTER X2, E52): on Driftwood it always replaces the procedural spawn cove —
 * terrain, palms, bushes, shore boulders, ground cover inside `area` (./blenderArea.ts) — with the one scripts/blender/
 * builds in Blender and bakes in Cycles (the user's pick, E7; the switch is gone since E136). The procedural cove is still
 * built before this install, then replaced or clipped inside the area. That construction is remaining loading
 * work, not a supported load-failure fallback: a required island asset failure refuses boot.
 * What this file computes from its committed files alone is baked at build (SF67 fix 3): the cover splat (`islandCoverUrl`,
 * scripts/bake-island-cover.mjs).
 *
 *   island = await BlenderIsland.install({ game, sky, player, terrain, palms, … });
 *
 * What loads (public/assets/models/driftwood-blender/, written by `pnpm blender:island`):
 * - island.glb: the area's terrain in 2×2 tiles (vertex colour + a planar lightmap UV) and ~60 prototypes (palms, faceted
 *   rocks, ferns, hibiscus, bushes, flowers, grass, beach grass, shells, starfish, pebbles, driftwood) whose vertex colour
 *   alpha is their Cycles-baked AO; meshopt-compressed.
 * - placements.bin (f32 × 10: proto, x, y, z, quaternion, scale, tint) + island.json (colliders, extra palms, bake notes):
 *   each prototype is uploaded once and drawn instanced per tile set {casters, small cover, big cover}, the tiles kept as
 *   the unit of reach and view (./islandInstances.ts; G144 / G173, E435: the merged tiles held a world-space copy of every
 *   vertex, ~104 MB). The phone builds every palm / rock / log and 70 % of the small cover (the file is ordered so that is
 *   a prefix).
 * - E306 / E315 M1: the prototypes are models (src/shards/driftwood-isle/models/cove.ts, one per family): the instanced
 *   meshes are the cove's own drawing of their copies, so each family is placed with `drawnInto` (its copies, boxes and card; nothing
 *   drawn twice). The scattered small rocks are the small-rock model (rockKit), placed merged (src/engine/models/place.ts).
 * - lm-ao / lm-bounce (.phone).webp: the terrain's baked GI — sky AO (5 m) and the sun's one-to-three-bounce indirect light.
 *
 * Lighting (the decision, see scripts/blender/README.md): the sun and its shadows stay dynamic (the toon ramp + CSM on the
 * 24-min day/night clock); the bake supplies only what the clock does not move much — the AO multiplies the hemisphere fill
 * the clock tints, and the bounce is added in proportion to the live sun (colour × intensity × its elevation over the
 * bake's reference). One bake, right at every time of day, no per-preset textures.
 *
 * Gameplay does not change: the Blender terrain sits on the exact heights `heightAt` walks (sampled from the same bake), the
 * game's own palms and boulders in the area keep their colliders (the Blender ones stand on the same spots), and the new
 * palms and the reachable crag rocks add theirs — E344: on their models (the cove palm / broad-frond palm / crag plate
 * families' pieces, `placeModels`), no longer on the P2 bridge. `palmSpecs` gains the new palms (the monkeys climb them).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { CELL } from '@wildshard/engine/world/blenderArea';
import { area, inArea, BLENDER_MODELS } from './blenderArea';
import type { PalmSpec } from './Palms';
import { WORLD_DROP } from './sea';
import { smallRock, type SmallRockParams } from '../models/smallRock';
import { COVE_MODELS, coveFamilyOf, coveProtos, type CoveFamily, type CoveParams } from '../models/cove';
import { CoverGrid, tintTerrain, triAreas, coverSample, coverJitter, type CoverTri } from './coverTint';
import { IslandInstances, TINT_VERTEX, type CoverTriangle } from './islandInstances';
import { slicer } from '@wildshard/engine/boot/plan';
import { CHUNK_HALF, TERRAIN_RES } from '@wildshard/engine/core/config';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { TIER, type Tier } from '@wildshard/engine/core/tier';
import { modelContext, type ModelContext, type Placement } from '@wildshard/engine/models/model';
import { place as placeModel, placeSliced } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { boxDesc, type ColliderDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const BASE = BLENDER_MODELS; // Driftwood's build: its palms / toon / sea are this file's own
/** tiles per side: the casters (palms, rocks, logs; near + far copies) and the ground cover */
const CT = TIER === 'phone' ? 6 : 3, VT = TIER === 'phone' ? 8 : 4;
/** the phone's share of the small ground cover (the palms, rocks and logs always build) */
const PHONE_COVER = 0.7;
/** how much of the terrain's baked AO reaches the direct sun (0 = physically only the fill) */
const AO_DIRECT = 0.45;
/**
 * Past this (m, camera to the tile's rect) a caster tile draws its far copy / a cover tile is not drawn. Nothing swaps
 * or blinks where you can see it (E90): the palms keep their full model to 110 m on the phone too (at 24 m whole tiles
 * of palms swapped to the 227-tri copy, and — the far copies casting none — their shadows vanished with them), and
 * every far copy casts, so no shadow comes or goes at the swap (a low sun throws a palm's shadow 50 m and more).
 * Measured on the phone tier, four cove poses (with tier.ts's animal shadows to 80 m): +176–274 k triangles (+18–31 %),
 * +25–30 draws over the 24 m swap.
 */
/**
 * Ground cover thins out plant by plant instead of its tile blinking off (E117): every plant inside COVER_NEAR stands; past
 * it each plant has its own edge in [COVER_NEAR + COVER_GROW, COVER_FAR] (a per-vertex `aEdge`, one value per placement),
 * takes on the ground's colour and shade over the COVER_GROW m before it and is gone past it (E156: it used to sink 3 m into
 * the ground there, which read as the plants bouncing), measured from its base (`aBase`), so the whole plant goes at once.
 */
const COVER_NEAR = TIER === 'phone' ? 16 : 100, COVER_FAR = TIER === 'phone' ? 40 : 148, COVER_GROW = TIER === 'phone' ? 6 : 12;
const LOD_D = 110;
/**
 * E156: the big cover — the bushes, the flowering bushes, the hibiscus and the ferns — keeps its reach far longer on the phone.
 * At COVER_NEAR / COVER_FAR a 1.5 m bush rose out of the ground 16–40 m ahead as you ran at it (Jake's video, 2026-09-25,
 * by the pier: "they still pop in"), where the rest of the island's cover (GroundCover.ts) stands to 38 m and keeps a far
 * model to 76 m. They get their own tiles: each stands to BIG_NEAR and sinks at its own edge in [BIG_NEAR + BIG_GROW, BIG_FAR],
 * over ground the cover grid already tints the colour of the cover (coverTint.ts). The small cover (tufts, beach grass,
 * flowers) keeps the short reach: at 20 m+ it is a few pixels over the tinted ground.
 */
const BIG_COVER = /^(bush|flowerbush|hibiscus|fern)\d+$/;
const BIG_NEAR = TIER === 'phone' ? 50 : COVER_NEAR, BIG_FAR = TIER === 'phone' ? 80 : COVER_FAR, BIG_GROW = TIER === 'phone' ? 10 : COVER_GROW;
/**
 * E117: a caster tile's far copy is its near one simplified (meshoptimizer: to FAR_RATIO of the triangles, never past
 * FAR_ERROR of the model's size — ~8 cm on a palm, under a pixel at LOD_D), not the file's hand-made `_lo` palms: those
 * (227 tris) have another crown, a thinner trunk and another height, so a whole tile of palms changed shape at LOD_D as
 * you flew. ~780 tris a palm instead of 227; the swap can no longer be seen.
 */
const FAR_RATIO = 0.25, FAR_ERROR = 0.01;

export interface Proto { pos: Float32Array; col: Uint8Array; index: Uint32Array }
/** `p` with its triangles simplified and its vertices compacted to the ones they use */
function simplified(p: Proto): Proto {
  const target = Math.max(3, Math.floor((p.index.length * FAR_RATIO) / 3) * 3);
  const [idx] = MeshoptSimplifier.simplify(p.index, p.pos, 3, target, FAR_ERROR);
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

export interface IslandMeta {
  version: number;
  protos: { name: string; kind: string; tris: number }[];
  placements: number;
  mustDraw: number;
  /** proto index → its far (LOD) proto */
  lod: Record<string, number>;
  colliders: Collider[];
  extraPalms: PalmSpec[];
  bake: { bounceGain: number; refSun: [number, number, number] };
}

export interface BlenderIslandCtx {
  scene: THREE.Scene;
  sky: Sky;
  registry: WorldRegistry;
  terrain: THREE.Mesh;
  palms: THREE.Mesh | null;
  palmSpecs: PalmSpec[];
  /** merged world-space meshes the area replaces (bushes) */
  replace: (THREE.Mesh | null)[];
  /** GroundCover's group: its instanced plants are hidden inside the area, its static logs dropped there */
  cover: THREE.Object3D | null;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
const _v = new THREE.Vector3();
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;

/** keep only the triangles `keep(cx, cz)` accepts (centroid, world xz — the merged meshes are built in world space) */
function dropTriangles(geo: THREE.BufferGeometry, keep: (x: number, z: number) => boolean): number {
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

/** the procedural terrain loses the area's whole cells (its index is (iz·(res−1) + ix)·6, Terrain.buildLowPolyGeometry) */
function clipTerrain(mesh: THREE.Mesh): void {
  const idx = mesh.geometry.getIndex();
  if (idx === null) return;
  const n = TERRAIN_RES - 1;
  if (idx.count !== n * n * 6) { dropTriangles(mesh.geometry, (x, z) => !inArea(x, z)); return; }
  const cx0 = Math.round((area.x0 + CHUNK_HALF) / CELL), cx1 = Math.round((area.x1 + CHUNK_HALF) / CELL);
  const cz0 = Math.round((area.z0 + CHUNK_HALF) / CELL), cz1 = Math.round((area.z1 + CHUNK_HALF) / CELL);
  const out = new Uint32Array(idx.count - (cx1 - cx0) * (cz1 - cz0) * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    if (ix >= cx0 && ix < cx1 && iz >= cz0 && iz < cz1) continue;
    const o = (iz * n + ix) * 6;
    for (let j = 0; j < 6; j++) out[k++] = idx.getX(o + j);
  }
  mesh.geometry.setIndex(new THREE.BufferAttribute(out, 1));
}

/** instanced plants: collapse an instance whose origin is inside the area (vertex shader, no discard, no CPU per frame) */
function clipInstanced(mat: THREE.Material): void {
  const f = (v: number) => v.toFixed(3);
  patchShader(mat, 'driftwood.island-clip', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
	{ vec4 io = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	  if ( io.x > ${f(area.x0)} && io.x < ${f(area.x1)} && io.z > ${f(area.z0)} && io.z < ${f(area.z1)} ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }
#endif`);
  }, { key: (k) => `${k}|island-clip` });
  mat.needsUpdate = true;
}

/** E156 / G144: each cover triangle's centre, ground / upright areas and colour, for CoverGrid.splat, from the instanced
 *  placements (./islandInstances.ts) in world space */
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

/** how much of the cover the splat turns into optical depth (fronds overlap) */
const COVER_DEPTH = 0.6;

/**
 * SF67 (E461): the cove's cover splat, baked. `CoverGrid.splat` overwrites every cell of the area from the instanced cover
 * triangles alone (whatever GroundCover filled there before), so the area's block is a pure function of island.glb,
 * placements.bin, island.json and the tier: scripts/bake-island-cover.mjs runs this same code in Node per tier and writes
 * it next to the island's other files, the build writes it back (`CoverGrid.writeBlock`) instead of walking ~1 M triangles at load, and splats only when
 * the file is missing or does not fit. bake-check (`--check`) rebuilds it byte for byte, so a stale bake fails the gate.
 */
export const islandCoverUrl = (tier: Tier): string => (tier === 'phone' ? '/assets/models/driftwood-blender/island-cover.phone.bin' : '/assets/models/driftwood-blender/island-cover.desktop.bin');
const COVER_MAGIC = 0x43495357, COVER_VERSION = 1, COVER_HEADER = 16; // 'WSIC' · version · placements used · floats

/** the area's splatted block (`CoverGrid.readBlock`) from the cover sets' triangles */
export function islandCoverBlock(tris: Iterable<CoverTriangle>): Float32Array {
  const grid = new CoverGrid();
  grid.splat(instancedCoverTriangles(tris), area.x0, area.x1, area.z0, area.z1, COVER_DEPTH);
  return grid.readBlock(area.x0, area.x1, area.z0, area.z1);
}

/** the baked file: a 16-byte header (magic, version, placements used, floats) and the block's f32s, little-endian */
export function encodeIslandCover(block: Float32Array, used: number): Uint8Array {
  const out = new Uint8Array(COVER_HEADER + block.length * 4), view = new DataView(out.buffer);
  view.setUint32(0, COVER_MAGIC, true); view.setUint32(4, COVER_VERSION, true); view.setUint32(8, used, true); view.setUint32(12, block.length, true);
  for (let i = 0; i < block.length; i++) view.setFloat32(COVER_HEADER + i * 4, block[i] ?? 0, true);
  return out;
}

/** the baked block, or null when the file is not this build's (another version, placement count or rect) */
export function decodeIslandCover(buf: ArrayBuffer, used: number, floats: number): Float32Array | null {
  if (buf.byteLength !== COVER_HEADER + floats * 4) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== COVER_MAGIC || view.getUint32(4, true) !== COVER_VERSION || view.getUint32(8, true) !== used || view.getUint32(12, true) !== floats) return null;
  const out = new Float32Array(floats);
  for (let i = 0; i < floats; i++) out[i] = view.getFloat32(COVER_HEADER + i * 4, true);
  return out;
}

/** the prototypes from island.glb's meshes (world-space positions, Uint8 colour + baked AO), by island.json's index */
export function islandProtos(found: readonly THREE.Mesh[], meta: IslandMeta): Proto[] {
  const protos: Proto[] = [];
  const protoIndex = new Map<string, number>(meta.protos.map((p, i) => [`proto_${p.name}`, i]));
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

/** placements.bin as the build reads it: each placement's y dropped with the world (G164) */
export function islandPlacements(buf: ArrayBuffer): Float32Array {
  const f = new Float32Array(buf);
  for (let i = 0; i < f.length / 10; i++) f[i * 10 + 2] = (f[i * 10 + 2] ?? 0) - WORLD_DROP;
  return f;
}

/** how many placements this tier builds (every palm / rock / log, and the tier's share of the small cover: a prefix) */
export function islandUsed(f: Float32Array, meta: IslandMeta, phone: boolean): number {
  return meta.mustDraw + Math.round((f.length / 10 - meta.mustDraw) * (phone ? PHONE_COVER : 1));
}

/** the placements by set and tile: casters CT×CT, small cover and big cover VT×VT; the small rocks rockKit rebuilds */
export function islandSets(f: Float32Array, meta: IslandMeta, used: number): { casters: number[][]; covers: number[][]; bigs: number[][]; smallRocks: number[] } {
  const tileOf = (x: number, z: number, n: number) => {
    const tx = Math.min(n - 1, Math.max(0, Math.floor((x - area.x0) / (area.x1 - area.x0) * n)));
    const tz = Math.min(n - 1, Math.max(0, Math.floor((z - area.z0) / (area.z1 - area.z0) * n)));
    return tz * n + tx;
  };
  const casters: number[][] = Array.from({ length: CT * CT }, () => []), covers: number[][] = Array.from({ length: VT * VT }, () => []), bigs: number[][] = Array.from({ length: VT * VT }, () => []);
  // E114: the loose rocks are rockKit's — the boulders (rock*, rockb*: the shore boulders' spots, drawn by Boulders.ts
  // instead) are skipped, the small scattered rocks (smallrock*) rebuilt below. The crag plates on the cliffs (cliff*)
  // stay the Blender ones
  const smallRocks: number[] = [];
  for (let i = 0; i < used; i++) {
    const pi = f[i * 10] ?? 0, kind = meta.protos[pi]?.kind ?? 'small';
    const x = f[i * 10 + 1] ?? 0, z = f[i * 10 + 3] ?? 0;
    const name = meta.protos[pi]?.name ?? '';
    if (/^rockb?\d+$/.test(name)) continue;
    if (/^smallrock\d+$/.test(name)) { smallRocks.push(i); continue; }
    if (kind === 'palm' || kind === 'rock' || kind === 'prop') casters[tileOf(x, z, CT)]?.push(i); else (BIG_COVER.test(name) ? bigs : covers)[tileOf(x, z, VT)]?.push(i);
  }
  return { casters, covers, bigs, smallRocks };
}

function load<T>(f: (ok: (v: T) => void, bad: (e: unknown) => void) => void): Promise<T> { return new Promise<T>((resolve, reject) => { f(resolve, reject); }); }

export class BlenderIsland {
  /** the area the island covers (GroundCover leaves it to the island's own dressing, E156) */
  static readonly area = area;
  group = new THREE.Group();
  stats = { terrainTris: 0, propTris: 0, placements: 0, draws: 0 };
  private terrainMat!: THREE.MeshStandardMaterial;
  private meta!: IslandMeta;
  private sunLum = 0;
  /** G144: the instanced placements, repacked in `late` (null until the build has made them) */
  instances: IslandInstances | null = null;

  static async install(ctx: BlenderIslandCtx): Promise<BlenderIsland> {
    const island = new BlenderIsland();
    await island.build(ctx);
    return island;
  }

  private async build(ctx: BlenderIslandCtx): Promise<void> {
    const phone = TIER === 'phone';
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const tex = new THREE.TextureLoader();
    // E157: the lightmaps' KTX2 stand-ins when there are some (baked unflipped: these load flipY = false, below)
    const lm = async (name: string): Promise<THREE.Texture> => {
      const url = `${BASE}${name}${phone ? '.phone' : ''}.webp`;
      return (await ktx2Texture(url)) ?? load<THREE.Texture>((ok, bad) => { tex.load(url, ok, undefined, bad); });
    };
    const [gltf, meta, place, ao, bounce, bakedCover] = await Promise.all([
      load<{ scene: THREE.Group }>((ok, bad) => { loader.load(`${BASE}island.glb`, ok, undefined, bad); }),
      fetch(`${BASE}island.json`).then((r) => r.json() as Promise<IslandMeta>),
      fetch(`${BASE}placements.bin`).then((r) => r.arrayBuffer()),
      lm('lm-ao'), lm('lm-bounce'),
      fetch(islandCoverUrl(TIER)).then((r) => (r.ok ? r.arrayBuffer() : null), () => null), // SF67: the baked cover splat
    ]);
    // G164: the cove was baked on the authored heights; it drops with the whole world (its tiles,
    // every placement and every collider box), so it stays on the dropped terrain exactly
    const drop = WORLD_DROP;
    for (const c of meta.colliders) { c.yTop -= drop; c.yBottom -= drop; }
    this.meta = meta;
    for (const t of [ao, bounce]) { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 0; t.anisotropy = 4; t.needsUpdate = true; }

    // ── materials: the shard's toon lighting (stylize.ts), fog, CSM — plus the bake ──
    const terrainMat = this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, aoMap: ao, aoMapIntensity: 1, lightMap: bounce, lightMapIntensity: 0 });
    patchShader(terrainMat, 'driftwood.island-terrain', PATCH_ORDER.material, (sh) => {
      attachFogUniforms(sh);
      // the baked AO also grounds the direct light a little: contact shade under the palms, the rocks, the pier
      sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, ${AO_DIRECT.toFixed(2)} );`);
    }, { mode: 'replace', key: 'island-terrain' });
    ctx.sky.setupMaterial(terrainMat);
    const makePropsMat = (cover: { near: number; far: number; grow: number; key: string } | null, tinted = true) => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
      patchShader(mat, 'driftwood.island-props', PATCH_ORDER.material, (s) => {
        attachFogUniforms(s);
        // the colour's alpha is the prototype's Cycles AO: all of the fill, a little of the sun (the crown's inner fronds)
        s.fragmentShader = s.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= vColor.a;
	reflectedLight.directDiffuse *= mix( 1.0, vColor.a, 0.35 );`);
        // E156: past its edge a plant is gone, and over the COVER_GROW m before it it takes on the colour and shade of the
        // ground it stands on (the cover grid's, as the tinted terrain draws it far out) — it no longer sinks into the
        // ground (Jake: the plants "bouncing like they're being reanimated"). Measured from the plant's own base (aBase,
        // per instance), so the whole plant goes at once.
        // G144: each placement's tint is applied per vertex as the merged tiles baked it (./islandInstances.ts)
        if (tinted) s.vertexShader = s.vertexShader.replace('#include <common>', TINT_VERTEX.common).replace('#include <color_vertex>', TINT_VERTEX.color);
        if (cover !== null) {
          s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aEdge;\nattribute vec3 aBase;\nattribute vec4 aGround;\nvarying vec4 vGround;\nvarying float vFar;\nvarying float vGone;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
	{ float edge = mix( ${(cover.near + cover.grow).toFixed(1)}, ${cover.far.toFixed(1)}, aEdge ), d = distance( aBase, cameraPosition );
	  vFar = smoothstep( edge - ${cover.grow.toFixed(1)}, edge, d ) * aGround.a; vGround = aGround; vGone = step( edge, d ); }`)
            .replace('#include <project_vertex>', '#include <project_vertex>\n\tif ( vGone > 0.5 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );');
          s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vGround;\nvarying float vFar;')
            .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, vGround.rgb, vFar );')
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( mix( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), vFar ) );');
        }
      }, { mode: 'replace', key: (cover !== null ? cover.key : 'island-props') + (tinted ? '|inst' : '') });
      ctx.sky.setupMaterial(mat);
      return mat;
    };
    const propsMat = makePropsMat(null), coverMat = makePropsMat({ near: COVER_NEAR, far: COVER_FAR, grow: COVER_GROW, key: 'island-cover' });
    const bigMat = makePropsMat({ near: BIG_NEAR, far: BIG_FAR, grow: BIG_GROW, key: 'island-cover-big' });

    // ── terrain tiles ──
    gltf.scene.updateMatrixWorld(true);
    const models = modelContext(ctx.sky);
    const found: THREE.Mesh[] = [], terrainTiles: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) found.push(o); });
    const protoNames = new Set(meta.protos.map((p) => `proto_${p.name}`));
    for (const o of found) {
      if (protoNames.has(o.name)) continue;
      // a terrain tile — the 1 m grid on desktop, the 2 m one (terrainlo_*) on the phone; keep its node transform (meshopt's
      // dequantisation lives there)
      if (o.name.startsWith('terrainlo') !== phone) continue;
      const m = new THREE.Mesh(o.geometry, terrainMat);
      m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrix.elements[13] -= drop; m.matrixWorld.copy(m.matrix);
      m.name = `island-${o.name}`; m.castShadow = true; m.receiveShadow = true;
      terrainTiles.push(m);
      if (!o.geometry.hasAttribute('normal')) o.geometry.computeVertexNormals(); // lighting is flat (derivatives); the normals are the shadows' normal bias
      o.geometry.computeBoundingSphere();
      this.group.add(m);
      this.stats.terrainTris += (o.geometry.getIndex()?.count ?? o.geometry.getAttribute('position').count) / 3;
    }
    const protos = islandProtos(found, meta);
    // SF67: the build ends its task at each ~30 ms between its sections (the order and every result are unchanged)
    const slice = slicer();
    await slice();

    // ── the placements by tile: casters (palms, rocks, logs) CT×CT, each with a far copy (the LOD palms); ground cover
    //    VT×VT, drawn only near the camera ──
    const f = islandPlacements(place); // G164: each placement's y
    const count = f.length / 10;
    const used = islandUsed(f, meta, phone);
    const lodOf = new Map<number, number>(Object.entries(meta.lod).map(([k, lo]) => [Number(k), lo]));
    await MeshoptSimplifier.ready;
    for (const [pi, lo] of lodOf) { const near = protos[pi]; if (near) protos[lo] = simplified(near); await slice(); } // E117: far = near, simplified
    const { casters, covers, bigs, smallRocks } = islandSets(f, meta, used);
    const rect = (k: number, n: number) => {
      const w = (area.x1 - area.x0) / n, d = (area.z1 - area.z0) / n, tx = k % n, tz = Math.floor(k / n);
      return { x0: area.x0 + tx * w, x1: area.x0 + (tx + 1) * w, z0: area.z0 + tz * d, z1: area.z0 + (tz + 1) * d };
    };
    // G144: one InstancedMesh per prototype × set, the tiles kept as the unit of reach and view (./islandInstances.ts)
    const ins = this.instances = new IslandInstances(this.group, protos, meta.protos.map((p) => p.name), f, lodOf);
    ins.add({ tag: 'casters', tiles: casters, rects: casters.map((_, k) => rect(k, CT)), material: propsMat, cast: true, reach: 0, lod: LOD_D, cover: false });
    await slice();
    ins.add({ tag: 'cover', tiles: covers, rects: covers.map((_, k) => rect(k, VT)), material: coverMat, cast: false, reach: COVER_FAR + 1, lod: LOD_D, cover: true });
    await slice();
    ins.add({ tag: 'cover-big', tiles: bigs, rects: bigs.map((_, k) => rect(k, VT)), material: bigMat, cast: false, reach: BIG_FAR + 1, lod: LOD_D, cover: true });
    await slice();
    for (const set of [casters, covers, bigs]) for (const items of set) for (const i of items) this.stats.propTris += (protos[f[i * 10] ?? 0]?.index.length ?? 0) / 3;
    // E156: the cove's ground wears the cover it carries (coverTint.ts) — what was placed here, splatted into the grid over
    // GroundCover's estimate for this area, then sampled by the cove's terrain
    const coverGrid = CoverGrid.get();
    if (coverGrid) {
      // SF67: the build-time splat when there is one that fits (bit for bit the splat below: bake-check rebuilds it)
      const baked = bakedCover === null ? null : decodeIslandCover(bakedCover, used, coverGrid.blockLength(area.x0, area.x1, area.z0, area.z1));
      if (baked === null || !coverGrid.writeBlock(baked, area.x0, area.x1, area.z0, area.z1)) coverGrid.splat(instancedCoverTriangles(ins.coverTriangles()), area.x0, area.x1, area.z0, area.z1, COVER_DEPTH);
      // each cover plant's fade-out colour: the grid's at its base (a = 0 where the grid has none: it keeps its own)
      const smp = coverSample();
      ins.fillGround((x, z, out, o) => {
        coverGrid.sample(x, z, smp);
        const ok = smp.top + smp.side > 0.01, j = coverJitter(x, z), byte = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255);
        out[o] = byte(smp.r * j); out[o + 1] = byte(smp.g * j); out[o + 2] = byte(smp.b * j); out[o + 3] = ok ? 255 : 0;
      });
      for (const tile of terrainTiles) tintTerrain(tile);
      await slice();
    }
    if (smallRocks.length > 0) {
      // E315 M1: the small-rock model, merged into one mesh (piece `cove-small-rocks`; it used to hang in this group)
      const rocks = await placeSliced(smallRock, this.smallRocks(smallRocks, f, protos), { ctx: models, draw: 'merged', piece: { id: 'cove-small-rocks' } }, slice.due);
      rocks.object.traverse((o) => { if (isMesh(o)) this.stats.propTris += o.geometry.getAttribute('position').count / 3; });
    }
    this.stats.placements = used;
    this.stats.draws = this.group.children.length;
    this.group.name = 'blender-island';
    ctx.scene.add(this.group);
    // the specimens draw with an untinted props material (a single specimen has no per-instance `aTint`)
    const unclaimed = await this.placeModels(models, f, used, meta, protos, makePropsMat(null, false));

    // ── hide what the area replaces ──
    clipTerrain(ctx.terrain);
    await slice();
    if (ctx.palms) {
      // a triangle belongs to the nearest palm (its fronds reach 5 m out); drop the palms standing in the area
      const cellOf = (x: number, z: number) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
      const grid = new Map<string, PalmSpec[]>();
      for (const p of ctx.palmSpecs) { const k = cellOf(p.x, p.z); const l = grid.get(k); if (l) l.push(p); else grid.set(k, [p]); }
      dropTriangles(ctx.palms.geometry, (x, z) => {
        let best: PalmSpec | null = null, bd = Infinity;
        const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
          const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; }
        }
        return best === null || !inArea(best.x, best.z, 1);
      });
      await slice();
    }
    for (const r of ctx.replace) if (r) { dropTriangles(r.geometry, (x, z) => !inArea(x, z)); await slice(); }
    if (ctx.cover) {
      const clipped = new Set<THREE.Material>(), coverMeshes: THREE.Mesh[] = [];
      ctx.cover.traverse((o) => {
        if (isInstanced(o)) { for (const mm of Array.isArray(o.material) ? o.material : [o.material]) if (!clipped.has(mm)) { clipped.add(mm); clipInstanced(mm); } }
        else if (isMesh(o)) coverMeshes.push(o);
      });
      for (const m of coverMeshes) { dropTriangles(m.geometry, (x, z) => !inArea(x, z)); await slice(); }
    }

    // ── gameplay ──
    ctx.registry.add({ id: 'cove-unclaimed', name: 'Cove rocks', category: 'nature', file: 'src/shards/driftwood-isle/world/BlenderIsland.ts', colliders: unclaimed.map((c) => boxDesc(c, 'wood')), surface: 'wood', solidFloor: false });
    ctx.palmSpecs.push(...meta.extraPalms);
    this.update(ctx.sky);
    console.info(`[island] blender: terrain ${this.stats.terrainTris} tris, props ${this.stats.propTris} tris in ${this.stats.draws} meshes, ${used}/${count} placements (${TIER})`);
  }

  /**
   * E114: the scattered small rocks as rockKit rocks — each at its placement's spot, tilt and yaw, as wide and as tall as
   * the Blender rock it replaces; one lighter build (detail −1) since there are ~400: the small-rock model's placements.
   */
  private smallRocks(items: number[], f: Float32Array, protos: Proto[]): Placement<SmallRockParams>[] {
    const size = new Map<number, { half: number; top: number }>();
    const sizeOf = (pi: number): { half: number; top: number } => {
      const hit = size.get(pi);
      if (hit) return hit;
      const pr = protos[pi];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
      if (pr) for (let k = 0; k < pr.pos.length; k += 3) {
        const x = pr.pos[k] ?? 0, y = pr.pos[k + 1] ?? 0, z = pr.pos[k + 2] ?? 0;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y);
      }
      const out = { half: Number.isFinite(x0) ? Math.max(x1 - x0, z1 - z0) / 2 : 0.4, top: y1 > 0 ? y1 : 0.25 };
      size.set(pi, out);
      return out;
    };
    const q = new THREE.Quaternion(), t = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    return items.map((i) => {
      const o = i * 10, pi = f[o] ?? 0, sc = f[o + 8] ?? 1, { half, top } = sizeOf(pi);
      t.set(f[o + 1] ?? 0, f[o + 2] ?? 0, f[o + 3] ?? 0); q.set(f[o + 4] ?? 0, f[o + 5] ?? 0, f[o + 6] ?? 0, f[o + 7] ?? 1);
      const r = (half * sc) / 1.1, sq = THREE.MathUtils.clamp((top * sc) / (0.92 * r), 0.4, 0.9);
      return { x: t.x, y: t.y, z: t.z, matrix: new THREE.Matrix4().compose(t, q, one), params: { r, sq } };
    });
  }

  /**
   * E315 M1: the cove's prototypes are models (one per family, src/shards/driftwood-isle/models/cove.ts). The instanced
   * meshes above are their drawing, so each family is placed `drawnInto` this group: its copies (the placements this tier
   * builds), each copy's world box, and the model's catalog card; `place` draws nothing. The specimens read the loaded
   * prototypes and the casters' material from the shard's model context.
   *
   * E344: the cove's collider boxes are its copies'. island.json's 200 `colliders` (build_island.py) are one box per extra
   * palm (its trunk: 0.6 m square, from a metre under its foot to its crown) and one per reachable crag plate (a box a
   * little inside the rock, 3 m into the ground), each standing on its copy's spot exactly (placements.bin holds the same
   * x, z in f32). So each goes to that copy's family: the colliders the copies made as they were fitted to the ground,
   * in world space (`drawnInto.colliders`: the palm, broad-frond palm and crag plate pieces), each the box the P2 bridge
   * mirrored (`boxDesc`: the same centre, half extents and turn) in 'wood', as the bridge tagged it. Returns the boxes no
   * copy claims (none: they would stay on the bridge).
   */
  private async placeModels(models: ModelContext, f: Float32Array, used: number, meta: IslandMeta, protos: Proto[], material: THREE.Material): Promise<Collider[]> {
    const byName = new Map<string, Proto>();
    meta.protos.forEach((p, i) => { const pr = protos[i]; if (pr) byName.set(p.name, pr); });
    coveProtos(models, { protos: byName, material });
    const local = protos.map((pr) => {
      const b = new THREE.Box3();
      for (let k = 0; k < pr.pos.length; k += 3) b.expandByPoint(_v.set(pr.pos[k] ?? 0, pr.pos[k + 1] ?? 0, pr.pos[k + 2] ?? 0));
      return b;
    });
    const fam = new Map<CoveFamily, { pls: Placement<CoveParams>[]; boxes: number[]; colliders: ColliderDesc[] }>();
    // the boxes by the spot they stand on, as placements.bin holds it (f32)
    const spot = (x: number, z: number): string => `${x},${z}`;
    const claim = new Map<string, Collider>();
    for (const c of meta.colliders) claim.set(spot(Math.fround(c.x), Math.fround(c.z)), c);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Box3();
    for (let i = 0; i < used; i++) {
      const o = i * 10, pi = f[o] ?? 0, name = meta.protos[pi]?.name ?? '', key = coveFamilyOf(name), lb = local[pi];
      if (key === undefined || lb === undefined) continue;
      t.set(f[o + 1] ?? 0, f[o + 2] ?? 0, f[o + 3] ?? 0); q.set(f[o + 4] ?? 0, f[o + 5] ?? 0, f[o + 6] ?? 0, f[o + 7] ?? 1);
      const sc = f[o + 8] ?? 1;
      b.copy(lb).applyMatrix4(m.compose(t, q, s.set(sc, sc, sc)));
      let e = fam.get(key);
      if (!e) { e = { pls: [], boxes: [], colliders: [] }; fam.set(key, e); }
      // the copy's pose lives in placements.bin (the instanced meshes draw it): a placement carries where it stands and which prototype
      e.pls.push({ x: t.x, y: t.y, z: t.z, variant: name });
      e.boxes.push(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
      const own = claim.get(spot(t.x, t.z));
      if (own !== undefined) { e.colliders.push(boxDesc(own, 'wood')); claim.delete(spot(t.x, t.z)); }
    }
    const slice = slicer(); // (~16 k copies on the desktop: a task ends once it has run 30 ms)
    for (const [key, e] of fam) {
      placeModel(COVE_MODELS[key], e.pls, { ctx: models, draw: 'merged', drawnInto: { object: this.group, boxes: Float32Array.from(e.boxes), ...(e.colliders.length > 0 ? { colliders: e.colliders } : {}) }, piece: { id: `cove-${key}` } });
      await slice();
    }
    if (claim.size > 0) console.warn(`[island] ${claim.size} collider boxes stand on no cove copy: they stay on the P2 bridge`);
    return [...claim.values()];
  }

  /** G144: once a frame with the camera posed (the late phase): the instanced placements repack for the view */
  late(sky: Sky): void { this.instances?.update(sky.viewCamera, sky.csm.lights); }

  /** per frame: the baked bounce follows the live sun (colour × intensity × elevation over the bake's reference) */
  update(sky: Sky): void {
    const l = sky.csm.lights[0];
    if (!l) return;
    const lum = l.intensity * (0.2126 * l.color.r + 0.7152 * l.color.g + 0.0722 * l.color.b);
    const elev = Math.max(0, sky.sunDir.y) / Math.max(0.2, this.meta.bake.refSun[1]);
    this.sunLum = lum * elev;
    this.terrainMat.lightMapIntensity = this.sunLum / this.meta.bake.bounceGain;
  }
}
