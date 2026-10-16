import * as THREE from 'three';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import { WEAPON_FINISHES } from '../data/weaponFinishes';
import { codePart } from '../world/codeParts';

/** Pine's authored material finishes and legendary sources; application and ownership are generic. */
export type SkinId = 'ghost-stag' | 'hollow-ash' | 'ironhide' | 'scarback-furnace' | 'blackpaw' | 'imperial' | 'warden';

export const SKINS: Record<SkinId, SkinDef & { id: SkinId; weapon: 'crossbow' | 'rifle' }> = {
  ...WEAPON_FINISHES,
  'ghost-stag': { ...WEAPON_FINISHES['ghost-stag'], extras: (root, mat) => antlerTines(root, mat('xbow-prod') ?? mat('xbow-iron')) },
};

export const PINE_FINISHES: readonly SkinDef[] = Object.values(SKINS);

/** Ghost Stag: antler tines growing up and back from the prod (the limb curve from Crossbow.ts) */
function antlerTines(root: THREE.Object3D, mat: THREE.Material | undefined): THREE.Object3D[] {
  if (!mat) return [];
  const mesh = new THREE.Mesh(codePart('ghost-stag-tines'), mat); mesh.name = 'skin-antlers';
  root.add(mesh);
  return [mesh];
}
