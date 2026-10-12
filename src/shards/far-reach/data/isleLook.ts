import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The islands' paint (E392; SHARD-PLATFORM M3: shader edit rows, applied by world/isle.ts `paintIsleMaterial` with
 * `editShader`): green faces get the painted meadow, tonal patches and daisies; the rest the painted cliff rock, triplanar in
 * world space. `@{textures}` splices the defines and samplers of the textures that loaded (`ISLE_PAINT`), `@{rockMix}` how
 * much of the rock texture replaces the vertex colour.
 */

/** The defines and samplers a loaded rock or meadow texture adds. */
export const ISLE_PAINT = {
  rockTex: '#define FAR_ROCK_TEX\nuniform sampler2D farRock;\n',
  meadowTex: '#define FAR_MEADOW_TEX\nuniform sampler2D farMeadow;\n',
} as const;

/** The paint over the vertex colour; then its header (the loaded textures and the value noise) put before the stage's source. */
export const ISLE_PAINT_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <color_fragment>', put: `#include <color_fragment>
  // the fragment's world position (the fog's varying is not in every program: computed from the view position)
  vec3 farWP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
  if (diffuseColor.g > diffuseColor.r * 1.05 && diffuseColor.g > diffuseColor.b * 1.3) {
    vec2 q = farWP.xz;
    diffuseColor.rgb *= 0.8 + 0.38 * farMN(q * 0.22) + 0.12 * farMN(q * 1.3);
#ifdef FAR_MEADOW_TEX
    // the painted meadow, a 5 m tile, keeping the vertex colour's broad tone
    // two scales of the painted meadow (3 m and 11 m tiles) so no repeat reads from above; sunlit swells and shaded hollows
    vec3 mt = texture2D(farMeadow, q * 0.33).rgb * 0.6 + texture2D(farMeadow, q * 0.09 + 0.37).rgb * 0.4;
    float swell = farMN(q * 0.12) * 0.7 + farMN(q * 0.4) * 0.3;
    // loop 20 (the aerial targets: lumpy sunlit tops, warm yellow-green, dark tuft shadows): stronger swells, a warmer tint
    float tuft = farMN(q * 3.1);
    // E399 (the council: 'sparse blades on a flat yellow plane'): the ground between the blades is the shade down in the
    // sward, a deeper green, so the gaps read as depth in the grass, not bare yellow ground
    // (round 6: between the tufts its pale patches read as the crudest surface at the bottom of C, D and proposal B)
    diffuseColor.rgb = mix(diffuseColor.rgb, mt * (0.5 + 0.45 * swell) * (0.85 + 0.2 * tuft) * vec3(0.5, 0.58, 0.4), 0.9);
#endif
    // the ground lies in the sward's shade, so its gaps read as depth in the grass (the mockups' dark roots): one shade
    // at every distance (round 13, seat C: row 4's darkening by distance from the camera was round 12's glowNear again)
    diffuseColor.rgb *= 0.86;
    vec2 cell = floor(q * 2.2); float pick = farMH(cell);
    float dot2 = 1.0 - smoothstep(0.12, 0.3, length(fract(q * 2.2) - 0.5));
    // painted daisies for the far view only: near the camera the meadow draws real flowers, and these read as bare tan discs
    float farDots = smoothstep(14.0, 26.0, length(farWP - cameraPosition));
    if (pick > 0.93) diffuseColor.rgb = mix(diffuseColor.rgb, pick > 0.975 ? vec3(0.95, 0.78, 0.25) : vec3(0.95, 0.94, 0.9), dot2 * 0.85 * farDots);
  } else {
    // the rock: toward a cool grey-brown (E392 targets), keeping a little of its warm strata
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.0, 0.96, 0.93), 0.45);
#ifdef FAR_ROCK_TEX
    // triplanar mossy rock, its facet normal from the world position's derivatives (flat shading)
    vec3 fn = normalize(cross(dFdx(farWP), dFdy(farWP)));
    vec3 tw = pow(abs(fn), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
    vec3 wq = farWP * 0.13;
    vec3 tex = texture2D(farRock, wq.zy).rgb * tw.x + texture2D(farRock, wq.xz).rgb * tw.y + texture2D(farRock, wq.xy).rgb * tw.z;
    diffuseColor.rgb = mix(diffuseColor.rgb, tex * (0.55 + 1.3 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), @{rockMix});
    // grey-green cliff (the targets): less brown, moss on every ledge that faces up
    float rl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(rl) * vec3(0.98, 1.0, 0.97), 0.55);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.42, 0.2) * (0.7 + 0.6 * rl), smoothstep(0.2, 0.65, fn.y) * 0.65);
#endif
  }` },
  { stage: 'fragment', find: '', put: `#ifndef FAR_MEADOW_PAINT
#define FAR_MEADOW_PAINT
@{textures}float farMH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float farMN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(farMH(i), farMH(i + vec2(1.0, 0.0)), u.x), mix(farMH(i + vec2(0.0, 1.0)), farMH(i + vec2(1.0, 1.0)), u.x), u.y); }
#endif
` },
];
