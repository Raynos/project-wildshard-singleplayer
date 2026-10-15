// SHARD-PLATFORM W2 C2 (look-family rows): the Blender cove's materials as graph toon looks (`look.materials`, compiled by
// the runtime with its other looks, runtime/hybrid.ts; world/BlenderIsland.ts wears them). Its numbers are
// data/islandRows.ts; the cover grid it mixes in is data/groundLook.ts `coverMix`.
import type { GraphIr, GraphNode, GraphParam } from '@wildshard/format/materialGraph';
import { coverMix } from './groundLook';

/** the look.materials ids: the terrain tiles, the casters, a single specimen (no per-instance tint), the two cover sets */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props', specimens: 'driftwood-island-specimens',
  cover: 'driftwood-island-cover', coverBig: 'driftwood-island-cover-big',
} as const;

type Nodes = Record<string, GraphNode>;
const INV_PI = 1 / Math.PI;
const lent = (slot: string): GraphParam => ({ type: 'texture', value: slot, role: 'lent' });

/**
 * The baked AO (`ao`, 0‥1) on the colour `base`: all of the fill and `share` of the sun. The surface's occlusion scales
 * only the fill, so the colour takes the sun's share, mix(1, ao, share), and the occlusion the rest, ao / that: the fill
 * sees `base` × ao, the sun `base` × mix(1, ao, share). Writes `lit` (the colour) and `occ`.
 */
const bakedAo = (ao: string, share: number, base: string): Nodes => ({
  direct: { op: 'mix', in: [1, ao, share] }, lit: { op: 'mul', in: [base, 'direct'] }, occ: { op: 'div', in: [ao, 'direct'] },
});

/**
 * The cove's terrain tiles: vertex colours (flat-shaded), the cover grid mixed in (E156), the Cycles sky AO (`ao`, lent:
 * lm-ao on the tiles' lightmap UV; 45 % of it grounds the sun too: contact shade under the palms, the rocks, the pier) and
 * the sun's baked bounce (`bounceMap`, lent: lm-bounce), added as the fill it is (× the colour and the AO) at `bounce`,
 * the live sun's share the runtime sets once a frame (bakedIsland.ts `sunBounceLevel` over the bake's gain).
 */
const terrain: GraphIr = {
  version: 1, kind: 'material', model: 'toon', flatShading: true,
  params: { ao: lent('driftwood-island-ao'), bounceMap: lent('driftwood-island-bounce'), bounce: { type: 'float', value: 0, min: 0 } },
  nodes: {
    paint: { op: 'vertexColour' }, ...coverMix('paint'),
    lmUv: { op: 'uv' }, aoTex: { op: 'texture', param: 'ao', in: ['lmUv'] }, aoR: { op: 'swizzle', in: ['aoTex'], mask: 'x' },
    ...bakedAo('aoR', 0.45, 'covered'),
    bTex: { op: 'texture', param: 'bounceMap', in: ['lmUv'] }, bRgb: { op: 'swizzle', in: ['bTex'], mask: 'xyz' }, bLevel: { op: 'param', param: 'bounce' },
    b0: { op: 'mul', in: ['bRgb', 'bLevel'] }, b1: { op: 'mul', in: ['b0', 'covered'] }, b2: { op: 'mul', in: ['b1', 'aoR'] }, glow: { op: 'mul', in: ['b2', INV_PI] },
  },
  stages: { surface: { colour: 'lit', occlusion: 'occ', emissive: 'glow', roughness: 0.92, metalness: 0 } },
};

/**
 * The cove's props (double-sided, flat-shaded): the vertex colour's alpha is the prototype's Cycles AO (all of the fill,
 * 35 % of the sun: the crown's inner fronds). `tinted`: G144, each placement's tint (`aTint`, per instance) on the colour,
 * min(1, colour × tint) as the merged tiles baked it. `cover`: E156, past its own edge (`aEdge` 0‥1 between `fade`'s near
 * edge and far) a plant is gone (its vertices collapse to a point), and over the `fade.z` m before it it takes on the
 * colour of the ground it stands on (`aGround`, the cover grid's; alpha 0 keeps its own) and the ground's upward shade
 * instead of sinking (Jake: the plants "bouncing like they're being reanimated"); measured from its base (`aBase`), so the
 * whole plant goes at once. `fade` is set per tier by the runtime.
 */
