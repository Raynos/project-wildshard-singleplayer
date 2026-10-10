import type * as THREE from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { editShader, type ShaderEditRow } from './shaderEdits';

/**
 * A moss / lichen overlay on a standard material (SHARD-PLATFORM M3, the looks system): the shard's GLSL edits (value-noise
 * patches in world space, denser where its `moss` vertex attribute is high and on faces turned from the sun, a soft bump
 * along the patch edges) patched in at the material stage, with the fog's uniforms, the sun's direction, a strength and an
 * up-only switch as uniforms, so every strength shares one program (`key`).
 */

/** One overlay: the patch's id and program key, the sun it reads, its strength and whether only up-facing faces take it. */
export interface MossOverlay {
  readonly id: string;
  readonly key: string;
  readonly sunDir: THREE.Vector3;
  readonly strength: number;
  readonly upOnly: boolean;
  readonly edits: readonly ShaderEditRow[];
}

/** Patches the overlay into `mat` (replacing an earlier patch of the same id). */
export function installMossOverlay(mat: THREE.MeshStandardMaterial, overlay: MossOverlay): void {
  patchShader(mat, overlay.id, PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    shader.uniforms['uMossSun'] = { value: overlay.sunDir };
    shader.uniforms['uMossStrength'] = { value: overlay.strength };
    shader.uniforms['uMossUpOnly'] = { value: overlay.upOnly ? 1.0 : 0.0 };
    editShader(shader, overlay.edits);
  }, { mode: 'replace', key: overlay.key });
}
