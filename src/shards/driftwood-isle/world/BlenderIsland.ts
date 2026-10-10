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
import { area, inArea, BLENDER_MODELS } from './blenderArea';
import type { PalmSpec } from './Palms';
import { WORLD_DROP } from './sea';
import { smallRock, type SmallRockParams } from '../models/smallRock';
import { COVE_MODELS, coveFamilyOf, coveProtos, type CoveFamily, type CoveParams } from '../models/cove';
import { ISLAND_CLIP, ISLAND_LOOK, ISLAND_PROPS, ISLAND_TERRAIN, ISLAND_TIERS } from '../data/islandLook';
import { CoverGrid, tintTerrain, triAreas, coverSample, coverJitter, type CoverTri } from './coverTint';
import { bakedPropsMaterial, bakedTerrainMaterial, clipGridTerrain, clipInstancedRect, decodeFloatBlock, droppedPlacements, dropNearestTriangles, dropTriangles, encodeFloatBlock, placementSets, protosFromMeshes, simplifiedProto, simplifierReady, sunBounceLevel, tileRect, usedPlacements, type IslandCoverFade, type IslandProto } from '@wildshard/sdk/looks/bakedIsland';
import { TiledInstances, type CoverTriangle, type TiledInstanceSet } from '@wildshard/sdk/looks/instancedTiles';
import { slicer } from '@wildshard/engine/boot/plan';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { TIER, type Tier } from '@wildshard/engine/core/tier';
import { modelContext, type ModelContext, type Placement } from '@wildshard/engine/models/model';
import { place as placeModel, placeSliced } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type ColliderDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const BASE = BLENDER_MODELS; // Driftwood's build: its palms / toon / sea are this file's own
/** the tier's tile counts, cover share and reaches, and its baked cover file (data/islandLook.ts) */
const TIER_LOOK = TIER === 'phone' ? ISLAND_TIERS.phone : ISLAND_TIERS.desktop;
/** tiles per side: the casters (palms, rocks, logs; near + far copies) and the ground cover */
const CT = TIER_LOOK.casterTiles, VT = TIER_LOOK.coverTiles;

/** a loaded prototype (world-space positions, Uint8 colour + baked AO, index) */
export type Proto = IslandProto;

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

/** E156 / G144: each cover triangle's centre, ground / upright areas and colour, for CoverGrid.splat, from the instanced
 *  placements (@wildshard/sdk/looks/instancedTiles) in world space */
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

/**
 * SF67 (E461): the cove's cover splat, baked. `CoverGrid.splat` overwrites every cell of the area from the instanced cover
 * triangles alone (whatever GroundCover filled there before), so the area's block is a pure function of island.glb,
 * placements.bin, island.json and the tier: scripts/bake-island-cover.mjs runs this same code in Node per tier and writes
 * it next to the island's other files, the build writes it back (`CoverGrid.writeBlock`) instead of walking ~1 M triangles at load, and splats only when
 * the file is missing or does not fit. bake-check (`--check`) rebuilds it byte for byte, so a stale bake fails the gate.
 */
export const islandCoverUrl = (tier: Tier): string => (tier === 'phone' ? ISLAND_TIERS.phone.coverUrl : ISLAND_TIERS.desktop.coverUrl);

/** the area's splatted block (`CoverGrid.readBlock`) from the cover sets' triangles */
export function islandCoverBlock(tris: Iterable<CoverTriangle>): Float32Array {
  const grid = new CoverGrid();
  grid.splat(instancedCoverTriangles(tris), area.x0, area.x1, area.z0, area.z1, ISLAND_LOOK.coverDepth);
  return grid.readBlock(area.x0, area.x1, area.z0, area.z1);
}

/** the baked file: a 16-byte header ('WSIC', version, placements used, floats) and the block's f32s, little-endian */
export const encodeIslandCover = (block: Float32Array, used: number): Uint8Array => encodeFloatBlock(block, used, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);

/** the baked block, or null when the file is not this build's (another version, placement count or rect) */
export const decodeIslandCover = (buf: ArrayBuffer, used: number, floats: number): Float32Array | null => decodeFloatBlock(buf, used, floats, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);

/** the prototypes from island.glb's meshes (world-space positions, Uint8 colour + baked AO), by island.json's index */
export const islandProtos = (found: readonly THREE.Mesh[], meta: IslandMeta): Proto[] => protosFromMeshes(found, meta.protos.map((p) => p.name), ISLAND_LOOK.protoPrefix);

/** placements.bin as the build reads it: each placement's y dropped with the world (G164) */
export const islandPlacements = (buf: ArrayBuffer): Float32Array => droppedPlacements(buf, WORLD_DROP);

/** how many placements this tier builds (every palm / rock / log, and the tier's share of the small cover: a prefix) */
export const islandUsed = (f: Float32Array, meta: IslandMeta, phone: boolean): number => usedPlacements(f, meta.mustDraw, phone ? ISLAND_TIERS.phone.share : ISLAND_TIERS.desktop.share);

/**
 * The placements by set and tile: casters CT×CT, small cover and big cover VT×VT; the small rocks rockKit rebuilds.
 * E114: the loose rocks are rockKit's — the boulders (rock*, rockb*: the shore boulders' spots, drawn by Boulders.ts
 * instead) are skipped, the small scattered rocks (smallrock*) rebuilt below. The crag plates on the cliffs (cliff*) stay
 * the Blender ones.
 */