function propsGraph(tinted: boolean, cover: boolean): GraphIr {
  const tint: Nodes = tinted ? { tintIn: { op: 'attribute', name: 'aTint', type: 'float' }, tinted: { op: 'mul', in: ['vc', 'tintIn'] }, own: { op: 'min', in: ['tinted', 1] } } : {};
  const fade: Nodes = cover ? {
    fadeP: { op: 'param', param: 'fade' }, edgeNear: { op: 'swizzle', in: ['fadeP'], mask: 'x' }, edgeFar: { op: 'swizzle', in: ['fadeP'], mask: 'y' }, grow: { op: 'swizzle', in: ['fadeP'], mask: 'z' },
    edgeIn: { op: 'attribute', name: 'aEdge', type: 'float' }, baseIn: { op: 'attribute', name: 'aBase', type: 'vec3' }, groundIn: { op: 'attribute', name: 'aGround', type: 'vec4' },
    edge: { op: 'mix', in: ['edgeNear', 'edgeFar', 'edgeIn'] }, eye: { op: 'cameraPosition' }, toEye: { op: 'sub', in: ['baseIn', 'eye'] }, dist: { op: 'length', in: ['toEye'] },
    fadeFrom: { op: 'sub', in: ['edge', 'grow'] }, farS: { op: 'smoothstep', in: ['fadeFrom', 'edge', 'dist'] }, groundA: { op: 'swizzle', in: ['groundIn'], mask: 'w' },
    farK: { op: 'mul', in: ['farS', 'groundA'] }, far: { op: 'varying', in: ['farK'] },
    groundRgb: { op: 'swizzle', in: ['groundIn'], mask: 'xyz' }, ground: { op: 'varying', in: ['groundRgb'] }, faded: { op: 'mix', in: [tinted ? 'own' : 'vc', 'ground', 'far'] },
    gone: { op: 'step', in: ['edge', 'dist'] }, posL: { op: 'positionLocal' }, collapse: { op: 'negate', in: ['gone'] }, offset: { op: 'mul', in: ['posL', 'collapse'] },
    at: { op: 'positionWorld' }, dx: { op: 'dFdx', in: ['at'] }, dy: { op: 'dFdy', in: ['at'] }, faceX: { op: 'cross', in: ['dx', 'dy'] }, faceN: { op: 'normalize', in: ['faceX'] },
    bent: { op: 'mix', in: ['faceN', [0, 1, 0], 'far'] }, shadeN: { op: 'normalize', in: ['bent'] },
  } : {};
  const base = cover ? 'faded' : tinted ? 'own' : 'vc';
  return {
    version: 1, kind: 'material', model: 'toon', flatShading: true, doubleSided: true,
    ...(cover ? { params: { fade: { type: 'vec3', value: [22, 40, 6] } } } : {}),
    nodes: { vc: { op: 'vertexColour' }, ao: { op: 'vertexColourAlpha' }, ...tint, ...fade, ...bakedAo('ao', 0.35, base) },
    stages: {
      ...(cover ? { 'vertex.offset': { offset: 'offset' } } : {}),
      surface: { colour: 'lit', occlusion: 'occ', roughness: 0.9, metalness: 0, ...(cover ? { normal: 'shadeN' } : {}) },
    },
  };
}

/** The cove's graphs by look.materials id. */
export const ISLAND_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [ISLAND_LOOKS.terrain]: terrain, [ISLAND_LOOKS.props]: propsGraph(true, false), [ISLAND_LOOKS.specimens]: propsGraph(false, false),
  [ISLAND_LOOKS.cover]: propsGraph(true, true), [ISLAND_LOOKS.coverBig]: propsGraph(true, true),
};
