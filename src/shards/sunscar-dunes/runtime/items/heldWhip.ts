import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { HeldPlayback, HeldMeleeWeapon } from '@wildshard/game/plugin/weaponFamily';
import { bindMeleeContacts } from '@wildshard/game/plugin/simulation';
import { Vector3, type BufferGeometry } from 'three';
import { HD_GLOVE_SIZE, WHIP_SCENE, WHIP_WRAP_SCENE } from '../../data/whip';
import { COIL_SURFACE } from '../../data/surfaces';
import lash from '../../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../../world/baked';
import { duneHd, heldSurface } from '../../world/meshes';
import { WHIP_ROW } from '../../data/equipment';
import { WHIP_ITEM } from '../../data/items';
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
type App = ConstructorParameters<typeof HeldMeleeWeapon>[0];
interface Targets { readonly raycast:(from:Vector3,dir:Vector3,reach:number)=>{readonly animal:Parameters<App['combat']['target']>[0];readonly point:Vector3}|null }
/** The admitted item contacts and phase rows feed the shared owners directly. */
export class Bullwhip extends HeldMeleeWeapon<ReturnType<App['combat']['targets']>[number],HeldPlayback> {
 constructor(app:App,targets:Targets|null=null,contacts:unknown=WHIP_ITEM.contacts,charge:number=WHIP_ITEM.charge) {
  const model=buildWhipModel();
  super(app,WHIP_ROW,{...WHIP_PHASE,charge},
   {model:model.root,parts:model,presentation:model,nodes:model.model?.parts??new Map(),tip:new Vector3(lash.tip[0]??0,lash.tip[1]??0,lash.tip[2]??0),restingVisible:model.model?.group('glove')===null,
    caughtPart:()=>{const wrap=model.createPart({row:WHIP_WRAP_SCENE,ports:{geometry:bakedLash}}).mesh('wrap');if(wrap===null)throw new Error('Declared wrap unavailable');return wrap;},
    targets:()=>app.combat.targets(),contacts:ports=>bindMeleeContacts(WHIP_ITEM.id,contacts,{...ports,owner:'env',body:(from,dir,reach)=>{
     const hit=targets?.raycast(from,dir,reach)??null,port=hit===null?null:app.combat.target(hit.animal);
     return hit===null||port===null?null:{port,point:hit.point};
    },react:port=>({actor:port.actor,...(port.impulse===undefined?{}:{impulse:port.impulse}),stagger:(dir:Vector3,strength:number)=>{port.target.stagger?.(dir,strength);}})})});
 }
}
