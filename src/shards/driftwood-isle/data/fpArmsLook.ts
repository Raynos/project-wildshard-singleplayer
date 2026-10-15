// SHARD-PLATFORM M3 (look-family rows): Driftwood's castaway arms (E334, Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke") as a toon-arms row (runtime/viewmodel/toonArms.ts); fpArms.ts passes it. The arms wear the
// graph toon look (FP_ARMS_GRAPHS, the shardfile's look.materials, compiled by the kit hook: runtime/index.ts).
import type { GraphIr } from '@wildshard/format/materialGraph';

/** the look.materials ids the arms, the two swords and the swimming arms wear */
export const FP_ARMS_MATERIALS = { arms: 'driftwood-fp-arms', wood: 'driftwood-fp-wood', iron: 'driftwood-fp-iron', swim: 'driftwood-fp-swim' } as const;

export const FP_ARMS_LOOK = {
  url: '/assets/models/driftwood-fp/fp-arms.glb',
  skeleton: 'driftwood-fp',
  sockets: ['R_weapon', 'L_hand'],
  // bake.mjs keeps Nine Dragon's round-13 skeleton and adds 15 finger bones a hand
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'], fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'], phalanges: 3 },
  // the framing: the castaway board (2 A) has the fist a little in from the frame's right edge and low, the blade's tip
  // below-right of the crosshair (E129's height); on the screen the pair smaller than Nine Dragon's rest
  offset: [-0.03, -0.012, 0],
  frame: { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 },
  // Jake's look review (2026-09-30): the body shadow must not shade the arms; they look their shadow up 1.2 m toward the light
  sunward: 1.2,
  // the blade's base (weapon-local m) when the rig's meta has none
  bladeBase: 0.012,
  // the swim water line's tip toward the eye (Jake's review 2026-09-30: "the sleeves above the water while swimming"),
  // about the hands' depth (the stroke's wrists run −0.43 … −0.62)
  swim: { tilt: 1.1, handsZ: -0.5, waterY: -0.16, startD: -0.16 },
  materials: FP_ARMS_MATERIALS,
} as const;

// charm III's glow (E314: "a soft glow + halo — the blade keeps its own colour with an aqua edge"): sea-glass aqua
const GLOW = 0x5fe6d8;
// the swords' blades as arms.py models them (weapon-local): the half-width at the guard end and its taper per metre
const BLADES = { wood: { halfW: 0.040, taper: 0.009 / 0.52 }, iron: { halfW: 0.026, taper: 0.006 / 0.56 } } as const;
/** the toon roughness (arms, wooden sword), the iron sword's and its metalness (× the GLB's per-vertex `aMetal`) */
const ROUGH = 0.85, METAL_ROUGH = 0.6, METAL = 0.6;

type Nodes = GraphIr['nodes'];
const srgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/**
 * A blade's glow: charm III lights its edges aqua (`rim`, the held sword's glow level). The GLB's positions are
 * quantized: `bladeDq` (the sword mesh's node scale, y) restores weapon-local metres, |x| across and y along the blade,
 * which take the glow from `bladeBase` (+3 cm) and toward the edge (70–100 % of the tapering half-width).
 */
function bladeNodes(blade: { readonly halfW: number; readonly taper: number }): Nodes {
  return {
    pg: { op: 'positionGeometry' }, dqP: { op: 'param', param: 'bladeDq' }, dqS: { op: 'swizzle', in: ['dqP'], mask: 'x' }, dqY: { op: 'swizzle', in: ['dqP'], mask: 'y' },
    pgX: { op: 'swizzle', in: ['pg'], mask: 'x' }, pgY: { op: 'swizzle', in: ['pg'], mask: 'y' },
    bx0: { op: 'mul', in: ['pgX', 'dqS'] }, bx: { op: 'abs', in: ['bx0'] }, by0: { op: 'mul', in: ['pgY', 'dqS'] }, by: { op: 'add', in: ['by0', 'dqY'] },
    bladeAt: { op: 'combine', in: ['bx', 'by'] }, blade: { op: 'varying', in: ['bladeAt'] },
    bX: { op: 'swizzle', in: ['blade'], mask: 'x' }, bY: { op: 'swizzle', in: ['blade'], mask: 'y' },
    baseP: { op: 'param', param: 'bladeBase' }, baseEnd: { op: 'add', in: ['baseP', 0.03] }, onBlade: { op: 'smoothstep', in: ['baseP', 'baseEnd', 'bY'] },
    along: { op: 'sub', in: ['bY', 'baseP'] }, narrow: { op: 'mul', in: ['along', blade.taper] }, hw0: { op: 'sub', in: [blade.halfW, 'narrow'] }, halfW: { op: 'max', in: ['hw0', 0.003] },
    across: { op: 'div', in: ['bX', 'halfW'] }, edge: { op: 'smoothstep', in: [0.7, 1, 'across'] },
    rimP: { op: 'param', param: 'rim' }, aqua: { op: 'param', param: 'aqua' },
    g0: { op: 'mul', in: ['rimP', 'onBlade'] }, g1: { op: 'mul', in: ['g0', 1.3] }, g2: { op: 'mul', in: ['g1', 'edge'] }, glow: { op: 'mul', in: ['aqua', 'g2'] },
  };
}

