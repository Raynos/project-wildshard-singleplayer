import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';
import { SKY_PAINTER_GRAPH } from './skyLook';

/**
 * The bridges' looks: the hover deck frame's glow for the rider near it and the rope bridges' painted deck wood (SF59
 * material graphs, the shardfile's `look.materials`), and the textured anchor posts' timber weathered to silver-grey (a
 * shader edit row, applied by world/shapes.ts with `editShader`; `@{weather}` splices how far it is greyed, `WEATHER`).
 */

/**
 * The hover frame's glow (SHARD-PLATFORM G382: an SF59 material graph, `look.materials.hover-frame`): solid cyan lit by its
 * own emissive, full within ~25 m of the camera, a third beyond ~60 m (E399 rounds 6 and 7: the rider's cue near it, still
 * readable from the spawn).
 */
export const HOVER_FRAME_GRAPH = { version: 1, kind: 'material', model: 'standard',
  params: { glow: { type: 'colour', value: [0x9f / 255, 0xe6 / 255, 0xf2 / 255] } },
  nodes: { ...SKY_PAINTER_GRAPH.nodes,
    glow: { op: 'param', param: 'glow' }, wp: { op: 'positionWorld' }, eye: { op: 'cameraPosition' }, rel: { op: 'sub', in: ['wp', 'eye'] },
    far: { op: 'length', in: ['rel'] }, fade: { op: 'smoothstep', in: [25, 60, 'far'] }, keep: { op: 'mix', in: [0.9, 0.27, 'fade'] },
    emissive: { op: 'mul', in: ['glow', 'keep'] },
  },
  stages: { surface: { colour: 'glow', emissive: 'emissive', roughness: 0.4, metalness: 0.2 }, lighting: SKY_PAINTER_GRAPH.lighting } } as const;

type GraphInput = string | number | readonly number[];
interface GraphNodeRow { readonly op: string; readonly in?: readonly GraphInput[]; readonly mask?: string }
const deck: Record<string, GraphNodeRow> = {};
const node = (id: string, op: string, inputs?: readonly GraphInput[], mask?: string): string => {
  deck[id] = { op, ...(inputs === undefined ? {} : { in: inputs }), ...(mask === undefined ? {} : { mask }) };
  return id;
};
/** the sine hash of a vec2 node (the old `farDH`) */
const hash = (id: string, p: string): string => node(`${id}h`, 'fract', [node(`${id}m`, 'mul', [node(`${id}s`, 'sin', [node(`${id}d`, 'dot', [p, [127.1, 311.7]])]), 43758.5453])]);
/** value noise over the hash with a smoothstep blend (the old `farDN`) */
const valueNoise = (id: string, p: string): string => {
  const i = node(`${id}i`, 'floor', [p]), f = node(`${id}f`, 'fract', [p]);
  const u = node(`${id}u`, 'mul', [node(`${id}ff`, 'mul', [f, f]), node(`${id}k`, 'sub', [3, node(`${id}f2`, 'mul', [f, 2])])]);
  const ux = node(`${id}ux`, 'swizzle', [u], 'x'), uy = node(`${id}uy`, 'swizzle', [u], 'y');
  const corner = (c: string, at: readonly number[]): string => hash(`${id}${c}`, node(`${id}${c}p`, 'add', [i, at]));
  const low = node(`${id}lo`, 'mix', [hash(`${id}a`, i), corner('b', [1, 0]), ux]), high = node(`${id}hi`, 'mix', [corner('c', [0, 1]), corner('d', [1, 1]), ux]);
  return node(`${id}n`, 'mix', [low, high, uy]);
};
// the deck's own vertex position (before its instance's transform): x across the deck, z along it
const at = node('at', 'varying', [node('pg', 'positionGeometry')]), qx = node('qx', 'swizzle', [at], 'x'), qy = node('qy', 'swizzle', [at], 'z');
const plank = node('plank', 'floor', [node('pk', 'add', [node('pk6', 'mul', [qy, 6]), 0.5])]);
const grain = node('grain', 'add', [
  node('g1', 'mul', [valueNoise('na', node('pa', 'combine', [node('pax', 'add', [node('pax3', 'mul', [qx, 3]), node('pl7', 'mul', [plank, 7.1])]), node('pay', 'mul', [qy, 90])])), 0.6]),
  node('g2', 'mul', [valueNoise('nb', node('pb', 'combine', [node('pbx', 'mul', [qx, 9]), node('pby', 'add', [node('pby2', 'mul', [qy, 260]), plank])])), 0.4]),
]);
const tone = node('tone', 'add', [0.78, node('tn', 'mul', [hash('t', node('tp', 'combine', [plank, 3.7])), 0.32])]);
const wear = node('wear', 'oneMinus', [node('ws', 'smoothstep', [0.15, 0.9, node('wx', 'div', [node('ax', 'abs', [qx]), 1.3])])]);
const wood = node('wood', 'mul', [node('vc', 'vertexColour'), node('tg', 'mul', [tone, node('gr', 'add', [0.82, node('g3', 'mul', [grain, 0.3])])])]);
const grey = node('grey', 'mul', [node('lum', 'dot', [wood, [0.3, 0.59, 0.11]]), [1.05, 1, 0.94]]);
// weathered grey-brown timber, silvered most down the walked middle (round 14 prep: C's deck read orange, 120/87/58
// over the mockup's grey-brown bridge); 0.6 is how far the planks are greyed
node('colour', 'mix', [wood, grey, node('silver', 'add', [0.6, node('w3', 'mul', [wear, 0.3])])]);

/**
 * The deck's painted wood (E399 round 2; SHARD-PLATFORM G382: an SF59 material graph, `look.materials.deck-wood`): grain
 * along each plank, a tone per plank, silvered wear down the middle, smooth-shaded at roughness 0.9 over the vertex colour.
 */
export const DECK_WOOD_GRAPH = { version: 1, kind: 'material', model: 'standard', nodes: { ...SKY_PAINTER_GRAPH.nodes, ...deck },
  stages: { surface: { colour: 'colour', roughness: 0.9, metalness: 0 }, lighting: SKY_PAINTER_GRAPH.lighting } } as const;

/** The anchor posts' timber greyed to the mockups' silver; the gold hemp and the iron band kept. */
export const POST_WEATHER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.3, 0.59, 0.11));
    float wood = (1.0 - smoothstep(0.32, 0.5, l)) * smoothstep(0.0, 0.04, c.r - c.b);
    diffuseColor.rgb = mix(c, vec3(l) * vec3(1.06, 1.0, 0.92), wood * @{weather}); }` },
];
