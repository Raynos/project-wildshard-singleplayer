import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { HeldPlayback, createHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import type { BufferGeometry } from 'three';
import { HD_GLOVE_SIZE, WHIP_SCENE, WHIP_WRAP_SCENE } from '../../data/whip';
import { COIL_SURFACE } from '../../data/surfaces';
import lash from '../../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../../world/baked';
import { duneHd, heldSurface } from '../../world/meshes';
import { WHIP_ROW } from '../../data/equipment';
import { WHIP_PHASE } from '../../data/meleePhase';

const bakedLash = (kind: string): BufferGeometry | null => { const g = lastBakedWorld()?.get('lash')?.get(kind)?.geometry.clone() ?? null, index = g?.getIndex(); if (index) g?.setIndex(Array.from(index.array)); return g; };
/** Geometry and shader ports remain private; the admitted scene owns every held-model part. */
export function buildWhipModel(): HeldPlayback {
  const hd=duneHd('glove-hd4',{size:HD_GLOVE_SIZE,by:'span'}), texels=hd===null?null:lastPlait();
  return new HeldPlayback(playback,new Map(),undefined,{row:WHIP_SCENE,ports:{geometry:bakedLash,objects:new Map([['hero',hd]]),
    textures:new Map([['plait',texels?.length===196608?texels:null]]),textureRepeat:new Map([['plait.repeat',[lash.along,1] as const]]),
    decorators:new Map([['plait',(material)=>{heldSurface(material,COIL_SURFACE);}]]),
  }});
}
export type Bullwhip = ReturnType<typeof createHeldMelee>;
interface Targets { readonly raycast: NonNullable<Parameters<typeof createHeldMelee>[3]['raycast']> }
/** Bind the admitted whip directly to the common held owner. */
export function createWhip(app: Parameters<typeof createHeldMelee>[0], targets: Targets, contacts: unknown, charge: number): Bullwhip {
  return createHeldMelee(app, WHIP_ROW, {...WHIP_PHASE, charge}, {presentation:buildWhipModel(),contacts,raycast:targets.raycast.bind(targets),
    tip:[lash.tip[0]??0,lash.tip[1]??0,lash.tip[2]??0],restingGroup:'glove',caught:{scene:{row:WHIP_WRAP_SCENE,ports:{geometry:bakedLash}},part:'wrap'}});
}
