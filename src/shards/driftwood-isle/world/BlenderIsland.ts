import DRESSING from '../data/islandDressing.generated.json' with {type:'json'};
import { clipIslandDressing } from './islandDressing';
import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };
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
 * - placements.bin (f32 × 10: proto, x, y, z, quaternion, scale, tint) + the plan and facts baked from island.json
 *   (colliders, extra palms, bake notes; generators/islandCover.ts, generators/islandFacts.ts, never read at runtime):
 *   each prototype is uploaded once and its copies placed instanced through the engine (`place`, one model per family,
 *   src/shards/driftwood-isle/runtime/models/cove.ts; G144 / G173, E435: the merged tiles held a world-space copy of every vertex,
 *   ~104 MB). The phone builds every palm / rock / log and 70 % of the small cover (the file is ordered so that is a
 *   prefix). The scattered small rocks are the small-rock model (rockKit), placed merged (src/engine/models/place.ts).
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
import PLAN_FILES from '../data/islandPlanFiles.json' with { type: 'json' };
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import ISLAND_FACTS from '../data/islandFacts.generated.json' with { type: 'json' };
import { area, BLENDER_MODELS } from './blenderArea';
import type { PalmSpec } from './Palms';
import sea from '../boot/sea.generated.json' with { type: 'json' };
import { smallRock } from '../runtime/models/shoreBoulder';
import { COVE_MODELS, coveLook, coveProtos, type CoveFamily, type CoveLook } from '../runtime/models/cove';
import { driftwoodRows, driftwoodProduct } from '../runtime/boot/rows';
import type { IslandCover } from './islandCover';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { followToonLook } from '@wildshard/game/looks/toonLook';
import { readDriftwoodBlob } from '../runtime/boot/blobAssets';
import { slicer } from '@wildshard/engine/boot/plan';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { TIER } from '@wildshard/engine/core/tier';
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import { placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { CullOptions } from '@wildshard/engine/models/cull';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const { WORLD_DROP } = sea;

const BASE = BLENDER_MODELS; // Driftwood's build: its palms / toon / sea are this file's own
/** the tier's cover share and reaches (data/islandRows.ts) */
const tierLook = () => driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_TIERS[TIER];

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
  /** the tier's baked cover look (world/islandCover.ts): the plants' ground map and the tiles' cover bytes */
  islandCover: IslandCover;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;


function load<T>(f: (ok: (v: T) => void, bad: (e: unknown) => void) => void): Promise<T> { return new Promise<T>((resolve, reject) => { f(resolve, reject); }); }

const planFloat=v.pipe(v.number(),v.finite()),planIndex=v.pipe(planFloat,v.integer(),v.minValue(0),v.maxValue(50_000));
const planPoint={x:planFloat,y:planFloat,z:planFloat};
const planBox=v.object({x:planFloat,z:planFloat,hw:planFloat,hd:planFloat,rot:planFloat,yTop:planFloat,yBottom:planFloat});
const planIndices=v.pipe(v.array(planIndex),v.maxLength(50_000));
const placementPlan=v.object({
  version:v.literal(1),used:planIndex,
  smallRocks:v.pipe(v.array(v.object({...planPoint,matrix:v.pipe(v.array(planFloat),v.length(16)),params:v.object({r:planFloat,sq:planFloat})})),v.maxLength(512)),
  families:v.pipe(v.array(v.object({key:v.custom<CoveFamily>(value=>typeof value==='string'&&Object.hasOwn(COVE_MODELS,value)),indices:planIndices,colliders:v.pipe(v.array(planBox),v.maxLength(512))})),v.maxLength(16)),
  unclaimed:v.pipe(v.array(planBox),v.maxLength(512)),
});
async function readPlacementPlan():Promise<v.InferOutput<typeof placementPlan>> {
  const file=PLAN_FILES[TIER],response=await fetch(file.url,{cache:'force-cache'});
  if(!response.ok)throw new Error(`Required island plan load failed (${response.status})`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(bytes.length!==file.bytes||!file.url.includes(hash))throw new Error('Required island plan content differs');
  const plan=v.parse(placementPlan,JSON.parse(new TextDecoder().decode(bytes)));
  if(plan.used!==file.used||plan.families.some(row=>row.indices.some(i=>i>=plan.used)))throw new Error('Required island plan layout differs');
  return plan;
}

export class BlenderIsland {
  /** the area the island covers (GroundCover leaves it to the island's own dressing, E156) */
  static readonly area = area;
  group = new THREE.Group();

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
    const [gltf, place, ao, bounce, plan, protoFile] = await Promise.all([
      load<{ scene: THREE.Group }>((ok, bad) => { loader.load(`${BASE}island.glb`, ok, undefined, bad); }),
      fetch(`${BASE}placements.bin`).then((r) => r.arrayBuffer()),
      lm('lm-ao'), lm('lm-bounce'), readPlacementPlan(), readDriftwoodBlob('world/island/protos.glb'),
    ]);
    if(plan.used!==ISLAND_COVER_FILES[TIER].used)throw new Error('Required full island cover does not match its placements');
    // G164: the cove was baked on the authored heights; it drops with the whole world (its tiles and every placement here,
    // its collider boxes in the plan's bake), so it stays on the dropped terrain exactly
    const drop = WORLD_DROP;
    for (const t of [ao, bounce]) { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 0; t.anisotropy = 4; t.needsUpdate = true; }

    // ── materials: the graph toon looks the runtime lent (data/islandLook.ts), the bake's maps lent to the terrain's and the
    //    tier's cover reach set on the two cover sets' ──
    setLentTexture(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.terrain, 'ao', ao); setLentTexture(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.terrain, 'bounceMap', bounce);
    // E156: each cover plant fades into the ground the cover paints under it (the baked cover map, sampled at its origin)
    const { ground, groundRect } = ctx.islandCover;
    for (const [id, c] of [[driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.cover, tierLook().cover], [driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.coverBig, tierLook().big]] as const) {
      setLentParam(id, 'fade', [c.near + c.grow, c.far, c.grow]); setLentParam(id, 'groundRect', [...groundRect]); setLentTexture(id, 'groundMap', ground);
    }
    const terrainMat = lentLook(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.terrain), propsMat = lentLook(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.props);
    const coverMat = lentLook(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.cover), bigMat = lentLook(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.coverBig);

    // ── terrain tiles ──
    gltf.scene.updateMatrixWorld(true);
    const models = modelContext(ctx.sky);
    const found: THREE.Mesh[] = [], terrainTiles: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) found.push(o); });
    const protoNames = new Set(ISLAND_FACTS.protos.map((p) => `${driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOK.protoPrefix}${p.name}`));
    for (const o of found) {
      if (protoNames.has(o.name)) continue;
      // a terrain tile — the 1 m grid on desktop, the 2 m one (terrainlo_*) on the phone; keep its node transform (meshopt's
      // dequantisation lives there)
      if (o.name.startsWith('terrainlo') !== phone) continue;
      const m = new THREE.Mesh(o.geometry, terrainMat);
      m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrix.elements[13] -= drop; m.matrixWorld.copy(m.matrix);
      m.name = `${driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOK.meshPrefix}${o.name}`; m.castShadow = true; m.receiveShadow = true;
      m.onBeforeRender = followToonLook(driftwoodProduct(), driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.terrain); // the terrain draws whenever the cove is in view: its toon look follows the day clock here
      ctx.islandCover.wear(o.geometry, terrainTiles.length + 1); // E156: the cove's ground wears the cover it carries (baked over the estimate)
      terrainTiles.push(m);
      if (!o.geometry.hasAttribute('normal')) o.geometry.computeVertexNormals(); // lighting is flat (derivatives); the normals are the shadows' normal bias
      o.geometry.computeBoundingSphere();
      this.group.add(m);
    }
    // the prototypes as baked (generators/islandCover.ts: E117, each palm's far copy is its near one simplified)
    const protos = new Map<string, THREE.BufferGeometry>();
    (await loader.parseAsync(Uint8Array.from(protoFile).buffer, '')).scene.traverse((o) => { if (isMesh(o)) protos.set(o.name, o.geometry); });
    // SF67: the build ends its task at each ~30 ms between its sections (the order and every result are unchanged)
    const slice = slicer();
    await slice();
    if (plan.smallRocks.length > 0) {
      // E315 M1: the small-rock model, merged into one mesh (piece `cove-small-rocks`; it used to hang in this group)
      await placeSliced(smallRock, plan.smallRocks.map(row=>({...row,matrix:new THREE.Matrix4().fromArray(row.matrix)})), { ctx: models, draw: 'merged', piece: { id: 'cove-small-rocks' } }, slice.due);
    }
    this.group.name = 'blender-island';
    ctx.scene.add(this.group);
    const unclaimed = await this.placeModels(models, new Float32Array(place), plan, protos, { cast: propsMat, cover: coverMat, big: bigMat });

    // ── hide what the area replaces (the faceted ground is baked without the island's cells) ──
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
    ctx.palmSpecs.push(...ISLAND_FACTS.extraPalms);
    this.update(ctx.sky);
  }

  /**
   * E315 M1: the cove's prototypes are models (one per family, src/shards/driftwood-isle/runtime/models/cove.ts), and each family is
   * placed instanced under this group (G144: one InstancedMesh per prototype and level): each copy its placement's matrix
   * and tint (the engine's per-copy colour). The casters are drawn where the camera or a shadow cascade sees them (the
   * palms swap to their far copy at `ISLAND_LOOK.lod`); the cover is culled by cells and drawn within the tier's reach (its
   * graph fades each plant out before it).
   *
   * E344: the cove's collider boxes are its copies'. island.json's 200 `colliders` (build_island.py) are one box per extra
   * palm (its trunk: 0.6 m square, from a metre under its foot to its crown) and one per reachable crag plate (a box a
   * little inside the rock, 3 m into the ground), each standing on its copy's spot exactly (placements.bin holds the same
   * x, z in f32). So each goes to that copy's family's piece (`piece.colliders`: the palm, broad-frond palm and crag plate
   * pieces), each the box the P2 bridge mirrored (`boxDesc`: the same centre, half extents and turn) in 'wood', as the
   * bridge tagged it. Returns the boxes no copy claims (none: they would stay on the bridge).
   */
  private async placeModels(models:ModelContext,f:Float32Array,plan:v.InferOutput<typeof placementPlan>,protos:ReadonlyMap<string,THREE.BufferGeometry>,materials:Readonly<Record<CoveLook,THREE.Material>>):Promise<Collider[]> {
    coveProtos(models,{protos,materials});
    const slice=slicer(),cell={size:16,pad:4},sky=models.sky,view=new THREE.Frustum(),pv=new THREE.Matrix4(),box=new THREE.Box3(),ball=new THREE.Sphere();
    // a caster is drawn while the camera or any shadow cascade sees its box (padded 4 m: the frusta are a frame old), so no
    // shadow is lost; the camera's frustum is taken as each choice starts (copy 0)
    const seen=(placed:{p:Placed|null})=>(i:number):boolean=>{
      const p=placed.p; if(p===null)return true;
      if(i===0){const c=sky.viewCamera;c.updateMatrixWorld();view.setFromProjectionMatrix(pv.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));}
      p.copyBox(i,box).getBoundingSphere(ball).applyMatrix4(this.group.matrixWorld);ball.radius+=4;
      return view.intersectsSphere(ball)||sky.csm.lights.some(l=>l.castShadow&&l.shadow.getFrustum().intersectsSphere(ball));
    };
    const culls:Readonly<Record<CoveLook,(placed:{p:Placed|null})=>CullOptions>>={cast:placed=>({test:seen(placed),flat:true}),cover:()=>({far:tierLook().cover.far+1,cells:cell}),big:()=>({far:tierLook().big.far+1,cells:cell})};
    for(const row of plan.families){
      const placements=row.indices.map(i=>{
        const o=i*10,x=f[o+1]??0,y=(f[o+2]??0)-WORLD_DROP,z=f[o+3]??0,sc=f[o+8]??1,t=f[o+9]??1;
        const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(f[o+4]??0,f[o+5]??0,f[o+6]??0,f[o+7]??1),new THREE.Vector3(sc,sc,sc));
        return {x,y,z,matrix,color:new THREE.Color(t,t,t),variant:ISLAND_FACTS.protos[f[o]??0]?.name??''};
      });
      const placed:{p:Placed|null}={p:null};
      placed.p=await placeSliced(COVE_MODELS[row.key],placements,{ctx:models,draw:'instanced',parent:this.group,cull:culls[coveLook(row.key)](placed),piece:{id:`cove-${row.key}`,...(row.colliders.length>0?{colliders:row.colliders.map(c=>boxDesc(c,'wood'))}:{})}},slice.due);
    }
    if(plan.unclaimed.length>0)console.warn(`[island] ${plan.unclaimed.length} collider boxes stand on no cove copy: they stay on the P2 bridge`);
    return plan.unclaimed;
  }

  /** per frame: the baked bounce follows the live sun (its luminance × intensity × its elevation over the bake's
   *  reference sun, floored at 0.2), once the sky has a sun light */
  update(sky: Sky): void {
    const l = sky.csm.lights[0];
    if (!l) return;
    const lum = l.intensity * (0.2126 * l.color.r + 0.7152 * l.color.g + 0.0722 * l.color.b);
    setLentParam(driftwoodRows('custom/fixedLayouts').nativeView.ISLAND_LOOKS.terrain, 'bounce', lum * (Math.max(0, sky.sunDir.y) / Math.max(0.2, ISLAND_FACTS.bake.sunY)) / ISLAND_FACTS.bake.bounceGain);
  }
}
