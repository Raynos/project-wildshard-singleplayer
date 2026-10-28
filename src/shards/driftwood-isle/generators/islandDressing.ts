import { Noise2D } from '@wildshard/sdk/noise';
import { islandKnobs } from './tiers';
import foliagePolicy from '../data/foliagePolicy.json' with { type: 'json' };
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@wildshard/sdk/random';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { HUT, LOOKOUT, SHRINE, WRECK } from './worldSites';
import manifest from '../manifest.json' with { type: 'json' };
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import { nativeTerrainQueries } from '@wildshard/sdk/bake/forest';
import { TRAILS } from './landscapeRows';
import { DECLARED_SEA, WORLD_DROP } from './sea';
import { palm, hibiscusBush, type PalmParams, type HibiscusBushParams, type FoliagePlacement } from './foliageModels';
import { palmGeometry } from './palm';
import { leafClump } from './hibiscus';
import { driftwoodGroundBytes } from './groundRows';
import { inArea } from './blenderArea';
import { GULL_CORRIDORS } from './gullsLook';
import { retainedIslandRuns } from './clipDressing';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { hibiscusTransport, foliageTransport } from './hibiscusTransport';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };

/** Explicit unshifted-bake samples plus the authored datum and scatter policy. */
export interface IslandFoliageGround {
 readonly heightAt: (x: number, z: number) => number;
 readonly normalAt: (x: number, z: number, eps?: number) => [number, number, number];
 readonly trailDistance: (x: number, z: number) => number;
 readonly half: number; readonly water: number; readonly roadWidth: number;
}
const inside = (x: number, z: number, margin: number, half: number): boolean =>
 Math.abs(x) <= half - margin && Math.abs(z) <= half - margin;

/** These producers always supply complete parameter data beside the owned foliage pose. */
export interface IslandFoliagePlacement<P extends object> extends FoliagePlacement { readonly params: P }

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }
export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

/** The world's wet-sand perches, compiled under its original native height binding. */
export function beachGullPerches(heightAt: (x: number, z: number) => number, seed: number, ground: Pick<IslandFoliageGround, 'half' | 'water'>): {x:number;y:number;z:number}[] {
 const rng = new Rng(seed ^ 0x6011), wl = ground.water, out: {x:number;y:number;z:number}[] = [];
 let tries = 0;
 while (out.length < 10 && tries++ < 2000) {
  const x = rng.range(-90,90), z = -195 + rng.range(-90,90);
  if (!inside(x,z,25,ground.half)) continue;
  const h = heightAt(x,z) - wl;
  if (h < 0.15 || h > 1.2) continue;
  if ((Math.abs(x)<GULL_CORRIDORS.half && Math.abs(z)>GULL_CORRIDORS.beyond) || (Math.abs(z)<GULL_CORRIDORS.half && Math.abs(x)>GULL_CORRIDORS.beyond)) continue;
  if (out.some(p=>Math.hypot(p.x-x,p.z-z)<3)) continue;
  out.push({x,y:h+wl,z});
 }
 return out;
}

function scatterPalms(ground: IslandFoliageGround, seed: number, count: number, avoid: { x: number; z: number; r: number }[] = []): PalmSpec[] {
    const rng = new Rng(seed ^ 0x9a1e), grove = new Noise2D(seed + 21);
    const { heightAt, normalAt, half: CHUNK_HALF, water: wl, roadWidth: ROAD_WIDTH } = ground;
    const out: PalmSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 80) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inside(x, z, 20, ground.half)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.4) continue;                                                       // land only, above the beach berm
      const [, ny] = normalAt(x, z, 1.5);
      if (ny < 0.9) continue;                                                      // not on the crag walls
      const g = grove.fbm(x * 0.012, z * 0.012, 3);
      const beachEdge = h < 3.4 ? 0.95 : 0;                                        // the back beach is lined with palms (E43: twice as many)
      if (rng.next() > Math.max(beachEdge, (g + 0.35) * 0.9)) continue;           // groves inland
      if (Math.abs(x) < ROAD_WIDTH / 2 + 6 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 6 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3.8)) continue;
      out.push({ x, z, h: rng.range(5, 9.5), lean: rng.range(0.05, 0.35), leanDir: rng.range(0, Math.PI * 2), rot: rng.range(0, Math.PI * 2), fronds: rng.int(9, 13) });
    }
    return out;
  }

  /** each spec as a placement of the palm: its foot 0.2 m into the sand, its shape from the spec */
function palmPlacements(heightAt: (x: number, z: number) => number, specs: readonly PalmSpec[]): IslandFoliagePlacement<PalmParams>[] {
    return specs.map((p) => ({ x: p.x, y: heightAt(p.x, p.z) - 0.2, z: p.z, params: { h: p.h, lean: p.lean, leanDir: p.leanDir, rot: p.rot, fronds: p.fronds } }));
  }

