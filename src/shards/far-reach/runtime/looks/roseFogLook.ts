import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * Sky Reach's rose fog (SHARD-PLATFORM M3: shader edit rows, applied to every scene material by look/render.ts with
 * `editShader`): the haze takes the painted horizon's colour in the direction you look (gold toward the sun, rose-lavender
 * away), from the `farHaze` strip by heading, and the air toward the low sun goes a little gold over distance. The splices
 * are look/render.ts's: `@{HEADING_GLSL}` (look/sky.ts), `@{near}` / `@{span}` / `@{max}` the fog (look/sun.ts `FOG`),
 * `@{sunX}` / `@{sunY}` / `@{sunZ}` the sun's direction and `@{sunHaze}` its gold share.
 */
export const ROSE_FOG_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <fog_fragment>', put: `#ifdef USE_FOG\n vec3 farV=vFogWorldPos-cameraPosition; gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(farHaze,vec2(farHeading(farV),0.5)).rgb,clamp((length(farV)-@{near})/@{span},0.0,1.0)*@{max});\n float farSun=pow(max(dot(normalize(farV),vec3(@{sunX},@{sunY},@{sunZ})),0.0),24.0); gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.8,0.52),farSun*clamp((length(farV)-15.0)/160.0,0.0,1.0)*@{sunHaze});\n#endif` },
  { stage: 'fragment', find: '', put: '#ifndef FAR_HAZE\n#define FAR_HAZE\nuniform sampler2D farHaze;\n@{HEADING_GLSL}\n#endif\n' },
];
