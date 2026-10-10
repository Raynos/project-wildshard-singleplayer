/**
 * PineCrags — the Ridge's granite and the Den's bear cave (PINE-HOLLOW-REMASTER PH-B2).
 *
 * The Ridge's face was the heightfield with a rock splat: smooth grey slopes. Now a kit of jointed granite built in
 * Blender (scripts/blender/pine-hollow/crags/build_crags.py → public/assets/models/pine-hollow-crags/crags.glb: cliff bands, a
 * buttress, an exfoliation slab, two tors, three boulders, two scree patches, each a LOD0 + LOD1 with Cycles vertex AO)
 * is placed over it at build time (G285: ../generators/crags.ts `placeCrags`, baked to ../data/crags.json with the face
 * skin's tiles, read through ./cragBake.ts): cliff modules on every steep face of the Ridge, the pass and the Den's walls,
 * fronts turned down the slope and sunk into it; tors along the crest; talus below each cliff where the slope eases —
 * boulders and scree fans. The cave (build_cave.py → cave.glb) is one
 * merged interior behind the hero arch at the Den's mouth: an antechamber, a squeeze, the bear's room with its bedding
 * and bones, drips, and a crack in the roof whose shaft of light falls on the floor; its hood is the rock over its first
 * metres where the passage runs shallower than the slope.
 *
 * The modules are models (E315 M2, src/shards/pine-hollow/models/): `pine-hollow/crag-cliff` (the cliff bands, the
 * buttress, the slab, the tors), `pine-hollow/crag-boulder` and `pine-hollow/scree`, placed with `place()`; the face skin
 * and the cave are the world (welded to the ground: the terrain is punched for the cave).
 *
 * Draws: ONE BatchedMesh (WEBGL_multi_draw) for everything — every module's two LODs (the models, `place`'s `batch`),
 * the face skin, the cave, its far hood — so the crags cost one draw + one per shadow cascade; per instance, the LOD is a
 * geometry id and the range a visibility bit, and three culls each live instance against every camera it renders. The
 * shaft and the drips are drawn only near the cave. One program (+ its depth program): triplanar granite in world space (Poly Haven CC0 `mossy_rock`, the lichened
 * boreal granite), ledge grit from the terrain's own `rock_ground`, moss on the up-facing, rain streaks down the faces;
 * the vertex colour carries (AO → the indirect light, sun reach → the directional light only (the cave's lantern and
 * the lamps stay), wet, rock / tint).
 *
 *   const crags = await PineCrags.load(sky);                        // null: the kit is missing (a dev server without it)
 *   await crags.prepareSkin(macrotask);                             // the baked face skin's tiles
 *   await crags.build(CRAG_ROWS.places, registry, macrotask);  scene.add(crags.group);  // the modules register themselves
 *   cutTerrain(physics, crags.terrainCuts()); terrain.punch(crags.holeTest());  game.onUpdate(() => crags.update(t))
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { pineSetCap } from '../debug/options';
import { PINE_CRAG_DIR } from './heroFiles';
import { pineModels } from './context';
import { CRAG_LOD, useCragKit } from './cragKit';
import { CAVE_FRAME, SKIN_TILE, caveLocal, caveWorld, loadCragSkin, type CragPlace, type CragSkin } from './cragBake';
import { CLIFF_MODULES, cragCliff } from '../models/cragCliff';
import { BOULDER_MODULES, cragBoulder } from '../models/cragBoulder';
import { SCREE_MODULES, scree as screeFan } from '../models/scree';
import { CAVE_SHAFT_GLSL, CRAG_EDITS } from '../data/cragLook';
import { loadPBR, loadTexture, texUrl, type PBRSet } from '@wildshard/engine/core/assets';
import { CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import { TIER, TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelDef, Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { TerrainCut } from '@wildshard/engine/physics/terrain';
import { PATCH_ORDER, patchShader, setProgramKey } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

const CRAG_DIR = PINE_CRAG_DIR; // the files: pineHero.ts `PINE_CRAG_URLS` (the boot manifest lists them with the landmarks' props)

/*
 * E322 F-L2 (Jake picked B): the face skin is textured by its facets, not its smoothed normals (the old projection laid
 * the ledge's top texture on its face: the stretch); paler granite (F-L1). Its shapes: ../generators/crags.ts.
 */

