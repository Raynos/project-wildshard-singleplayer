import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { LAST_LIGHT_EDITS } from '../data/lightLook';

/** The style bible's rim and shade floor ("Last Light", data/lightLook.ts): a material patch, applied once per material at build. */
export function lastLight(material: MeshStandardMaterial, scope: Scope): void {
  patchShader(material, 'sunscar.lastLight', PATCH_ORDER.decorate, (shader) => { editShader(shader, LAST_LIGHT_EDITS); }, { scope });
}

/** Every standard material under `root` (the world's props), once each. */
export function lastLightAll(root: Object3D, scope: Scope): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const list: unknown[] = Array.isArray(o.material) ? o.material : [o.material];
    // a thin tube (the whip's coil) is all grazing faces: the rim would wash it pale, so it can opt out
    for (const m of list) if (m instanceof MeshStandardMaterial && !seen.has(m) && m.userData['sunscarNoRim'] !== true) { seen.add(m); lastLight(m, scope); }
  });
}
