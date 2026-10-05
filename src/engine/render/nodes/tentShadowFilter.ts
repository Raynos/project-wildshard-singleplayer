/**
 * The engine's shadow filter as nodes (SHARD-PLATFORM SF59 step 2, fix 3; sf59-tsl-spike.md §2.2): Castaño's optimised
 * PCF tent (shadowFilter.ts, E138), the same taps, weights and receiver-plane depth bias, for graph materials. three's node
 * shadows use their own 5-tap Vogel PCF; EngineNodesHandler gives this filter to every shadow-casting light (the light's
 * `shadow.filterNode`, which only node materials read) wherever the engine installed the tent, so node and family
 * materials share one penumbra. A light picks its tent by `shadow.radius` as the chunk does: ≥ 1.5 is 7×7, ≥ 1 is 5×5,
 * below that 3×3.
 *
 * three's shadow node hands the filter a coordinate whose y is flipped (WebGPU convention) and its texture sample flips it
 * back; the texel grid is symmetric under the flip and the tent is symmetric, so the result is the chunk's.
 */
import type * as THREE from 'three';
import type { Node } from 'three/webgpu';
import { Fn, If, abs, clamp, dFdx, dFdy, dot, float, floor, min, reference, select, texture, vec2 } from 'three/tsl';

/** what three's shadow node hands a filter (the index signature: Fn's object-argument overload needs one) */
interface FilterInputs {
  readonly [key: string]: unknown;
  depthTexture: THREE.DepthTexture;
  shadowCoord: Node<'vec3'>;
  shadow: THREE.LightShadow;
}

/** the tent as a node shadow filter (a light's `shadow.filterNode`); EngineNodesHandler assigns it */
export const tentShadowFilter = Fn<FilterInputs, Node<'float'>>(({ depthTexture, shadowCoord, shadow }: FilterInputs): Node<'float'> => {
  const mapSize = reference('mapSize', 'vec2', shadow);
  const radius = reference('radius', 'float', shadow);
  const tuv = shadowCoord.xy.mul(mapSize);
  const tb = floor(tuv.add(0.5));
  const ts = tuv.x.add(0.5).sub(tb.x).toVar(), tt = tuv.y.add(0.5).sub(tb.y).toVar();
  const inv = vec2(1).div(mapSize);
  const tbase = tb.sub(0.5).mul(inv).toVar();
  // receiver-plane depth bias: d(depth)/d(uv) along the receiver, from the screen derivatives of the shadow coordinate
  const sdx = dFdx(shadowCoord), sdy = dFdy(shadowCoord);
  const sdet = sdx.x.mul(sdy.y).sub(sdx.y.mul(sdy.x));
  const slope = vec2(sdy.y.mul(sdx.z).sub(sdx.y.mul(sdy.z)), sdx.x.mul(sdy.z).sub(sdy.x.mul(sdx.z))).div(sdet);
  const zSlope = clamp(select(abs(sdet).greaterThan(1e-12), slope, vec2(0)), -2, 2).mul(inv).toVar();
  const tap = (u: Node<'float'>, v: Node<'float'>): Node<'float'> => {
    const o = vec2(u, v);
    const z = shadowCoord.z.add(min(0, dot(o.sub(vec2(ts, tt)), zSlope)));
    return texture(depthTexture, tbase.add(o.mul(inv))).compare(z).x; // a compare sample is a float
  };
  const out = float(1).toVar();
  If(radius.greaterThanEqual(1.5), () => {
    const uw0 = ts.mul(5).sub(6), uw1 = ts.mul(11).sub(28), uw2 = ts.mul(11).add(17).negate(), uw3 = ts.mul(5).add(1).negate();
    const vw0 = tt.mul(5).sub(6), vw1 = tt.mul(11).sub(28), vw2 = tt.mul(11).add(17).negate(), vw3 = tt.mul(5).add(1).negate();
    const u0 = ts.mul(4).sub(5).div(uw0).sub(3), u1 = ts.mul(4).sub(16).div(uw1).sub(1), u2 = ts.mul(7).add(5).negate().div(uw2).add(1), u3 = ts.negate().div(uw3).add(3);
    const v0 = tt.mul(4).sub(5).div(vw0).sub(3), v1 = tt.mul(4).sub(16).div(vw1).sub(1), v2 = tt.mul(7).add(5).negate().div(vw2).add(1), v3 = tt.negate().div(vw3).add(3);
    const us = [[uw0, u0], [uw1, u1], [uw2, u2], [uw3, u3]] as const, vs = [[vw0, v0], [vw1, v1], [vw2, v2], [vw3, v3]] as const;
    let sum: Node<'float'> = float(0);
    for (const [vw, v] of vs) for (const [uw, u] of us) sum = sum.add(uw.mul(vw).mul(tap(u, v)));
    out.assign(sum.div(2704));
  }).ElseIf(radius.greaterThanEqual(1), () => {
    const uw0 = float(4).sub(ts.mul(3)), uw2 = ts.mul(3).add(1), vw0 = float(4).sub(tt.mul(3)), vw2 = tt.mul(3).add(1);
    const u0 = float(3).sub(ts.mul(2)).div(uw0).sub(2), u1 = ts.add(3).div(7), u2 = ts.div(uw2).add(2);
    const v0 = float(3).sub(tt.mul(2)).div(vw0).sub(2), v1 = tt.add(3).div(7), v2 = tt.div(vw2).add(2);
    const us = [[uw0, u0], [float(7), u1], [uw2, u2]] as const, vs = [[vw0, v0], [float(7), v1], [vw2, v2]] as const;
    let sum: Node<'float'> = float(0);
    for (const [vw, v] of vs) for (const [uw, u] of us) sum = sum.add(uw.mul(vw).mul(tap(u, v)));
    out.assign(sum.div(144));
  }).Else(() => {
    const uw0 = float(3).sub(ts.mul(2)), uw1 = ts.mul(2).add(1), vw0 = float(3).sub(tt.mul(2)), vw1 = tt.mul(2).add(1);
    const u0 = float(2).sub(ts).div(uw0).sub(1), u1 = ts.div(uw1).add(1), v0 = float(2).sub(tt).div(vw0).sub(1), v1 = tt.div(vw1).add(1);
    const us = [[uw0, u0], [uw1, u1]] as const, vs = [[vw0, v0], [vw1, v1]] as const;
    let sum: Node<'float'> = float(0);
    for (const [vw, v] of vs) for (const [uw, u] of us) sum = sum.add(uw.mul(vw).mul(tap(u, v)));
    out.assign(sum.div(16));
  });
  return out;
});
