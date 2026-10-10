// SF59 (2b) and step 4: the post inputs (sceneColourAt taps, sceneDepth, sceneNormal; each one sampler) and a shard's own
// post stack (`look.post`) admitted with budget v1: at most 4 passes and 1,000 instructions per pixel at 2×, the normal
// pre-pass costed once, a blended pair summed.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules } from '@wildshard/game/shardfile/schema';
import { validateGraph, type GraphIr, type GraphNode } from '../src/engine/core/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { NO_POST, POST_NORMAL_PREPASS_COST, POST_STACK_BUDGET, postPairRefusal, postStackCost } from '../src/game/shardfile/postStack';

/** a 3 × 3 colour edge (Laplacian) over sceneColourAt taps, optionally a depth fade and a normal crease */
function edge(opts: { depth?: boolean; normal?: boolean; taps?: number; grain?: number } = {}): GraphIr {
  const nodes: Record<string, GraphNode> = { uv: { op: 'screenUV' }, px: { op: 'param', param: 'texel' }, c: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['c'], mask: 'xyz' } };
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].slice(0, opts.taps ?? 4);
  let sum = 'rgb';
  offsets.forEach(([x, y], i) => {
    nodes[`o${i}`] = { op: 'mul', in: ['px', [x ?? 0, y ?? 0]] }; nodes[`u${i}`] = { op: 'add', in: ['uv', `o${i}`] };
    nodes[`t${i}`] = { op: 'sceneColourAt', in: [`u${i}`] }; nodes[`r${i}`] = { op: 'swizzle', in: [`t${i}`], mask: 'xyz' };
    nodes[`s${i}`] = { op: 'sub', in: [sum, `r${i}`] }; sum = `s${i}`;
  });
  nodes['e'] = { op: 'length', in: [sum] }; nodes['k'] = { op: 'step', in: [0.2, 'e'] };
  let ink = 'k';
  if (opts.depth === true) { nodes['d'] = { op: 'sceneDepth' }; nodes['df'] = { op: 'smoothstep', in: [200, 20, 'd'] }; nodes['kd'] = { op: 'mul', in: [ink, 'df'] }; ink = 'kd'; }
  if (opts.normal === true) { nodes['n'] = { op: 'sceneNormal' }; nodes['nz'] = { op: 'swizzle', in: ['n'], mask: 'z' }; nodes['crease'] = { op: 'step', in: ['nz', 0.3] }; nodes['kn'] = { op: 'max', in: [ink, 'crease'] }; ink = 'kn'; }
  for (let i = 0; i < (opts.grain ?? 0); i++) { nodes[`g${i}`] = { op: 'noise', in: ['uv'] }; nodes[`gk${i}`] = { op: 'max', in: [ink, `g${i}`] }; ink = `gk${i}`; }
  nodes['inv'] = { op: 'oneMinus', in: [ink] }; nodes['out'] = { op: 'mul', in: ['rgb', 'inv'] };
  return { version: 1, kind: 'post', params: { texel: { type: 'vec2', value: [1 / 804, 1 / 1428] } }, nodes, stages: { post: { colour: 'out' } } };
}

it('counts each scene input as one sampler however many taps read it, and names the inputs a pass reads', () => {
  const colour = validateGraph(edge({ taps: 8 }));
  if (!colour.ok) throw new Error(colour.errors.join('; '));
  expect(colour.cost.samplers).toBe(1);
  expect(colour.inputs).toEqual({ colour: true, depth: false, normal: false });
  const all = validateGraph(edge({ depth: true, normal: true }));
  if (!all.ok) throw new Error(all.errors.join('; '));
  expect(all.cost.samplers).toBe(3);
  expect(all.inputs).toEqual({ colour: true, depth: true, normal: true });
  // more taps cost more instructions, never another sampler
  const four = validateGraph(edge({ taps: 4 }));
  if (!four.ok) throw new Error('four taps');
  expect(colour.cost.instructions).toBeGreaterThan(four.cost.instructions);
});

it.each([
  [{ version: 1, kind: 'material', nodes: { d: { op: 'sceneDepth' }, c: { op: 'combine', in: ['d', 'd', 'd'] } }, stages: { surface: { colour: 'c' } } }, 'cannot run in the fragment stage'],
  [{ version: 1, kind: 'post', nodes: { t: { op: 'sceneColourAt', in: [0.5] }, c: { op: 'swizzle', in: ['t'], mask: 'xyz' } }, stages: { post: { colour: 'c' } } }, 'samples at a vec2'],
  [{ version: 1, kind: 'post', nodes: { t: { op: 'sceneColourAt' }, c: { op: 'swizzle', in: ['t'], mask: 'xyz' } }, stages: { post: { colour: 'c' } } }, 'takes 1 inputs'],
])('refuses a scene input out of place or mistyped: %o', (graph, reason) => {
  const checked = validateGraph(graph);
  expect(checked.ok).toBe(false);
  if (!checked.ok) expect(checked.errors.join('; ')).toContain(reason);
});

