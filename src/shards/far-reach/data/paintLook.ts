import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';
import { skyMapGraph } from '../look/mapGraph';

/**
 * Sky Reach's smaller paint corrections, each pulling a generated model's paint toward the mockups: SF59 material graphs
 * over the model's own map (the shardfile's `look.materials`, bound by world/looks.ts `skyMappedLook` in world/crown.ts,
 * world/bookStand.ts, quest/keeper.ts, world/trees.ts, weapons/fanModel.ts; one program per graph, a material per map), and shader edit rows
 * (applied with `editShader` in runtime/index.ts): a creature wears the Roc's.
 */

const LUMA = [0.2126, 0.7152, 0.0722];

/** The crown dais's paint (it came out red-brown) toward mockup D's weathered grey stone with a warm cast. */
export const CROWN_DAIS_GRAPH = skyMapGraph({ l: { op: 'dot', in: ['c', LUMA] }, grey: { op: 'mul', in: ['l', [1.06, 1, 0.92]] }, colour: { op: 'mix', in: ['grey', 'c', 0.3] } }, { colour: 'colour' });

/** The lantern's warm glass: the paint's bright amber texels burn (emissive); the iron and brass stay as painted. */
export const LANTERN_GLOW_GRAPH = skyMapGraph({ a1: { op: 'smoothstep', in: [0.45, 0.75, 'cr'] }, rb: { op: 'sub', in: ['cr', 'cb'] }, a2: { op: 'smoothstep', in: [0.3, 0.6, 'rb'] },
  amber: { op: 'mul', in: ['a1', 'a2'] }, warm: { op: 'mul', in: ['c', [1.6, 1.15, 0.7]] }, glow: { op: 'mul', in: ['warm', 'amber'] } }, { colour: 'c', emissive: 'glow' });

/** The trees' bark (the paint's came out magenta-red) toward a warm grey-brown; the foliage kept. */
export const TREE_BARK_GRAPH = skyMapGraph({ rg: { op: 'sub', in: ['cr', 'cg'] }, b1: { op: 'smoothstep', in: [0, 0.06, 'rg'] }, g8: { op: 'mul', in: ['cg', 0.8] }, bg: { op: 'sub', in: ['cb', 'g8'] },
  b2: { op: 'smoothstep', in: [-0.02, 0.04, 'bg'] }, b3: { op: 'mul', in: ['b1', 'b2'] }, bark: { op: 'mul', in: ['b3', 0.85] }, l: { op: 'dot', in: ['c', LUMA] },
  brown: { op: 'mul', in: ['l', [1.35, 1, 0.72]] }, colour: { op: 'mix', in: ['c', 'brown', 'bark'] } }, { colour: 'colour' });

/** The keeper's scarf and sash a warm rust-brown, not a loud red: strongly red texels pulled toward brown. */
export const KEEPER_SCARF_GRAPH = skyMapGraph({ gb: { op: 'max', in: ['cg', 'cb'] }, gb1: { op: 'mul', in: ['gb', 1.1] }, rd: { op: 'sub', in: ['cr', 'gb1'] }, r1: { op: 'smoothstep', in: [0.08, 0.25, 'rd'] },
  red: { op: 'mul', in: ['r1', 0.8] }, rust: { op: 'mul', in: ['cr', [0.72, 0.42, 0.24]] }, colour: { op: 'mix', in: ['c', 'rust', 'red'] } }, { colour: 'colour' });

/** The war fan's painted silk (`look.materials['fan-silk']`, over the leaf map; weapons/fanModel.ts `paintFanLeaf`): the leaf in
 *  its pale sea-green tint, toward the mockups' muted, lighter teal (E399 round 6: 80 % of its saturation kept, lifted 2.6x and
 *  tinted toward blue, measured against the mockups' leaf where blue >= green), then the pleats' vertex shade; faintly
 *  self-lit, two-sided. */
export const FAN_SILK_GRAPH = { ...skyMapGraph({ tint: { op: 'param', param: 'tint' }, glow: { op: 'param', param: 'glow' }, vc: { op: 'vertexColour' },
  t: { op: 'mul', in: ['c', 'tint'] }, l: { op: 'dot', in: ['t', LUMA] }, s: { op: 'mix', in: ['l', 't', 0.8] }, lift: { op: 'mul', in: ['s', [0.94 * 2.6, 2.6, 1.16 * 2.6]] },
  colour: { op: 'mul', in: ['lift', 'vc'] } }, { colour: 'colour', emissive: 'glow', roughness: 0.8 }),
  params: { tint: { type: 'colour', value: [0xdf / 255, 0xec / 255, 0xe6 / 255] }, glow: { type: 'colour', value: [0x04 / 255, 0x12 / 255, 0x12 / 255] } }, doubleSided: true } as const;

/** The Roc's plumage to mockup D's slate / white split (E399, E410): its browns slate grey in the paint and in the emission fed back from it; the white head and belly and the gold beak and talons kept. */
export const ROC_SLATE_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <map_fragment>', put: '#include <map_fragment>\n  diffuseColor.rgb = farSlate(diffuseColor.rgb);' },
  { stage: 'fragment', find: '#include <emissivemap_fragment>', put: '#include <emissivemap_fragment>\n  totalEmissiveRadiance = farSlate(totalEmissiveRadiance);' },
  { stage: 'fragment', find: '', put: 'vec3 farSlate(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float gold = (1.0 - smoothstep(0.06, 0.12, c.b / max(c.r, 1e-3))) * smoothstep(0.2, 0.3, c.r); float brown = clamp((c.r - c.b) / max(c.r, 1e-3) * 1.6 - 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.55, 0.75, c.g / max(c.r, 1e-3))) * (1.0 - gold); return mix(c, vec3(0.085, 0.09, 0.11) + vec3(l) * vec3(0.82, 0.9, 1.05) * 1.1, brown * 0.95); }\n' },
];
