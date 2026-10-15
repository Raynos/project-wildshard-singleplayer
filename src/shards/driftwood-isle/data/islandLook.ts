// SHARD-PLATFORM W2 C2 (look-family rows): the Blender cove's materials as graph toon looks (`look.materials`, compiled by
// the runtime with its other looks, runtime/hybrid.ts; world/BlenderIsland.ts wears them). Its numbers are
// data/islandRows.ts; the cover grid it mixes in is data/groundLook.ts `coverMix`.
import type { GraphIr, GraphNode, GraphParam } from '@wildshard/format/materialGraph';
import { coverMix } from './groundLook';

/** the look.materials ids: the terrain tiles, the casters (and the Explorer's specimens), the two cover sets */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props',
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
 * 35 % of the sun: the crown's inner fronds). Each copy's tint (G144) is the engine's per-copy colour (the copies are
 * placed instanced, world/BlenderIsland.ts), which three multiplies into the surface colour. `cover`: E156, past its own
 * edge (0‥1 between `fade`'s near edge and far, a hash of where it stands) a plant is gone (its vertices collapse to a
 * point), and over the `fade.z` m before it it takes on the colour of the ground it stands on (`groundMap`, lent: the
 * cover grid, premultiplied by its cover, sampled at the plant's origin through `groundRect`, uv = xz × zw + xy, and
 * jittered as the terrain's facets are; no cover there keeps its own colour) and the ground's upward shade instead of
 * sinking (Jake: the plants "bouncing like they're being reanimated"); measured from its origin, so the whole plant goes
 * at once. `fade` and `groundRect` are set by the runtime.
 */
function propsGraph(cover: boolean): GraphIr {
  const fade: Nodes = cover ? {
    fadeP: { op: 'param', param: 'fade' }, edgeNear: { op: 'swizzle', in: ['fadeP'], mask: 'x' }, edgeFar: { op: 'swizzle', in: ['fadeP'], mask: 'y' }, grow: { op: 'swizzle', in: ['fadeP'], mask: 'z' },
    org: { op: 'objectOrigin' }, ox: { op: 'swizzle', in: ['org'], mask: 'x' }, oz: { op: 'swizzle', in: ['org'], mask: 'z' },
    hx: { op: 'mul', in: ['ox', 12.9898] }, hz: { op: 'mul', in: ['oz', 78.233] }, hs: { op: 'add', in: ['hx', 'hz'] }, hsin: { op: 'sin', in: ['hs'] },
    hbig: { op: 'mul', in: ['hsin', 43758.5453] }, hash: { op: 'fract', in: ['hbig'] },
    edge: { op: 'mix', in: ['edgeNear', 'edgeFar', 'hash'] }, eye: { op: 'cameraPosition' }, toEye: { op: 'sub', in: ['org', 'eye'] }, dist: { op: 'length', in: ['toEye'] },
    fadeFrom: { op: 'sub', in: ['edge', 'grow'] }, farS: { op: 'smoothstep', in: ['fadeFrom', 'edge', 'dist'] }, farV: { op: 'varying', in: ['farS'] },
    jit0: { op: 'mul', in: ['hash', 0.24] }, jit: { op: 'add', in: ['jit0', 0.88] }, jitV: { op: 'varying', in: ['jit'] },
    rect: { op: 'param', param: 'groundRect' }, rOff: { op: 'swizzle', in: ['rect'], mask: 'xy' }, rScale: { op: 'swizzle', in: ['rect'], mask: 'zw' },
    oxz: { op: 'swizzle', in: ['org'], mask: 'xz' }, uv0: { op: 'mul', in: ['oxz', 'rScale'] }, uv1: { op: 'add', in: ['uv0', 'rOff'] }, gUv: { op: 'varying', in: ['uv1'] },
    gTex: { op: 'texture', param: 'groundMap', in: ['gUv'] }, gA: { op: 'swizzle', in: ['gTex'], mask: 'w' }, gRgb: { op: 'swizzle', in: ['gTex'], mask: 'xyz' },
    gK: { op: 'max', in: ['gA', 0.00001] }, gMean: { op: 'div', in: ['gRgb', 'gK'] }, ground: { op: 'mul', in: ['gMean', 'jitV'] },
    groundOn: { op: 'step', in: [0.01, 'gA'] }, far: { op: 'mul', in: ['farV', 'groundOn'] }, faded: { op: 'mix', in: ['vc', 'ground', 'far'] },
    gone: { op: 'step', in: ['edge', 'dist'] }, posL: { op: 'positionLocal' }, collapse: { op: 'negate', in: ['gone'] }, offset: { op: 'mul', in: ['posL', 'collapse'] },
    at: { op: 'positionWorld' }, dx: { op: 'dFdx', in: ['at'] }, dy: { op: 'dFdy', in: ['at'] }, faceX: { op: 'cross', in: ['dx', 'dy'] }, faceN: { op: 'normalize', in: ['faceX'] },
    bent: { op: 'mix', in: ['faceN', [0, 1, 0], 'far'] }, shadeN: { op: 'normalize', in: ['bent'] },
  } : {};
  return {
    version: 1, kind: 'material', model: 'toon', flatShading: true, doubleSided: true,
    ...(cover ? { params: { fade: { type: 'vec3', value: [22, 40, 6] }, groundRect: { type: 'vec4', value: [0, 0, 0, 0] }, groundMap: lent('driftwood-island-ground') } } : {}),
    nodes: { vc: { op: 'vertexColour' }, ao: { op: 'vertexColourAlpha' }, ...fade, ...bakedAo('ao', 0.35, cover ? 'faded' : 'vc') },
    stages: {
      ...(cover ? { 'vertex.offset': { offset: 'offset' } } : {}),
      surface: { colour: 'lit', occlusion: 'occ', roughness: 0.9, metalness: 0, ...(cover ? { normal: 'shadeN' } : {}) },
    },
  };
}

/** The cove's graphs by look.materials id. */
export const ISLAND_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [ISLAND_LOOKS.terrain]: terrain, [ISLAND_LOOKS.props]: propsGraph(false),
  [ISLAND_LOOKS.cover]: propsGraph(true), [ISLAND_LOOKS.coverBig]: propsGraph(true),
};