/** a placement's matrix: yaw about +Y, then the tilt (a scree patch lies with the slope: tiltX pitches its front down) */
export function cragMatrix(p: CragPlace, out = new THREE.Matrix4()): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tiltX, p.yaw, p.tiltZ, 'YXZ'));
  return out.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
}

// ───────────────────────────────────────────────── the cave's data ─────────────────────────────────────────────────

/** cave.json (build_cave.py): everything in the cave's frame (lx across, lz in, y world height) */
export interface CaveMeta {
  version: number;
  /** the render hole: drawn-terrain triangles whose box overlaps one of these (local, axis-aligned) are dropped */
  holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number }[];
  /** the physics heightfield is pushed below `below` inside these (local rects; grown a cell by cutTerrain) */
  cuts: { lx: number; lz: number; hw: number; hd: number; below: number }[];
  /** the cave reverb / bed: circles along the passage and the room */
  spots: { lx: number; lz: number; r: number }[];
  /** the footprint (rain never falls inside it) */
  inside: [number, number][];
  /** the crack's shaft of light: its top (at the crack) and its foot (on the floor), radii */
  shaft: { top: [number, number, number]; foot: [number, number, number]; r0: number; r1: number };
  /** drip points on the roof: lx, y, lz, and the floor's height under each */
  drips: [number, number, number, number][];
  /** the floor's height along the passage (lz → y), for the spawn / the test poses */
  floor: [number, number][];
}

// ──────────────────────────────────────────────────── the material ─────────────────────────────────────────────────

/** the cave's fill (see the material): PineCrags.update drives it from the clock */
const CAVE_FILL = { value: 1.0 };


/**
 * Triplanar granite in world space for the BatchedMesh (and the cave inside it): albedo / normal / ARM from `mossy_rock`
 * on the X and Z projections and on the Y one blended with `rock_ground` grit on the ledges, moss on the up-facing,
 * dark rain streaks down the faces, and a tint path for the cave's bedding and bones. The vertex `cdata` = (AO, sun reach,
 * wet, rock): AO multiplies the indirect light, sun reach the directional lights only. The GLSL edits are data
 * (../data/cragLook.ts `CRAG_EDITS`).
 */
function cragMaterial(sky: Sky, rock: PBRSet, grit: Pick<PBRSet, 'map' | 'normalMap'>): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const u = {
    tRockD: { value: rock.map }, tRockN: { value: rock.normalMap }, tRockA: { value: rock.armMap },
    tGritD: { value: grit.map }, tGritN: { value: grit.normalMap },
    /** the cave's fill: the light the mouth and the crack let in, scattered off every wall (no direction) — day-driven */
    uCaveFill: CAVE_FILL,
  };
  for (const t of [rock.map, rock.normalMap, rock.armMap, grit.map, grit.normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; }
  setProgramKey(mat, 'pine-crag');
  sky.setupMaterial(mat);
  // chained after sky.setupMaterial's CSM uniforms (its lights_fragment_begin is the global chunk, patched below)
  patchShader(mat, 'pine.crag', PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    Object.assign(shader.uniforms, u);
    editShader(shader, CRAG_EDITS); // ../data/cragLook.ts
  }, { textures: [rock.map, rock.normalMap, rock.armMap] });
  return mat;
}

// ─────────────────────────────────────────────────────── the set ───────────────────────────────────────────────────

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** position / normal back to float (meshopt quantizes), the colour → `cdata` (vec4), the tint UV → `ctint`; nothing else */
function kitGeometry(src: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const f32 = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < a.itemSize ? a.getComponent(i, k) : 1;
    return out;
  };
  const n = src.getAttribute('position').count;
  g.setAttribute('position', new THREE.BufferAttribute(f32('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32('normal', 3), 3));
  g.setAttribute('cdata', src.hasAttribute('color') ? new THREE.BufferAttribute(f32('color', 4), 4) : new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4));
  g.setAttribute('ctint', src.hasAttribute('uv') ? new THREE.BufferAttribute(f32('uv', 2), 2) : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const idx = src.getIndex();
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)), 1));
  g.applyMatrix4(matrix);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

