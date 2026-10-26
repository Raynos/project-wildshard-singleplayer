import type { FnNode, ProxiedObject } from 'three/src/nodes/tsl/TSLCore.js';
/**
 * The engine's shadow filter as nodes (SHARD-PLATFORM SF59 step 2, fix 3; sf59-tsl-spike.md §2.2): Castaño's optimised
 * PCF tent (shadowFilter.ts, E138), the same taps, weights and receiver-plane depth bias, for graph materials. three's node
 * shadows use their own 5-tap Vogel PCF; EngineNodesHandler gives this filter to every shadow-casting light (the light's
 * `shadow.filterNode`, which only node materials read) wherever the engine installed the tent, so node and family
 * materials share one penumbra. A light picks its tent by `shadow.radius` as the chunk does: ≥ 1.5 is 7×7, ≥ 1 is 5×5,
 * below that 3×3. The pick is made as the program builds, from the light's radius then (the sky rig sets every cascade's
 * and ghost's radius before anything compiles, and a new rig is new lights, so new programs): each light's program
 * carries only its own tent (16, 9 or 4 taps), not all three behind a runtime branch.
 *
 * Each tent is one GLSL function (`wsTent7`, `wsTent5`, `wsTent3`) that a light's shadow calls, not its taps as nodes: as
 * nodes, a Driftwood graph build processed ~2,500 tent nodes for its five shadows (three cascades, two fade ghosts), half
 * of its CPU time (G743 / G717: one stock node build is one slow phone frame), and its program held a flip uniform for
 * every tap. The function is the node tent's own expressions in their order, so it draws the same.
 *
 * three's shadow node hands the filter a coordinate whose y is flipped (WebGPU convention) and the shadow depth sample
 * flips it back (shadowDepthSample.ts: always, for a depth map); the texel grid is symmetric under the flip and the tent
 * is symmetric, so the result is the chunk's.
 */
import type * as THREE from 'three';
import { TempNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import { Fn, glsl, nodeObject, reference } from 'three/tsl';
import { shadowDepthSample } from './shadowDepthSample';

/** what three's shadow node hands a filter (the index signature: Fn's object-argument overload needs one) */
interface FilterInputs {
  readonly [key: string]: unknown;
  depthTexture: THREE.DepthTexture;
  shadowCoord: Node<'vec3'>;
  shadow: THREE.LightShadow;
}

type TentSize = 3 | 5 | 7;
/** a tent's per-axis weights and offsets as GLSL of the axis fraction `t` (offset i reads weight `w<i>`), as the node
 *  tent wrote them, and the sum's divisor */
interface TentAxis { readonly weights: (t: string) => string[]; readonly offsets: (t: string) => string[]; readonly divisor: string }
const AXES: Record<TentSize, TentAxis> = {
  7: {
    weights: (t) => [`( ( ${t} * 5.0 ) - 6.0 )`, `( ( ${t} * 11.0 ) - 28.0 )`, `( - ( ( ${t} * 11.0 ) + 17.0 ) )`, `( - ( ( ${t} * 5.0 ) + 1.0 ) )`],
    offsets: (t) => [`( ( ( ( ${t} * 4.0 ) - 5.0 ) / w0 ) - 3.0 )`, `( ( ( ( ${t} * 4.0 ) - 16.0 ) / w1 ) - 1.0 )`,
      `( ( ( - ( ( ${t} * 7.0 ) + 5.0 ) ) / w2 ) + 1.0 )`, `( ( ( - ${t} ) / w3 ) + 3.0 )`],
    divisor: '2704.0',
  },
  5: {
    weights: (t) => [`( 4.0 - ( ${t} * 3.0 ) )`, '7.0', `( ( ${t} * 3.0 ) + 1.0 )`],
    offsets: (t) => [`( ( ( 3.0 - ( ${t} * 2.0 ) ) / w0 ) - 2.0 )`, `( ( ${t} + 3.0 ) / 7.0 )`, `( ( ${t} / w2 ) + 2.0 )`],
    divisor: '144.0',
  },
  3: {
    weights: (t) => [`( 3.0 - ( ${t} * 2.0 ) )`, `( ( ${t} * 2.0 ) + 1.0 )`],
    offsets: (t) => [`( ( ( 2.0 - ${t} ) / w0 ) - 1.0 )`, `( ( ${t} / w1 ) + 1.0 )`],
    divisor: '16.0',
  },
};

/** one tent's GLSL function: the receiver-plane slope, then every tap (row by row) weighted into the sum */
export function tentSource(size: TentSize): string {
  const axis = AXES[size], body: string[] = [];
  for (const [prefix, t] of [['u', 'ts'], ['v', 'tt']] as const) {
    axis.weights(t).forEach((w, i) => { body.push(`\tfloat ${prefix}w${String(i)} = ${w};`); });
    axis.offsets(t).forEach((o, i) => { body.push(`\tfloat ${prefix}${String(i)} = ${o.replaceAll(/\bw(\d)/gu, `${prefix}w$1`)};`); });
  }
  const n = axis.weights('').length;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const o = `vec2( u${String(i)}, v${String(j)} )`, p = `p${String(j * n + i)}`;
    body.push(`\tvec2 ${p} = ( tbase + ( ${o} * inv ) );`,
      `\tsum = ( sum + ( ( uw${String(i)} * vw${String(j)} ) * texture( map, vec3( vec2( ${p}.x, 1.0 - ${p}.y ), ( c.z + min( 0.0, dot( ( ${o} - vec2( ts, tt ) ), zSlope ) ) ) ) ) ) );`);
  }
  return [
    `float wsTent${String(size)}( sampler2DShadow map, vec2 mapSize, vec3 c ) {`,
    '\tvec2 tuv = ( c.xy * mapSize );',
    '\tvec2 tb = floor( ( tuv + vec2( 0.5 ) ) );',
    '\tfloat ts = ( ( tuv.x + 0.5 ) - tb.x );',
    '\tfloat tt = ( ( tuv.y + 0.5 ) - tb.y );',
    '\tvec2 inv = ( vec2( 1.0, 1.0 ) / mapSize );',
    '\tvec2 tbase = ( ( tb - vec2( 0.5 ) ) * inv );',
    '\tvec3 sdx = dFdx( c );',
    '\tvec3 sdy = dFdy( c );',
    '\tfloat sdet = ( ( sdx.x * sdy.y ) - ( sdx.y * sdy.x ) );',
    '\tvec2 slope = vec2( 0.0, 0.0 );',
    '\tif ( ( abs( sdet ) > 1e-12 ) ) {',
    '\t\tslope = ( vec2( ( ( sdy.y * sdx.z ) - ( sdx.y * sdy.z ) ), ( ( sdx.x * sdy.z ) - ( sdy.x * sdx.z ) ) ) / vec2( sdet ) );',
    '\t}',
    '\tvec2 zSlope = ( clamp( slope, vec2( -2.0 ), vec2( 2.0 ) ) * inv );',
    '\tfloat sum = 0.0;',
    ...body,
    `\treturn ( sum / ${axis.divisor} );`,
    '}',
  ].join('\n');
}

