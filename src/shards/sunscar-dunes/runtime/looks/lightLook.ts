import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The style bible's rim and shade floor ("Last Light") as a shader edit row (look/light.ts applies it with
 * @wildshard/sdk/looks/shaderEdits editShader, once per standard material at build): a prop or creature keeps an orange
 * edge where its silhouette meets the sky, and its shaded side a cool sky-lit floor, so nothing reads as a black cut-out
 * against the afterglow (review R1, R6).
 */
export const LAST_LIGHT_EDITS: readonly ShaderEditRow[] = [{ stage: 'fragment', find: '#include <opaque_fragment>', put: `{
    float sunscarRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
    // round 1 (R1C-2): a stronger cool sky floor and rim; leather and wood in shade read brown-violet, never black
    outgoingLight += diffuseColor.rgb * (vec3(0.24, 0.21, 0.36) + vec3(1.0, 0.5, 0.22) * sunscarRim * 1.2); // round 2: stronger still
  }
#include <opaque_fragment>` }];
