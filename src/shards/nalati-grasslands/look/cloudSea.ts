/**
 * Look v2 — the cloud sea under the slab (A3: "the slab edge seen from above: a rocky grassy lip over a cloud sea, not a
 * glass panel").
 *
 * v1's cloud sea hangs 240 m down and half transparent, so from the god views past the rim you look through it into
 * the dome's flat fog colour — a pale panel. In v2 the same mesh (Horizon.ts, named 'cloud-sea') gets this material and
 * rises to 60 m under the valley floor: a dense painted cumulus deck that hugs the slab's rocky wall, sunlit gold toward
 * the painted sun and lavender-white away from it, with blue-grey hollows. Its base colour is the fog LUT's (the painted
 * haze of that azimuth) and it dissolves into it with distance, so it meets the painted horizon with no line; it goes
 * transparent past ~3 km so the far painted ranges still stand over it. Graded like the dome (the grade's inverse) and
 * re-tinted by the hour / storm (tint.ts).
 */
import * as THREE from 'three';
import { V2_GRADE_GLSL, gradeUniforms } from './grade';
import { V2_TINT_GLSL, tintUniforms } from './tint';
import { fogLut } from './fog';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { CLOUD_SEA_GLSL } from '../data/cloudSeaGlsl';

/** the GLSL below is data (data/cloudSeaGlsl.ts); `@{name}` splices the fragments this module passes */
const CLOUD_SEA_GLSL_FAMILY = new ShaderFamily(CLOUD_SEA_GLSL, {});

/** the deck's height (m, world): under the valley floor (−10) and well over the slab's floor (−100) */
export const CLOUD_SEA_Y = -68;

export function applyCloudSeaV2(mesh: THREE.Object3D, sunView: { value: THREE.Vector3 }): void {
  if (!(mesh instanceof THREE.Mesh)) return;
  const old: unknown = mesh.material;
  const tNoise = old instanceof THREE.ShaderMaterial ? (old.uniforms['tNoise'] as { value: THREE.Texture } | undefined) : undefined;
  const uTime = old instanceof THREE.ShaderMaterial ? (old.uniforms['uTime'] as { value: number } | undefined) : undefined;
  if (!tNoise || !uTime) return;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tNoise, uTime, tFogLut: { value: fogLut }, uSunView: sunView, ...gradeUniforms, ...tintUniforms },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: CLOUD_SEA_GLSL_FAMILY.glsl(CLOUD_SEA_GLSL.seaFragment, { V2_GRADE_GLSL, V2_TINT_GLSL }),
  });
  mat.name = 'cloud-sea-v2';
  mesh.material = mat;
  if (old instanceof THREE.Material) old.dispose();
  // the mesh rides in Horizon's group (which follows the camera on xz); its own y is the deck height
  mesh.position.y = CLOUD_SEA_Y;
}
