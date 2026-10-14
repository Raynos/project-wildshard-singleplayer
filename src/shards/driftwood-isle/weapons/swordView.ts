import * as THREE from 'three';
import type { SwordRig } from '@wildshard/engine/combat/view/melee';
import { setProgramKey } from '@wildshard/engine/render/shaderPatches';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { SWORD_GEOMETRY } from '../boot/swordGeometry';

/**
 * The castaway's low-poly wooden and iron swords (SF54: moved unchanged out of the kit's SweptMelee.ts, whose Sword family
 * no longer builds a default rig): `buildSword` and `swordMaterial` as they were, and `swordRig`, the pair as the
 * `SwordRig` Driftwood hands the Sword (`SwordOptions.rig`).
 */
export function swordRig(sky: Sky, blade: 'wood' | 'iron'): SwordRig {
  const { sword, arms, tipY, baseY } = buildSword(blade);
  return { sword, arms, tipY, baseY, material: swordMaterial(sky, blade) };
}

/** Cached immutable shapes; both live swords borrow them without copies or transforms. */
export function buildSword(blade:'wood'|'iron'):{sword:THREE.BufferGeometry;arms:THREE.BufferGeometry;tipY:number;baseY:number}{
 const sword=SWORD_GEOMETRY.geometry(`${blade}-sword`,{borrow:true}),arms=SWORD_GEOMETRY.geometry(`${blade}-arms`,{borrow:true});
 if(sword===null||arms===null)throw new Error('Sword fallback pool not ready');return {sword,arms,tipY:.619,baseY:.099};
}

/** the low-poly swords' material (flat facets, vertex colours; the iron blade metallic), prepared for the sky — opaque: the
 *  viewmodel turns its own copy into the transparent queue */
export function swordMaterial(sky: Sky, blade: 'wood' | 'iron'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.82, metalness: blade === 'iron' ? 0.6 : 0, envMapIntensity: 0.6 });
  mat.name = 'sword'; setProgramKey(mat, 'sword-lowpoly');
  sky.setupMaterial(mat);
  return mat;
}
