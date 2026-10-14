import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { ShrineAnchor, ShrineParams, ShrineSite } from '../assets/contracts/shrine';
import { SHRINE_SITES } from '../data/shrineSites';
import bake from '../data/shrineBake.json' with {type:'json'};
import { fixedGeometryReady, loadFixedGeometry,
  SHRINE_KIT_GEOMETRY,SHRINE_WATER_GEOMETRY,SHRINE_GLYPHS_GEOMETRY,
  SHRINE_SPECIMEN_KIT_GEOMETRY,SHRINE_SPECIMEN_WATER_GEOMETRY,SHRINE_SPECIMEN_GLYPHS_GEOMETRY } from '../boot/fixedGeometry';

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
export function shrineOrigin(p:ShrineParams):{x:number;y:number;z:number}{return {...bake[shrineSiteKind(p.site)].origin};}

/** Borrowed layout values are copied for each native owner; floor queries keep the original stair/terrace/causeway law. */
export interface ShrineLayout {
  colliders:BoxSpec[];anchors:Record<string,ShrineAnchor>;baseY:number;waterY:number;terrace:number;
  colliderDescs:()=>ColliderDesc[];floorHeightAt:(x:number,z:number)=>number|undefined;
}
const n=(v:number|undefined):number=>{if(v===undefined)throw new Error('Shrine collider lacks a number');return v;};
const end=(v:{x:number;y:number;z:number}|undefined):{x:number;y:number;z:number}=>{if(v===undefined)throw new Error('Shrine tread lacks an end');return {...v};};
/** Independent native collision and floor callbacks over the admitted layout. */
export function shrineLayout(p:ShrineParams):ShrineLayout {
  const row=bake[shrineSiteKind(p.site)],cs=Math.cos(p.site.rot),sn=Math.sin(p.site.rot);
  return {colliders:structuredClone(row.colliders),anchors:structuredClone(row.anchors),baseY:row.baseY,waterY:row.waterY,terrace:row.terrace,
    colliderDescs:()=>row.descs.map((d):ColliderDesc=>{
      if(d.kind==='treads')return {kind:'treads',from:end(d.from),to:end(d.to),width:n(d.width),count:n(d.count),surface:'stone'};
      if(d.kind!=='box')throw new Error('Unsupported shrine collider');
      return {kind:'box',x:n(d.x),y:n(d.y),z:n(d.z),hx:n(d.hx),hy:n(d.hy),hz:n(d.hz),yaw:n(d.yaw),surface:'stone'};
    }),
    floorHeightAt:(x,z)=>{
    const lx=x*cs-z*sn,lz=x*sn+z*cs,b=row.baseY;
    if (Math.abs(lx) < STAIR.hw && lz >= STAIR.z0 && lz <= STAIR.z1) return b + TIERS[2].top * ((STAIR.z1 - lz) / (STAIR.z1 - STAIR.z0));
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const t = TIERS[i as 0 | 1 | 2];
      if (Math.abs(lx) <= t.hw && lz >= t.z0 && lz <= t.z1) return b + t.top;
    }
    if (Math.abs(lx) < POOL.causeway && Math.abs(lz - POOL.z) < POOL.rz + 0.5) return row.waterY + 0.1;
    return undefined;
  
    }};
}

/** the pool's material: soft ripple rings and a caustic shimmer, brighter at the edges (its clock: `uniforms.uTime`) */
function poolMaterial(ctx: ModelContext, uniforms: { uTime: THREE.IUniform<number> }): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2aa7b0'), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.82, flatShading: true });
  patchShader(mat, 'driftwood.shrine-pool', PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    shader.uniforms['uTime'] = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float w = sin(vWp.x * 2.3 + uTime * 1.1) * sin(vWp.z * 2.9 - uTime * 0.9) + sin((vWp.x + vWp.z) * 4.1 + uTime * 1.7) * 0.5;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.95, 0.95), smoothstep(0.9, 1.4, w) * 0.45);
          }`);
  }, { mode: 'replace', key: 'shrine-pool' });
  ctx.sky.setupMaterial(mat);
  return mat;
}

/** the shrine's own materials on a shard — the pool (and its clock) and the glyphs — which the world animates */
export function shrineMaterials(ctx: ModelContext): { water: THREE.MeshStandardMaterial; glyphs: THREE.MeshBasicMaterial; uniforms: { uTime: THREE.IUniform<number> } } {
  return ctx.once('driftwood-isle/shrine:materials', () => {
    const uniforms = { uTime: { value: 0 } };
    return { water: poolMaterial(ctx, uniforms), glyphs: new THREE.MeshBasicMaterial({ color: SHRINE_RUNE, side: THREE.DoubleSide }), uniforms };
  });
}

function shrineParts(ctx:ModelContext,kind:keyof typeof SHRINE_SITES):ModelPart[] {
  const m=shrineMaterials(ctx),world=kind==='world';
  return [
    {geometry:(world?SHRINE_KIT_GEOMETRY:SHRINE_SPECIMEN_KIT_GEOMETRY).copy(),material:lowPolyMaterial(ctx.sky),castShadow:true,receiveShadow:true},
    {geometry:(world?SHRINE_WATER_GEOMETRY:SHRINE_SPECIMEN_WATER_GEOMETRY).copy(),material:m.water,receiveShadow:true,renderOrder:1},
    {geometry:(world?SHRINE_GLYPHS_GEOMETRY:SHRINE_SPECIMEN_GLYPHS_GEOMETRY).copy(),material:m.glyphs,renderOrder:1},
  ];
}
export const shrine=defineModel<ShrineParams>({
  id:'driftwood-isle/shrine',name:'Ring shrine',category:'buildings',pipeline:'code',
  file:'src/shards/driftwood-isle/models/shrine.ts',surface:'stone',
  defaults:{site:SHRINE_SITES.specimen,ground:()=>0},prepare:loadFixedGeometry,
  build:(ctx,p)=>{
    const kind=shrineSiteKind(p.site);
    if(fixedGeometryReady())return shrineParts(ctx,kind);
    return loadingSpecimen('driftwood-isle/shrine',[20,13,30],async()=>{
      await loadFixedGeometry();const group=new THREE.Group();
      for(const part of shrineParts(ctx,kind)){
        const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=part.castShadow??false;mesh.receiveShadow=part.receiveShadow??false;mesh.renderOrder=part.renderOrder??0;group.add(mesh);
      }
      return group;
    });
  },colliders:p=>shrineLayout(p).colliderDescs(),
});
