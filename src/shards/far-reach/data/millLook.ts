import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The windmill's material edits (SHARD-PLATFORM M3: shader edit rows, applied by world/mill.ts with `editShader`): the
 * modelled tower's paint pulled toward a pale weathered whitewash with the painted stone's courses multiplied in, and the
 * worn canvas of the sails (frayed edges, a torn corner on two sails, the painted cloth's sun-bleached cream, or a coarse
 * weave and water stains before it lands).
 */

/** The tower's whitewash and stone courses (the courses on the bump map's second UV set). */
export const MILL_TOWER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.2);
#ifdef USE_BUMPMAP
  diffuseColor.rgb *= mix(1.0, texture2D(bumpMap, vBumpMapUv).g * 1.45, 0.35);
#endif` },
];

/** The canvas: its cloth coordinates handed to the fragment stage, the value noise, the weathering over the colour. */
export const MILL_CANVAS_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <begin_vertex>', put: '#include <begin_vertex>\n  vFarCloth = farCloth;' },
  { stage: 'vertex', find: '', put: 'attribute vec3 farCloth;\nvarying vec3 vFarCloth;\n' },
  { stage: 'fragment', find: '#include <color_fragment>', put: `#include <color_fragment>
  { vec2 q = vFarCloth.xy; float seed = vFarCloth.z;
    float n = farCN(q * vec2(14.0, 40.0) + seed * 17.0) * 0.65 + farCN(q * vec2(5.0, 13.0) + seed * 5.0) * 0.35;
    float edge = min(min(q.x, 1.0 - q.x), min(q.y * 2.5, (1.0 - q.y) * 2.5));
    float torn = step(edge, 0.05 * n);
    // two sails have lost a ragged corner at the outer rail's hub end
    torn = max(torn, step(0.45, seed) * step(length((q - vec2(1.0, 0.0)) * vec2(1.0, 1.6)), 0.22 + 0.22 * n));
    if (farCN(q * vec2(6.0, 15.0) + seed * 31.0) > 0.94) torn = 1.0;
    diffuseColor.a *= 1.0 - torn;
#ifdef USE_MAP
    // the painted canvas is a warm beige swatch: toward the targets' sun-bleached cream
    diffuseColor.rgb = min(vec3(1.0), mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.25) * vec3(1.12, 1.06, 0.96));
    // (E399 seats: the sails 'read like pale glass panes'; the mockups' canvas is a weathered tan between dark frames)
#else
    float weave = 0.92 + 0.08 * sin(q.x * 300.0) * sin(q.y * 700.0);
    diffuseColor.rgb *= weave * mix(1.0, 0.8, smoothstep(0.62, 0.8, n)) * mix(0.8, 1.0, smoothstep(0.0, 0.3, q.y));
#endif
  }` },
  { stage: 'fragment', find: '', put: `varying vec3 vFarCloth;
float farCH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float farCN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(farCH(i), farCH(i + vec2(1.0, 0.0)), u.x), mix(farCH(i + vec2(0.0, 1.0)), farCH(i + vec2(1.0, 1.0)), u.x), u.y); }
` },
];