it('compiles depth, normal and tap inputs into a full-screen pass, each needing its target', () => {
  const scene = new THREE.Texture(), depth = new THREE.DepthTexture(4, 4), normal = new THREE.Texture();
  const compiled = compileGraph(edge({ depth: true, normal: true }), { scene, depth: { texture: depth, near: 0.1, far: 800 }, normal });
  expect(compiled.material).toBeInstanceOf(MeshBasicNodeMaterial);
  expect(compiled.cost.samplers).toBe(3);
  expect(() => { compiled.setDepthRange(0.2, 1200); }).not.toThrow();
  expect(() => compileGraph(edge({ depth: true }), { scene })).toThrow('compile it with { depth }');
  expect(() => compileGraph(edge({ normal: true }), { scene, depth: { texture: depth, near: 0.1, far: 800 } })).toThrow('compile it with { normal }');
});

const FILE = 'd'.repeat(64);
const fileRow = (hash: string) => ({ hash, kind: 'json', compressed: 1, decoded: 1, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
function product(post: unknown, files: ReturnType<typeof fileRow>[] = [], library: string[] = []) {
  const base = emptyShardfile({ slug: 'post-stack', name: 'Post stack', author: 'Local', seed: 1, revision: 1 });
  return { ...base, files, library, look: { ...base.look, ...(post === undefined ? {} : { post }) } };
}

it('admits a shard post stack and costs it per pixel, the normal pre-pass once', () => {
  const source = parseShardfile(product([{ graph: edge({ normal: true }) }, { graph: edge({ taps: 2, normal: true }) }]));
  expect(shardfileRules(source)).toEqual([]);
  const { cost, errors } = postStackCost(source, () => undefined);
  expect(errors).toEqual([]);
  const a = validateGraph(edge({ normal: true })), b = validateGraph(edge({ taps: 2, normal: true }));
  if (!a.ok || !b.ok) throw new Error('passes');
  expect(cost).toEqual({ passes: 2, instructions: a.cost.instructions + b.cost.instructions + POST_NORMAL_PREPASS_COST, inputs: { colour: true, depth: false, normal: true } });
  // an absent stack stays absent (no default written into older products)
  expect('post' in parseShardfile(product(undefined)).look).toBe(false);
});

it('refuses a material as a pass, a fifth pass and a stack past the per-pixel budget', () => {
  const material = { version: 1, kind: 'material', nodes: { c: { op: 'const', value: [1, 0, 0] } }, stages: { surface: { colour: 'c' } } };
  expect(() => parseShardfile(product([{ graph: material }]))).toThrow();
  expect(() => parseShardfile(product(Array.from({ length: POST_STACK_BUDGET.passes + 1 }, () => ({ graph: edge() }))))).toThrow();
  // four 8-tap passes with a normal crease and film grain: each within the author caps, the stack past 1,000
  const heavy = Array.from({ length: 4 }, () => ({ graph: edge({ taps: 8, depth: true, normal: true, grain: 5 }) }));
  expect(heavy.every((pass) => validateGraph(pass.graph).ok)).toBe(true);
  expect(() => parseShardfile(product(heavy))).toThrow('semantic');
  const one = parseShardfile(product([{ graph: edge({ taps: 8, depth: true, normal: true, grain: 5 }) }]));
  expect(shardfileRules({ ...one, look: { ...one.look, post: heavy.map((pass) => ({ graph: validGraph(pass.graph) })) } }).join('; ')).toContain('instructions per pixel at 2×');
});

function validGraph(graph: GraphIr): GraphIr { const checked = validateGraph(graph); if (!checked.ok) throw new Error(checked.errors.join('; ')); return checked.graph; }

it('admits a graph-file pass only as a library JSON file, costed with its bytes', () => {
  expect(() => parseShardfile(product([{ file: FILE }], [fileRow(FILE)], [FILE]))).not.toThrow();
  expect(() => parseShardfile(product([{ file: FILE }], [{ ...fileRow(FILE), kind: 'binary' }], [FILE]))).toThrow('semantic');
  const source = parseShardfile(product([{ file: FILE }], [fileRow(FILE)], [FILE]));
  const bytes = new TextEncoder().encode(JSON.stringify(edge({ depth: true })));
  expect(postStackCost(source, () => bytes).cost.inputs).toEqual({ colour: true, depth: true, normal: false });
  expect(postStackCost(source, () => undefined).errors.join('; ')).toContain('is not an admitted file');
});

it('sums a blended pair against the budget, a shared normal pre-pass drawn once', () => {
  const half = { passes: 1, instructions: 500, inputs: { colour: true, depth: false, normal: false } };
  expect(postPairRefusal(half, half)).toBeNull();
  expect(postPairRefusal(half, { ...half, instructions: 501 })).toContain('where the two frames blend');
  const withNormal = { passes: 1, instructions: 500 + POST_NORMAL_PREPASS_COST, inputs: { colour: true, depth: false, normal: true } };
  expect(postPairRefusal(withNormal, withNormal)).toContain('where the two frames blend');
  expect(postPairRefusal({ ...withNormal, instructions: 340 + POST_NORMAL_PREPASS_COST }, withNormal)).toBeNull();
  expect(postPairRefusal(NO_POST, { ...half, instructions: POST_STACK_BUDGET.instructions })).toBeNull();
});