function scatterBushes(ground: IslandFoliageGround, seed: number, count: number, avoid: { x: number; z: number; r: number }[] = []): BushSpec[] {
    const rng = new Rng(seed ^ 0xb054), clump = new Noise2D(seed + 33);
    const { heightAt, normalAt, half: CHUNK_HALF, water: wl, roadWidth: ROAD_WIDTH } = ground;
    const out: BushSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inside(x, z, 20, ground.half)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.5) continue;
      const [, ny] = normalAt(x, z, 1.2);
      if (ny < 0.88) continue;
      const c = clump.fbm(x * 0.02, z * 0.02, 2);
      const beachTop = h < 3.0 ? 0.5 : 0;
      if (rng.next() > Math.max(beachTop, (c + 0.4) * 0.8)) continue;
      if (Math.abs(x) < ROAD_WIDTH / 2 + 4 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 4 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 2.2)) continue;
      out.push({ x, z, r: rng.range(0.7, 1.5), flowers: rng.next() < 0.28 });
    }
    return out;
  }

  /** each spec as a placement of the bush: on the ground, its sway's phase from where it stands */
function bushPlacements(heightAt: (x: number, z: number) => number, specs: readonly BushSpec[]): IslandFoliagePlacement<HibiscusBushParams>[] {
    return specs.map((b) => ({ x: b.x, y: heightAt(b.x, b.z), z: b.z, params: { r: b.r, flowers: b.flowers, phase: (b.x + b.z) * 0.37 } }));
  }


function palmKeep(points:readonly{x:number;z:number}[]):(x:number,z:number)=>boolean {
 const grid=new Map<string,{x:number;z:number}[]>(),cell=8;
 for(const p of points){const k=`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`,list=grid.get(k);if(list)list.push(p);else grid.set(k,[p]);}
 return(x,z)=>{let best:{x:number;z:number}|null=null,bd=Infinity;const cx=Math.floor(x/cell),cz=Math.floor(z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of grid.get(`${cx+dx},${cz+dz}`)??[]){const distance=(p.x-x)**2+(p.z-z)**2;if(distance<bd){bd=distance;best=p;}}
  return best===null||!inArea(best.x,best.z,1);
 };
}
/** One tier's foliage rows: the palms' and bushes' scatter specs and their placements. */
export interface IslandFoliageTier {
 readonly palms: { readonly specs: ReturnType<typeof scatterPalms>; readonly placements: ReturnType<typeof palmPlacements> };
 readonly bushes: { readonly specs: ReturnType<typeof scatterBushes>; readonly placements: ReturnType<typeof bushPlacements> };
}
/** The island's foliage placement rows (GR7: the dressing job's foliagePlacements.generated.json): the seed, the beach gull
 *  perches and each tier's palm and bush rows. */
export interface IslandFoliagePlacements { readonly seed: number; readonly gullPerches: ReturnType<typeof beachGullPerches>; readonly tiers: { readonly phone: IslandFoliageTier; readonly desktop: IslandFoliageTier } }
let foliagePlacements: IslandFoliagePlacements | undefined;
const avoidSites=():{x:number;z:number;r:number}[]=>[{x:HUT.x,z:HUT.z,r:11},{x:LOOKOUT.x,z:LOOKOUT.z,r:12},{x:SHRINE.x,z:SHRINE.z,r:13},{x:WRECK.x,z:WRECK.z,r:14}];
/** Built once per build process: both tiers' scatter on the bound native ground, as the dressing bakes it (its rows are
 *  these); every reader treats it as read-only. */
