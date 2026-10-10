import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The textured sky isles' material edits (E399; SHARD-PLATFORM M3: shader edit rows, applied by world/skyIsleHd.ts with
 * `editShader`): the rock grey-brown with the turf kept green, the low sun's gold rim and its turn of the masses, the
 * isles' own haze. The splices are the caller's numbers: `@{turf}` (the turf mask, `0.0` on a playable keel cut at its
 * turf), `@{sunX}` / `@{sunY}` / `@{sunZ}` the sun's direction, `@{shadeLo}` / `@{shadeHi}` the shade across the sun's
 * turn, and `@{hazeColor}`, `@{hazeNear}`, `@{hazeSpan}`, `@{hazeMax}` the haze.
 */

/** The turf mask on a decorative isle (green over red and blue). */
export const SKY_ISLE_ROCK = { turf: 'smoothstep(0.02, 0.12, c.g - max(c.r, c.b) * 0.92)' } as const;

/** The rock and turf paint, then the sun's rim and turn and the haze over the lit colour. */
export const SKY_ISLE_ROCK_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.3, 0.59, 0.11));
    float turf = @{turf};
    vec3 stone = vec3(l) * vec3(1.02, 0.96, 0.88) * (0.75 + 0.35 * smoothstep(0.15, 0.6, l));
    // (row 1, the lead: the canopies read olive-grey; the mockups' crowns are lush green lit warm by the low sun)
    vec3 leaf = mix(vec3(l), c, 1.35) * vec3(1.02, 1.12, 0.78) * 1.15;
    diffuseColor.rgb = mix(stone, clamp(leaf, 0.0, 1.0), turf); }` },
  { stage: 'fragment', find: '#include <dithering_fragment>', put: `#include <dithering_fragment>
  // the low sun behind them catches their edges gold (round 9, the seats: 'pale flat mesas'; mockup A's crags are dark
  // masses with sunlit gold rims)
  // strongest on the sun's side (round 10, seat B: every edge lit alike), a share on the rest (round 12: sun-side only
  // left the crags facing the spawn dark)
  { float farRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0) * (0.4 + 0.6 * smoothstep(-0.1, 0.5, dot(normalize(normal), normalize((viewMatrix * vec4(@{sunX}, @{sunY}, @{sunZ}, 0.0)).xyz))));
    // (top-10 row 9: the mockups light their isles from behind: the masses turned from the low sun fall into a soft
    // shade, the faces toward it brighten, so each reads as a lit volume, not a flat beige cut-out)
    float farSunTurn = smoothstep(-0.45, 0.65, dot(normalize(normal), normalize((viewMatrix * vec4(@{sunX}, @{sunY}, @{sunZ}, 0.0)).xyz)));
    gl_FragColor.rgb *= mix(@{shadeLo}, @{shadeHi}, farSunTurn);
    gl_FragColor.rgb = gl_FragColor.rgb * 0.95 + vec3(1.0, 0.7, 0.36) * farRim * 0.55; }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, @{hazeColor}, clamp((length(vViewPosition) - @{hazeNear}) / @{hazeSpan}, 0.0, 1.0) * @{hazeMax});` },
];

/** A playable keel's clip: everything above its turf discarded (its deck draws the top). */
export const SKY_ISLE_CLIP_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <begin_vertex>', put: '#include <begin_vertex>\n  farLocalY = position.y;' },
  { stage: 'vertex', find: '', put: 'varying float farLocalY;\n' },
  { stage: 'fragment', find: '#include <clipping_planes_fragment>', put: '#include <clipping_planes_fragment>\n  if (farLocalY > 0.02) discard;' },
  { stage: 'fragment', find: '', put: 'varying float farLocalY;\n' },
];
