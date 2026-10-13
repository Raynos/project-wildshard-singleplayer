import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';
import { skyMapGraph } from '../look/mapGraph';

/**
 * Sky Reach's smaller paint corrections, each pulling a generated model's paint toward the mockups: SF59 material graphs
 * over the model's own map (the shardfile's `look.materials`, bound by world/looks.ts `skyMappedLook` in world/crown.ts,
 * world/bookStand.ts, quest/keeper.ts), and shader edit rows (applied with `editShader` in world/trees.ts,
 * weapons/fanModel.ts, world/build.ts, runtime/index.ts): the trees wear five maps (a graph per map is a program each until
 * a meshMap graph can share one), the fan's map arrives late, a keel has none, a creature wears the Roc's.
 */

const LUMA = [0.2126, 0.7152, 0.0722];

/** The crown dais's paint (it came out red-brown) toward mockup D's weathered grey stone with a warm cast. */
export const CROWN_DAIS_GRAPH = skyMapGraph({ l: { op: 'dot', in: ['c', LUMA] }, grey: { op: 'mul', in: ['l', [1.06, 1, 0.92]] }, colour: { op: 'mix', in: ['grey', 'c', 0.3] } }, { colour: 'colour' });

/** The lantern's warm glass: the paint's bright amber texels burn (emissive); the iron and brass stay as painted. */
export const LANTERN_GLOW_GRAPH = skyMapGraph({ a1: { op: 'smoothstep', in: [0.45, 0.75, 'cr'] }, rb: { op: 'sub', in: ['cr', 'cb'] }, a2: { op: 'smoothstep', in: [0.3, 0.6, 'rb'] },
  amber: { op: 'mul', in: ['a1', 'a2'] }, warm: { op: 'mul', in: ['c', [1.6, 1.15, 0.7]] }, glow: { op: 'mul', in: ['warm', 'amber'] } }, { colour: 'c', emissive: 'glow' });

/** The trees' bark (the paint's came out magenta-red) toward a warm grey-brown; the foliage kept. */
export const TREE_BARK_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float bark = smoothstep(0.0, 0.06, c.r - c.g) * smoothstep(-0.02, 0.04, c.b - c.g * 0.8);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = mix(c, vec3(l) * vec3(1.35, 1.0, 0.72), bark * 0.85); }` },
];

/** The keeper's scarf and sash a warm rust-brown, not a loud red: strongly red texels pulled toward brown. */
export const KEEPER_SCARF_GRAPH = skyMapGraph({ gb: { op: 'max', in: ['cg', 'cb'] }, gb1: { op: 'mul', in: ['gb', 1.1] }, rd: { op: 'sub', in: ['cr', 'gb1'] }, r1: { op: 'smoothstep', in: [0.08, 0.25, 'rd'] },
  red: { op: 'mul', in: ['r1', 0.8] }, rust: { op: 'mul', in: ['cr', [0.72, 0.42, 0.24]] }, colour: { op: 'mix', in: ['c', 'rust', 'red'] } }, { colour: 'colour' });

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
