import { createHeldPresentation, createDeclaredHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import type { BufferGeometry } from 'three';
import { HD_GLOVE_SIZE } from '../../data/whip';
import { COIL_SURFACE } from '../../data/surfaces';
import lash from '../../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../../world/baked';
import { duneHd, heldSurface } from '../../world/meshes';
import { WHIP_HELD_RECIPE } from '../../data/heldWeapon';

const bakedLash = (kind: string): BufferGeometry | null => { const g = lastBakedWorld()?.get('lash')?.get(kind)?.geometry.clone() ?? null, index = g?.getIndex(); if (index) g?.setIndex(Array.from(index.array)); return g; };
/** Real geometry/texture/shader owners lend the same private resources. */
function whipModelPorts():Parameters<typeof createHeldPresentation>[1] {
  const hd=duneHd('glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}),texels=hd===null?null:lastPlait();
  return {scene:{geometry:bakedLash,objects:new Map([['hero',hd]]),textures:new Map([['plait',texels?.length===196608?texels:null]]),
    textureRepeat:new Map([['plait.repeat',[lash.along,1] as const]]),decorators:new Map([['plait',material=>{heldSurface(material,COIL_SURFACE);}]]),}};
}
export const buildWhipModel = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(WHIP_HELD_RECIPE,whipModelPorts());
export type Bullwhip = ReturnType<typeof createDeclaredHeldMelee>;
interface Targets {readonly raycast:NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['raycast']>}
export const createWhip = (app:Parameters<typeof createDeclaredHeldMelee>[0],targets:Targets,contacts:unknown,charge:number):Bullwhip =>
  createDeclaredHeldMelee(app,WHIP_HELD_RECIPE,{model:whipModelPorts(),contacts,charge,raycast:targets.raycast.bind(targets)});
