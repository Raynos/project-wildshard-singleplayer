import DRESSING from '../data/islandDressing.generated.json' with {type:'json'};
import { clipIslandDressing } from './islandDressing';
import { ISLAND_COVER_FILES } from '../data/islandCoverFiles';
/**
 * The Blender-built island (DRIFTWOOD-REMASTER X2, E52): on Driftwood it always replaces the procedural spawn cove —
 * terrain, palms, bushes, shore boulders, ground cover inside `area` (./blenderArea.ts) — with the one scripts/blender/
 * builds in Blender and bakes in Cycles (the user's pick, E7; the switch is gone since E136). The procedural cove is still
 * built before this install, then replaced or clipped inside the area. That construction is remaining loading
 * work, not a supported load-failure fallback: a required island asset failure refuses boot.
 * What this file computes from its committed files alone is baked at build (SF67 fix 3): the cover splat (scripts/bake-island-cover.mjs).
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
import * as v from 'valibot';
import { assetBytes } from '@wildshard/sdk/assets';
import { ISLAND_PLAN_FILES as PLAN_FILES } from '../data/islandPlanFiles';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import ISLAND_FACTS from '../data/islandFacts.generated.json' with { type: 'json' };
import { area, BLENDER_MODELS } from './blenderArea';
import type { PalmSpec } from './Palms';
import { WORLD_DROP } from './sea';
import { smallRock } from '../models/smallRock';
import { COVE_MODELS, coveProtos, type CoveFamily } from '../models/cove';
import { ISLAND_PROPS, ISLAND_TERRAIN } from '../runtime/looks/islandLook';
import { ISLAND_LOOK, ISLAND_TIERS } from '../data/islandRows';
import { CoverGrid, tintTerrain, coverSample, coverJitter } from './coverTint';
import { bakedPropsMaterial, bakedTerrainMaterial, clipGridTerrain, droppedPlacements, protosFromMeshes, simplifiedProto, simplifierReady, sunBounceLevel, tileRect, usedPlacements, type IslandCoverFade, type IslandProto } from '../runtime/looks/bakedIsland';
import { TiledInstances, type TiledInstances as TiledInstanceSet } from '../runtime/looks/instancedTiles';
import { slicer } from '@wildshard/engine/boot/plan';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { TIER } from '@wildshard/engine/core/tier';
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import { place as placeModel, placeSliced } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
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
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;


function load<T>(f: (ok: (v: T) => void, bad: (e: unknown) => void) => void): Promise<T> { return new Promise<T>((resolve, reject) => { f(resolve, reject); }); }

const planFloat=v.pipe(v.number(),v.finite()),planIndex=v.pipe(planFloat,v.integer(),v.minValue(0),v.maxValue(50_000));
const planPoint={x:planFloat,y:planFloat,z:planFloat};
const planBox=v.object({x:planFloat,z:planFloat,hw:planFloat,hd:planFloat,rot:planFloat,yTop:planFloat,yBottom:planFloat});
const planIndices=v.pipe(v.array(planIndex),v.maxLength(50_000));
const planBoxes=v.pipe(v.string(),v.maxLength(1_600_000),v.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u),v.transform(assetBytes),v.check(bytes=>bytes.length%4===0),v.transform(bytes=>new Float32Array(bytes.buffer)),v.check(values=>values.every(Number.isFinite)));
const placementPlan=v.object({
  version:v.literal(1),used:planIndex,
  sets:v.object({casters:v.pipe(v.array(planIndices),v.maxLength(64)),covers:v.pipe(v.array(planIndices),v.maxLength(64)),bigs:v.pipe(v.array(planIndices),v.maxLength(64))}),
  smallRocks:v.pipe(v.array(v.object({...planPoint,matrix:v.pipe(v.array(planFloat),v.length(16)),params:v.object({r:planFloat,sq:planFloat})})),v.maxLength(512)),
  families:v.pipe(v.array(v.object({key:v.custom<CoveFamily>(value=>typeof value==='string'&&Object.hasOwn(COVE_MODELS,value)),indices:planIndices,boxes:planBoxes,colliders:v.pipe(v.array(planBox),v.maxLength(512))})),v.maxLength(16)),
  unclaimed:v.pipe(v.array(planBox),v.maxLength(512)),
});
async function readPlacementPlan():Promise<v.InferOutput<typeof placementPlan>> {
  const file=PLAN_FILES[TIER],response=await fetch(file.url,{cache:'force-cache'});
  if(!response.ok)throw new Error(`Required island plan load failed (${response.status})`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(bytes.length!==file.bytes||!file.url.includes(hash))throw new Error('Required island plan content differs');
  const plan=v.parse(placementPlan,JSON.parse(new TextDecoder().decode(bytes)));
  if(plan.used!==file.used||plan.sets.casters.length!==CT*CT||plan.sets.covers.length!==VT*VT||plan.sets.bigs.length!==VT*VT||plan.families.some(row=>row.boxes.length!==row.indices.length*6||row.indices.some(i=>i>=plan.used))||Object.values(plan.sets).some(tiles=>tiles.some(items=>items.some(i=>i>=plan.used))))throw new Error('Required island plan layout differs');
  return plan;
}

export class BlenderIsland {
  /** the area the island covers (GroundCover leaves it to the island's own dressing, E156) */
  static readonly area = area;
  group = new THREE.Group();
  private terrainMat!: THREE.MeshStandardMaterial;
  private meta!: IslandMeta;
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
    const [gltf, meta, place, ao, bounce, plan] = await Promise.all([
      load<{ scene: THREE.Group }>((ok, bad) => { loader.load(`${BASE}island.glb`, ok, undefined, bad); }),
      fetch(`${BASE}island.json`).then((r) => r.json() as Promise<IslandMeta>),
      fetch(`${BASE}placements.bin`).then((r) => r.arrayBuffer()),
      lm('lm-ao'), lm('lm-bounce'), readPlacementPlan(),
    ]);
    const f = droppedPlacements(place, WORLD_DROP); // G164: each placement's y
    const used = usedPlacements(f, meta.mustDraw, TIER_LOOK.share);
    const coverGrid = CoverGrid.get();
    if(coverGrid===null||used!==ISLAND_COVER_FILES[TIER].used||used!==plan.used)throw new Error('Required full island cover does not match its placements');
    // G164: the cove was baked on the authored heights; it drops with the whole world (its tiles,
    // every placement and every collider box), so it stays on the dropped terrain exactly
    const drop = WORLD_DROP;
    for (const c of meta.colliders) { c.yTop -= drop; c.yBottom -= drop; }
    if(meta.protos.length!==ISLAND_FACTS.length||meta.protos.some((p,i)=>p.name!==ISLAND_FACTS[i]?.name))throw new Error('Blender prototype metadata changed; regenerate island facts');
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
    }
    const protos = protosFromMeshes(found, meta.protos.map((p) => p.name), ISLAND_LOOK.protoPrefix);
    // SF67: the build ends its task at each ~30 ms between its sections (the order and every result are unchanged)
    const slice = slicer();
    await slice();

    // ── the placements by tile: casters (palms, rocks, logs) CT×CT, each with a far copy (the LOD palms); ground cover
    //    VT×VT, drawn only near the camera ──

    const lodOf = new Map<number, number>(Object.entries(meta.lod).map(([k, lo]) => [Number(k), lo]));
    await simplifierReady();
    // E117: far = near, simplified (not the file's hand-made `_lo` palms: a whole tile changed shape at the swap)
    for (const [pi, lo] of lodOf) { const near = protos[pi]; if (near) protos[lo] = simplifiedProto(near, ISLAND_LOOK.far.ratio, ISLAND_LOOK.far.error); await slice(); }
    const { casters, covers, bigs } = plan.sets;
    // G144: one InstancedMesh per prototype × set, the tiles kept as the unit of reach and view (@wildshard/sdk/looks/instancedTiles)
    const ins = this.instances = new TiledInstances(this.group, protos, meta.protos.map((p) => p.name), f, lodOf, ISLAND_LOOK.meshPrefix);
    ins.add({ tag: 'casters', tiles: casters, rects: casters.map((_, k) => tileRect(area, k, CT)), material: propsMat, cast: true, reach: 0, lod: ISLAND_LOOK.lod, cover: false });
    await slice();
    ins.add({ tag: 'cover', tiles: covers, rects: covers.map((_, k) => tileRect(area, k, VT)), material: coverMat, cast: false, reach: TIER_LOOK.cover.far + 1, lod: ISLAND_LOOK.lod, cover: true });
    await slice();
    ins.add({ tag: 'cover-big', tiles: bigs, rects: bigs.map((_, k) => tileRect(area, k, VT)), material: bigMat, cast: false, reach: TIER_LOOK.big.far + 1, lod: ISLAND_LOOK.lod, cover: true });
    await slice();
    // E156: the cove's ground wears the cover it carries (coverTint.ts) — what was placed here, splatted into the grid over
    // GroundCover's estimate for this area, then sampled by the cove's terrain
    { // The required complete grid is admitted before world assembly.
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
    if (plan.smallRocks.length > 0) {
      // E315 M1: the small-rock model, merged into one mesh (piece `cove-small-rocks`; it used to hang in this group)
      await placeSliced(smallRock, plan.smallRocks.map(row=>({...row,matrix:new THREE.Matrix4().fromArray(row.matrix)})), { ctx: models, draw: 'merged', piece: { id: 'cove-small-rocks' } }, slice.due);
    }
    this.group.name = 'blender-island';
    ctx.scene.add(this.group);
    // the specimens draw with an untinted props material (a single specimen has no per-instance `aTint`)
    const unclaimed = await this.placeModels(models, f, plan, meta, protos, makePropsMat(null, false));

    // ── hide what the area replaces ──
    clipGridTerrain(ctx.terrain);
    await slice();
    if (ctx.palms) {
      // a triangle belongs to the nearest palm (its fronds reach 5 m out); drop the palms standing in the area
      if (ctx.palms.userData['islandDressingClipped'] !== true) clipIslandDressing(ctx.palms.geometry,DRESSING[TIER].palms);
      await slice();
    }
    for (const r of ctx.replace) if (r) { if (r.userData['islandDressingClipped'] !== true) clipIslandDressing(r.geometry,DRESSING[TIER].bushes); await slice(); }
    if (ctx.cover) {
      // Streamed cover excludes the baked area before its first refill; only
      // non-instanced drift logs still need their replaced triangles removed.
      const coverMeshes: THREE.Mesh[] = [];
      ctx.cover.traverse((o) => { if (isMesh(o) && !isInstanced(o)) coverMeshes.push(o); });
      for (const m of coverMeshes) { clipIslandDressing(m.geometry,DRESSING[TIER].logs); await slice(); }
    }

    // ── gameplay ──
    ctx.registry.add({ id: 'cove-unclaimed', name: 'Cove rocks', category: 'nature', file: 'src/shards/driftwood-isle/world/BlenderIsland.ts', colliders: unclaimed.map((c) => boxDesc(c, 'wood')), surface: 'wood', solidFloor: false });
    ctx.palmSpecs.push(...meta.extraPalms);
    this.update(ctx.sky);
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
  private async placeModels(models:ModelContext,f:Float32Array,plan:v.InferOutput<typeof placementPlan>,meta:IslandMeta,protos:Proto[],material:THREE.Material):Promise<Collider[]> {
    const byName=new Map<string,Proto>();
    meta.protos.forEach((p,i)=>{const pr=protos[i];if(pr)byName.set(p.name,pr);});
    coveProtos(models,{protos:byName,material});
    const slice=slicer();
    for(const row of plan.families){
      const placements=row.indices.map(i=>({x:f[i*10+1]??0,y:f[i*10+2]??0,z:f[i*10+3]??0,variant:meta.protos[f[i*10]??0]?.name??''}));
      placeModel(COVE_MODELS[row.key],placements,{ctx:models,draw:'merged',drawnInto:{object:this.group,boxes:row.boxes,...(row.colliders.length>0?{colliders:row.colliders.map(c=>boxDesc(c,'wood'))}:{})},piece:{id:`cove-${row.key}`}});
      await slice();
    }
    if(plan.unclaimed.length>0)console.warn(`[island] ${plan.unclaimed.length} collider boxes stand on no cove copy: they stay on the P2 bridge`);
    return plan.unclaimed;
  }

  /** G144: once a frame with the camera posed (the late phase): the instanced placements repack for the view */
  late(sky: Sky): void { this.instances?.update(sky.viewCamera, sky.csm.lights); }

  /** per frame: the baked bounce follows the live sun (colour × intensity × elevation over the bake's reference) */
  update(sky: Sky): void {
    const level = sunBounceLevel(sky, this.meta.bake.refSun[1]);
    if (level === null) return;
    this.terrainMat.lightMapIntensity = level / this.meta.bake.bounceGain;
  }
}
