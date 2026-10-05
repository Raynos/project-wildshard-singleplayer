// SHARD-PLATFORM SF59 steps 3–4: the material graph IR (validation), its compiler (IR → TSL node material) and the family
// presets. Pixel parity of the presets against the hand-written families is the bench's job (scripts/tsl-spike, the graph
// variants).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConditionalNode, MeshBasicNodeMaterial, MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import { DEFAULT_GRAPH_BUDGET, LOOP_MAX, validateGraph, type GraphIr } from '../src/engine/core/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { emissiveGraph, pbrMeasureGraph, PRESET_GRAPH_BUDGET } from '../src/engine/render/graph/presets';
import { parseFamilyMaterial } from '../src/engine/render/families/params';

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
    expect(refused({ ...base(), stages: { ...base().stages, lighting: {} } })).toMatch(/lighting-model stage is not in IR version 1/);
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
