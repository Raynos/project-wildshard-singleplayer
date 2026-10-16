import * as THREE from 'three';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import { WEAPON_FINISHES } from '../../data/weaponFinishes';
import { codePart } from '../world/codeParts';
import type { InferOutput } from 'valibot';
import type { ClaimedPickupRow } from '@wildshard/game/loot/runtime';
import type { SECTIONS } from '../sections';

/** Pine's authored material finishes and legendary sources; application and ownership are generic. */
export type SkinId = 'ghost-stag' | 'hollow-ash' | 'ironhide' | 'scarback-furnace' | 'blackpaw' | 'imperial' | 'warden';

/** The product's `custom/skinPickups` rows (one per finish that drops) as the claimed-pickup roster's rows. A row with a
 *  walk-in volume refuses: the section's `walkIn` is a tuple and the roster takes `{ radius, height }`; every row is null. */
export function skinPickups(rows: InferOutput<(typeof SECTIONS)['custom/skinPickups']>): Readonly<Record<SkinId, ClaimedPickupRow>> {
  const row = (id: SkinId): ClaimedPickupRow => {
    const found = rows[id];
    if (found === undefined) throw new Error(`Pine skin pickups: custom/skinPickups has no ${id}`);
    if (found.walkIn !== null) throw new Error(`Pine skin pickups: ${id} declares a walk-in volume the roster cannot take`);
    return { ...found, walkIn: null };
  };
  return { 'ghost-stag': row('ghost-stag'), 'hollow-ash': row('hollow-ash'), ironhide: row('ironhide'), 'scarback-furnace': row('scarback-furnace'),
    blackpaw: row('blackpaw'), imperial: row('imperial'), warden: row('warden') };
}

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
