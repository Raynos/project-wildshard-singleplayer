import * as THREE from 'three';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import { WEAPON_FINISHES } from '../data/weaponFinishes';

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
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  const curve = new THREE.CatmullRomCurve3([tipL, new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR], false, 'catmullrom', 0.5);
  const group = new THREE.Group(); group.name = 'skin-antlers';
  const cone = new THREE.ConeGeometry(1, 1, 7, 1); cone.translate(0, 0.5, 0); // unit tine, base at the origin, pointing +Y
  cone.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cone.getAttribute('position').count * 3).fill(1), 3)); // in case the material reads vertex colours
  const tines: [number, number, number, number][] = [ // [t along the limb, length, lean back (rad), lean out (rad)]
    [0.02, 0.085, 0.55, -0.35], [0.1, 0.07, 0.35, -0.2], [0.2, 0.06, 0.15, 0], [0.31, 0.045, 0.05, 0.15],
  ];
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const side of [0, 1]) for (const [t0, len, back, out] of tines) {
    const t = side ? 1 - t0 : t0;
    const p = curve.getPoint(t);
    const m = new THREE.Mesh(cone, mat);
    m.position.copy(p).add(up.clone().multiplyScalar(0.006));
    m.scale.set(0.007, len, 0.005);
    e.set(back, 0, side ? -out : out); m.quaternion.copy(q.setFromEuler(e));
    group.add(m);
    // a short fork on the two longest tines
    if (len > 0.065) {
      const f = new THREE.Mesh(cone, mat);
      f.position.copy(p).add(up.clone().multiplyScalar(len * 0.45));
      f.scale.set(0.005, len * 0.45, 0.004);
      e.set(back + 0.9, 0, side ? -(out + 0.5) : out + 0.5); f.quaternion.copy(q.setFromEuler(e));
      group.add(f);
    }
  }
  root.add(group);
  return [group];
}

