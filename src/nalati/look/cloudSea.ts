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
    fragmentShader: /* glsl */`
      ${V2_GRADE_GLSL}
      ${V2_TINT_GLSL}
      uniform sampler2D tNoise; uniform float uTime; uniform sampler2D tFogLut; uniform vec3 uSunView;
      varying vec3 vW;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
        return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
      // cumulus heaps: big soft mounds (two octaves, billowed) for the shape and the light, finer puffs only in the tone
      float heap(vec2 p) { float a = vn(p), b = vn(p * 2.1 + 7.1); return a * 0.62 + (1.0 - abs(b * 2.0 - 1.0)) * 0.38; }
      void main() {
        vec2 p = vW.xz * 0.011 + vec2(uTime * 0.006, uTime * 0.0025);
        float d = heap(p);
        float fine = vn(p * 5.3 - 3.7) * 0.6 + vn(p * 12.1 + 1.3) * 0.4;
        // the mound's surface normal (a height field) lit from the painted sun's side, wrapped soft
        float e = 0.08;
        vec3 n = normalize(vec3(d - heap(p + vec2(e, 0.0)), 0.16, d - heap(p + vec2(0.0, e))));
        vec3 sunH = normalize(vec3(uSunView.x, max(uSunView.y, 0.3), uSunView.z));
        float lit = clamp(dot(n, sunH) * 0.75 + 0.3, 0.0, 1.0);
        // tops catch the light, the folds between the heaps sink into blue shade
        float crown = smoothstep(0.34, 0.7, d + (fine - 0.5) * 0.25);
        vec3 ray = vW - cameraPosition;
        float dist = length(ray);
        vec3 vd = ray / dist;
        float az = atan(-vd.x, vd.z) * 0.15915494;
        vec3 haze = texture2D(tFogLut, vec2(az, 0.5)).rgb;                         // scene-linear already
        float toSun = pow(max(dot(normalize(vec3(vd.x, 0.0, vd.z)), normalize(vec3(uSunView.x, 0.0, uSunView.z))), 0.0), 3.0);
        // painted cloud colours (display-linear): lavender-white sunlit tops, gold toward the sun, blue-grey hollows
        vec3 top = mix(vec3(0.97, 0.9, 0.86), vec3(1.0, 0.8, 0.5), toSun * 0.8 + 0.15);
        vec3 shade = mix(vec3(0.46, 0.5, 0.66), vec3(0.66, 0.52, 0.5), toSun * 0.5);
        vec3 c = mix(shade, top, lit * (0.55 + 0.45 * crown));
        c = mix(shade * 0.7, c, 0.25 + 0.75 * crown);
        c = v2Ungrade(c);
        // far off the deck melts into the painted haze, then thins so the far ranges stand over it
        c = mix(c, haze, smoothstep(300.0, 2600.0, dist) * 0.85);
        c = v2Regrade(c);
        float alpha = 1.0 - smoothstep(2800.0, 5200.0, dist);
        gl_FragColor = vec4(c, alpha);
      }`,
  });
  mat.name = 'cloud-sea-v2';
  mesh.material = mat;
  if (old instanceof THREE.Material) old.dispose();
  // the mesh rides in Horizon's group (which follows the camera on xz); its own y is the deck height
  mesh.position.y = CLOUD_SEA_Y;
}