/** each tent's function, declared once in a program that calls it */
const TENTS: Record<TentSize, Node> = { 7: glsl(tentSource(7)), 5: glsl(tentSource(5)), 3: glsl(tentSource(3)) };

/** a node's generated snippet (a build in the generate stage returns its code) */
function snippet(node: Node, builder: NodeBuilder, output: string): string {
  const code = node.build(builder, output);
  if (typeof code !== 'string') throw new Error('tentShadowFilter: an input generated no code');
  return code;
}

/** a call of one tent's function with the shadow map (a compare sampler), its size and the shadow coordinate */
class TentShadowNode extends TempNode<'float'> {
  private readonly map: TextureNode;
  private readonly mapSize: Node<'vec2'>;
  private readonly coord: Node<'vec3'>;
  private readonly size: TentSize;

  constructor(map: TextureNode, mapSize: Node<'vec2'>, coord: Node<'vec3'>, size: TentSize) {
    super('float');
    this.map = map; this.mapSize = mapSize; this.coord = coord; this.size = size;
  }

  override generate(builder: NodeBuilder): string {
    TENTS[this.size].build(builder);
    const map = snippet(this.map, builder, 'property'), mapSize = snippet(this.mapSize, builder, 'vec2');
    return `wsTent${String(this.size)}( ${map}, ${mapSize}, ${snippet(this.coord, builder, 'vec3')} )`;
  }
}

/** the tent as a node shadow filter (a light's `shadow.filterNode`); EngineNodesHandler assigns it */
export const tentShadowFilter: FnNode<[ProxiedObject<FilterInputs>], Node<'float'>> = Fn<FilterInputs, Node<'float'>>(({ depthTexture, shadowCoord, shadow }: FilterInputs): Node<'float'> => {
  const size: TentSize = shadow.radius >= 1.5 ? 7 : shadow.radius >= 1 ? 5 : 3;
  // a compare sample, so the program declares the map as a shadow sampler; the call generates only its uniform
  const map = shadowDepthSample(depthTexture, shadowCoord.xy).compare(shadowCoord.z);
  return nodeObject(new TentShadowNode(map, reference('mapSize', 'vec2', shadow), shadowCoord, size));
});
