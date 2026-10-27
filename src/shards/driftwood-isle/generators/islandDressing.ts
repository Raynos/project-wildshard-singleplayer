import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { islandKnobs } from './tiers';
import type * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { _buildAs, buildTier, TIER, type Tier } from '@wildshard/engine/core/tier';
import { Rng } from '@wildshard/engine/core/rng';
import { seedOf, type Placement } from '@wildshard/engine/models/model';
import { bindLevelSelection } from '@wildshard/engine/level/selection';
import { HeightfieldBinding, bindHeightfield, normalAt, waterLevel, inChunk } from '@wildshard/engine/world/Heightfield';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { HUT, LOOKOUT, SHRINE, WRECK } from './worldSites';
import manifest from '../discovery.generated';
import { palm, hibiscusBush, type PalmParams, type HibiscusBushParams } from './foliageModels';
import { palmGeometry } from './palm';
import { leafClump } from './hibiscus';
import { driftwoodGroundBytes } from './groundRows';
import { duneLogs } from './duneLogs';
import { bakeFullIslandCover } from './islandCover';
import { driftwoodIslandFactsFrom, type DriftwoodIslandFacts } from './islandFacts';
import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };
import { inArea } from './blenderArea';
import { GULL_CORRIDORS } from './gullsLook';
import { retainedIslandRuns, type ClipRuns } from './clipDressing';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { hibiscusTransport, foliageTransport } from './hibiscusTransport';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }
export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

/** The world's wet-sand perches, compiled under its original native height binding. */
export function beachGullPerches(heightAt: (x: number, z: number) => number, seed: number): {x:number;y:number;z:number}[] {
 const rng = new Rng(seed ^ 0x6011), wl = waterLevel(), out: {x:number;y:number;z:number}[] = [];
 let tries = 0;
 while (out.length < 10 && tries++ < 2000) {
  const x = rng.range(-90,90), z = -195 + rng.range(-90,90);
  if (!inChunk(x,z,25)) continue;
  const h = heightAt(x,z) - wl;
  if (h < 0.15 || h > 1.2) continue;
  if ((Math.abs(x)<GULL_CORRIDORS.half && Math.abs(z)>GULL_CORRIDORS.beyond) || (Math.abs(z)<GULL_CORRIDORS.half && Math.abs(x)>GULL_CORRIDORS.beyond)) continue;
  if (out.some(p=>Math.hypot(p.x-x,p.z-z)<3)) continue;
  out.push({x,y:h+wl,z});
 }
 return out;
}

interface FoliagePlacements { palms: {specs: PalmSpec[]; placements: Placement<PalmParams>[]}; bushes: {specs: BushSpec[]; placements: Placement<HibiscusBushParams>[]} }
function scatterPalms(heightAt: (x: number, z: number) => number, seed: number, count = Math.round(islandKnobs().palmCount * 1.7), avoid: { x: number; z: number; r: number }[] = []): PalmSpec[] {
    const rng = new Rng(seed ^ 0x9a1e), grove = new Noise2D(seed + 21);
    const wl = waterLevel();
    const out: PalmSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 80) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
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
function palmPlacements(heightAt: (x: number, z: number) => number, specs: readonly PalmSpec[]): Placement<PalmParams>[] {
    return specs.map((p) => ({ x: p.x, y: heightAt(p.x, p.z) - 0.2, z: p.z, params: { h: p.h, lean: p.lean, leanDir: p.leanDir, rot: p.rot, fronds: p.fronds } }));
  }

