// Pine Hollow's cabin looks as data (SHARD-PLATFORM M3, look-family rows): the door's and the moss overlay's edits of the
// standard material (world/homestead.ts applies them through @wildshard/sdk/looks/shaderEdits inside its patches) and the
// hearth particles' program and kinds.
import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/** the rough_pine_door scan is a saturated orange-red: pulled toward a weathered grey-brown */
export const CABIN_DOOR_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.333))), diffuseColor.rgb, 0.45) * vec3(0.9, 0.95, 1.0);` },
];

/**
 * Procedural moss / lichen overlay: value-noise patches in world space, denser where the `moss` vertex attribute is high
 * (eaves, foundation base) and on faces turned away from the sun (`uMossSun`), with a soft normal bump along the patch
 * edges; `uMossStrength` and `uMossUpOnly` are uniforms, so the roof and the stone share one program.
 */
export const CABIN_MOSS_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <common>', put: `#include <common>
        attribute float moss; varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;` },
  { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
        vMoss = moss; vMossPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMossN = normalize(mat3(modelMatrix) * objectNormal);` },
  { stage: 'fragment', find: '#include <common>', put: `#include <common>
        uniform vec3 uMossSun; uniform float uMossStrength, uMossUpOnly;
        varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;
        float mossHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float mossNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(mix(mossHash(i), mossHash(i + vec2(1, 0)), f.x), mix(mossHash(i + vec2(0, 1)), mossHash(i + vec2(1, 1)), f.x), f.y); }
        float mossFbm(vec2 p) { mat2 r = mat2(0.8, 0.6, -0.6, 0.8); vec2 p2 = r * p * 2.13 + 3.7; vec2 p3 = r * p2 * 2.02 + 9.1;
          return mossNoise(p) * 0.5 + mossNoise(p2) * 0.3 + mossNoise(p3) * 0.2; }
        float mossMask;` },
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
        {
          #ifdef USE_MAP
            vec2 mp = vMapUv * vec2(1.6, 3.6) + vMossPos.xz * 0.2;       // patches stretched along the planks
          #else
            vec2 mp = vMossPos.xz * 2.0 + vMossPos.y * 0.35;
          #endif
          float n = mossFbm(mp) * 0.8 + mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 2.7 + 11.0) * 0.2;
          float patchy = 0.55 + 0.9 * mossNoise(mp * 0.3 + 2.0);            // large-scale variation so some stretches stay bare
          float shade = 1.0 - smoothstep(-0.3, 0.5, dot(vMossN, uMossSun));
          float density = (0.2 + 0.75 * pow(vMoss, 1.6) + 0.18 * shade) * patchy * uMossStrength * mix(1.0, smoothstep(-0.05, 0.45, vMossN.y), uMossUpOnly);
          float th = 0.8 - density * 0.5;
          mossMask = smoothstep(th, th + 0.22, n);
          float lichen = smoothstep(0.74, 0.86, mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 4.0 + 17.0)) * density * 0.35;
          vec3 mossCol = mix(vec3(0.02, 0.038, 0.009), vec3(0.075, 0.115, 0.03), mossFbm(mp * 2.0 + 5.0));
          mossCol *= clamp(0.6 + 3.0 * dot(diffuseColor.rgb, vec3(0.33)), 0.6, 1.25);   // let the plank grain show through the mat
          vec3 lichenCol = vec3(0.055, 0.07, 0.04);
          diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, mossMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, lichenCol, lichen * (1.0 - mossMask));
        }` },
  { stage: 'fragment', find: '#include <roughnessmap_fragment>', put: `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, mossMask);` },
  { stage: 'fragment', find: '#include <normal_fragment_maps>', put: `#include <normal_fragment_maps>
        {
          // bump along the moss patch edges (same maths as three's perturbNormalArb)
          float mh = mossMask * 0.35;
          vec2 dHdxy = vec2(dFdx(mh), dFdy(mh));
          vec3 sp = -vViewPosition;
          vec3 vSigmaX = dFdx(sp), vSigmaY = dFdy(sp);
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad * 6.0);
        }` },
];

/** One hearth particle kind: its life (s), rise (m), spread (m), size from birth to death (m), wind (m/s, world), blend. */
export interface CabinParticleKind {
  readonly life: number;
  readonly rise: number;
  readonly spread: number;
  readonly size: readonly [number, number];
  readonly wind: readonly [number, number, number];
  readonly blend: 'normal' | 'additive';
}

/** the chimney smoke, the hearth flames and their embers */
export const CABIN_PARTICLE_KINDS: Readonly<Record<'smoke' | 'flame' | 'ember', CabinParticleKind>> = {
  smoke: { life: 11.0, rise: 12.0, spread: 0.25, size: [0.7, 4.6], wind: [1.6, 0.0, 0.45], blend: 'normal' },
  flame: { life: 0.85, rise: 0.95, spread: 0.36, size: [0.95, 0.3], wind: [0, 0, 0], blend: 'additive' },
  ember: { life: 2.8, rise: 3.4, spread: 0.4, size: [0.04, 0.012], wind: [0.3, 0, 0.15], blend: 'additive' },
};

/**
 * The hearth particles' one program: billboards driven entirely by uTime (no per-frame CPU work). The kind is a uniform
 * branch (`uKind`: 0 smoke, 1 flame, 2 ember), not a define, and every kind carries the fog uniforms (only smoke applies
 * them): three per-define variants were three ~150 ms compiles on the iPhone.
 */
export const CABIN_PARTICLE_GLSL = {
  vertex: /* glsl */`
      attribute vec4 seed;
      uniform float uTime, uLife, uRise, uSpread; uniform vec2 uSize; uniform vec3 uWind; uniform vec3 uSunDir; uniform int uKind;
      varying vec2 vUv; varying float vAge; varying vec4 vSeed; varying vec2 vSunView;
      #include <fog_pars_vertex>
      void main() {
        float age = fract(uTime / uLife * (0.85 + 0.3 * seed.z) + seed.w);
        vAge = age; vSeed = seed; vUv = uv;
        float ang = seed.y * 6.2831853;
        vec3 p = vec3(cos(ang), 0.0, sin(ang)) * uSpread * sqrt(seed.z);
        if (uKind == 1) {
          p.y += age * uRise * (0.6 + 0.8 * seed.x);
          p.xz *= 1.0 - age * 0.55;
          p.x += sin(uTime * 7.0 + seed.x * 20.0) * 0.06 * age;
          p.z += cos(uTime * 6.3 + seed.y * 20.0) * 0.06 * age;
        } else {
          p.y += age * uRise * (0.7 + 0.6 * seed.x);
          p.x += sin(age * 9.0 + seed.x * 12.0) * 0.12 * age + sin(uTime * 1.3 + seed.y * 9.0) * 0.08 * age;
          p.z += cos(age * 7.0 + seed.y * 12.0) * 0.12 * age;
        }
        vec3 windW = vec3(0.0);
        if (uKind != 1) {
          // wind is a world-space vector: undo the cabin's yaw so every plume drifts the same way
          windW = (inverse(mat3(modelMatrix)) * uWind) * age * age * (0.6 + 0.8 * seed.x);
          if (uKind == 0) {
            windW += (inverse(mat3(modelMatrix)) * vec3(sin(uTime * 0.37 + seed.x * 6.0), 0.0, cos(uTime * 0.29 + seed.y * 6.0))) * 0.9 * age * age;
          }
          p += windW;
        }
        vSunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xy + vec2(1e-4));
        float size = mix(uSize.x, uSize.y, age) * (0.75 + 0.5 * seed.x);
        if (uKind == 0) {
          size = mix(uSize.x, uSize.y, pow(age, 0.7)) * (0.75 + 0.5 * seed.x) * smoothstep(0.0, 0.08, age);
        }
        vec3 transformed = p;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float rot = seed.x * 6.28 + age * (seed.y - 0.5) * 2.0;
        vec2 q = position.xy * size;
        if (uKind == 0) {
          q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
        }
        if (uKind == 1) {
          q.y *= 1.9;
        }
        mvPosition.xy += q;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
  fragment: /* glsl */`
      uniform sampler2D tNoise; uniform float uTime; uniform vec3 uSunColor; uniform int uKind; uniform float uShade; uniform float uLamps;
      varying vec2 vUv; varying float vAge; varying vec4 vSeed; varying vec2 vSunView;
      #include <fog_pars_fragment>
      void main() {
        vec2 d = vUv - 0.5;
        if (uKind == 0) {
          float n = texture2D(tNoise, vUv * 1.3 + vSeed.xy * 3.0 + vec2(uTime * 0.015, -uTime * 0.04)).r;
          float n2 = texture2D(tNoise, vUv * 3.1 + vSeed.zw * 5.0 + vec2(-uTime * 0.03, -uTime * 0.02)).r;
          float m = smoothstep(0.5, 0.08, length(d) + (n - 0.5) * 0.42 + (n2 - 0.5) * 0.15);
          float a = m * 0.55 * smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.3, 1.0, vAge));
          // lit on the sun side of each puff, cool blue-grey in its own shadow
          float lit = smoothstep(-0.55, 0.6, dot(d * 2.0, vSunView) + (n - 0.5) * 0.6);
          vec3 col = mix(vec3(0.36, 0.38, 0.44), vec3(0.95, 0.9, 0.85) * uSunColor * 1.25, lit) * (0.85 + 0.3 * n2) * uShade;
          // the chimney's glow (PH-L3): the young plume catches the hearth's light from below at night
          col += vec3(1.0, 0.42, 0.12) * 0.16 * uLamps * (1.0 - smoothstep(0.0, 0.1, vAge)) * (1.0 - uShade);
          gl_FragColor = vec4(col, a);
          #include <fog_fragment>
        }
        if (uKind == 1) {
          vec2 uv = vUv;
          float n1 = texture2D(tNoise, uv * vec2(1.2, 0.7) + vec2(vSeed.x * 4.0, -uTime * 0.9 - vSeed.y * 5.0)).r;
          float n2 = texture2D(tNoise, uv * vec2(2.3, 1.4) + vec2(-vSeed.y * 3.0, -uTime * 1.6 + vSeed.x * 7.0)).r;
          float n = n1 * 0.65 + n2 * 0.35;
          float width = mix(0.42, 0.06, uv.y) * (0.7 + 0.6 * n);
          float body = smoothstep(width, width * 0.25, abs(d.x + (n - 0.5) * 0.25 * uv.y));
          body *= smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.55, uv.y + (n - 0.5) * 0.4);
          float life = smoothstep(0.0, 0.1, vAge) * (1.0 - smoothstep(0.55, 1.0, vAge));
          float heat = body * (1.0 - uv.y * 0.6) * (1.0 - vAge * 0.5);
          vec3 col = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.15, 0.6, heat));
          col = mix(col, vec3(1.0, 0.96, 0.75), smoothstep(0.55, 1.0, heat));
          gl_FragColor = vec4(col * body * life * 1.8, body * life);
        }
        if (uKind == 2) {
          float m = smoothstep(0.5, 0.15, length(d));
          float flick = 0.6 + 0.4 * sin(uTime * 17.0 + vSeed.x * 40.0);
          float life = smoothstep(0.0, 0.05, vAge) * (1.0 - smoothstep(0.4, 1.0, vAge));
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * 2.5 * m * flick * life, m * life);
        }
      }`,
};
