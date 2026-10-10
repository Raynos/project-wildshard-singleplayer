// SHARD-PLATFORM SF59 steps 3–4: the material graph IR (validation), its compiler (IR → TSL node material) and the family
// presets. Pixel parity of the presets against the hand-written families is the bench's job (scripts/tsl-spike, the graph
// variants).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConditionalNode, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PhysicalLightingModel, type Node } from 'three/webgpu';
import { DEFAULT_GRAPH_BUDGET, LOOP_MAX, validateGraph, type GraphIr } from '../src/engine/core/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { emissiveGraph, painterlyGraph, pbrMeasureGraph, PRESET_GRAPH_BUDGET, toonGraph } from '../src/engine/render/graph/presets';
import { parseFamilyMaterial, parsePainterlyLook, parseToonLook } from '../src/engine/render/families/params';

const pbr = parseFamilyMaterial({ family: 'pbr', colour: [0.8, 0.8, 0.8], roughness: 0.85, metalness: 0, measure: {} });
if (pbr.family !== 'pbr' || pbr.measure === null) throw new Error('a PBR measure surface');
const preset = pbrMeasureGraph(pbr, pbr.measure);

/** a small valid material graph to break one field at a time */
const base = (): GraphIr => ({
  version: 1, kind: 'material',
  params: { tint: { type: 'colour', value: [1, 0.5, 0.25] }, wet: { type: 'float', value: 0.2, min: 0, max: 1, bind: { state: 'rain' } } },
  nodes: { t: { op: 'param', param: 'tint' }, w: { op: 'param', param: 'wet' }, r: { op: 'oneMinus', in: ['w'] } },
  stages: { surface: { colour: 't', roughness: 'r' } },
});
const refused = (g: unknown, opts = {}): string => { const r = validateGraph(g, opts); if (r.ok) throw new Error('expected a refusal'); return r.errors.join('\n'); };
const withNodes = (nodes: GraphIr['nodes'], surface: NonNullable<GraphIr['stages']['surface']>): GraphIr => ({ ...base(), nodes: { ...base().nodes, ...nodes }, stages: { surface } });

