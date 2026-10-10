// SHARD-PLATFORM M3 (look-family rows): fpArms.ts's GLSL as data for the SDK toon arms (@wildshard/sdk/viewmodel/toonArms);
// `@{name}` is spliced by the system: SUNWARD (the shadow lookup's reach), the blade's DQ_S / DQ_Y / BASE / BASE_END / HALF_W / TAPER.
export const FP_ARMS_GLSL = {
  shadowCommon: /* glsl */`#include <common>
uniform vec3 uVmLightDir;`,
  shadowLookup: /* glsl */`vec4 vmWorldPos = worldPosition;
worldPosition.xyz -= uVmLightDir * @{SUNWARD};
#include <shadowmap_vertex>
worldPosition = vmWorldPos;`,
  metalVertexCommon: /* glsl */`#include <common>
attribute float _metal;
varying float vMetal;`,
  metalVertexBegin: /* glsl */`#include <begin_vertex>
vMetal = _metal;`,
  metalFragmentCommon: /* glsl */`#include <common>
varying float vMetal;`,
  metalFragmentMetalness: /* glsl */`#include <metalnessmap_fragment>
metalnessFactor *= vMetal;`,
  bladeVertexCommon: /* glsl */`#include <common>
varying vec2 vBlade;`,
  bladeVertexBegin: /* glsl */`#include <begin_vertex>
vBlade = vec2(abs(position.x * @{DQ_S}), position.y * @{DQ_S} + @{DQ_Y});`,
  bladeFragmentCommon: /* glsl */`#include <common>
uniform float uRim;
uniform vec3 uRimAqua;
varying vec2 vBlade;`,
  bladeEmissive: /* glsl */`#include <emissivemap_fragment>
        if (uRim > 0.0) {
          float onBlade = smoothstep(@{BASE}, @{BASE_END}, vBlade.y);
          float halfW = max(0.003, @{HALF_W} - @{TAPER} * (vBlade.y - @{BASE}));
          float edge = smoothstep(0.7, 1.0, vBlade.x / halfW);
          totalEmissiveRadiance += uRimAqua * (uRim * onBlade * 1.3 * edge);
        }`,
  swimVertexCommon: /* glsl */`#include <common>
varying vec3 vVmPos;`,
  swimProject: /* glsl */`#include <project_vertex>
vVmPos = mvPosition.xyz;`,
  swimFragmentCommon: /* glsl */`#include <common>
uniform vec3 uWaterN;
uniform float uWaterD;
varying vec3 vVmPos;`,
  swimColor: /* glsl */`#include <color_fragment>
        float hWater = dot(uWaterN, vVmPos) - uWaterD;
        float under = 1.0 - smoothstep(-0.003, 0.003, hWater);
        vec3 sea = diffuseColor.rgb * vec3(0.38, 0.78, 0.86) * (1.0 - clamp(-hWater * 1.6, 0.0, 0.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, sea, under * 0.9);`,
  swimEmissive: /* glsl */`#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.62, 0.74, 0.78) * (1.0 - smoothstep(0.002, 0.011, abs(hWater)));`,
} as const;
