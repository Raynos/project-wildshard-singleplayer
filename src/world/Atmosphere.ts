// Global atmospheric fog: exponential height fog + distance fog with sun in-scatter.
// Implemented by overriding three's fog shader chunks so *every* fogged material
// (terrain, instanced trees, glTF props, animals) gets it for free.
import * as THREE from 'three';
import { isStylized, toonUniforms } from './stylize';

export const fogUniforms = {
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  fogHeight: { value: -14.0 },          // metres; fog is densest below this
  fogHeightFalloff: { value: 0.12 },
  fogHeightDensity: { value: 0.005 },
  fogDistDensity: { value: 0.00045 },
};

let installed = false;
export function installAtmosphere(): void {
  if (installed) return;
  installed = true;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
    #endif`;

  THREE.ShaderChunk.fog_vertex = /* glsl */`
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vec4 fogWP = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        fogWP = instanceMatrix * fogWP;
      #endif
      #ifdef USE_BATCHING
        fogWP = batchingMatrix * fogWP;
      #endif
      vFogWorldPos = ( modelMatrix * fogWP ).xyz;
    #endif`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform vec3 fogSunDir;
      uniform vec3 fogSunColor;
      uniform float fogHeight;
      uniform float fogHeightFalloff;
      uniform float fogHeightDensity;
      uniform float fogDistDensity;
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
    #endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        // exponential height fog integrated along the view ray (Unreal-style)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float t = fogHeightFalloff * dy;
        float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
        float heightAmt = fogHeightDensity * camF * integ * rayLen;
        float distAmt = fogDistDensity * rayLen;
        float fogFactor = 1.0 - exp( - ( heightAmt + distAmt ) );
        fogFactor = clamp( fogFactor, 0.0, 1.0 );
        float sunAmt = max( dot( viewDir, fogSunDir ), 0.0 );
        vec3 fogCol = mix( fogColor, fogSunColor, pow( sunAmt, 6.0 ) * 0.7 );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
      }
    #endif`;

  // Inject the shared uniform objects into every material that compiles with fog.
  const proto = THREE.Material.prototype as unknown as { onBeforeCompile: (s: THREE.WebGLProgramParametersWithUniforms) => void };
  proto.onBeforeCompile = function onBeforeCompile(shader) { attachFogUniforms(shader); };
}

export function attachFogUniforms(shader: { uniforms: Record<string, THREE.IUniform> }): void {
  for (const k of Object.keys(fogUniforms) as (keyof typeof fogUniforms)[]) shader.uniforms[k] = fogUniforms[k];
  // the low-poly shard's toon lighting (stylize.ts) rides the same hook: every fogged material already calls this
  if (isStylized()) for (const k of Object.keys(toonUniforms) as (keyof typeof toonUniforms)[]) shader.uniforms[k] = toonUniforms[k];
}

// ─── underwater (the eye below the sea surface — Player.submerged) ───
// The same fog, retuned: no height term, a dense distance term (half the light gone by ~12 m), a deep teal-green
// colour and no orange sun in-scatter. `setUnderwater(on)` picks the target, `updateUnderwater(dt, scene.fog)` lerps
// the uniforms and the scene fog colour there over ~0.3 s; the dry values are captured on the way in and restored.
const UNDER_COLOR = new THREE.Color(0.08, 0.78, 0.9); // linear HDR: the scene's sun + sky sit near 3×, so the fog must be bright to read as turquoise, not grey
const UNDER_SUN = new THREE.Color(0.4, 1.2, 1.2);
const UNDER_DIST_DENSITY = 0.024;
const UNDER_BLEND_RATE = 1 / 0.3;
let underTarget = 0, underBlend = 0;
const dry = { color: new THREE.Color(), sun: new THREE.Color(), dist: 0, height: 0, captured: false };
const _c = new THREE.Color();

/** the eye went under (true) / came back up (false) */
export function setUnderwater(on: boolean): void { underTarget = on ? 1 : 0; }
export function isUnderwater(): boolean { return underTarget === 1; }

/** every frame (Player.update does it): lerps the fog uniforms + `fog.color` toward the underwater / dry set */
export function updateUnderwater(dt: number, fog: THREE.Fog | THREE.FogExp2 | null): void {
  if (underBlend === underTarget) return;
  if (!dry.captured) {
    // the dry set is whatever the sky installed (Sky.ts); read it the first time the water asks for a change
    dry.captured = true;
    dry.sun.copy(fogUniforms.fogSunColor.value); dry.dist = fogUniforms.fogDistDensity.value; dry.height = fogUniforms.fogHeightDensity.value;
    if (fog) dry.color.copy(fog.color);
  }
  const step = Math.min(1, dt * UNDER_BLEND_RATE);
  underBlend = underTarget > underBlend ? Math.min(underTarget, underBlend + step) : Math.max(underTarget, underBlend - step);
  const t = underBlend * underBlend * (3 - 2 * underBlend);
  fogUniforms.fogSunColor.value.copy(dry.sun).lerp(UNDER_SUN, t);
  fogUniforms.fogDistDensity.value = dry.dist + (UNDER_DIST_DENSITY - dry.dist) * t;
  fogUniforms.fogHeightDensity.value = dry.height * (1 - t);
  if (fog) fog.color.copy(dry.color).lerp(_c.copy(UNDER_COLOR), t);
}