/** every node reachable from a node through its inputs (TSL keeps them as fields) */
function reach(root: unknown): unknown[] {
  const seen = new Set<unknown>(), out: unknown[] = [], stack = [root];
  while (stack.length > 0) {
    const n = stack.pop();
    if (typeof n !== 'object' || n === null || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    for (const k of ['aNode', 'bNode', 'cNode', 'node', 'condNode', 'ifNode', 'elseNode', 'nodes', 'uvNode'] as const) {
      const v: unknown = Reflect.get(n, k);
      if (Array.isArray(v)) { const items: unknown[] = v; stack.push(...items); } else if (v !== undefined) stack.push(v);
    }
  }
  return out;
}

describe('SF59 material graph IR: validation', () => {
  it('admits the PBR + measure preset (labels included) within the preset budget, past the content budget', () => {
    expect(refused(preset)).toMatch(/budget: \d+ nodes/);
    const r = validateGraph(preset, { budget: PRESET_GRAPH_BUDGET });
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.cost.samplers).toBe(0);
    expect(r.cost.nodes).toBeGreaterThan(DEFAULT_GRAPH_BUDGET.nodes);
    expect(r.cost.nodes).toBeLessThanOrEqual(PRESET_GRAPH_BUDGET.nodes);
    expect(r.cost.instructions).toBeLessThanOrEqual(PRESET_GRAPH_BUDGET.instructions);
    expect(r.types.get('out')).toBe('vec3');
    expect(r.types.get('lch')).toBe('float');
    expect(r.types.get('lBarsV')).toBe('vec4');
    expect(r.types.get('hasRole')).toBe('bool');
    expect(r.types.get('c')).toBe('vec2');
  });

  it('refuses unknown nodes, including anything that would carry code', () => {
    expect(refused(withNodes({ x: { op: 'glslFn' } }, { colour: 'x' }))).toMatch(/unknown op glslFn/);
    expect(refused(withNodes({ x: { op: 'code' } }, { colour: 'x' }))).toMatch(/unknown op code/);
    expect(refused(withNodes({}, { colour: 'nope' }))).toMatch(/unknown node nope/);
    expect(refused({ ...base(), nodes: { ...base().nodes, t: { op: 'param', param: 'missing' } } })).toMatch(/unknown param missing/);
    expect(refused({ ...base(), extra: 1 })).toMatch(/unknown field extra/);
    expect(refused({ ...base(), version: 2 })).toMatch(/version 2/);
  });

  it('refuses type mismatches', () => {
    expect(refused(withNodes({ x: { op: 'add', in: [[1, 2], [1, 2, 3]] } }, { colour: 'x' }))).toMatch(/inputs vec2, vec3 do not match/);
    expect(refused(withNodes({ x: { op: 'swizzle', in: [[1, 2]], mask: 'xz' } }, { colour: 'x' }))).toMatch(/reads past a vec2/);
    expect(refused(withNodes({ x: { op: 'select', in: [1, 't', 't'] } }, { colour: 'x' }))).toMatch(/condition is float/);
    expect(refused(withNodes({ x: { op: 'lt', in: ['t', 1] } }, { colour: 't' , alpha: 'x' }))).toMatch(/compares two floats/);
    expect(refused(withNodes({ x: { op: 'combine', in: ['t', 't'] } }, { colour: 'x' }))).toMatch(/6 components/);
    expect(refused(withNodes({}, { colour: [1, 2] }))).toMatch(/is a vec2, wants a vec3/);
    // a float broadcasts: a float colour is a grey
    expect(validateGraph(withNodes({}, { colour: 0.5 })).ok).toBe(true);
  });

  it('refuses cycles, directly and through a loop', () => {
    expect(refused(withNodes({ a: { op: 'add', in: ['b', 1] }, b: { op: 'mul', in: ['a', 2] } }, { roughness: 'a' }))).toMatch(/cycle/);
    expect(refused(withNodes({ a: { op: 'loop', count: 2, in: ['a'], body: { nodes: { k: { op: 'acc' } }, out: 'k' } } }, { roughness: 'a' }))).toMatch(/cycle/);
  });

  it('checks constant-count loops and their bodies', () => {
    const loop = (count: number, out = 'k'): GraphIr => withNodes({
      a: { op: 'loop', count, in: [0], body: { nodes: { i: { op: 'index' }, s: { op: 'sin', in: ['i'] }, k: { op: 'add', in: ['acc', 's'] } }, out } },
    }, { roughness: 'a' });
    // `acc` is an op, not a node id: the body above reads a node named "acc", which does not exist
    expect(refused(loop(4))).toMatch(/unknown node acc/);
    const ok = withNodes({ a: { op: 'loop', count: 4, in: [0], body: { nodes: { acc: { op: 'acc' }, i: { op: 'index' }, s: { op: 'sin', in: ['i'] }, k: { op: 'add', in: ['acc', 's'] } }, out: 'k' } } }, { roughness: 'a' });
    const r = validateGraph(ok);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.cost.nodes).toBeGreaterThanOrEqual(4 * 4); // a body counts once per iteration
    expect(refused({ ...ok, nodes: { ...ok.nodes, a: { ...ok.nodes['a'], op: 'loop', count: LOOP_MAX + 1 } } })).toMatch(/loop count 17/);
    expect(refused({ ...ok, nodes: { ...ok.nodes, a: { ...ok.nodes['a'], op: 'loop', count: 1.5 } } })).toMatch(/loop count 1.5/);
    expect(refused(withNodes({ a: { op: 'loop', count: 2, in: [0], body: { nodes: { k: { op: 'combine', in: [1, 2] } }, out: 'k' } } }, { roughness: 'a' }))).toMatch(/body makes a vec2, the accumulator is a float/);
    expect(refused(withNodes({ a: { op: 'acc' } }, { roughness: 'a' }))).toMatch(/acc outside a loop body/);
  });

  it('refuses over-budget graphs', () => {
    const chain: Record<string, { op: string; in: (string | number)[] }> = {};
    for (let i = 0; i < 200; i++) chain[`n${i}`] = { op: 'add', in: [i === 0 ? 1 : `n${i - 1}`, 1] };
    expect(refused(withNodes(chain, { roughness: 'n199' }))).toMatch(/budget: 2\d\d nodes \(at most 160\)/);
    const noisy = withNodes({ p: { op: 'positionWorld' }, a: { op: 'noise', in: ['p'] } }, { roughness: 'a' });
    expect(refused(noisy, { budget: { nodes: 99, samplers: 4, instructions: 20 } })).toMatch(/instructions \(at most 20\)/);
    const tex: GraphIr = { ...base(), params: { ...base().params, a: { type: 'texture', value: 'a.ktx2' }, b: { type: 'texture', value: 'b.ktx2' } }, nodes: { ...base().nodes, uv: { op: 'uv' }, ta: { op: 'texture', param: 'a', in: ['uv'] }, tb: { op: 'texture', param: 'b', in: ['uv'] }, s: { op: 'add', in: ['ta', 'tb'] }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' } }, stages: { surface: { colour: 'rgb' } } };
    const r = validateGraph(tex);
    expect(r.ok && r.cost.samplers).toBe(2);
    expect(refused(tex, { budget: { ...DEFAULT_GRAPH_BUDGET, samplers: 1 } })).toMatch(/2 samplers \(at most 1\)/);
  });

  it('checks stages, places and bindings', () => {
    expect(refused({ ...base(), stages: { ...base().stages, lighting: {} } })).toMatch(/a lighting model needs sun/);
    expect(refused({ ...base(), nodes: { ...base().nodes, p: { op: 'positionLocal' }, f: { op: 'fwidth', in: ['p'] } }, stages: { ...base().stages, 'vertex.offset': { offset: 'f' } } })).toMatch(/fwidth cannot run in the vertex stage/);
    expect(refused({ ...base(), stages: { ...base().stages, 'vertex.offset': { offset: [0, 1, 0], shadow: true } } })).toMatch(/shadow depth variant/);
    expect(refused(withNodes({ s: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' } }, { colour: 'rgb' }))).toMatch(/sceneColour cannot run in the fragment stage/);
    expect(refused({ ...base(), stages: {} })).toMatch(/needs a surface/);
    expect(refused(base(), { stateFields: ['wind'] })).toMatch(/undeclared state field rain/);
    expect(validateGraph(base(), { stateFields: ['rain'] }).ok).toBe(true);
    expect(refused({ ...base(), params: { ...base().params, wet: { type: 'float', value: 2, max: 1 } } })).toMatch(/value above max/);
    expect(refused({ ...base(), params: { ...base().params, tex: { type: 'texture', value: 'a.ktx2', bind: { day: 'noon' } } } })).toMatch(/texture cannot be bound/);
    const post: GraphIr = { version: 1, kind: 'post', nodes: { s: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' }, g: { op: 'mul', in: ['rgb', 1.1] } }, stages: { post: { colour: 'g' } } };
    const r = validateGraph(post);
    expect(r.ok && r.cost.samplers).toBe(1);
    expect(refused({ ...post, stages: { ...post.stages, surface: { colour: 1 } } })).toMatch(/only a post stage/);
  });
});

describe('SF59 material graph compiler: IR → TSL', () => {
  it('compiles the measure preset to a standard node material with the engine epilogue on, branching only for the label', () => {
    const g = compileGraph(preset, { budget: PRESET_GRAPH_BUDGET });
    expect(g.material).toBeInstanceOf(MeshStandardNodeMaterial);
    expect(g.material.fog).toBe(true);
    if (!(g.material instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    expect(g.material.colorNode).not.toBeNull();
    expect(g.material.emissiveNode).not.toBeNull();
    expect(g.material.roughnessNode).not.toBeNull();
    // the grid's six selects (role colour ×2, floor plane ×2, face vs floor, line alpha) and the label's character picks are
    // cheap and branch-free; the glyph's distance (the '.' / '×' / digit pick, the bar loops, the digit's mask chain) is
    // real branches nested under the label test, so only label pixels run the loops
    expect(g.selects.light).toBeGreaterThan(6);
    expect(g.selects.branch).toBeGreaterThanOrEqual(1);
    expect(reach(g.material.colorNode).some((n) => n instanceof ConditionalNode)).toBe(true);
  });

  it('turns a select with an expensive, exclusive side into a real branch', () => {
    const ir = withNodes({ p: { op: 'positionWorld' }, n: { op: 'noise', in: ['p'] }, up: { op: 'gt', in: ['w', 0.5] }, x: { op: 'select', in: ['up', 'n', 0] } }, { roughness: 'x' });
    const g = compileGraph(ir);
    expect(g.selects).toEqual({ light: 0, branch: 1 });
    if (!(g.material instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    expect(reach(g.material.roughnessNode).some((n) => n instanceof ConditionalNode)).toBe(true);
    // the same side read elsewhere is computed anyway, so the select stays branch-free
    const shared = withNodes({ ...ir.nodes, y: { op: 'add', in: ['x', 'n'] } }, { roughness: 'y' });
    expect(compileGraph(shared).selects).toEqual({ light: 1, branch: 0 });
  });

  it('holds params as uniforms: setParam moves the value, a colour arrives linear', () => {
    const g = compileGraph(base(), { stateFields: ['rain'] });
    expect(g.bindings).toEqual([{ param: 'wet', bind: { state: 'rain' } }]);
    if (!(g.material instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    const uniformsOf = (root: unknown): { value: unknown }[] => reach(root).filter((n): n is { value: unknown } => typeof n === 'object' && n !== null && Reflect.get(n, 'isUniformNode') === true);
    const colour = uniformsOf(g.material.colorNode)[0]?.value;
    expect(colour).toBeInstanceOf(THREE.Color);
    const lin = new THREE.Color().setRGB(1, 0.5, 0.25, THREE.SRGBColorSpace);
    if (!(colour instanceof THREE.Color)) throw new Error('colour');
    expect(colour.g).toBeCloseTo(lin.g, 6);
    g.setParam('tint', [0, 0, 1]);
    expect(colour.b).toBeCloseTo(1, 6);
    const wet = uniformsOf(g.material.roughnessNode)[0];
    g.setParam('wet', 0.9);
    expect(wet?.value).toBe(0.9);
    expect(() => { g.setParam('nope', 1); }).toThrow(/no param nope/);
  });

  it('compiles loops, vertex offsets, unlit and post graphs; refuses what validation refuses', () => {
    const loop = withNodes({ a: { op: 'loop', count: 3, in: [0], body: { nodes: { acc: { op: 'acc' }, i: { op: 'index' }, k: { op: 'add', in: ['acc', 'i'] } }, out: 'k' } }, s: { op: 'mul', in: ['a', 0.1] } }, { roughness: 's' });
    expect(() => compileGraph(loop)).not.toThrow();
    const sway = { ...base(), nodes: { ...base().nodes, h: { op: 'instanceHash' }, tm: { op: 'time' }, ph: { op: 'add', in: ['tm', 'h'] }, sx: { op: 'sin', in: ['ph'] }, off: { op: 'combine', in: ['sx', 0, 0] } }, stages: { ...base().stages, 'vertex.offset': { offset: 'off' } } };
    const s = compileGraph(sway);
    expect(s.material.positionNode).not.toBeNull();
    const unlit = compileGraph({ ...base(), model: 'unlit' });
    expect(unlit.material).toBeInstanceOf(MeshBasicNodeMaterial);
    const post: GraphIr = { version: 1, kind: 'post', nodes: { s: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' } }, stages: { post: { colour: 'rgb' } } };
    expect(() => compileGraph(post)).toThrow(/compile it with \{ scene \}/);
    const p = compileGraph(post, { scene: new THREE.Texture() });
    expect(p.material.fog).toBe(false);
    const vertexNode: Node | null = p.material.vertexNode;
    expect(vertexNode).not.toBeNull();
    expect(() => compileGraph(withNodes({ x: { op: 'glslFn' } }, { colour: 'x' }))).toThrow(/material graph refused:[\s\S]*unknown op glslFn/);
  });
});

describe('SF59 family presets', () => {
  const look = { gain: 1.5, blend: 0 };
  const emissive = (entry: Record<string, unknown>): ReturnType<typeof emissiveGraph> => {
    const p = parseFamilyMaterial({ family: 'emissive', ...entry });
    if (p.family !== 'emissive') throw new Error('an emissive surface');
    return emissiveGraph(p, look);
  };
  const tube = { field: 'field.ktx2', fillSpread: 0.3, skeletonSpread: 0.4 };

  it('re-expresses the emissive surface and tube as unlit graphs within the content budget', () => {
    for (const entry of [{ colour: [1, 0.4, 0.1], intensity: 3, flicker: 4 }, { map: 'lamp.ktx2', vertexColours: true }, { tube, intensity: 4 }, { tube: { ...tube, cell: [0.25, 0.5] } }]) {
      const g = emissive(entry);
      const r = validateGraph(g);
      if (!r.ok) throw new Error(r.errors.join('\n'));
      expect(r.cost.samplers).toBe(('tube' in entry ? 1 : 0) + ('map' in entry ? 1 : 0));
      const c = compileGraph(g, { textures: () => new THREE.Texture() });
      expect(c.material).toBeInstanceOf(MeshBasicNodeMaterial);
      expect(c.material.fog).toBe(true);
      expect(c.bindings).toEqual([]);
      c.setParam('clock', 12.5); // the look's clock moves the flicker as a uniform
    }
    expect(emissive({}).params?.['gain']?.value).toBe(1.5);
  });

  it('refuses the emissive shapes IR version 1 cannot express, naming each', () => {
    expect(() => emissive({ blend: 'additive' })).toThrow(/additive blend/);
    expect(() => emissive({ fog: 0.4 })).toThrow(/fog share of 0.4/);
    expect(() => emissive({ sky: { maps: ['a.ktx2', null] }, fog: 0.5 })).toThrow(/a sky[\s\S]*fog share/);
  });

  it('admits exp and the vertex colour (added for the emissive preset)', () => {
    const g = withNodes({ vc: { op: 'vertexColour' }, e0: { op: 'negate', in: ['w'] }, e: { op: 'exp', in: ['e0'] }, k: { op: 'mul', in: ['vc', 'e'] } }, { colour: 'k' });
    const r = validateGraph(g);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.types.get('vc')).toBe('vec3');
    expect(r.types.get('e')).toBe('float');
    expect(refused(withNodes({ e: { op: 'exp', in: [[1, 2]] }, b: { op: 'gt', in: ['e', 0] } }, { roughness: 'b' }))).toMatch(/compares two floats/);
    expect(() => compileGraph(g)).not.toThrow();
  });
});

describe('SF59 step 6: the lighting stage', () => {
  /** a small lit graph: a two-band sun, a lifted ambient, a grade */
  const lit = (): GraphIr => ({
    ...base(),
    nodes: {
      ...base().nodes,
      n: { op: 'normalView' }, l: { op: 'sunDirection' }, c: { op: 'sunColour' }, sh: { op: 'sunShadow' }, a: { op: 'albedo' },
      ndl: { op: 'dot', in: ['n', 'l'] }, band: { op: 'step', in: [0.2, 'ndl'] }, k: { op: 'mul', in: ['band', 'sh'] }, ca: { op: 'mul', in: ['c', 'a'] }, sun: { op: 'mul', in: ['ca', 'k'] },
      irr: { op: 'irradiance' }, amb0: { op: 'add', in: ['irr', [0.05, 0.02, 0.1]] }, amb: { op: 'mul', in: ['amb0', 'a'] },
      lc: { op: 'litColour' }, graded: { op: 'mul', in: ['lc', 1.1] },
    },
    stages: { surface: { colour: 't', roughness: 'r' }, lighting: { sun: 'sun', sunSpecular: 'band', ambient: 'amb', grade: 'graded' } },
  });

  it('admits a lit graph, typed and costed, the sun sub-graph inside the content budget', () => {
    const r = validateGraph(lit());
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.types.get('sun')).toBe('vec3');
    expect(r.types.get('sh')).toBe('float');
    expect(r.cost.nodes).toBeLessThan(DEFAULT_GRAPH_BUDGET.nodes);
    expect(r.graph.stages.lighting).toEqual({ sun: 'sun', sunSpecular: 'band', ambient: 'amb', grade: 'graded' });
  });

  it('keeps the light inputs to their places and the stage to standard materials', () => {
    const g = lit();
    expect(refused({ ...g, stages: { ...g.stages, surface: { colour: 'sun' } } })).toMatch(/sunDirection cannot run in the fragment stage/);
    expect(refused({ ...g, stages: { ...g.stages, lighting: { sun: 'amb' } } })).toMatch(/irradiance cannot run in the sun stage/);
    expect(refused({ ...g, stages: { ...g.stages, lighting: { sun: 'sun', ambient: 'graded' } } })).toMatch(/litColour cannot run in the ambient stage/);
    expect(refused({ ...g, stages: { ...g.stages, lighting: { sun: 'sun', grade: 'sun' } } })).toMatch(/cannot run in the grade stage/);
    expect(refused({ ...g, model: 'unlit' })).toMatch(/unlit graph has no lighting model/);
    expect(refused({ ...g, stages: { ...g.stages, lighting: { sun: 'sun', shade: 'sun' } } })).toMatch(/unknown output shade/);
    expect(refused({ ...g, stages: { ...g.stages, lighting: { sun: 'sun', sunSpecular: 'sun' } } })).toMatch(/sunSpecular: is a vec3, wants a float/);
    expect(refused({ version: 1, kind: 'post', nodes: { s: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' } }, stages: { post: { colour: 'rgb' }, lighting: { sun: 1 } } })).toMatch(/only a post stage/);
    expect(refused({ ...g, flatShading: 1 })).toMatch(/flatShading is not a boolean/);
    // the light-free ops still run there: noise over the world position in the sun sub-graph
    const noisy = { ...g, nodes: { ...g.nodes, p: { op: 'positionWorld' }, nz: { op: 'noise', in: ['p'] }, sunN: { op: 'mul', in: ['sun', 'nz'] } }, stages: { ...g.stages, lighting: { sun: 'sunN' } } };
    expect(validateGraph(noisy).ok).toBe(true);
  });

  it('compiles to a standard node material whose lighting model is the graph model; the grade turns tone mapping off', () => {
    const c = compileGraph({ ...lit(), flatShading: true });
    expect(c.material).toBeInstanceOf(MeshStandardNodeMaterial);
    if (!(c.material instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    const model = c.material.setupLightingModel();
    expect(model).toBeInstanceOf(PhysicalLightingModel);
    expect(model.constructor.name).not.toBe('PhysicalLightingModel');
    expect(c.material.toneMapped).toBe(false);
    expect(c.material.flatShading).toBe(true);
    expect(c.material.fog).toBe(true);
    const plain = compileGraph(base());
    if (!(plain.material instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    expect(plain.material.setupLightingModel().constructor.name).toBe('PhysicalLightingModel');
    expect(plain.material.toneMapped).toBe(true);
  });
  it('keeps the lighting stage and grade through clone() (the viewmodel clones a held model\'s material; G169 pastel plain)', () => {
    const c = compileGraph(lit());
    const copy = c.material.clone();
    if (!(copy instanceof MeshStandardNodeMaterial)) throw new Error('standard');
    expect(copy.constructor).toBe(c.material.constructor);
    expect(Reflect.get(copy, 'hooks')).toBe(Reflect.get(c.material, 'hooks'));
    expect(Reflect.get(Reflect.get(copy, 'hooks'), 'grade')).not.toBeNull();
    expect(copy.setupLightingModel().constructor.name).not.toBe('PhysicalLightingModel');
  });
});

describe('SF59 step 6: the toon and painterly presets', () => {
  const toon = parseFamilyMaterial({ family: 'toon', colour: [0.85, 0.6, 0.4] });
  const paint = parseFamilyMaterial({ family: 'painterly', colour: [0.5, 0.7, 0.3] });
  if (toon.family !== 'toon' || paint.family !== 'painterly') throw new Error('surfaces');

  it('re-expresses both families through the lighting stage within the preset budget and compiles them', () => {
    for (const [name, g] of [['toon', toonGraph(toon, parseToonLook({}))], ['painterly', painterlyGraph(paint, parsePainterlyLook({}))], ['painterly ungraded', painterlyGraph(paint, parsePainterlyLook({ grade: null }))]] as const) {
      const r = validateGraph(g, { budget: PRESET_GRAPH_BUDGET });
      if (!r.ok) throw new Error(`${name}: ${r.errors.join('\n')}`);
      expect(r.cost.nodes).toBeLessThanOrEqual(PRESET_GRAPH_BUDGET.nodes);
      const c = compileGraph(g, { budget: PRESET_GRAPH_BUDGET });
      expect(c.material).toBeInstanceOf(MeshStandardNodeMaterial);
      expect(c.material.toneMapped).toBe(name !== 'painterly');
    }
    const t = toonGraph(toon, parseToonLook({}));
    expect(t.flatShading).toBe(true);
    expect(t.stages.lighting?.sunSpecular).toBe('sunSpec');
    expect(painterlyGraph(paint, parsePainterlyLook({})).stages.lighting?.sunSpecular).toBeUndefined();
  });

  it('ports the toon caustics, the faceted rim and the painterly sway (SF59 step 7) within the preset budget', () => {
    const plainToon = toonGraph(toon, parseToonLook({}));
    expect(plainToon.params?.['water']).toBeUndefined();
    expect(plainToon.nodes['nW']).toEqual({ op: 'viewToWorld', in: ['nV'] });
    const wet = toonGraph(toon, parseToonLook({ caustics: { level: 1.5, strength: 0.5 } }));
    expect(wet.params?.['water']).toEqual({ type: 'vec2', value: [1.5, 0.5] });
    const sway = painterlyGraph({ ...paint, sway: 0.1 }, parsePainterlyLook({}));
    expect(sway.stages['vertex.offset']).toEqual({ offset: 'swayOffset' });
    expect(painterlyGraph(paint, parsePainterlyLook({})).stages['vertex.offset']).toBeUndefined();
    for (const g of [wet, sway]) {
      const r = validateGraph(g, { budget: PRESET_GRAPH_BUDGET });
      if (!r.ok) throw new Error(r.errors.join('\n'));
      const c = compileGraph(g, { budget: PRESET_GRAPH_BUDGET });
      expect(c.material).toBeInstanceOf(MeshStandardNodeMaterial);
    }
    // the caustics sit behind a select whose costly side (two noises) compiles to a real branch when the sun sub-graph
    // builds (at the first render: the bench's programs show it), so only pixels under the water pay
    expect(wet.nodes['caustics']).toEqual({ op: 'select', in: ['under', 'kV', 0] });
    expect(compileGraph(sway, { budget: PRESET_GRAPH_BUDGET }).material.positionNode).not.toBeNull();
  });
});

describe('SF59 step 7: object inputs, the outline stage and the cascade cost', () => {
  it('keeps the object inputs and space changes to their places and types', () => {
    const v = (nodes: GraphIr['nodes'], offset: string): GraphIr => ({ ...base(), nodes: { ...base().nodes, ...nodes }, stages: { surface: { colour: 't' }, 'vertex.offset': { offset } } });
    const ok = v({ o: { op: 'objectOrigin' }, g: { op: 'positionGeometry' }, w: { op: 'worldToLocal', in: ['o'] }, s: { op: 'add', in: ['w', 'g'] } }, 's');
    expect(validateGraph(ok).ok).toBe(true);
    expect(() => compileGraph(ok)).not.toThrow();
    expect(refused(withNodes({ o: { op: 'objectOrigin' } }, { colour: 'o' }))).toMatch(/objectOrigin cannot run in the fragment stage/);
    expect(refused(withNodes({ n: { op: 'normalWorld' }, w: { op: 'worldToLocal', in: ['n'] } }, { colour: 'w' }))).toMatch(/worldToLocal cannot run in the fragment stage/);
    expect(refused(withNodes({ w: { op: 'viewToWorld', in: [[0, 1]] } }, { colour: 'w' }))).toMatch(/viewToWorld takes a vec3/);
    const rim = withNodes({ n: { op: 'normalWorld' }, w: { op: 'viewToWorld', in: ['n'] } }, { colour: 'w' });
    expect(validateGraph(rim).ok).toBe(true);
  });

  const inked = (): GraphIr => ({
    ...base(),
    params: { ...base().params, ink: { type: 'colour', value: [0.05, 0.05, 0.08] }, width: { type: 'float', value: 0.002, min: 0, max: 0.05 } },
    nodes: {
      ...base().nodes, ink: { op: 'param', param: 'ink' }, width: { op: 'param', param: 'width' },
      nl: { op: 'normalLocal' }, p: { op: 'positionWorld' }, cam: { op: 'cameraPosition' }, d0: { op: 'sub', in: ['p', 'cam'] },
      d: { op: 'length', in: ['d0'] }, w: { op: 'mul', in: ['d', 'width'] }, off: { op: 'mul', in: ['nl', 'w'] },
    },
    stages: { surface: { colour: 't', roughness: 'r' }, outline: { offset: 'off', colour: 'ink' } },
  });

  it('admits an outline stage, counts it apart, refuses a free render state and compiles a back-face second draw', () => {
    const r = validateGraph(inked());
    if (!r.ok) throw new Error(r.errors.join('\n'));
    const without = validateGraph(base());
    if (!without.ok) throw new Error('base');
    expect(r.cost.nodes).toBeGreaterThan(without.cost.nodes);
    expect(r.graph.stages.outline).toEqual({ offset: 'off', colour: 'ink' });
    const g = inked();
    expect(refused({ ...g, stages: { ...g.stages, outline: { offset: 'off', colour: 'ink', side: 'front' } } })).toMatch(/unknown field side/);
    expect(refused({ ...g, stages: { ...g.stages, outline: { offset: 'off' } } })).toMatch(/an outline is \{ offset, colour \}/);
    expect(refused({ ...g, nodes: { ...g.nodes, a: { op: 'albedo' } }, stages: { ...g.stages, outline: { offset: 'off', colour: 'a' } } })).toMatch(/albedo cannot run in the outline stage/);
    expect(refused({ ...g, nodes: { ...g.nodes, f: { op: 'fwidth', in: ['w'] }, o2: { op: 'mul', in: ['nl', 'f'] } }, stages: { ...g.stages, outline: { offset: 'o2', colour: 'ink' } } })).toMatch(/fwidth cannot run in the outlineVertex stage/);
    expect(refused({ version: 1, kind: 'post', nodes: { s: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' } }, stages: { post: { colour: 'rgb' }, outline: { offset: [0, 0, 0], colour: 'rgb' } } })).toMatch(/only a post stage/);
    const c = compileGraph(g);
    expect(c.outline).toBeInstanceOf(MeshBasicNodeMaterial);
    expect(c.outline?.side).toBe(THREE.BackSide);
    expect(c.outline?.fog).toBe(true);
    expect(c.outline?.positionNode).not.toBeNull();
    expect(compileGraph(base()).outline).toBeNull();
  });

  it('counts the light-dependent sun nodes once per cascade and the light-free ones once', () => {
    const g: GraphIr = {
      ...base(), model: 'standard',
      nodes: {
        ...base().nodes, l: { op: 'sunDirection' }, n: { op: 'normalView' }, ndl: { op: 'dot', in: ['n', 'l'] },
        p: { op: 'positionWorld' }, nz: { op: 'noise', in: ['p'] }, k: { op: 'mul', in: ['ndl', 'nz'] }, sun: { op: 'combine', in: ['k', 'k', 'k'] },
      },
      stages: { surface: { colour: 't' }, lighting: { sun: 'sun' } },
    };
    const cost = (cascades: number): number => { const r = validateGraph(g, { cascades }); if (!r.ok) throw new Error(r.errors.join('\n')); return r.cost.instructions; };
    // dependent: dot 2 + mul 1 + combine 0 (the input itself costs 0); the noise (40) and positionWorld (1) are light-free
    expect(cost(3) - cost(1)).toBe(2 * 3);
    expect(cost(4) - cost(1)).toBe(3 * 3);
    expect(validateGraph(g).ok && validateGraph(g, { cascades: 3 }).ok).toBe(true);
    const def = validateGraph(g), three = validateGraph(g, { cascades: 3 });
    expect(def.ok && three.ok && def.cost.instructions === three.cost.instructions).toBe(true);
    expect(refused(g, { cascades: 0 })).toMatch(/cascades 0/);
    expect(refused(g, { cascades: 5 })).toMatch(/cascades 5/);
  });
});

describe('SF59 step 6: G169 stress cases (the bench fixtures)', () => {
  it('admits the pastel alien plain and the ink / cel valley within the content budget and compiles both', async () => {
    const { inkGraph, opsOf, pastelGraph } = await import('../scripts/tsl-spike/stress.js');
    for (const g of [pastelGraph(), inkGraph()]) {
      const r = validateGraph(g);
      if (!r.ok) throw new Error(r.errors.join('\n'));
      expect(r.cost.nodes).toBeLessThanOrEqual(DEFAULT_GRAPH_BUDGET.nodes);
      expect(() => compileGraph(g)).not.toThrow();
      expect(opsOf(g)).toContain('sunShadow');
    }
  });
});

describe('SF59 node programs: each program keeps its own build\'s uniforms (G169 pastel plain, Graph materials on)', () => {
  /** a classic renderer stand-in with what the node handler and its builder read; `target` is the bound render target */
  function fakeRenderer(bound: { target: THREE.WebGLRenderTarget | null }, props: WeakMap<object, object>): THREE.WebGLRenderer {
    const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
    if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
    const fields: Record<string, unknown> = {
      extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => bound.target,
      toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
      coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } }, debug: { checkShaderErrors: true, diagnostics: { keywords: false } },
      properties: { get: (o: object) => { const p = props.get(o) ?? {}; props.set(o, p); return p; }, has: (o: object) => props.has(o) },
    };
    for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
    return renderer;
  }
  const isParameters = (v: object): v is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(v);
  /** what `build` leaves in the parameters: the build's uniforms by name */
  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const uniformsOf = (p: object): Record<string, unknown> => {
    const u: unknown = Reflect.get(p, 'uniforms');
    if (!isRecord(u)) throw new Error('no uniforms');
    return u;
  };
  /** a program as the renderer's WebGLProgram shows it: its active uniforms (here every uniform its build declared) */
  const programOf = (uniforms: Record<string, unknown>): object => ({ getUniforms: () => ({ seq: Object.keys(uniforms).map((id) => ({ id })) }) });
  const idsOf = (list: unknown): unknown[] => (Array.isArray(list) ? list.map((u: unknown): unknown => (isRecord(u) ? u['id'] : null)) : []);

  it('pairs a precompiled program with its own build, not the material\'s latest (the precompile builds for the target and the screen first)', async () => {
    const priorBitmap = Object.getOwnPropertyDescriptor(globalThis, 'ImageBitmap');
    Object.defineProperty(globalThis, 'ImageBitmap', { configurable: true, writable: true, value: class { readonly width = 0; } }); // TextureNode.update reads it
    try {
      const { EngineNodesHandler } = await import('../src/engine/render/nodes/engineNodesHandler');
      const bound: { target: THREE.WebGLRenderTarget | null } = { target: new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }) };
      const handler = new EngineNodesHandler();
      const props = new WeakMap<object, object>();
      handler.setRenderer(fakeRenderer(bound, props));
      const map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
      const g = compileGraph({
        version: 1, kind: 'material',
        params: { tint: { type: 'colour', value: [1, 0.5, 0.25] }, map: { type: 'texture', value: 'm.png' }, k: { type: 'float', value: 0.5 } },
        nodes: { t: { op: 'param', param: 'tint' }, u: { op: 'uv' }, s: { op: 'texture', param: 'map', in: ['u'] }, rgb: { op: 'swizzle', in: ['s'], mask: 'xyz' }, kk: { op: 'param', param: 'k' }, c: { op: 'mul', in: ['rgb', 'kk'] }, f: { op: 'add', in: ['c', 't'] } },
        stages: { surface: { colour: 'f' } },
      }, { textures: () => map });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), g.material);
      handler.renderStart(new THREE.Scene(), new THREE.PerspectiveCamera());
      handler.updateLights([]);
      // the precompile: one build into the half-float target (no tone mapping), one to the screen (tone mapped), each
      // followed by the renderer acquiring a program under a new key, and no program switch in between
      const programs = new Map<string, object>();
      const properties: { programs: Map<string, object>; uniforms: Record<string, unknown>; uniformsList: unknown } = { programs, uniforms: {}, uniformsList: null };
      props.set(g.material, properties);
      const intoTarget: object = {};
      if (!isParameters(intoTarget)) throw new Error('parameters');
      handler.build(g.material, mesh, intoTarget);
      const a = uniformsOf(intoTarget), programA = programOf(a);
      programs.set('target', programA);
      bound.target = null;
      const toScreen: object = {};
      if (!isParameters(toScreen)) throw new Error('parameters');
      handler.build(g.material, mesh, toScreen);
      const b = uniformsOf(toScreen), programB = programOf(b);
      programs.set('screen', programB);
      expect(Object.keys(a).sort()).not.toEqual(Object.keys(b).sort()); // the two builds name their uniforms differently
      properties.uniforms = b; // the renderer keeps the latest build's uniforms
      // the first draw goes into the target: its program must read the target build's uniforms, every active one found
      handler.onUpdateProgram(g.material, programA, properties);
      expect(properties.uniforms).toBe(a);
      expect(idsOf(properties.uniformsList)).toEqual(Object.keys(a));
      handler.onUpdateProgram(g.material, programB, properties);
      expect(properties.uniforms).toBe(b);
      expect(idsOf(properties.uniformsList)).toEqual(Object.keys(b));
      handler.onUpdateProgram(g.material, programA, properties);
      expect(properties.uniforms).toBe(a);
    } finally {
      if (priorBitmap === undefined) Reflect.deleteProperty(globalThis, 'ImageBitmap');
      else Object.defineProperty(globalThis, 'ImageBitmap', priorBitmap);
    }
  });
});

describe('SF59 node uniform blocks: bound per draw, never out of binding points (G169 ink valley, Graph materials on)', () => {
  it('lays a block out by std140 and binds any number of programs\' blocks to the same few top points, writing only changes', async () => {
    const { NodeUniformBuffers, std140Layout } = await import('../src/engine/render/nodes/nodeUniformBuffers');
    const f = { value: 0.5 }, c = { value: new THREE.Color(1, 0, 0) }, v2 = { value: new THREE.Vector2(1, 2) }, m = { value: new THREE.Matrix4() }, m3 = { value: new THREE.Matrix3() };
    const layout = std140Layout({ name: 'object', uniforms: [f, c, v2, m3, m] });
    expect(layout.slots.map((s) => s.offset)).toEqual([0, 16, 32, 48, 96]); // vec3 on 16; vec2 after it on 8; mat3 as 3×vec4; mat4
    expect(layout.size).toBe(160);
    const calls: string[] = [];
    let buffers = 0;
    const gl = {
      MAX_UNIFORM_BUFFER_BINDINGS: 0x8a2f as const, UNIFORM_BUFFER: 0x8a11 as const, DYNAMIC_DRAW: 0x88e8 as const, INVALID_INDEX: 0xffffffff as const,
      getParameter: (p: number): unknown => (p === 0x8a2f ? 24 : null),
      createBuffer: (): WebGLBuffer => { buffers++; return {}; },
      deleteBuffer: (): void => { buffers--; },
      bindBuffer: (): void => undefined,
      bufferData: (_t: number, _d: unknown, _u: number): void => undefined,
      bufferSubData: (_t: number, offset: number, _d: unknown): void => { calls.push(`write ${offset}`); },
      bindBufferBase: (_t: number, point: number): void => { calls.push(`point ${point}`); },
      getUniformBlockIndex: (_p: WebGLProgram, name: string): number => ['object', 'render', 'frame'].indexOf(name),
      uniformBlockBinding: (_p: WebGLProgram, index: number, point: number): void => { calls.push(`block ${index}->${point}`); },
    };
    const blocks = new NodeUniformBuffers(gl);
    // forty programs of three groups each: 120 blocks on a context with 24 binding points
    const programs = Array.from({ length: 40 }, () => ({ program: {}, groups: ['object', 'render', 'frame'].map((name) => ({ name, uniforms: [{ value: 1 }, { value: new THREE.Vector3() }] })) }));
    for (const p of programs) blocks.bind(p.program, p.groups);
    const points = new Set(calls.filter((x) => x.startsWith('point')).map((x) => Number(x.split(' ')[1])));
    expect([...points].sort((x, y) => x - y)).toEqual([21, 22, 23]);
    expect(buffers).toBe(120);
    // a second draw of an unchanged program writes nothing and re-points nothing in its program; a change writes one value
    const first = programs[0];
    if (first === undefined) throw new Error('programs');
    calls.length = 0;
    blocks.bind(first.program, first.groups);
    expect(calls.filter((x) => !x.startsWith('point'))).toEqual([]);
    const moved = first.groups[1]?.uniforms[0];
    if (moved === undefined) throw new Error('uniform');
    moved.value = 2;
    calls.length = 0;
    blocks.bind(first.program, first.groups);
    expect(calls.filter((x) => x.startsWith('write'))).toEqual(['write 0']);
    for (const g of first.groups) blocks.release(g);
    expect(buffers).toBe(117);
  });
});