/** a held material: the toon look on the vertex paint, flat facets, its cast-shadow lookup `sunward` (m toward the light,
 *  world space: the trusted runtime moves it with the light) so the invisible body never shades the arms */
function heldGraph(kind: 'arms' | 'wood' | 'iron'): GraphIr {
  const blade = kind === 'arms' ? null : BLADES[kind];
  return { version: 1, kind: 'material', model: 'toon', flatShading: true,
    params: {
      sunward: { type: 'vec3', value: [0, FP_ARMS_LOOK.sunward, 0] },
      ...(blade === null ? {} : { rim: { type: 'float', value: 0, min: 0 }, aqua: { type: 'colour', value: srgb(GLOW) }, bladeDq: { type: 'vec2', value: [1, 0] }, bladeBase: { type: 'float', value: FP_ARMS_LOOK.bladeBase } }),
    },
    nodes: {
      paint: { op: 'vertexColour' }, sunwardP: { op: 'param', param: 'sunward' },
      ...(kind === 'iron' ? { metalIn: { op: 'attribute', name: 'aMetal', type: 'float' }, metal: { op: 'mul', in: ['metalIn', METAL] } } : {}),
      ...(blade === null ? {} : bladeNodes(blade)),
    },
    stages: {
      'shadow.offset': { offset: 'sunwardP' },
      surface: { colour: 'paint', roughness: kind === 'iron' ? METAL_ROUGH : ROUGH, metalness: kind === 'iron' ? 'metal' : 0, ...(blade === null ? {} : { emissive: 'glow' }) },
    },
  };
}

/**
 * The swimming arms: under a view-space water plane (`waterN` · p = `waterD`, the trusted runtime moves it with the
 * stroke and the camera) the paint takes the sea's tint, deepening 1.6 a metre under to 40 %; a thin foam band
 * (2–11 mm) rides the line.
 */
function swimGraph(): GraphIr {
  return { version: 1, kind: 'material', model: 'toon', flatShading: true,
    params: { waterN: { type: 'vec3', value: [0, 1, 0] }, waterD: { type: 'float', value: FP_ARMS_LOOK.swim.startD } },
    nodes: {
      paint: { op: 'vertexColour' }, at: { op: 'positionView' }, nP: { op: 'param', param: 'waterN' }, dP: { op: 'param', param: 'waterD' },
      h0: { op: 'dot', in: ['nP', 'at'] }, h: { op: 'sub', in: ['h0', 'dP'] },
      above: { op: 'smoothstep', in: [-0.003, 0.003, 'h'] }, under: { op: 'oneMinus', in: ['above'] },
      down: { op: 'mul', in: ['h', -1.6] }, deep: { op: 'clamp', in: ['down', 0, 0.4] }, keep: { op: 'oneMinus', in: ['deep'] },
      tint: { op: 'mul', in: ['paint', [0.38, 0.78, 0.86]] }, sea: { op: 'mul', in: ['tint', 'keep'] },
      wet: { op: 'mul', in: ['under', 0.9] }, colour: { op: 'mix', in: ['paint', 'sea', 'wet'] },
      lineD: { op: 'abs', in: ['h'] }, off: { op: 'smoothstep', in: [0.002, 0.011, 'lineD'] }, on: { op: 'oneMinus', in: ['off'] },
      foam: { op: 'mul', in: [[0.62, 0.74, 0.78], 'on'] },
    },
    stages: { surface: { colour: 'colour', roughness: ROUGH, metalness: 0, emissive: 'foam' } },
  };
}

/** The arms' graphs by look.materials id. */
export const FP_ARMS_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [FP_ARMS_MATERIALS.arms]: heldGraph('arms'), [FP_ARMS_MATERIALS.wood]: heldGraph('wood'),
  [FP_ARMS_MATERIALS.iron]: heldGraph('iron'), [FP_ARMS_MATERIALS.swim]: swimGraph(),
};
