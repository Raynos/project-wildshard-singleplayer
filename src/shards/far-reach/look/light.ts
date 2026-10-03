import { ShaderChunk, Vector3 } from 'three';
import { SUN_DIR } from './sun';

/**
 * Sky Reach's painted light (review 2026-10-01 item 1, the look's `lighting`): the golden-hour key stays low and behind
 * the islands (the mockup's mood), and three painter's terms keep the camera-facing sides from going black:
 *
 * - **warm bounce**: a soft wrap light from the anti-sun side, a little above the horizon (the gold sky scattered back
 *   onto every face the player sees);
 * - **rim**: a sun-coloured fresnel edge, strongest when the sun sits behind the surface, mostly on vertical faces
 *   (island lips, the windmill, the pines, creatures, the fan);
 * - **shade floor**: no shaded surface drops below a warm plum share of its own albedo (the review's p10 L* ≥ 25).
 *
 * One patch of three's `lights_fragment_end` chunk, so every lit material in the shard gets it with no per-material call
 * (a shard switch is a page reload, as Driftwood's toon rig relies on). The sun never moves here (no day cycle), so the
 * directions are baked into the GLSL as constants. A material opts out with `defines: { FAR_NO_PAINT: '' }`.
 */
export const PAINT = {
  /** the bounce's colour × strength (linear, in the material's diffuse units) */
  // E399 round 2 (seat C: 'front-lit, a strong warm fill from behind the camera'): less fill, more rim, warmer shade
  bounce: [0.32, 0.21, 0.15],
  /** its direction: the anti-sun heading, lifted this much (y before normalising) */
  bounceLift: 0.55,
  /** the rim's colour × strength */
  rim: [2.6, 1.7, 0.85],
  /** the shade floor's colour (a share of albedo) */
  // (round 7: the middle band's shade lifted here rather than by a global gamma, which flattened the unlit meadow)
  floor: [0.56, 0.44, 0.4],
} as const;

const v3 = (v: readonly number[]): string => `vec3(${v.map((n) => n.toFixed(4)).join(',')})`;

export function paintGlsl(sun: Vector3 = SUN_DIR): string {
  const bounce = new Vector3(-sun.x, PAINT.bounceLift, -sun.z).normalize();
  return /* glsl */`
#ifndef FAR_NO_PAINT
{
  vec3 farL = normalize( ( viewMatrix * vec4( ${v3(sun.toArray())}, 0.0 ) ).xyz );
  vec3 farB = normalize( ( viewMatrix * vec4( ${v3(bounce.toArray())}, 0.0 ) ).xyz );
  vec3 farUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float farNV = clamp( dot( geometryNormal, geometryViewDir ), 0.0, 1.0 );
  float farBack = clamp( dot( -geometryViewDir, farL ), 0.0, 1.0 );
  float farSide = 1.0 - abs( dot( geometryNormal, farUp ) );
  float farRim = pow( 1.0 - farNV, 3.0 ) * ( 0.2 + 0.8 * farBack * farBack ) * ( 0.3 + 0.7 * farSide );
  reflectedLight.directDiffuse += material.diffuseColor * ${v3(PAINT.rim)} * farRim;
  float farWrap = clamp( ( dot( geometryNormal, farB ) + 0.45 ) / 1.45, 0.0, 1.0 );
  reflectedLight.indirectDiffuse += material.diffuseColor * ${v3(PAINT.bounce)} * farWrap;
  reflectedLight.indirectDiffuse = max( reflectedLight.indirectDiffuse, material.diffuseColor * ${v3(PAINT.floor)} );
}
#endif
`;
}

let installed = false;
/** The look's `lighting.install` (Sky.build runs it before anything compiles). */
export function installPaintedLight(): void {
  if (installed) return;
  installed = true;
  ShaderChunk.lights_fragment_end += paintGlsl();
}
