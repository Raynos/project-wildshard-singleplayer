import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';

/**
 * The style bible's rim and shade floor ("Last Light"): a prop or creature keeps an orange edge where its silhouette
 * meets the sky, and its shaded side a cool sky-lit floor, so nothing reads as a black cut-out against the afterglow
 * (review R1, R6). A material patch, applied once per material at build.
 */
export function lastLight(material: MeshStandardMaterial, scope: Scope): void {
  patchShader(material, 'sunscar.lastLight', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `{
    float sunscarRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
    // round 1 (R1C-2): a stronger cool sky floor and rim; leather and wood in shade read brown-violet, never black
    outgoingLight += diffuseColor.rgb * (vec3(0.24, 0.21, 0.36) + vec3(1.0, 0.5, 0.22) * sunscarRim * 1.2); // round 2: stronger still
  }
#include <opaque_fragment>`);
  }, { scope });
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
