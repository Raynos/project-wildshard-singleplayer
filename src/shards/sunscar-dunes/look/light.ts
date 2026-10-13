import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { painterLightPatch } from '@wildshard/engine/render/dataLook';
import { LAST_LIGHT, LAST_LIGHT_SUN } from '../data/lightLook';

/** The style bible's rim and shade floor ("Last Light", data/lightLook.ts): the shared painter light on every standard material under `root` (the world's props), once each. */
export function lastLightAll(root: Object3D, scope: Scope): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const list: unknown[] = Array.isArray(o.material) ? o.material : [o.material];
    // a thin tube (the whip's coil) is all grazing faces: the rim would wash it pale, so it can opt out
    for (const m of list) if (m instanceof MeshStandardMaterial && !seen.has(m) && m.userData['sunscarNoRim'] !== true) { seen.add(m); painterLightPatch(m, LAST_LIGHT, LAST_LIGHT_SUN, scope); }
  });
}