async function loadNodes(url: string): Promise<Map<string, THREE.BufferGeometry>> {
  const out = new Map<string, THREE.BufferGeometry>();
  const g = await gltf.loadAsync(url);
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!('isMesh' in o)) return;
    const mesh = o as THREE.Mesh;
    out.set(mesh.name, kitGeometry(mesh.geometry, mesh.matrixWorld));
  });
  return out;
}

/** LOD / range per kind (m, camera to the instance less half its radius): the kit's models' (world/cragKit.ts) */
const LOD = CRAG_LOD;

interface Inst { id: number; x: number; y: number; z: number; r: number; near: number; far: number; lod0: number; lod1: number; state: number }

export interface CaveHandle { meta: CaveMeta; inst: Inst | null; hood: Inst | null }

export class PineCrags {
  readonly group = new THREE.Group();
  /** the modules' hulls (their models' colliders, placed: the navmesh bake reads them) */
  readonly colliders: ColliderDesc[] = [];
  /** the three place calls: cliffs (and tors), boulders, scree */
  readonly placed: Placed[] = [];
  readonly caveColliders: ColliderDesc[] = [];
  places: CragPlace[] = [];
  private batch: THREE.BatchedMesh | null = null;
  private insts: Inst[] = [];
  private cave: CaveHandle | null = null;
  private last = new THREE.Vector3(1e9, 0, 0);
  private tmp = new THREE.Vector3();
  private shaft: THREE.Mesh | null = null;
  private drips: THREE.Points | null = null;
  private dripState: Float32Array = new Float32Array(0);
  private caveNear = false;
  private under = false;
  private skin: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];

  private constructor(private sky: Sky | null, private kit: Map<string, THREE.BufferGeometry>, private caveGeo: Map<string, THREE.BufferGeometry>, private caveMeta: CaveMeta | null, private mat: THREE.Material | null, private skinBake: CragSkin | null) {
    this.group.name = 'pine-crags';
  }

  /** the kit, the cave, their textures and this tier's baked face skin; null when the kit is not in this build. `sky` null: geometry only */
  static async load(sky: Sky | null): Promise<PineCrags | null> {
    try {
      const [kit, kitB, caveGeo, caveMeta, tex, skin] = await Promise.all([
        // the kit is two files: crags.glb the tors, boulders and scree; crags-b.glb (E322 F-L2) the fused, weathered cliff
        // bands, buttress and slab and the hero crag (E350 F-X1 dropped A's big modules from crags.glb, so both are required)
        loadNodes(`${CRAG_DIR}/crags.glb`),
        loadNodes(`${CRAG_DIR}/crags-b.glb`),
        loadNodes(`${CRAG_DIR}/cave.glb`).catch((e: unknown) => { console.warn('[crags] no cave.glb', e); return new Map<string, THREE.BufferGeometry>(); }),
        fetch(`${CRAG_DIR}/cave.json`).then(async (r) => (r.ok ? (await r.json()) as CaveMeta : null)).catch(() => null),
        sky ? Promise.all([loadPBR('mossy_rock', 1, pineSetCap(TIER_CONFIG.maxTexture)), Promise.all([loadTexture(texUrl('rock_ground', 'diffuse'), true), loadTexture(texUrl('rock_ground', 'nor_gl'))])
          .then(([map, normalMap]) => ({ map, normalMap }))]) : Promise.resolve(null), // G180 B1: only the grit samplers the shader uses; an eagerly uploaded unused ARM has no owner.
        sky ? loadCragSkin(TIER) : Promise.resolve(null), // only drawn builds need the skin (G285: ./cragBake.ts)
      ]);
      const mat = sky && tex ? cragMaterial(sky, tex[0], tex[1]) : null;
      for (const [name, g] of kitB) kit.set(name, g);
      return new PineCrags(sky, kit, caveGeo, caveMeta, mat, skin);
    } catch (e: unknown) {
      console.warn('[crags] the kit did not load', e);
      return null;
    }
  }

  /** the face skin's tiles (both resolutions) from this tier's bake, a tile per task; only drawn builds need it */
  async prepareSkin(yieldTask: () => Promise<void>): Promise<void> {
    if (!this.mat || !this.skinBake) return;
    this.skin = await this.skinBake.tiles(yieldTask);
  }

  /**
   * Draw (when a material exists) and collide the placements and the cave. The modules are placed as models into the ONE
   * batch, registered on `registry` 90 hulls a `yieldTask` apart (the phone's per-task collider budget); `registry`
   * null: built only (the navmesh bake reads `colliders`). The face skin and the cave are this world's own instances.
   */
  async build(places: CragPlace[], registry: WorldRegistry | null = null, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    this.places = places;
    // the world's own geometry: the face skin (one geometry per tile per resolution, identity matrix: its vertices are
    // world positions) and the cave (its interior + hood near, the hood alone (simplified) far)
    const geos: THREE.BufferGeometry[] = [];
    const plan: { p: THREE.Matrix4; lod0: number; lod1: number; near: number; far: number; r: number; x: number; y: number; z: number }[] = [];
    if (this.mat) {
      for (const [g0, g1] of this.skin) {
        const i0 = geos.length; geos.push(g0); const i1 = geos.length; geos.push(g1);
        const bs = g0.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), SKIN_TILE);
        plan.push({ p: new THREE.Matrix4(), lod0: i0, lod1: i1, near: LOD.big * 0.8, far: LOD.bigFar, r: bs.radius, x: bs.center.x, y: bs.center.y, z: bs.center.z });
      }
    }
    const caveM = new THREE.Matrix4().makeRotationY(CAVE_FRAME.yaw).setPosition(CAVE_FRAME.x, 0, CAVE_FRAME.z);
    const caveG = this.caveGeo.get('cave'), hoodG = this.caveGeo.get('cave-far');
    let caveIdx = -1, hoodIdx = -1;
    if (caveG) {
      const cave0 = geos.length; geos.push(caveG);
      const bs = caveG.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 30);
      const c = bs.center.clone().applyMatrix4(caveM);
      caveIdx = plan.length;
      plan.push({ p: caveM.clone(), lod0: cave0, lod1: cave0, near: 1e9, far: LOD.cave, r: bs.radius, x: c.x, y: c.y, z: c.z });
      if (hoodG) {
        const hoodFar = geos.length; geos.push(hoodG);
        hoodIdx = plan.length;
        plan.push({ p: caveM.clone(), lod0: hoodFar, lod1: hoodFar, near: 1e9, far: 1200, r: bs.radius, x: c.x, y: c.y, z: c.z });
      }
      const col = this.caveGeo.get('cave-col') ?? caveG;
      this.caveColliders.push(trimeshOf(col, caveM));
    }
    if (this.caveMeta) this.caveColliders.push(...this.roofPatch());

    // the modules, as models: every place call adds its (variant, level) geometries and its copies to the one batch
    const of = (ids: readonly string[]): CragPlace[] => places.filter((p) => ids.includes(p.id) && this.kit.has(p.id));
    const byKind = [of(CLIFF_MODULES), of(BOULDER_MODULES), of(SCREE_MODULES)] as const;
    const size = (g: THREE.BufferGeometry | undefined): { v: number; i: number } => (g ? { v: g.getAttribute('position').count, i: g.index ? g.index.count : g.getAttribute('position').count } : { v: 0, i: 0 });
    if (this.mat && (plan.length > 0 || byKind.some((l) => l.length > 0))) {
      // sized for all of it: the modules the placements use (each at both levels) and the world's own
      let v = 0, ix = 0, n = plan.length;
      for (const list of byKind) {
        n += list.length;
        for (const id of new Set(list.map((p) => p.id))) for (const g of [this.kit.get(id), this.kit.get(`${id}-lod1`) ?? this.kit.get(id)]) { const s0 = size(g); v += s0.v; ix += s0.i; }
      }
      for (const g of geos) { const s0 = size(g); v += s0.v; ix += s0.i; }
      const bm = this.batch = new THREE.BatchedMesh(n, v, ix, this.mat);
      bm.name = 'pine-crags';
      bm.sortObjects = false; bm.perObjectFrustumCulled = true;
      bm.castShadow = true; bm.receiveShadow = true;
    }
    const sky = this.sky;
    if (sky) {
      const ctx = pineModels(sky);
      useCragKit(ctx, { kit: this.kit, mat: this.mat });
      const placeKind = async <P extends object>(model: ModelDef<P>, list: readonly CragPlace[], far: number): Promise<void> => {
        if (list.length === 0) return;
        const pls = list.map((p): Placement<P> => ({ x: p.x, y: p.y, z: p.z, matrix: cragMatrix(p), variant: p.id }));
        // LOD by the camera's distance less half the module's radius, re-chosen once it has moved a metre; three culls
        // each live copy per camera (the batch's per-object culling)
        const placed = place(model, pls, { ctx, draw: 'batched', ...(this.batch ? { batch: this.batch } : {}), registry,
          cull: { frustum: false, radiusBias: 0.5, step: 1, bounds: 'sphere', far },
          piece: { id: `pine-crags-${model.id.slice('pine-hollow/'.length)}`, name: model.name, split: { every: 90, yieldTask } } });
        this.placed.push(placed);
        this.colliders.push(...placed.colliders);
        await placed.registered;
        if (placed.colliders.length > 0) await yieldTask();
      };
      await placeKind(cragCliff, byKind[0], LOD.bigFar);
      await placeKind(cragBoulder, byKind[1], LOD.smallFar);
      await placeKind(screeFan, byKind[2], LOD.screeFar);
    }
    const bm = this.batch;
    if (bm) {
      const ids = geos.map((g) => bm.addGeometry(g));
      for (const q of plan) {
        const g0 = ids[q.lod0], g1 = ids[q.lod1];
        if (g0 === undefined || g1 === undefined) continue;
        const id = bm.addInstance(g0);
        bm.setMatrixAt(id, q.p);
        this.insts.push({ id, x: q.x, y: q.y, z: q.z, r: q.r, near: q.near, far: q.far, lod0: g0, lod1: g1, state: 0 });
      }
      if (registry === null) this.group.add(bm);
    }
    if (this.caveMeta) {
      const find = (i: number): Inst | null => (i >= 0 ? this.insts[i] ?? null : null);
      this.cave = { meta: this.caveMeta, inst: find(caveIdx), hood: find(hoodIdx) };
      if (this.sky) this.buildCaveFx(this.caveMeta);
    }
    return this;
  }

  // ── the cave's frame helpers ──

  /** the cave's data (null: no cave.json in this build) */
  get caveMetaData(): CaveMeta | null { return this.caveMeta; }

  /** the physics heightfield's cuts (world rects): the ground under the passage where the slope runs through it */
  terrainCuts(): TerrainCut[] {
    return (this.caveMeta?.cuts ?? []).map((c) => { const [x, z] = caveWorld(c.lx, c.lz); return { x, z, hw: c.hw, hd: c.hd, yaw: CAVE_FRAME.yaw, below: c.below }; });
  }

  /** the drawn terrain's hole: true for a triangle (world vertices) that reaches into the cave's passage */
  holeTest(): (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean {
    const holes = this.caveMeta?.holes ?? [];
    return (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const [alx, alz] = caveLocal(ax, az), [blx, blz] = caveLocal(bx, bz), [clx, clz] = caveLocal(cx, cz);
      const x0 = Math.min(alx, blx, clx), x1 = Math.max(alx, blx, clx), z0 = Math.min(alz, blz, clz), z1 = Math.max(alz, blz, clz);
      const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
      for (const h of holes) {
        if (x1 < h.lx - h.hw || x0 > h.lx + h.hw || z1 < h.lz - h.hd || z0 > h.lz + h.hd || y1 < h.y0 || y0 > h.y1) continue;
        return true;
      }
      return false;
    };
  }

  /** the cave's reverb / bed spots, world (the mouth's own spot is the audio lane's — these go inside) */
  caveSpots(): { x: number; z: number; r: number }[] {
    return (this.caveMeta?.spots ?? []).map((s) => { const [x, z] = caveWorld(s.lx, s.lz); return { x, z, r: s.r }; });
  }

  /** inside the cave's footprint (no rain falls there) */
  inCave(x: number, z: number): boolean {
    const poly = this.caveMeta?.inside;
    if (!poly || poly.length < 3) return false;
    const [lx, lz] = caveLocal(x, z);
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (!a || !b) continue;
      if ((a[1] > lz) !== (b[1] > lz) && lx < ((b[0] - a[0]) * (lz - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /** the passage's floor height at depth `lz` (the test poses, the spawn) */
  caveFloorAt(lz: number): number | undefined {
    const f = this.caveMeta?.floor;
    if (!f || f.length === 0) return undefined;
    for (let i = 0; i + 1 < f.length; i++) {
      const a = f[i], b = f[i + 1];
      if (a && b && lz >= a[0] && lz <= b[0]) return a[1] + (b[1] - a[1]) * ((lz - a[0]) / Math.max(1e-6, b[0] - a[0]));
    }
    return undefined;
  }

  /**
   * The terrain over the cut (its drawn triangles that are not in the hole) as a trimesh: the heightfield under the cut
   * was pushed below the cave's floor, so the ground up there — on the slope above the mouth — comes back as this.
   */
  private roofPatch(): ColliderDesc[] {
    const cuts = this.terrainCuts();
    if (cuts.length === 0) return [];
    const res = TERRAIN_RES, d = CHUNK_SIZE / (res - 1), half = CHUNK_SIZE / 2;
    const hole = this.holeTest();
    const cells = new Set<number>();
    for (const c of cuts) {
      const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw), r = Math.hypot(c.hw, c.hd) + 3 * d;
      const i0 = Math.max(0, Math.floor((c.x - r + half) / d)), i1 = Math.min(res - 2, Math.ceil((c.x + r + half) / d));
      const k0 = Math.max(0, Math.floor((c.z - r + half) / d)), k1 = Math.min(res - 2, Math.ceil((c.z + r + half) / d));
      for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const dx = ix * d - half - c.x, dz = iz * d - half - c.z;
        const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
        if (Math.abs(lx) > c.hw + 2.5 * d || Math.abs(lz) > c.hd + 2.5 * d) continue;
        cells.add(iz * res + ix);
      }
    }
    const verts: number[] = [], idx: number[] = [];
    const ox = CAVE_FRAME.x, oz = CAVE_FRAME.z;
    const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): void => {
      const ay = heightAt(ax, az), by = heightAt(bx, bz), cy = heightAt(cx, cz);
      if (hole(ax, ay, az, bx, by, bz, cx, cy, cz)) return;
      const b = verts.length / 3;
      verts.push(ax - ox, ay, az - oz, bx - ox, by, bz - oz, cx - ox, cy, cz - oz);
      idx.push(b, b + 1, b + 2);
    };
    for (const cell of cells) {
      const ix = cell % res, iz = Math.floor(cell / res);
      const x0 = ix * d - half, x1 = x0 + d, z0 = iz * d - half, z1 = z0 + d;
      tri(x0, z0, x0, z1, x1, z0); tri(x0, z1, x1, z1, x1, z0);
    }
    if (idx.length === 0) return [];
    return [{ kind: 'trimesh', x: ox, y: 0, z: oz, vertices: Float32Array.from(verts), indices: Uint32Array.from(idx), surface: 'rock' }];
  }

  // ── the cave's shaft of light and drips ──

  private buildCaveFx(meta: CaveMeta): void {
    const toW = (p: [number, number, number]): THREE.Vector3 => { const [x, z] = caveWorld(p[0], p[2]); return new THREE.Vector3(x, p[1], z); };
    // the shaft: an open cone from the crack to the floor, additive, brightest at the crack, fading to the floor and toward its rim
    const top = toW(meta.shaft.top), foot = toW(meta.shaft.foot);
    const len = top.distanceTo(foot);
    const geo = new THREE.CylinderGeometry(meta.shaft.r0, meta.shaft.r1, len, 20, 6, true);
    geo.translate(0, -len / 2, 0);
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uLen: { value: len } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: CAVE_SHAFT_GLSL.vertex,
      fragmentShader: CAVE_SHAFT_GLSL.fragment,
    });
    const shaft = new THREE.Mesh(geo, shaftMat);
    shaft.position.copy(top);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foot.clone().sub(top).normalize());
    shaft.renderOrder = 7; shaft.frustumCulled = true; shaft.visible = false;
    shaft.name = 'cave-shaft';
    this.shaft = shaft;
    this.group.add(shaft);
    // the drips: a Points per drip point, each falling from the roof on its own clock
    const n = meta.drips.length;
    if (n > 0) {
      const pos = new Float32Array(n * 3);
      this.dripState = new Float32Array(n * 4);
      meta.drips.forEach((d, i) => {
        const [x, z] = caveWorld(d[0], d[2]);
        this.dripState.set([x, d[1], z, d[3]], i * 4);
        pos.set([x, d[1], z], i * 3);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: 0xcfd8dc, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      const pts = new THREE.Points(g, pm);
      pts.name = 'cave-drips'; pts.visible = false; pts.frustumCulled = false;
      this.drips = pts;
      this.group.add(pts);
    }
  }

  /** per frame: the world's own instances' LODs and ranges (when the camera has moved a metre; the modules' are
   *  `place`'s), the cave's shaft and drips near it */
  update(t: number): void {
    const sky = this.sky;
    if (!sky) return;
    const cam = sky.viewCamera; cam.getWorldPosition(this.tmp);
    const p = this.tmp;
    const bm = this.batch;
    if (bm && p.distanceToSquared(this.last) > 1) {
      this.last.copy(p);
      for (const it of this.insts) {
        const dd = Math.hypot(it.x - p.x, it.y - p.y, it.z - p.z) - it.r * 0.5;
        const state = dd > it.far ? 2 : dd > it.near ? 1 : 0;
        if (state === it.state) continue;
        it.state = state;
        bm.setVisibleAt(it.id, state !== 2);
        if (state !== 2) bm.setGeometryIdAt(it.id, state === 0 ? it.lod0 : it.lod1);
      }
    }
    const cave = this.cave;
    if (!cave) return;
    // the sun's corona sprite draws without a depth test (Sky.buildSunDisc): under the roof the disc goes, corona and all
    const [, lz] = caveLocal(p.x, p.z);
    const under = this.inCave(p.x, p.z) && p.y < (this.caveFloorAt(Math.min(36, Math.max(-4, lz))) ?? p.y) + 7;
    // (the volumetric march needs no fade here: it reads the world's depth, core/worldDepth.ts, and stops at the rock)
    if (under !== this.under) {
      this.under = under;
      sky.sunDisc.visible = !under; // the corona has no depth test (and the disc is the god rays' source)
    }
    const near = Math.hypot(p.x - CAVE_FRAME.x, p.z - CAVE_FRAME.z) < 60;
    if (near !== this.caveNear) { this.caveNear = near; if (this.shaft) this.shaft.visible = near; if (this.drips) this.drips.visible = near; }
    if (!near) return;
    if (this.shaft && this.shaft.material instanceof THREE.ShaderMaterial) {
      const u = this.shaft.material.uniforms;
      // the sky over the crack: bright by day (the lamps are out), a glimmer at night
      const day = 1 - Math.max(0, Math.min(1, sky.lamps));
      const uI = u['uI'], uT = u['uTime'];
      CAVE_FILL.value = 0.05 + 1.6 * day;
      if (uI) uI.value = 0.2 * day * Math.min(1, 0.4 + Math.max(0, sky.sunDir.y) * 2) + 0.02;
      if (uT) uT.value = t;
    }
    if (this.drips) {
      const pos = this.drips.geometry.getAttribute('position');
      const s = this.dripState, n = s.length / 4;
      for (let i = 0; i < n; i++) {
        const top = s[i * 4 + 1] ?? 0, floor = s[i * 4 + 3] ?? 0, h = Math.max(0.2, top - floor);
        // each drip: forms for a while (hangs at the roof), then falls under gravity to the floor
        const period = 1.7 + (i % 5) * 0.53, ph = (t / period + i * 0.37) % 1;
        const fall = Math.sqrt((2 * h) / 9.8) / period;
        const k = ph < 1 - fall ? 0 : (ph - (1 - fall)) / fall;
        pos.setY(i, top - 0.04 - 0.5 * 9.8 * (k * fall * period) ** 2 * (k > 0 ? 1 : 0));
      }
      pos.needsUpdate = true;
    }
  }
}

/** the geometry placed by `m` as a trimesh relative to m's translation */
function trimeshOf(g: THREE.BufferGeometry, m: THREE.Matrix4): ColliderDesc {
  const pos = g.getAttribute('position');
  const o = new THREE.Vector3().setFromMatrixPosition(m);
  const verts = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); verts[i * 3] = v.x - o.x; verts[i * 3 + 1] = v.y - o.y; verts[i * 3 + 2] = v.z - o.z; }
  const idx = g.getIndex();
  const indices = idx ? Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)) : Uint32Array.from({ length: pos.count }, (_v, i) => i);
  return { kind: 'trimesh', x: o.x, y: o.y, z: o.z, vertices: verts, indices, surface: 'rock' };
}
