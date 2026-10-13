import type { BufferGeometry, Mesh } from 'three';
import { buildLashHold, type HeldLashModel } from '../runtime/items/lashWeapon';
import { HD_GLOVE_SIZE, LASH_CORD, WHIP_SCENE, WHIP_WRAP_SCENE } from '../data/whip';
import { COIL_SURFACE } from '../data/surfaces';
import lash from '../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../world/baked';
import { duneHd, heldSurface } from '../world/meshes';

/** The whip's built parts (the lash item's held view). */
export type WhipParts = HeldLashModel;
/** A copy of one of the lash's baked kinds (`generators/lash.ts`), its index re-laid as the tube built it (16-bit: the bake writes 32); null before the bake loads. */
const bakedLash = (kind: string): BufferGeometry | null => { const g = lastBakedWorld()?.get('lash')?.get(kind)?.geometry.clone() ?? null, index = g?.getIndex(); if (index) g?.setIndex(Array.from(index.array)); return g; };
/** The caught wrap is another declared private part owned by the same held model. */
export function braidedCoil(model: WhipParts): Mesh {
  const part=model.playback.createPart({row:WHIP_WRAP_SCENE,ports:{geometry:bakedLash}}).mesh('wrap');
  if(part===null)throw new Error('Declared wrap unavailable');return part;
}
/** Source ports only: geometry, fitted glove, baked texels and the original shader decorator. */
export function buildWhipModel(): WhipParts {
  const hd=duneHd('glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}), texels=hd===null?null:lastPlait();
  return buildLashHold({row:WHIP_SCENE,ports:{geometry:bakedLash,objects:new Map([['hero',hd]]),
    textures:new Map([['plait',texels?.length===196608?texels:null]]),textureRepeat:new Map([['plait.repeat',[lash.along,1] as const]]),
    decorators:new Map([['plait',(material)=>{heldSurface(material,COIL_SURFACE);}]]),
  }},LASH_CORD,[lash.tip[0]??0,lash.tip[1]??0,lash.tip[2]??0]);
}
