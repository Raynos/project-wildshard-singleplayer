// Global atmospheric fog: exponential height fog + distance fog with sun in-scatter.
// Implemented by overriding three's fog shader chunks so *every* fogged material
// (terrain, instanced trees, glTF props, animals) gets it for free.
import * as THREE from 'three';

export const fogUniforms = {
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  fogHeight: { value: 2.0 },          // metres; fog is densest below this
  fogHeightFalloff: { value: 0.06 },
  fogHeightDensity: { value: 0.0007 },
  fogDistDensity: { value: 0.0006 },
};

let installed = false;
export function installAtmosphere() {
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
  proto.onBeforeCompile = function (shader) { attachFogUniforms(shader); };
}

export function attachFogUniforms(shader: { uniforms: Record<string, THREE.IUniform> }) {
  for (const k of Object.keys(fogUniforms)) shader.uniforms[k] = (fogUniforms as Record<string, THREE.IUniform>)[k];
}
