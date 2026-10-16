import { readFileSync } from 'node:fs';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { ShrineBuilder } from './shrine.ts';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { SHRINE_SITES } from '../data/shrineSites.ts';

/** Original ordered shrine builds and native layouts for the two admitted sites. */
export function originalShrine() {
  const bytes=Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin',import.meta.url)));
  const release=addVoxelAOBake(bytes.buffer);
  try {
    const worldGround=driftwoodGroundSampler();
    const build=(site,ground)=>{
      const builder=new ShrineBuilder({site,ground}).build();
      if(builder.geometry===null)throw new Error('Shrine author did not emit its geometry');
      return {geometry:builder.geometry,rows:{site,origin:{x:site.x,y:Math.fround(ground(site.x,site.z)),z:site.z},
        colliders:builder.colliders,descs:builder.colliderDescs(),anchors:builder.anchors,floors:builder.floors(),
        baseY:builder.baseY,terrace:builder.terrace}};
    };
    return {world:build(SHRINE_SITES.world,worldGround),specimen:build(SHRINE_SITES.specimen,()=>0)};
  } finally {release();}
}