export function islandFoliagePlacements(): IslandFoliagePlacements {
 foliagePlacements ??= bakeIslandFoliagePlacements(islandFoliageGround()); return foliagePlacements;
}
/** Native install arithmetic, expressed over owned bake samples without selecting/installing a level. */
export function islandFoliageGround(): IslandFoliageGround {
 const source = readNativeTerrain(driftwoodGroundBytes()), datum = -WORLD_DROP;
 const metadata = nativeTerrainQueries(TERRAIN.seed, { trails: TRAILS, cabinSites: [] }, () => DECLARED_SEA.level);
 return { heightAt: datum === 0 ? source.heightAt : (x, z) => source.heightAt(x, z) + datum,
  normalAt: source.normalAt, trailDistance: metadata.trailDistance, half: source.grid.size / 2,
  water: DECLARED_SEA.level, roadWidth: foliagePolicy.roadWidth };
}
/** Fresh source rows for both explicit tiers; no ambient tier/heightfield or memo is read. */
export function bakeIslandFoliagePlacements(ground: IslandFoliageGround): IslandFoliagePlacements {
 const avoid = avoidSites();
 const tier = (name: 'phone' | 'desktop'): IslandFoliageTier => {
  const knobs = islandKnobs(name);
  const palms = scatterPalms(ground, manifest.seed, Math.round(knobs.palmCount * 1.7), avoid);
  const bushes = scatterBushes(ground, manifest.seed, knobs.bushCount, avoid);
  return { palms: { specs: palms, placements: palmPlacements(ground.heightAt, palms) },
   bushes: { specs: bushes, placements: bushPlacements(ground.heightAt, bushes) } };
 };
 const phone = tier('phone'), desktop = tier('desktop');
 return { seed: manifest.seed, gullPerches: beachGullPerches(ground.heightAt, manifest.seed, ground), tiers: { phone, desktop } };
}
/** One dressing blob: its product name's kind and bytes. */
export interface IslandFoliageBlob { readonly kind: 'glb' | 'bin'; readonly bytes: Uint8Array }
/** The palms' and bushes' bytes (GR7: the dressing job's palm and hibiscus outputs): each tier's world transport and Explorer
 *  variant GLBs by product name (equal payloads keep the first name, as the job's writer did), and the hash-named public URLs
 *  (palmFiles.ts / hibiscusFiles.ts) as aliases of those names. */
export interface IslandFoliageBatches { readonly blobs: ReadonlyMap<string, IslandFoliageBlob>; readonly byUrl: Readonly<Record<string, string>> }
let foliageBatches: IslandFoliageBatches | undefined;
/** Built once per build process from the foliage placements (no file is read); every reader treats it as read-only. */
export function islandFoliageBatches(): IslandFoliageBatches { foliageBatches ??= bakeIslandFoliageBatches(islandFoliagePlacements()); return foliageBatches; }
export function bakeIslandFoliageBatches(placed: IslandFoliagePlacements): IslandFoliageBatches {
 // Each supplied tier layout feeds its explicit shape/RNG pass.
 const blobs=new Map<string,IslandFoliageBlob>(),byUrl:Record<string,string>={},names=new Map<string,string>();
 const emit=(bytes:Uint8Array,kind:IslandFoliageBlob['kind'],prefix:string,name:string):void=>{
  const hash=hashImmutableBytes(bytes),owner=names.get(hash)??name;
  if(!names.has(hash)){names.set(hash,name);blobs.set(name,{kind,bytes});}
  byUrl[`${publicInputs.baked}${prefix}-${hash}.${kind}`]=owner;
 };
 for(const tier of ['phone','desktop'] as const){
   const knobs = islandKnobs(tier);
   const rows=placed.tiers[tier],palms=rows.palms.specs;
   const palmRng=new Rng(palm.seed),bushRng=new Rng(hibiscusBush.seed);
   const pg=rows.palms.placements.map(p=>palmGeometry({...palm.defaults,...p.params},palmRng,knobs).translate(p.x,p.y,p.z));
   const bg=rows.bushes.placements.map(p=>leafClump({...hibiscusBush.defaults,...p.params},bushRng,knobs).translate(p.x,p.y,p.z));
   const mergedPalms=mergeGeometries(pg),mergedBushes=mergeGeometries(bg);
   try{
    emit(hibiscusTransport(mergedBushes,bg,retainedIslandRuns(mergedBushes,(x,z)=>!inArea(x,z))),'bin','hibiscus',`world/hibiscus/${tier}.bin`);
    for(const variant of hibiscusBush.variants){
     const shape=leafClump({...hibiscusBush.defaults,...variant.params},new Rng(hibiscusBush.seed),knobs),material=new MeshStandardMaterial();
     try{emit(staticGlb([{geometry:shape,material,customAttributes:{_SWAY:'aSway'},compactIndex:true}],`hibiscus-${variant.id}`),'glb','hibiscus',`models/hibiscus/${tier}/${variant.id}.glb`);}
     finally{shape.dispose();material.dispose();}
    }
    emit(foliageTransport(mergedPalms,pg,retainedIslandRuns(mergedPalms,palmKeep(palms)),0x314d4c50,['position','color','sway']),'bin','palm',`world/palms/${tier}.bin`);
    for(const variant of palm.variants){
     const shape=palmGeometry({...palm.defaults,...variant.params},new Rng(palm.seed),knobs),material=new MeshStandardMaterial();
     try{emit(staticGlb([{geometry:shape,material,customAttributes:{_SWAY:'sway'},compactIndex:true}],`palm-${variant.id}`),'glb','palm',`models/palms/${tier}/${variant.id}.glb`);}
     finally{shape.dispose();material.dispose();}
    }
   }finally{mergedPalms.dispose();mergedBushes.dispose();for(const geometry of [...pg,...bg])geometry.dispose();}
  }
 return{blobs,byUrl};
}
