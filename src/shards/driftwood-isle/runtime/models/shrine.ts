import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { libraryModel } from '@wildshard/game/models/libraryModel';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { ShrineAnchor, ShrineParams, ShrineSite } from '../../assets/contracts/shrine';
import { driftwoodRows } from '../boot/rows';
import { SHRINE_POOL_LOOK, SHRINE_SITES } from '../const';
import { fixedGeometryReady, loadFixedGeometry,
  SHRINE_KIT_GEOMETRY,SHRINE_WATER_GEOMETRY,SHRINE_GLYPHS_GEOMETRY,
  SHRINE_SPECIMEN_KIT_GEOMETRY,SHRINE_SPECIMEN_WATER_GEOMETRY,SHRINE_SPECIMEN_GLYPHS_GEOMETRY } from '../boot/fixedGeometry';

/** the two sites' baked layouts, from the admitted product (`custom/fixedLayouts`, from data/shrineBake.json) */
const bake = () => driftwoodRows('custom/fixedLayouts').shrine;

const TIERS = [
  { hw: 6.5, z0: -7.5, z1: 4.0, top: 1.0 },
  { hw: 5.5, z0: -6.5, z1: 3.0, top: 2.0 },
  { hw: 4.5, z0: -5.5, z1: 2.0, top: 3.0 },
] as const;
const STAIR = { hw: 1.6, z0: 2.0, z1: 7.0 };          // top edge at z0 (terrace height), foot at z1 (ground)
const POOL = { z: 11, rx: 7, rz: 3.2, causeway: 1.2 };

export const SHRINE_RUNE=new THREE.Color('#7fd9ff');
/** Only the two authored sites are admitted; runtime callers never build a procedural substitute. */
export function shrineSiteKind(site:ShrineSite):keyof typeof SHRINE_SITES {
  for(const kind of ['world','specimen'] as const){const row=SHRINE_SITES[kind];if(site.x===row.x&&site.z===row.z&&site.rot===row.rot)return kind;}
  throw new Error('Shrine site changed; regenerate its authored geometry');
}
/** The authored origin retains the native floor's own-space frame. */
export function shrineOrigin(p:ShrineParams):{x:number;y:number;z:number}{return {...bake()[shrineSiteKind(p.site)].origin};}

/** Borrowed layout values are copied for each native owner; floor queries keep the original stair/terrace/causeway law. */
export interface ShrineLayout {
  colliders:BoxSpec[];anchors:Record<string,ShrineAnchor>;baseY:number;waterY:number;terrace:number;
  colliderDescs:()=>ReturnType<typeof readColliderRows>;floorHeightAt:(x:number,z:number)=>number|undefined;
}
/** Independent native collision and floor callbacks over the admitted layout. */
export function shrineLayout(p:ShrineParams):ShrineLayout {
  const row=bake()[shrineSiteKind(p.site)],cs=Math.cos(p.site.rot),sn=Math.sin(p.site.rot);
  return {colliders:structuredClone(row.colliders),anchors:structuredClone(row.anchors),baseY:row.baseY,waterY:row.waterY,terrace:row.terrace,
    colliderDescs:()=>readColliderRows(row.descs, { kinds: ['box', 'treads'], surfaces: ['stone'], requireSurface: true }),
    floorHeightAt:(x,z)=>{
    const lx=x*cs-z*sn,lz=x*sn+z*cs,b=row.baseY;
    if (Math.abs(lx) < STAIR.hw && lz >= STAIR.z0 && lz <= STAIR.z1) return b + TIERS[2].top * ((STAIR.z1 - lz) / (STAIR.z1 - STAIR.z0));
    for (let i = 2; i >= 0; i--) { // the three terraces, top first
      const t = TIERS[i as 0 | 1 | 2];
      if (Math.abs(lx) <= t.hw && lz >= t.z0 && lz <= t.z1) return b + t.top;
    }
    if (Math.abs(lx) < POOL.causeway && Math.abs(lz - POOL.z) < POOL.rz + 0.5) return row.waterY + 0.1;
    return undefined;
  
    }};
}

let poolLook: THREE.Material | null = null;
/** hand the pool its compiled graph (look.materials, data/poolLook.ts: the ripples; its toon look follows the day clock with
 *  the cove's pools) before the world builds */
export function setShrinePoolLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(SHRINE_POOL_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the shrine pool graph');
  poolLook = material;
}

/** the shrine's own materials on a shard — the pool (its graph: soft ripples, a caustic shimmer at their crests, lent before
 *  the world builds; a shrine built before that refuses) and the glyphs, which the world pulses */
export function shrineMaterials(ctx: ModelContext): { water: THREE.Material; glyphs: THREE.MeshBasicMaterial } {
  return ctx.once('driftwood-isle/shrine:materials', () => {
    if (poolLook === null) throw new Error('Driftwood shrine: no pool graph material lent (the runtime compiles it before the world builds)');
    return { water: poolLook, glyphs: new THREE.MeshBasicMaterial({ color: SHRINE_RUNE, side: THREE.DoubleSide }) };
  });
}

const DRAWS={'world-kit':SHRINE_KIT_GEOMETRY,'world-water':SHRINE_WATER_GEOMETRY,'world-glyphs':SHRINE_GLYPHS_GEOMETRY,
  'specimen-kit':SHRINE_SPECIMEN_KIT_GEOMETRY,'specimen-water':SHRINE_SPECIMEN_WATER_GEOMETRY,'specimen-glyphs':SHRINE_SPECIMEN_GLYPHS_GEOMETRY};
export const shrine=defineModel<ShrineParams>({
  id:'driftwood-isle/shrine',name:'Ring shrine',category:'buildings',pipeline:'code',
  file:'src/shards/driftwood-isle/runtime/models/shrine.ts',surface:'stone',
  defaults:{site:SHRINE_SITES.specimen,ground:()=>0},
  ...libraryModel<ShrineParams,'kit'|'water'|'glyphs',keyof typeof DRAWS>({
    draws:p=>{const kind=shrineSiteKind(p.site);return [{draw:`${kind}-kit`,material:'kit',castShadow:true,receiveShadow:true},
      {draw:`${kind}-water`,material:'water',receiveShadow:true,renderOrder:1},{draw:`${kind}-glyphs`,material:'glyphs',renderOrder:1}];},
    geometry:(_,draw)=>DRAWS[draw].copy(),
    material:(ctx,key)=>key==='kit'?lowPolyLookMaterial(ctx.sky,'still'):shrineMaterials(ctx)[key],
    colliders:p=>shrineLayout(p).colliderDescs(),
    loading:{id:'driftwood-isle/shrine',ready:fixedGeometryReady,load:()=>loadFixedGeometry(),size:()=>[20,13,30]},
  }),
});