export function islandSets(f: Float32Array, meta: IslandMeta, used: number): { casters: number[][]; covers: number[][]; bigs: number[][]; smallRocks: number[] } {
  const { casters, covers, bigs, apart } = placementSets(f, meta.protos, used, area, { casterTiles: CT, coverTiles: VT, ...ISLAND_LOOK.names });
  return { casters, covers, bigs, smallRocks: apart };
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
  instances: TiledInstanceSet | null = null;

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

    // ── materials: the shard's toon lighting (stylize.ts), fog, CSM — plus the bake (data/islandLook.ts) ──
    const terrainMat = this.terrainMat = bakedTerrainMaterial(ISLAND_TERRAIN, ao, bounce, ctx.sky);
    const makePropsMat = (cover: IslandCoverFade | null, tinted = true) => bakedPropsMaterial(ISLAND_PROPS, ctx.sky, cover, tinted);
    const propsMat = makePropsMat(null), coverMat = makePropsMat({ ...TIER_LOOK.cover, key: ISLAND_LOOK.coverKeys.cover });
    const bigMat = makePropsMat({ ...TIER_LOOK.big, key: ISLAND_LOOK.coverKeys.big });

    // ── terrain tiles ──
    gltf.scene.updateMatrixWorld(true);
    const models = modelContext(ctx.sky);
    const found: THREE.Mesh[] = [], terrainTiles: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) found.push(o); });
    const protoNames = new Set(meta.protos.map((p) => `${ISLAND_LOOK.protoPrefix}${p.name}`));
    for (const o of found) {
      if (protoNames.has(o.name)) continue;
      // a terrain tile — the 1 m grid on desktop, the 2 m one (terrainlo_*) on the phone; keep its node transform (meshopt's
      // dequantisation lives there)
      if (o.name.startsWith('terrainlo') !== phone) continue;
      const m = new THREE.Mesh(o.geometry, terrainMat);
      m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrix.elements[13] -= drop; m.matrixWorld.copy(m.matrix);
      m.name = `${ISLAND_LOOK.meshPrefix}${o.name}`; m.castShadow = true; m.receiveShadow = true;
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
    await simplifierReady();
    // E117: far = near, simplified (not the file's hand-made `_lo` palms: a whole tile changed shape at the swap)
    for (const [pi, lo] of lodOf) { const near = protos[pi]; if (near) protos[lo] = simplifiedProto(near, ISLAND_LOOK.far.ratio, ISLAND_LOOK.far.error); await slice(); }
    const { casters, covers, bigs, smallRocks } = islandSets(f, meta, used);
    // G144: one InstancedMesh per prototype × set, the tiles kept as the unit of reach and view (@wildshard/sdk/looks/instancedTiles)
    const ins = this.instances = new TiledInstances(this.group, protos, meta.protos.map((p) => p.name), f, lodOf, ISLAND_LOOK.meshPrefix);
    ins.add({ tag: 'casters', tiles: casters, rects: casters.map((_, k) => tileRect(area, k, CT)), material: propsMat, cast: true, reach: 0, lod: ISLAND_LOOK.lod, cover: false });
    await slice();
    ins.add({ tag: 'cover', tiles: covers, rects: covers.map((_, k) => tileRect(area, k, VT)), material: coverMat, cast: false, reach: TIER_LOOK.cover.far + 1, lod: ISLAND_LOOK.lod, cover: true });
    await slice();
    ins.add({ tag: 'cover-big', tiles: bigs, rects: bigs.map((_, k) => tileRect(area, k, VT)), material: bigMat, cast: false, reach: TIER_LOOK.big.far + 1, lod: ISLAND_LOOK.lod, cover: true });
    await slice();
    for (const set of [casters, covers, bigs]) for (const items of set) for (const i of items) this.stats.propTris += (protos[f[i * 10] ?? 0]?.index.length ?? 0) / 3;
    // E156: the cove's ground wears the cover it carries (coverTint.ts) — what was placed here, splatted into the grid over
    // GroundCover's estimate for this area, then sampled by the cove's terrain
    const coverGrid = CoverGrid.get();
    if (coverGrid) {
      // SF67: the build-time splat when there is one that fits (bit for bit the splat below: bake-check rebuilds it)
      const baked = bakedCover === null ? null : decodeIslandCover(bakedCover, used, coverGrid.blockLength(area.x0, area.x1, area.z0, area.z1));
      if (baked === null || !coverGrid.writeBlock(baked, area.x0, area.x1, area.z0, area.z1)) coverGrid.splat(instancedCoverTriangles(ins.coverTriangles()), area.x0, area.x1, area.z0, area.z1, ISLAND_LOOK.coverDepth);
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
    clipGridTerrain(ctx.terrain, area, (x, z) => inArea(x, z));
    await slice();
    if (ctx.palms) {
      // a triangle belongs to the nearest palm (its fronds reach 5 m out); drop the palms standing in the area
      dropNearestTriangles(ctx.palms.geometry, ctx.palmSpecs, ISLAND_LOOK.palmCell, (p) => inArea(p.x, p.z, 1));
      await slice();
    }
    for (const r of ctx.replace) if (r) { dropTriangles(r.geometry, (x, z) => !inArea(x, z)); await slice(); }
    if (ctx.cover) {
      // instanced plants: an instance whose origin is inside the area collapses (data/islandLook.ts ISLAND_CLIP)
      const clipped = new Set<THREE.Material>(), coverMeshes: THREE.Mesh[] = [];
      ctx.cover.traverse((o) => {
        if (isInstanced(o)) { for (const mm of Array.isArray(o.material) ? o.material : [o.material]) if (!clipped.has(mm)) { clipped.add(mm); clipInstancedRect(mm, area, ISLAND_CLIP); } }
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
    const level = sunBounceLevel(sky, this.meta.bake.refSun[1]);
    if (level === null) return;
    this.sunLum = level;
    this.terrainMat.lightMapIntensity = this.sunLum / this.meta.bake.bounceGain;
  }
}
