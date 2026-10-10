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
import { pineSetCap } from '../debug/options';
import { PINE_CRAG_DIR } from './heroFiles';
import { pineModels } from './context';
import { CRAG_LOD, useCragKit } from './cragKit';
import { CAVE_FRAME, SKIN_TILE, loadCragSkin, type CragPlace, type CragSkin } from './cragBake';
import { CLIFF_MODULES, cragCliff } from '../models/cragCliff';
import { BOULDER_MODULES, cragBoulder } from '../models/cragBoulder';
import { SCREE_MODULES, scree as screeFan } from '../models/scree';
import { CAVE_LOOK, CRAG_EDITS } from '../data/cragLook';
import { loadPBR, loadTexture, texUrl, type PBRSet } from '@wildshard/engine/core/assets';
import { TIER, TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelDef, Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { TerrainCut } from '@wildshard/engine/physics/terrain';
import { PATCH_ORDER, patchShader, setProgramKey } from '@wildshard/engine/render/shaderPatches';
import { BatchedLodSet, geometrySize, type BatchedLodSetView, type LodPlanRow } from '@wildshard/sdk/cull/batchedLod';
import { CaveInterior, type CaveInteriorView, type CaveMeta } from '@wildshard/sdk/kit/caveInterior';
import { loadGlbNodes, trimeshDesc } from '@wildshard/sdk/kit/glbNodes';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

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

/** LOD / range per kind (m, camera to the instance less half its radius): the kit's models' (world/cragKit.ts) */
const LOD = CRAG_LOD;

/** the kit's vertex colour and tint UV, as the granite's program reads them (../data/cragLook.ts) */
const KIT_ATTRS = { color: 'cdata', uv: 'ctint' } as const;


export class PineCrags {
  readonly group = new THREE.Group();
  /** the modules' hulls (their models' colliders, placed: the navmesh bake reads them) */
  readonly colliders: ColliderDesc[] = [];
  /** the three place calls: cliffs (and tors), boulders, scree */
  readonly placed: Placed[] = [];
  readonly caveColliders: ColliderDesc[] = [];
  places: CragPlace[] = [];
  private batch: THREE.BatchedMesh | null = null;
  /** the world's own instances in the batch: the face skin's tiles, the cave and its far hood */
  private own: BatchedLodSetView | null = null;
  /** the bear cave (null: no cave.json in this build); live (updated) once built */
  private readonly cave: CaveInteriorView | null;
  private caveLive = false;
  private tmp = new THREE.Vector3();
  private skin: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];
  private readonly sky: Sky | null;
  private readonly kit: Map<string, THREE.BufferGeometry>;
  private readonly caveGeo: Map<string, THREE.BufferGeometry>;
  private readonly mat: THREE.Material | null;
  private readonly skinBake: CragSkin | null;

  private constructor(sky: Sky | null, kit: Map<string, THREE.BufferGeometry>, caveGeo: Map<string, THREE.BufferGeometry>, caveMeta: CaveMeta | null, mat: THREE.Material | null, skinBake: CragSkin | null) {
    this.sky = sky; this.kit = kit; this.caveGeo = caveGeo; this.mat = mat; this.skinBake = skinBake;
    this.cave = caveMeta ? new CaveInterior(caveMeta, CAVE_FRAME, CAVE_LOOK, CAVE_FILL) : null;
    this.group.name = 'pine-crags';
  }

  /** the kit, the cave, their textures and this tier's baked face skin; null when the kit is not in this build. `sky` null: geometry only */
  static async load(sky: Sky | null): Promise<PineCrags | null> {
    try {
      const [kit, kitB, caveGeo, caveMeta, tex, skin] = await Promise.all([
        // the kit is two files: crags.glb the tors, boulders and scree; crags-b.glb (E322 F-L2) the fused, weathered cliff
        // bands, buttress and slab and the hero crag (E350 F-X1 dropped A's big modules from crags.glb, so both are required)
        loadGlbNodes(`${CRAG_DIR}/crags.glb`, KIT_ATTRS),
        loadGlbNodes(`${CRAG_DIR}/crags-b.glb`, KIT_ATTRS),
        loadGlbNodes(`${CRAG_DIR}/cave.glb`, KIT_ATTRS).catch((e: unknown) => { console.warn('[crags] no cave.glb', e); return new Map<string, THREE.BufferGeometry>(); }),
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
   * null: built only (the navmesh bake reads `colliders`). The face skin and the cave are this world's own instances
   * (@wildshard/sdk/cull/batchedLod).
   */
  async build(places: CragPlace[], registry: WorldRegistry | null = null, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    this.places = places;
    // the world's own geometry: the face skin (one geometry per tile per resolution, identity matrix: its vertices are
    // world positions) and the cave (its interior + hood near, the hood alone (simplified) far)
    const geos: THREE.BufferGeometry[] = [];
    const plan: LodPlanRow[] = [];
    if (this.mat) {
      for (const [g0, g1] of this.skin) {
        const i0 = geos.length; geos.push(g0); const i1 = geos.length; geos.push(g1);
        const bs = g0.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), SKIN_TILE);
        plan.push({ matrix: new THREE.Matrix4(), lod0: i0, lod1: i1, near: LOD.big * 0.8, far: LOD.bigFar, r: bs.radius, x: bs.center.x, y: bs.center.y, z: bs.center.z });
      }
    }
    const caveM = new THREE.Matrix4().makeRotationY(CAVE_FRAME.yaw).setPosition(CAVE_FRAME.x, 0, CAVE_FRAME.z);
    const caveG = this.caveGeo.get('cave'), hoodG = this.caveGeo.get('cave-far');
    if (caveG) {
      const cave0 = geos.length; geos.push(caveG);
      const bs = caveG.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 30);
      const c = bs.center.clone().applyMatrix4(caveM);
      plan.push({ matrix: caveM.clone(), lod0: cave0, lod1: cave0, near: 1e9, far: LOD.cave, r: bs.radius, x: c.x, y: c.y, z: c.z });
      if (hoodG) {
        const hoodFar = geos.length; geos.push(hoodG);
        plan.push({ matrix: caveM.clone(), lod0: hoodFar, lod1: hoodFar, near: 1e9, far: 1200, r: bs.radius, x: c.x, y: c.y, z: c.z });
      }
      const col = this.caveGeo.get('cave-col') ?? caveG;
      this.caveColliders.push(trimeshDesc(col, caveM, CAVE_LOOK.surface));
    }
    if (this.cave) this.caveColliders.push(...this.cave.roofPatch());

    // the modules, as models: every place call adds its (variant, level) geometries and its copies to the one batch
    const of = (ids: readonly string[]): CragPlace[] => places.filter((p) => ids.includes(p.id) && this.kit.has(p.id));
    const byKind = [of(CLIFF_MODULES), of(BOULDER_MODULES), of(SCREE_MODULES)] as const;
    if (this.mat && (plan.length > 0 || byKind.some((l) => l.length > 0))) {
      // sized for all of it: the modules the placements use (each at both levels) and the world's own
      let v = 0, ix = 0, n = plan.length;
      for (const list of byKind) {
        n += list.length;
        for (const id of new Set(list.map((p) => p.id))) for (const g of [this.kit.get(id), this.kit.get(`${id}-lod1`) ?? this.kit.get(id)]) { const s0 = geometrySize(g); v += s0.v; ix += s0.i; }
      }
      for (const g of geos) { const s0 = geometrySize(g); v += s0.v; ix += s0.i; }
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
      this.own = new BatchedLodSet(bm);
      this.own.add(geos, plan);
      if (registry === null) this.group.add(bm);
    }
    if (this.cave) {
      this.caveLive = true;
      if (this.sky) { this.cave.buildFx(); for (const o of this.cave.fx) this.group.add(o); }
    }
    return this;
  }

  // ── the cave's questions (@wildshard/sdk/kit/caveInterior) ──

  /** the cave's data (null: no cave.json in this build) */
  get caveMetaData(): CaveMeta | null { return this.cave?.meta ?? null; }

  /** the physics heightfield's cuts (world rects): the ground under the passage where the slope runs through it */
  terrainCuts(): TerrainCut[] { return this.cave?.terrainCuts() ?? []; }

  /** the drawn terrain's hole: true for a triangle (world vertices) that reaches into the cave's passage */
  holeTest(): (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean {
    return this.cave?.holeTest() ?? (() => false);
  }

  /** the cave's reverb / bed spots, world (the mouth's own spot is the audio lane's — these go inside) */
  caveSpots(): { x: number; z: number; r: number }[] { return this.cave?.spots() ?? []; }

  /** inside the cave's footprint (no rain falls there) */
  inCave(x: number, z: number): boolean { return this.cave?.inside(x, z) ?? false; }

  /** the passage's floor height at depth `lz` (the test poses, the spawn) */
  caveFloorAt(lz: number): number | undefined { return this.cave?.floorAt(lz); }

  /** per frame: the world's own instances' LODs and ranges (when the camera has moved a metre; the modules' are
   *  `place`'s), the cave's shaft and drips near it */
  update(t: number): void {
    const sky = this.sky;
    if (!sky) return;
    const cam = sky.viewCamera; cam.getWorldPosition(this.tmp);
    this.own?.update(this.tmp);
    if (this.cave && this.caveLive) this.cave.update(t, this.tmp, sky);
  }
}
