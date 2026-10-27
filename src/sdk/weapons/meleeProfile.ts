import type { MeleeProfile as PlatformMeleeProfile, ViewmodelFeel as PlatformViewmodelFeel } from '@wildshard/engine/combat/meleeProfile';
import * as THREE from 'three';
import { parse } from 'valibot';
import { MeleeWeaponProfileSchema, type MeleeWeaponProfileRows } from '@wildshard/format/weaponProfiles';

/** Authored swept combo and view parameters; ordered contact rows are defined by the format's weaponProfiles module. */
export type MeleeProfile = PlatformMeleeProfile;
/** Numeric camera lag, bob and sway parameters, independent of a particular weapon model. */
export type ViewmodelFeel = PlatformViewmodelFeel;

/** An authored hand pose, independent of a live weapon controller. */
export interface MeleeKey { t: number; pos: THREE.Vector3; q: THREE.Quaternion }
/** An authored blade trail. */
export interface MeleeTrail { from: number; color: THREE.Color; alpha: number; inner: number; life: number }
/** A complete authored contact window and its three hand keys. */
export interface MeleeMove {
  name: 'slash' | 'backhand' | 'finisher' | 'heavy' | 'pass-left' | 'pass-right';
  keys: [MeleeKey, MeleeKey, MeleeKey];
  windup: number; slashEnd: number; total: number;
  damage: number; stagger: number; sweep: number;
  kick: { pitch: number; roll: number; fov?: number };
  hitStop: number; reach?: number; trail: MeleeTrail;
}
/** Ordered poses for the generic melee view. */
export interface MeleeMoveSet { rest: MeleeKey; charge: MeleeKey; sprint: MeleeKey; combo: MeleeMove[]; heavy: MeleeMove }
/** Owned geometry returned by a held melee recipe. */
export interface MeleeRig {
  sword: THREE.BufferGeometry; arms: THREE.BufferGeometry; tipY: number; baseY: number; tipX?: number; material: THREE.Material;
  extras?: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
  left?: { geometry: THREE.BufferGeometry; material: THREE.Material; pos: THREE.Vector3; q: THREE.Quaternion };
}

/** Admit an authored melee contact profile before constructing geometry or poses. */
export function parseMeleeWeaponProfile(input: unknown): MeleeWeaponProfileRows { return parse(MeleeWeaponProfileSchema, input); }

/** Build the original +Y blade direction followed by its local roll. */
export function meleeKey(t: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, roll: number): MeleeKey {
  const axis = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(dx, dy, dz).normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(axis, roll));
  return { t, pos: new THREE.Vector3(px, py, pz), q };
}

/** Retain the held-model sRGB-to-linear paint law, including its optional gain. */
export function meleeColour(hex: number, gain = 1): THREE.Color { return new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(gain); }
