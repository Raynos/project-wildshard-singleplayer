import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { HeldPlayback, HeldMeleeWeapon } from '@wildshard/game/plugin/weaponFamily';
import { Vector3, type Group, type Object3D, type BufferGeometry, type Mesh } from 'three';
import { LashCord } from './lashView';
import { HD_GLOVE_SIZE, LASH_CORD, WHIP_SCENE, WHIP_WRAP_SCENE, type CordStyle } from '../../data/whip';
import { COIL_SURFACE } from '../../data/surfaces';
import lash from '../../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../../world/baked';
import { duneHd, heldSurface } from '../../world/meshes';
import { lashRuntime, lashSpec, type LashSpec } from './lash';
import { WHIP_ROW } from '../../weapons/rows';
import { WHIP_ITEM } from '../../data/items';
import { WHIP_PHASE } from '../../data/meleePhase';

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

/** Catalogue and gameplay share the actual admitted hierarchy and its original cord kernel. */
export type HeldModelSource = NonNullable<ConstructorParameters<typeof HeldPlayback>[3]>;
export interface HeldLashModel {root:Group;grip:Group;coil:Object3D;hd:Group|null;lash:LashCord;tip:Vector3;playback:HeldPlayback}
export function buildLashHold(source: HeldModelSource, style: CordStyle, tip: readonly [number,number,number]): HeldLashModel {
  const bound: { cord: LashCord | null } = { cord: null };
  const owner = new HeldPlayback(playback, new Map(), (_parts, model) => {
    const mesh = model?.mesh('cord');
    if (mesh === null || mesh === undefined) throw new Error('Cord scene binding unavailable');
    bound.cord = new LashCord(style, mesh);
    const kernel = bound.cord;
    return new Map([['cord', (profile, target) => kernel.bindCurve(profile, target)]]);
  }, source);
  const root = owner.model?.group('root'), grip = owner.model?.group('grip'), coil = owner.model?.parts.get('coil'), hd = owner.model?.group('glove') ?? null;
  if (root === null || root === undefined || grip === null || grip === undefined || coil === undefined) throw new Error('Lash scene bindings unavailable');
  // The trusted binder writes once synchronously during admission.
  const cord = bound.cord;
  if (cord === null) throw new Error('Lash kernel binding unavailable');
  return {root,grip,coil,hd,lash:cord,tip:new Vector3(...tip),playback:owner};
}

type App = ConstructorParameters<typeof HeldMeleeWeapon>[0];
interface Targets { readonly raycast:(from:Vector3,dir:Vector3,reach:number)=>{readonly animal:Parameters<App['combat']['target']>[0];readonly point:Vector3}|null }
/** The view/contact projection stays the original admitted item profile. */
export const CRACK = lashSpec(WHIP_ITEM, WHIP_ITEM.profile);
/** Original page body query and declared deformation kernel; the shared owner schedules both melee weapons. */
export class Bullwhip extends HeldMeleeWeapon<ReturnType<App['combat']['targets']>[number],WhipParts> {
 constructor(app:App,targets:Targets|null=null,spec:LashSpec=CRACK) {
  const model=buildWhipModel();
  super(app,WHIP_ROW,{...WHIP_PHASE,charge:spec.charge,unroll:spec.unroll,second:spec.second,show:spec.show,reach:[spec.reach,spec.heavyReach]},
   {model:model.root,parts:model,presentation:model.playback,nodes:model.playback.model?.parts??new Map(),tip:model.tip,restingVisible:model.hd===null,caughtPart:()=>braidedCoil(model),
    targets:()=>app.combat.targets(),contacts:ports=>lashRuntime(spec,{...ports,source:'env',body:(from,dir,reach)=>{
     const hit=targets?.raycast(from,dir,reach)??null,port=hit===null?null:app.combat.target(hit.animal);
     return hit===null||port===null?null:{port,point:hit.point};
    }})});
 }
}
