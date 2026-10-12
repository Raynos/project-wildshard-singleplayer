import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * Sky Reach's smaller paint corrections (SHARD-PLATFORM M3: shader edit rows, applied with `editShader` where each material
 * is made: world/crown.ts, world/bookStand.ts, world/fir.ts, world/trees.ts, world/build.ts, quest/keeper.ts,
 * weapons/fanModel.ts, runtime/index.ts). Each pulls a generated model's paint toward the mockups.
 */

/** The crown dais's paint (it came out red-brown) toward mockup D's weathered grey stone with a warm cast. */
export const CROWN_DAIS_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.06, 1.0, 0.92), diffuseColor.rgb, 0.3);` },
];

/** The lantern's warm glass: the paint's bright amber texels burn (emissive); the iron and brass stay as painted. */
export const LANTERN_GLOW_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: `#include <emissivemap_fragment>
  { vec3 c = diffuseColor.rgb; float amber = smoothstep(0.45, 0.75, c.r) * smoothstep(0.3, 0.6, c.r - c.b);
    totalEmissiveRadiance += c * vec3(1.6, 1.15, 0.7) * amber; }` },
];

/** The firs' sheet: a trunk's uv is (-1, -1), so the bark is drawn from the vertex colour alone. */
export const FIR_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#ifdef USE_MAP
  vec4 farTex = texture2D(map, vMapUv);
  if (vMapUv.x < 0.0) farTex = vec4(1.0);
  diffuseColor *= farTex;
#endif` },
];

/** The trees' bark (the paint's came out magenta-red) toward a warm grey-brown; the foliage kept. */
export const TREE_BARK_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float bark = smoothstep(0.0, 0.06, c.r - c.g) * smoothstep(-0.02, 0.04, c.b - c.g * 0.8);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = mix(c, vec3(l) * vec3(1.35, 1.0, 0.72), bark * 0.85); }` },
];

/** The keeper's scarf and sash a warm rust-brown, not a loud red: strongly red texels pulled toward brown. */
export const KEEPER_SCARF_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float red = smoothstep(0.08, 0.25, c.r - max(c.g, c.b) * 1.1);
    diffuseColor.rgb = mix(c, vec3(c.r * 0.72, c.r * 0.42, c.r * 0.24), red * 0.8); }` },
];

/** The painted silk toward the mockups' muted, lighter teal (E399 round 6): `@{saturation}` of its colour kept, `@{lift}` and `@{tint}` over it. */
export const FAN_SILK_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, @{saturation}) * @{lift} * vec3(@{tint});` },
];

/** A code keel cut a little under its lip (E399 round 3): every fragment below the `farCut` height discarded. */
export const ISLE_CUT_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <clipping_planes_fragment>', put: `#include <clipping_planes_fragment>
  if ((inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).y < farCut) discard;` },
  { stage: 'fragment', find: '', put: 'uniform float farCut;\n' },
];

/** The Roc's plumage to mockup D's slate / white split (E399, E410): its browns slate grey in the paint and in the emission fed back from it; the white head and belly and the gold beak and talons kept. */
export const ROC_SLATE_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: '#include <map_fragment>\n  diffuseColor.rgb = farSlate(diffuseColor.rgb);' },
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: '#include <emissivemap_fragment>\n  totalEmissiveRadiance = farSlate(totalEmissiveRadiance);' },
  { stage: 'fragment', find: '', put: 'vec3 farSlate(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float gold = (1.0 - smoothstep(0.06, 0.12, c.b / max(c.r, 1e-3))) * smoothstep(0.2, 0.3, c.r); float brown = clamp((c.r - c.b) / max(c.r, 1e-3) * 1.6 - 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.55, 0.75, c.g / max(c.r, 1e-3))) * (1.0 - gold); return mix(c, vec3(0.085, 0.09, 0.11) + vec3(l) * vec3(0.82, 0.9, 1.05) * 1.1, brown * 0.95); }\n' },
];
