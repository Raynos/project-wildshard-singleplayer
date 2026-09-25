/**
 * Look v2 — the painting's live re-grade (port-v2.md step 1, "cheapest first"): the panorama is painted once, at the
 * def's golden afternoon; the hour and the weather re-tint it in the shader, the way the old v1 matte backdrop did.
 *
 * One GLSL function, `v2Regrade(sceneLinear)`, used by BOTH the sky dome and the fog colour (fog.ts), so the fog the 3D
 * world dissolves into is always exactly the sky behind it — at noon, at dusk, under the moon, in a storm:
 *   × the live key light relative to the painted key (half strength, normalised — tints, doesn't dim)
 *   → a cool blue monochrome under the moon
 *   × the sky rig's cloud light (night and a storm's gloom dim the whole painting)
 *   → a storm's veil into the rig's slate fog colour (overcast / rain swallow the painted clouds and the range)
 *   + the lightning flash
 * `updateTint(look, weather)` writes the uniforms once a frame (no allocation).
 */
import * as THREE from 'three';
import type { SkyLook } from '../../world/DayClock';

/** the key light the panorama was painted under (the def's late-afternoon sun, ChunkSky.sunColor) */
const PAINTED_KEY = new THREE.Color(1.0, 0.85, 0.64);
const WHITE = new THREE.Color(1, 1, 1);

export const tintUniforms = {
  uV2KeyTint: { value: new THREE.Color(1, 1, 1) },
  uV2Moon: { value: 0 },
  uV2Light: { value: new THREE.Color(1, 1, 1) },
  uV2Veil: { value: 0 },
  uV2VeilCol: { value: new THREE.Color(0.2, 0.21, 0.26) },
  uV2Flash: { value: 0 },
};

export const V2_TINT_GLSL = /* glsl */`
uniform vec3 uV2KeyTint;
uniform float uV2Moon;
uniform vec3 uV2Light;
uniform float uV2Veil;
uniform vec3 uV2VeilCol;
uniform float uV2Flash;
vec3 v2Regrade(vec3 c) {
  c *= uV2KeyTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, l * vec3(0.5, 0.62, 1.0), uV2Moon * 0.8);
  c *= uV2Light;
  c = mix(c, uV2VeilCol, uV2Veil);
  return c + uV2Flash * l * vec3(0.8, 0.85, 1.0);
}
`;

/** the weather's share of the re-grade (src/world/Weather.ts fields) */
export interface TintWeather { overcast: number; rain: number; flash: number }

export function updateTint(look: SkyLook, w: TintWeather): void {
  const u = tintUniforms;
  const k = look.keyColor;
  const r = k.r / PAINTED_KEY.r, g = k.g / PAINTED_KEY.g, b = k.b / PAINTED_KEY.b;
  const mx = Math.max(r, g, b, 1e-3);
  u.uV2KeyTint.value.setRGB(0.5 + 0.5 * (r / mx), 0.5 + 0.5 * (g / mx), 0.5 + 0.5 * (b / mx));
  if (look.moon > 0) u.uV2KeyTint.value.lerp(WHITE, look.moon);
  u.uV2Moon.value = look.moon;
  u.uV2Light.value.copy(look.cloudLight);
  u.uV2VeilCol.value.copy(look.fogColor);
  u.uV2Veil.value = Math.min(0.9, w.overcast * 0.6 + w.rain * 0.35);
  u.uV2Flash.value = w.flash;
}
