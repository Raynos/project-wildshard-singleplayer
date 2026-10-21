import type * as THREE from 'three';
import {lin} from '../math/color';
import * as arms from './firstPersonArms';

// only *-legacy imports this; deleted with the legacy copies (SHARD-PLATFORM-NEXT N5)
export const ARM_PAL = {
  leather: lin(0x9c7454), leatherLight: lin(0xc49c74), leatherDark: lin(0x5c4230), leatherEdge: lin(0x6e5038),
  thread: lin(0xf0dcae), jade: lin(0xbfe0c4), jadeDark: lin(0x7aa88a),
  fleece: lin(0xf4eee2), fleeceShade: lin(0xcabda6), fleeceDeep: lin(0x9a8c78),
  wool: lin(0xeee2c6), woolShade: lin(0xcdb792), red: lin(0xc0321e), redDeep: lin(0x8a1c12), redLine: lin(0x6a1610), gold: lin(0xd8a84a),
};

const style=():arms.ArmStyle=>({leather:[ARM_PAL.leather.r,ARM_PAL.leather.g,ARM_PAL.leather.b],leatherLight:[ARM_PAL.leatherLight.r,ARM_PAL.leatherLight.g,ARM_PAL.leatherLight.b],leatherDark:[ARM_PAL.leatherDark.r,ARM_PAL.leatherDark.g,ARM_PAL.leatherDark.b],leatherEdge:[ARM_PAL.leatherEdge.r,ARM_PAL.leatherEdge.g,ARM_PAL.leatherEdge.b],thread:[ARM_PAL.thread.r,ARM_PAL.thread.g,ARM_PAL.thread.b],jade:[ARM_PAL.jade.r,ARM_PAL.jade.g,ARM_PAL.jade.b],jadeDark:[ARM_PAL.jadeDark.r,ARM_PAL.jadeDark.g,ARM_PAL.jadeDark.b],fleece:[ARM_PAL.fleece.r,ARM_PAL.fleece.g,ARM_PAL.fleece.b],fleeceShade:[ARM_PAL.fleeceShade.r,ARM_PAL.fleeceShade.g,ARM_PAL.fleeceShade.b],fleeceDeep:[ARM_PAL.fleeceDeep.r,ARM_PAL.fleeceDeep.g,ARM_PAL.fleeceDeep.b],wool:[ARM_PAL.wool.r,ARM_PAL.wool.g,ARM_PAL.wool.b],woolShade:[ARM_PAL.woolShade.r,ARM_PAL.woolShade.g,ARM_PAL.woolShade.b],red:[ARM_PAL.red.r,ARM_PAL.red.g,ARM_PAL.red.b],redDeep:[ARM_PAL.redDeep.r,ARM_PAL.redDeep.g,ARM_PAL.redDeep.b],redLine:[ARM_PAL.redLine.r,ARM_PAL.redLine.g,ARM_PAL.redLine.b],gold:[ARM_PAL.gold.r,ARM_PAL.gold.g,ARM_PAL.gold.b]});
export type FistOpts = arms.FistOpts;
export type Fist = arms.Fist;
export function gloveFist(opts:arms.FistOpts):arms.Fist{return arms.gloveFist(style(),opts);}
export function riderArm(len=0.9,seed=1):THREE.BufferGeometry{return arms.riderArm(style(),len,seed);}
export function riderArmSteps(len=0.9,seed=1):Generator<void,THREE.BufferGeometry>{return arms.riderArmSteps(style(),len,seed);}
export function placeArm(obj:THREE.Object3D,wrist:THREE.Vector3,dir:THREE.Vector3):void{arms.placeArm(obj,wrist,dir);}
export function forearm(dir:THREE.Vector3,len=0.6,gripR=0.017,opts:Parameters<typeof arms.forearm>[4]={}):THREE.BufferGeometry{return arms.forearm(style(),dir,len,gripR,opts);}
