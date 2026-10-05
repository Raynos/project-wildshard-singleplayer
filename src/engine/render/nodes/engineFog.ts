/**
 * The engine's height fog as nodes (SHARD-PLATFORM SF59 step 2, fix 3; sf59-tsl-spike.md §2.2): the same maths as
 * Atmosphere.ts's `fog_fragment` chunk, for graph materials, which never read THREE.ShaderChunk. It reads the engine's own
 * uniform objects by reference (`fogUniforms`, `weatherUniforms`, `weatherFogUniforms` and the scene fog's colour), so a
 * value set on them reaches classic and node materials alike, and it compiles in the same optional terms the chunk did
 * (`atmosphereTerms()`: Pine Hollow's slab-edge haze and fog bank, a level's weather fog). EngineNodesHandler appends it
 * after the output transform, where classic three applies fog. Parity with the chunk: scripts/tsl-spike (`family` vs
 * `tsl`, ≥ 40 dB).
 */
import type * as THREE from 'three';
import type { Node } from 'three/webgpu';
import { abs, cameraPosition, clamp, dot, exp, float, length, max, mix, positionWorld, pow, reference, select, smoothstep, vec4 } from 'three/tsl';
import { atmosphereTerms, fogUniforms, weatherFogUniforms, weatherUniforms } from '../../world/Atmosphere';

const f = (u: { value: number }): Node<'float'> => reference('value', 'float', u);
const v3 = (u: { value: THREE.Vector3 }): Node<'vec3'> => reference('value', 'vec3', u);
const v4 = (u: { value: THREE.Vector4 }): Node<'vec4'> => reference('value', 'vec4', u);
const col = (u: { value: THREE.Color }): Node<'color'> => reference('value', 'color', u);

/** fog `out` (a colour after the output transform) the way Atmosphere.ts's chunk fogs a classic material; unfogged when the scene has no fog (USE_FOG off) */
export function engineFog(out: Node<'vec4'>, fog: THREE.Fog | THREE.FogExp2 | null): Node<'vec4'> {
  if (fog === null) return out;
  const fogColor = reference('color', 'color', fog); // classic three's `fogColor` uniform
  const terms = atmosphereTerms();
  const u = fogUniforms;
  const ray = positionWorld.sub(cameraPosition);
  const rayLen = length(ray);
  const viewDir = ray.div(max(rayLen, 1e-3));
  // exponential height fog integrated along the view ray (Unreal-style)
  const dy = positionWorld.y.sub(cameraPosition.y);
  const falloff = f(u.fogHeightFalloff);
  const camF = exp(falloff.negate().mul(cameraPosition.y.sub(f(u.fogHeight))));
  const t = falloff.mul(dy);
  const integ = select(abs(t).greaterThan(1e-3), float(1).sub(exp(t.negate())).div(t), float(1));
  const heightAmt = f(u.fogHeightDensity).mul(camF).mul(integ).mul(rayLen);
  const distAmt = f(u.fogDistDensity).mul(rayLen);
  let factor: Node<'float'> = clamp(float(1).sub(exp(heightAmt.add(distAmt).negate())), 0, 1);
  if (terms.edgeHaze) {
    // the slab's last metres thicken into the painted horizon's haze, seen from above (PH-L5)
    const edge = v4(u.fogEdge);
    const edgeD = max(abs(positionWorld.x), abs(positionWorld.z));
    const fogE = edge.x.mul(smoothstep(edge.y, edge.z, edgeD)).mul(smoothstep(edge.w, edge.w.mul(4), cameraPosition.y.sub(positionWorld.y)));
    factor = float(1).sub(float(1).sub(factor).mul(float(1).sub(fogE)));
    // the Ghost Stag's fog bank (PH-C7)
    const blob = v4(weatherUniforms.fogBlob);
    const fogB = f(weatherUniforms.fogBlobAmt).mul(float(1).sub(smoothstep(0.1, 1, length(positionWorld.sub(blob.xyz)).div(blob.w)))).mul(smoothstep(5, 24, rayLen));
    factor = float(1).sub(float(1).sub(factor).mul(float(1).sub(fogB)));
  }
  const sunAmt = max(dot(viewDir, v3(u.fogSunDir)), 0);
  const fogCol = mix(fogColor, col(u.fogSunColor), pow(sunAmt, 6).mul(0.7));
  let rgb = mix(out.rgb, fogCol, factor);
  if (terms.weather) {
    // the weather fog (E390), over the level's own fog
    const w = v4(weatherFogUniforms.fogWeather);
    const wAmt = w.x.add(w.y.mul(camF).mul(integ)).mul(rayLen);
    rgb = mix(rgb, col(weatherFogUniforms.fogWeatherColor), clamp(float(1).sub(exp(wAmt.negate())).mul(w.z), 0, 1));
  }
  return vec4(rgb, out.a);
}
