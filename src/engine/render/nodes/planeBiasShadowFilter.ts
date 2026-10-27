import type { FnNode, ProxiedObject } from 'three/src/nodes/tsl/TSLCore.js';
/**
 * three's 5-tap Vogel PCF with the receiver-plane depth bias, as nodes (E435, the shadow acne fix): the node side of
 * `installPlaneBiasShadowFilter` (world/shadowFilter.ts), so graph materials keep the classic materials' penumbra.
 * three's `PCFShadowFilter` (r186) with one change: each tap compares against the receiver's depth moved along its own
 * plane to the tap (the depth slope from the screen derivatives of the shadow coordinate, clamped where the receiver
 * turns edge-on), and only toward the light. EngineNodesHandler gives it to every shadow-casting light without a filter
 * of its own wherever the chunk carries the bias.
 *
 * It is one GLSL function (`wsPlaneBiasPcf`, shadowFunction.ts) a light's shadow calls, not its taps as nodes (G743 /
 * G717, per-build CPU): the node filter's own expressions in their order, with three's `interleavedGradientNoise` and
 * `vogelDiskSample` (r186) as the program wrote them. The screen coordinate it hashes is the builder's (`screenCoordinate`,
 * flipped to the WebGPU convention), handed in.
 *
 * three's shadow node hands a filter a y-flipped coordinate; the slope and the tap offsets are both taken in that space,
 * and each tap's sample flips it back (a shadow depth map's fixed orientation, as shadowDepthSample.ts samples it).
 */
import type * as THREE from 'three';
import type { Node } from 'three/webgpu';
import { Fn, glsl, reference, screenCoordinate } from 'three/tsl';
import { shadowFunctionCall } from './shadowFunction';

/** what three's shadow node hands a filter (the index signature: Fn's object-argument overload needs one) */
interface FilterInputs {
  readonly [key: string]: unknown;
  depthTexture: THREE.DepthTexture;
  shadowCoord: Node<'vec3'>;
  shadow: THREE.LightShadow;
}

const TAPS = 5;
/** the filter's GLSL: three's two helpers under the engine's names, then the receiver-plane slope and the five taps */
export function planeBiasSource(): string {
  const taps: string[] = [];
  for (let i = 0; i < TAPS; i++) {
    const o = `o${String(i)}`, p = `p${String(i)}`;
    taps.push(`\tvec2 ${o} = ( wsVogelDiskSample( ${String(i)}, ${String(TAPS)}, phi ) * vec2( radiusScaled ) );`, `\tvec2 ${p} = ( c.xy + ${o} );`,
      `\tsum = ( sum + texture( map, vec3( vec2( ${p}.x, 1.0 - ${p}.y ), ( c.z + min( 0.0, dot( ${o}, zSlope ) ) ) ) ) );`);
  }
  return [
    'float wsInterleavedGradientNoise( vec2 position ) {',
    '\treturn fract( ( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) ) );',
    '}',
    'vec2 wsVogelDiskSample( int sampleIndex, int samplesCount, float phi ) {',
    '\tfloat angle = ( ( float( sampleIndex ) * 2.399963229728653 ) + phi );',
    '\treturn ( vec2( cos( angle ), sin( angle ) ) * vec2( sqrt( ( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) ) ) ) );',
    '}',
    'float wsPlaneBiasPcf( sampler2DShadow map, vec3 c, vec2 screen, float radius, vec2 mapSize ) {',
    '\tvec3 sdx = dFdx( c );',
    '\tvec3 sdy = dFdy( c );',
    '\tfloat sdet = ( ( sdx.x * sdy.y ) - ( sdx.y * sdy.x ) );',
    '\tvec2 slope = vec2( 0.0, 0.0 );',
    '\tif ( ( abs( sdet ) > 1e-12 ) ) {',
    '\t\tslope = ( vec2( ( ( sdy.y * sdx.z ) - ( sdx.y * sdy.z ) ), ( ( sdx.x * sdy.z ) - ( sdy.x * sdx.z ) ) ) / vec2( sdet ) );',
    '\t}',
    '\tvec2 zSlope = clamp( slope, vec2( -2.0 ), vec2( 2.0 ) );',
    '\tfloat phi = ( wsInterleavedGradientNoise( screen ) * 6.28318530718 );',
    '\tfloat radiusScaled = ( radius / mapSize.x );',
    '\tfloat sum = 0.0;',
    ...taps,
    '\treturn ( sum * 0.2 );',
    '}',
  ].join('\n');
}

/** the filter's functions, declared once in a program that calls it */
const PLANE_BIAS = glsl(planeBiasSource());

/** the biased PCF as a node shadow filter (a light's `shadow.filterNode`); EngineNodesHandler assigns it */
export const planeBiasShadowFilter: FnNode<[ProxiedObject<FilterInputs>], Node<'float'>> = Fn<FilterInputs, Node<'float'>>(({ depthTexture, shadowCoord, shadow }: FilterInputs): Node<'float'> =>
  shadowFunctionCall(PLANE_BIAS, 'wsPlaneBiasPcf', depthTexture, shadowCoord, [[shadowCoord, 'vec3'], [screenCoordinate.xy, 'vec2'],
    [reference('radius', 'float', shadow), 'float'], [reference('mapSize', 'vec2', shadow), 'vec2']]));
