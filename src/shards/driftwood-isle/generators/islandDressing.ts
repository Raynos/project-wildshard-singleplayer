import type * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { _buildAs } from '@wildshard/engine/core/tier';
import { Rng } from '@wildshard/engine/core/rng';
import { seedOf } from '@wildshard/engine/models/model';
import { bindLevelSelection } from '@wildshard/engine/level/selection';
import { HeightfieldBinding, bindHeightfield } from '@wildshard/engine/world/Heightfield';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import manifest, { HUT, LOOKOUT, SHRINE, WRECK } from '../manifest';
import { Palms } from '../world/Palms';
import { Bushes } from '../world/Bushes';
import { palm } from '../models/palm';
import { palmGeometry } from './palm';
import { hibiscusBush } from '../models/hibiscusBush';
import { leafClump } from './hibiscus';
import { driftwoodGroundBytes } from './groundRows';
import { duneLogs } from './duneLogs';
import { bakeFullIslandCover } from './islandCover';
import { inArea } from '../world/blenderArea';

/** Retained triangle runs of the native merged shape, without a second geometry payload. */
export interface ClipRuns { vertices:number; indices:number; output:number; runs:{start:number;count:number}[] }
function retain(geometry:THREE.BufferGeometry,keep:(x:number,z:number)=>boolean):ClipRuns {
 const pos=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?.count??pos.count,runs:{start:number;count:number}[]=[];
 for(let t=0;t<count;t+=3){
  const a=index?.getX(t)??t,b=index?.getX(t+1)??t+1,c=index?.getX(t+2)??t+2;
  if(!keep((pos.getX(a)+pos.getX(b)+pos.getX(c))/3,(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3))continue;
  const previous=runs.at(-1);if(previous!==undefined&&previous.start+previous.count===t)previous.count+=3;else runs.push({start:t,count:3});
 }
 if(runs.length>4096)throw new Error('Island clip runs exceed metadata bound');
 return{vertices:pos.count,indices:index?.count??0,output:runs.reduce((n,row)=>n+row.count,0),runs};
}
function palmKeep(points:readonly{x:number;z:number}[]):(x:number,z:number)=>boolean {
 const grid=new Map<string,{x:number;z:number}[]>(),cell=8;
 for(const p of points){const k=`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`,list=grid.get(k);if(list)list.push(p);else grid.set(k,[p]);}
 return(x,z)=>{let best:{x:number;z:number}|null=null,bd=Infinity;const cx=Math.floor(x/cell),cz=Math.floor(z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of grid.get(`${cx+dx},${cz+dz}`)??[]){const distance=(p.x-x)**2+(p.z-z)**2;if(distance<bd){bd=distance;best=p;}}
  return best===null||!inArea(best.x,best.z,1);
 };
}
/** Compile both tiers from their actual scatter, native shapes and original height binding. */
export async function islandDressing(readAsset:(url:string)=>Uint8Array, bushesReady?: (tier:'phone'|'desktop', geometry:THREE.BufferGeometry, originals:readonly THREE.BufferGeometry[], clips:ClipRuns) => void, palmsReady?: (tier:'phone'|'desktop', geometry:THREE.BufferGeometry, originals:readonly THREE.BufferGeometry[], clips:ClipRuns) => void):Promise<{tiers:{tier:'phone'|'desktop';clips:{palms:ClipRuns;bushes:ClipRuns;logs:ClipRuns};cover:Awaited<ReturnType<typeof bakeFullIslandCover>>}[]}> {
 const terrain=manifest.ground.terrain;if(terrain===undefined)throw new Error('Native island ground is required');
 const level={id:manifest.slug,ground:{terrain},spawn:manifest.spawn,sky:manifest.sky,atmosphere:manifest.atmosphere,grade:manifest.grade,
  budgets:{},mechanisms:[],fight:{},boot:{files:[]},audio:{ambience:'none',score:'none'},loadout:{weapons:[],tools:[],start:[]},species:[],spawns:[],minimap:{},kitLook:'toon' as const}; // Only the real authored ground frame is evaluated by this isolated producer.
 const restoreLevel=bindLevelSelection(level),binding=new HeightfieldBinding(level);
 binding.install(readNativeTerrain(driftwoodGroundBytes()));const restoreGround=bindHeightfield(binding),ground=binding.field;
 const avoid=[{x:HUT.x,z:HUT.z,r:11},{x:LOOKOUT.x,z:LOOKOUT.z,r:12},{x:SHRINE.x,z:SHRINE.z,r:13},{x:WRECK.x,z:WRECK.z,r:14}];
 // Ground-cover logs use the cover's own POI exclusions, not the palm/bush scatter margins.
 const {islandCoveSpec}=await import('../world/coveLayout');const cave=islandCoveSpec().cave;
 const logAvoid=[{x:HUT.x,z:HUT.z,r:9},{x:LOOKOUT.x,z:LOOKOUT.z,r:8},{x:SHRINE.x,z:SHRINE.z,r:9.5},{x:WRECK.x,z:WRECK.z,r:13},{x:cave.x,z:cave.z+cave.depth/2,r:8},{x:0,z:-151,r:3.2}];
 const logs=duneLogs(ground.heightAt,ground.trailDistance,logAvoid,0,manifest.seed);
 try{
  const tiers=[];
  for(const tier of ['phone','desktop'] as const){
   _buildAs(tier);
   const palms=Palms.scatterIsland(manifest.seed,undefined,avoid),bushes=Bushes.scatterIsland(manifest.seed,undefined,avoid);
   const palmRng=new Rng(seedOf(palm)),bushRng=new Rng(seedOf(hibiscusBush));
   const pg=Palms.placements(palms).map(p=>palmGeometry({...palm.defaults,...p.params},palmRng).translate(p.x,p.y,p.z));
   const bg=Bushes.placements(bushes).map(p=>leafClump({...hibiscusBush.defaults,...p.params},bushRng).translate(p.x,p.y,p.z));
   const mergedPalms=mergeGeometries(pg),mergedBushes=mergeGeometries(bg);
   try{
    const clips={palms:retain(mergedPalms,palmKeep(palms)),bushes:retain(mergedBushes,(x,z)=>!inArea(x,z)),logs:retain(logs.geometry,(x,z)=>!inArea(x,z))};
    bushesReady?.(tier,mergedBushes,bg,clips.bushes);
    palmsReady?.(tier,mergedPalms,pg,clips.palms);
    const cover=await bakeFullIslandCover(readAsset,tier==='phone',palms,ground);
    tiers.push({tier,clips,cover});
   }finally{mergedPalms.dispose();mergedBushes.dispose();for(const geometry of [...pg,...bg])geometry.dispose();}
  }
  return{tiers};
 }finally{logs.geometry.dispose();_buildAs(null);restoreGround();restoreLevel();}
}