function scatterBushes(heightAt: (x: number, z: number) => number, seed: number, count = islandKnobs().bushCount, avoid: { x: number; z: number; r: number }[] = []): BushSpec[] {
    const rng = new Rng(seed ^ 0xb054), clump = new Noise2D(seed + 33);
    const wl = waterLevel();
    const out: BushSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
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
function bushPlacements(heightAt: (x: number, z: number) => number, specs: readonly BushSpec[]): Placement<HibiscusBushParams>[] {
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
export function islandFoliagePlacements(): IslandFoliagePlacements { foliagePlacements ??= scatterIslandFoliage(); return foliagePlacements; }
/** Run `build` and put the build tier back as it was (a memo may first fill inside a caller's tier pass). */
function keepingTier<T>(build: () => T): T {
 const previous: Tier = buildTier();
 try { return build(); } finally { _buildAs(previous === TIER ? null : previous); }
}
function scatterIslandFoliage(): IslandFoliagePlacements { return keepingTier(scatterIslandFoliageRows); }
function scatterIslandFoliageRows(): IslandFoliagePlacements {
 const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
 const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
  budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon' as const};
 const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
 binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding),ground=binding.field,avoid=avoidSites();
 try{
  const tier=(name:'phone'|'desktop'):IslandFoliageTier=>{
   _buildAs(name);
   const palms=scatterPalms(ground.heightAt,manifest.seed,undefined,avoid),bushes=scatterBushes(ground.heightAt,manifest.seed,undefined,avoid);
   return{palms:{specs:palms,placements:palmPlacements(ground.heightAt,palms)},bushes:{specs:bushes,placements:bushPlacements(ground.heightAt,bushes)}};
  };
  const phone=tier('phone'),desktop=tier('desktop');
  return{seed:manifest.seed,gullPerches:beachGullPerches(ground.heightAt,manifest.seed),tiers:{phone,desktop}};
 }finally{restoreGround();restoreLevel();}
}
/** One dressing blob: its product name's kind and bytes. */
export interface IslandFoliageBlob { readonly kind: 'glb' | 'bin'; readonly bytes: Uint8Array }
/** The palms' and bushes' bytes (GR7: the dressing job's palm and hibiscus outputs): each tier's world transport and Explorer
 *  variant GLBs by product name (equal payloads keep the first name, as the job's writer did), and the hash-named public URLs
 *  (palmFiles.ts / hibiscusFiles.ts) as aliases of those names. */
export interface IslandFoliageBatches { readonly blobs: ReadonlyMap<string, IslandFoliageBlob>; readonly byUrl: Readonly<Record<string, string>> }
let foliageBatches: IslandFoliageBatches | undefined;
/** Built once per build process from the foliage placements (no file is read); every reader treats it as read-only. */
export function islandFoliageBatches(): IslandFoliageBatches { foliageBatches ??= buildIslandFoliageBatches(); return foliageBatches; }
function buildIslandFoliageBatches(): IslandFoliageBatches { return keepingTier(buildIslandFoliageBatchRows); }
function buildIslandFoliageBatchRows(): IslandFoliageBatches {
 // the placements first: their scatter ends by clearing the build tier, so they must not be filled inside a tier pass
 const placed=islandFoliagePlacements(),blobs=new Map<string,IslandFoliageBlob>(),byUrl:Record<string,string>={},names=new Map<string,string>();
 const emit=(bytes:Uint8Array,kind:IslandFoliageBlob['kind'],prefix:string,name:string):void=>{
  const hash=hashImmutableBytes(bytes),owner=names.get(hash)??name;
  if(!names.has(hash)){names.set(hash,name);blobs.set(name,{kind,bytes});}
  byUrl[`${publicInputs.baked}${prefix}-${hash}.${kind}`]=owner;
 };
 for(const tier of ['phone','desktop'] as const){
   _buildAs(tier);
   const rows=placed.tiers[tier],palms=rows.palms.specs;
   const palmRng=new Rng(seedOf(palm)),bushRng=new Rng(seedOf(hibiscusBush));
   const pg=rows.palms.placements.map(p=>palmGeometry({...palm.defaults,...p.params},palmRng).translate(p.x,p.y,p.z));
   const bg=rows.bushes.placements.map(p=>leafClump({...hibiscusBush.defaults,...p.params},bushRng).translate(p.x,p.y,p.z));
   const mergedPalms=mergeGeometries(pg),mergedBushes=mergeGeometries(bg);
   try{
    emit(hibiscusTransport(mergedBushes,bg,retainedIslandRuns(mergedBushes,(x,z)=>!inArea(x,z))),'bin','hibiscus',`world/hibiscus/${tier}.bin`);
    for(const variant of hibiscusBush.variants){
     const shape=leafClump({...hibiscusBush.defaults,...variant.params},new Rng(seedOf(hibiscusBush))),material=new MeshStandardMaterial();
     try{emit(staticGlb([{geometry:shape,material,customAttributes:{_SWAY:'aSway'},compactIndex:true}],`hibiscus-${variant.id}`),'glb','hibiscus',`models/hibiscus/${tier}/${variant.id}.glb`);}
     finally{shape.dispose();material.dispose();}
    }
    emit(foliageTransport(mergedPalms,pg,retainedIslandRuns(mergedPalms,palmKeep(palms)),0x314d4c50,['position','color','sway']),'bin','palm',`world/palms/${tier}.bin`);
    for(const variant of palm.variants){
     const shape=palmGeometry({...palm.defaults,...variant.params},new Rng(seedOf(palm))),material=new MeshStandardMaterial();
     try{emit(staticGlb([{geometry:shape,material,customAttributes:{_SWAY:'sway'},compactIndex:true}],`palm-${variant.id}`),'glb','palm',`models/palms/${tier}/${variant.id}.glb`);}
     finally{shape.dispose();material.dispose();}
    }
   }finally{mergedPalms.dispose();mergedBushes.dispose();for(const geometry of [...pg,...bg])geometry.dispose();}
  }
 return{blobs,byUrl};
}
let coverBank: Promise<ReadonlyMap<string, Uint8Array>> | undefined;
/** The streamed cover (GR7: the dressing job's cover outputs): each tier's cover transport and per-cell plants by product
 *  name, baked over the Blender island (`readAsset` its committed public files) on the bound native ground as the dressing
 *  bakes it. Each cover must hash to its committed islandCoverFiles.json row, whose URL and metadata the build names it by.
 *  Built once per build process. */
export function islandCoverBank(readAsset: (url: string) => Uint8Array, facts: DriftwoodIslandFacts): Promise<ReadonlyMap<string, Uint8Array>> {
 coverBank ??= bakeIslandCoverBank(readAsset, facts); return coverBank;
}
async function bakeIslandCoverBank(readAsset: (url: string) => Uint8Array, facts: DriftwoodIslandFacts): Promise<ReadonlyMap<string, Uint8Array>> {
 // the placements before any tier pass: their scatter puts back the build tier it found
 const placed=islandFoliagePlacements(),files=new Map<string,Uint8Array>();
 const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
 const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
  budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon' as const};
 const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level),previous:Tier=buildTier();
 binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding),ground=binding.field;
 try{
  for(const tier of ['phone','desktop'] as const){
   _buildAs(tier);
   const baked=await bakeFullIslandCover(readAsset,tier==='phone',placed.tiers[tier].palms.specs,ground,manifest.seed,facts);
   if(hashImmutableBytes(baked.bytes)!==ISLAND_COVER_FILES[tier].hash)throw new Error(`Driftwood ${tier} cover differs from its committed islandCoverFiles.json row`);
   files.set(`world/cover/${tier}.bin`,baked.bytes);files.set(`world/cover/cells/${tier}.bin`,baked.cells);
  }
 }finally{_buildAs(previous===TIER?null:previous);restoreGround();restoreLevel();}
 return files;
}
/** Compile both tiers from their actual scatter, native shapes and original height binding. */
export async function islandDressing(readAsset:(url:string)=>Uint8Array, bushesReady?: (tier:'phone'|'desktop', geometry:THREE.BufferGeometry, originals:readonly THREE.BufferGeometry[], clips:ClipRuns) => void, palmsReady?: (tier:'phone'|'desktop', geometry:THREE.BufferGeometry, originals:readonly THREE.BufferGeometry[], clips:ClipRuns) => void):Promise<{seed:number;gullPerches:ReturnType<typeof beachGullPerches>;tiers:{foliage:FoliagePlacements;tier:'phone'|'desktop';clips:{palms:ClipRuns;bushes:ClipRuns;logs:ClipRuns};cover:Awaited<ReturnType<typeof bakeFullIslandCover>>}[]}> {
 const facts=await driftwoodIslandFactsFrom(readAsset);
 const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
 const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
  budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon' as const}; // Only the real authored ground frame is evaluated by this isolated producer.
 const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
 binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding),ground=binding.field;
 // Ground-cover logs use the cover's own POI exclusions, not the palm/bush scatter margins.
 const {islandCoveSpec}=await import('./coveLayout');const cave=islandCoveSpec().cave;
 const logAvoid=[{x:HUT.x,z:HUT.z,r:9},{x:LOOKOUT.x,z:LOOKOUT.z,r:8},{x:SHRINE.x,z:SHRINE.z,r:9.5},{x:WRECK.x,z:WRECK.z,r:13},{x:cave.x,z:cave.z+cave.depth/2,r:8},{x:0,z:-151,r:3.2}];
 const logs=duneLogs(ground.heightAt,ground.trailDistance,logAvoid,0,manifest.seed);
 try{
  // the placements before any tier pass: their scatter ends by clearing the build tier
  const placed=islandFoliagePlacements(),tiers=[];
  for(const tier of ['phone','desktop'] as const){
   _buildAs(tier);
   const rows=placed.tiers[tier],palms=rows.palms.specs,bushes=rows.bushes.specs;
   const palmRng=new Rng(seedOf(palm)),bushRng=new Rng(seedOf(hibiscusBush));
   const palmRows=rows.palms.placements,bushRows=rows.bushes.placements;
   const pg=palmRows.map(p=>palmGeometry({...palm.defaults,...p.params},palmRng).translate(p.x,p.y,p.z));
   const bg=bushRows.map(p=>leafClump({...hibiscusBush.defaults,...p.params},bushRng).translate(p.x,p.y,p.z));
   const mergedPalms=mergeGeometries(pg),mergedBushes=mergeGeometries(bg);
   try{
    const clips={palms:retainedIslandRuns(mergedPalms,palmKeep(palms)),bushes:retainedIslandRuns(mergedBushes,(x,z)=>!inArea(x,z)),logs:retainedIslandRuns(logs.geometry,(x,z)=>!inArea(x,z))};
    bushesReady?.(tier,mergedBushes,bg,clips.bushes);
    palmsReady?.(tier,mergedPalms,pg,clips.palms);
    const cover=await bakeFullIslandCover(readAsset,tier==='phone',palms,ground,manifest.seed,facts);
    tiers.push({tier,clips,cover,foliage:{palms:{specs:palms,placements:palmRows},bushes:{specs:bushes,placements:bushRows}}});
   }finally{mergedPalms.dispose();mergedBushes.dispose();for(const geometry of [...pg,...bg])geometry.dispose();}
  }
  return{seed:placed.seed,gullPerches:placed.gullPerches,tiers};
 }finally{logs.geometry.dispose();_buildAs(null);restoreGround();restoreLevel();}
}
