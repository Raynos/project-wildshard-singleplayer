/**
 * The shard fog as a `scene.fogNode` (src/world/Atmosphere.ts + the low-poly shard's L3 colour-ramp fog in
 * src/world/stylize.ts), the same maths as the GLSL chunks: the exponential height + distance fog integrated along
 * the view ray (the underwater blend drives it), and on the stylized shard the Firewatch ramp into the sky dome's
 * own gradient, warmer toward the sun.
 *
 *   scene.fogNode = shardFog(scene.fog, stylized);   // GpuPath
 *   const { col, factor } = fogAt(positionWorld);    // a port that fogs by hand
 */
import type * as THREE from 'three';
import { abs, cameraPosition, clamp, dot, exp, float, fog, max, mix, pow, positionWorld, select, smoothstep, uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { gpuUniforms } from './bridge';

let fogColorU: Node<'color'> | null = null;
/** the scene fog's colour (Sky's horizon; the underwater blend moves it) — set by shardFog, read by ports */
export function sceneFogColor(): Node<'color'> {
  if (!fogColorU) throw new Error('[gpu/fog] sceneFogColor() before shardFog()');
  return fogColorU;
}
function fogColorNode(sceneFog: THREE.Fog | THREE.FogExp2): Node<'color'> {
  fogColorU = uniform(sceneFog.color.clone()).onRenderUpdate((_f, self) => self.value.copy(sceneFog.color));
  return fogColorU;
}

/** the exponential height + distance fog factor at a world point (Atmosphere.ts fog_fragment) */
export function expFogFactor(w: Node<'vec3'>): Node<'float'> {
  const F = gpuUniforms().fog;
  const rayLen = w.sub(cameraPosition).length();
  const dy = w.y.sub(cameraPosition.y);
  const camF = exp(F.fogHeightFalloff.negate().mul(cameraPosition.y.sub(F.fogHeight)));
  const t = F.fogHeightFalloff.mul(dy).toVar();
  const integ = select(abs(t).greaterThan(1e-3), float(1).sub(exp(t.negate())).div(t), float(1));
  return clamp(float(1).sub(exp(F.fogHeightDensity.mul(camF).mul(integ).mul(rayLen).add(F.fogDistDensity.mul(rayLen)).negate())), 0, 1);
}

let stylizedFog = true;
/** the scene fog node: `stylized` = the L3 ramp (Driftwood), else Atmosphere's plain height fog (Pine Hollow) */
export function shardFog(sceneFog: THREE.Fog | THREE.FogExp2, stylized: boolean): Node {
  fogColorNode(sceneFog);
  stylizedFog = stylized;
  const { col, factor } = fogAt(positionWorld);
  return fog(col, factor);
}

/** the fog colour and amount at world point `w` (for a port that applies fog itself, e.g. the premultiplied ocean) */
export function fogAt(w: Node<'vec3'>): { col: Node<'vec3'>; factor: Node<'float'> } {
  const F = gpuUniforms().fog, T = gpuUniforms().toon;
  const fogColor = sceneFogColor();
  const ray = w.sub(cameraPosition).toVar();
  const rayLen = ray.length().toVar();
  const viewDir = ray.div(max(rayLen, 1e-3)).toVar();
  const expF = expFogFactor(w).toVar();
  if (!stylizedFog) {
    const sunAmt = max(dot(viewDir, F.fogSunDir), 0);
    return { col: mix(fogColor, F.fogSunColor, pow(sunAmt, 6).mul(0.7)), factor: expF };
  }
  const r = smoothstep(T.uFogStart, T.uFogEnd, rayLen).toVar();
  const rampF = pow(r, 0.8).mul(mix(float(1), float(0.72), smoothstep(4, 40, w.y))).toVar();
  const e = max(viewDir.y, 0);
  const skyCol = mix(fogColor, T.uFogZenith, pow(smoothstep(0, 0.75, e), 0.62));
  const col0 = mix(T.uFogNear, skyCol, smoothstep(0, 0.55, r)).add(F.fogSunColor.mul(pow(max(dot(viewDir, F.fogSunDir), 0), 8)).mul(0.3).mul(r));
  const col = mix(col0, fogColor, clamp(expF.sub(rampF).mul(4), 0, 1)); // under the sea the dense turquoise fog wins
  return { col, factor: max(rampF, expF) };
}
