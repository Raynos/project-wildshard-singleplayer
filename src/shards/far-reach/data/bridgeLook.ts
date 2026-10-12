import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The bridges' material edits (SHARD-PLATFORM M3: shader edit rows, applied by world/shapes.ts with `editShader`): the
 * hover deck frame's glow for the rider near it, the rope bridges' painted deck wood and the textured anchor posts' timber
 * weathered to silver-grey. `@{weather}` splices how far the timber is greyed (world/shapes.ts `WEATHER`).
 */

/** The hover frame's glow: full within ~25 m of the camera, a third beyond ~60 m (E399 rounds 6 and 7). */
export const HOVER_FRAME_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: `#include <emissivemap_fragment>
  totalEmissiveRadiance *= mix(1.0, 0.3, smoothstep(25.0, 60.0, length(vViewPosition)));` },
];

/** The deck's painted wood (E399 round 2): grain along each plank, a tone per plank, silvered wear down the middle. */
export const DECK_WOOD_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <begin_vertex>', put: '#include <begin_vertex>\n  vFarDeck = position;' },
  { stage: 'vertex', find: '', put: 'varying vec3 vFarDeck;\n' },
  { stage: 'fragment', find: '#include <color_fragment>', put: `#include <color_fragment>
  { vec2 q = vFarDeck.xz;
    float plank = floor(q.y * 6.0 + 0.5);
    float grain = farDN(vec2(q.x * 3.0 + plank * 7.1, q.y * 90.0)) * 0.6 + farDN(vec2(q.x * 9.0, q.y * 260.0 + plank)) * 0.4;
    float tone = 0.78 + 0.32 * farDH(vec2(plank, 3.7));
    float wear = 1.0 - smoothstep(0.15, 0.9, abs(q.x) / 1.3);
    diffuseColor.rgb *= tone * (0.82 + 0.3 * grain);
    // weathered grey-brown timber, silvered most down the walked middle (round 14 prep: C's deck read orange, 120/87/58
    // over the mockup's grey-brown bridge)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(1.05, 1.0, 0.94), @{weather} + wear * 0.3);
  }` },
  { stage: 'fragment', find: '', put: `varying vec3 vFarDeck;
float farDH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float farDN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(farDH(i), farDH(i + vec2(1.0, 0.0)), u.x), mix(farDH(i + vec2(0.0, 1.0)), farDH(i + vec2(1.0, 1.0)), u.x), u.y); }
` },
];

/** The anchor posts' timber greyed to the mockups' silver; the gold hemp and the iron band kept. */
export const POST_WEATHER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.3, 0.59, 0.11));
    float wood = (1.0 - smoothstep(0.32, 0.5, l)) * smoothstep(0.0, 0.04, c.r - c.b);
    diffuseColor.rgb = mix(c, vec3(l) * vec3(1.06, 1.0, 0.92), wood * @{weather}); }` },
];
