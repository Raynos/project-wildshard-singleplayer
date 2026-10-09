/**
 * three's 5-tap Vogel PCF with the receiver-plane depth bias, as nodes (E435, the shadow acne fix): the node side of
 * `installPlaneBiasShadowFilter` (world/shadowFilter.ts), so graph materials keep the classic materials' penumbra.
 * three's `PCFShadowFilter` (r186) with one change: each tap compares against the receiver's depth moved along its own
 * plane to the tap (the depth slope from the screen derivatives of the shadow coordinate, clamped where the receiver
 * turns edge-on), and only toward the light. EngineNodesHandler gives it to every shadow-casting light without a filter
 * of its own wherever the chunk carries the bias.
 *
 * three's shadow node hands a filter a y-flipped coordinate; the slope and the tap offsets are both taken in that space.
 */
import type * as THREE from 'three';
import type { Node } from 'three/webgpu';
import { Fn, abs, clamp, dFdx, dFdy, dot, float, int, interleavedGradientNoise, min, reference, screenCoordinate, select, texture, vec2, vogelDiskSample } from 'three/tsl';

/** what three's shadow node hands a filter (the index signature: Fn's object-argument overload needs one) */
interface FilterInputs {
  readonly [key: string]: unknown;
  depthTexture: THREE.DepthTexture;
  shadowCoord: Node<'vec3'>;
  shadow: THREE.LightShadow;
}

/** the biased PCF as a node shadow filter (a light's `shadow.filterNode`); EngineNodesHandler assigns it */
export const planeBiasShadowFilter = Fn<FilterInputs, Node<'float'>>(({ depthTexture, shadowCoord, shadow }: FilterInputs): Node<'float'> => {
  const mapSize = reference('mapSize', 'vec2', shadow);
  const radius = reference('radius', 'float', shadow);
  const radiusScaled = radius.div(mapSize.x);
  const phi = interleavedGradientNoise(screenCoordinate.xy).mul(6.28318530718);
  const sdx = dFdx(shadowCoord), sdy = dFdy(shadowCoord);
  const sdet = sdx.x.mul(sdy.y).sub(sdx.y.mul(sdy.x));
  const slope = vec2(sdy.y.mul(sdx.z).sub(sdx.y.mul(sdy.z)), sdx.x.mul(sdy.z).sub(sdy.x.mul(sdx.z))).div(sdet);
  const zSlope = clamp(select(abs(sdet).greaterThan(1e-12), slope, vec2(0)), -2, 2).toVar();
  let sum: Node<'float'> = float(0);
  for (let i = 0; i < 5; i++) {
    const o = vogelDiskSample(int(i), int(5), phi).mul(radiusScaled);
    const z = shadowCoord.z.add(min(0, dot(o, zSlope)));
    sum = sum.add(texture(depthTexture, shadowCoord.xy.add(o)).compare(z).x); // a compare sample is a float
  }
  return sum.mul(0.2);
});
