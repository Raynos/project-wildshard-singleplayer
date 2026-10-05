import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { validateGraph, type GraphIr, type GraphNode } from '@wildshard/engine/core/materialGraph';
import { materialGraphRules, materialTextureRefs } from '../src/game/shardfile/materials';

const source = () => emptyShardfile({ slug: 'graph-test', name: 'Graph', author: 'Local', seed: 1, revision: 1 });
const graph = (): GraphIr => ({ version: 1, kind: 'material', nodes: { tint: { op: 'const', value: [0.2, 0.4, 0.6] } }, stages: { surface: { colour: 'tint', roughness: 0.8 } } });
const product = (ir: unknown) => { const base = source(); return { ...base, look: { ...base.look, materials: { surface: { family: 'graph', graph: ir } } } }; };

it('round trips a graph material through full author admission without changing presets', () => {
  const input = product(graph()), parsed = parseShardfile(JSON.parse(new TextDecoder().decode(new TextEncoder().encode(JSON.stringify(input)))));
  expect(parsed.look.materials['surface']).toEqual(input.look.materials.surface);
  const material = parsed.look.materials['surface'];
  if (material?.family !== 'graph') throw new Error('expected graph material');
  expect(validateGraph(material.graph)).toMatchObject({ ok: true, cost: { nodes: 1, samplers: 0, instructions: 0 } });
  expect(materialTextureRefs(parsed.look.materials)).toEqual([]);
  expect(parseShardfile(source()).look.materials).toEqual({});
  expect(() => parseShardfile({ ...input, look: { ...input.look, materials: { surface: { family: 'graph', graph: graph(), shader: 'void main() {}' } } } })).toThrow();
  expect(() => parseShardfile({ ...input, look: { ...input.look, families: ['graph'] } })).toThrow();
});

it.each([
  { ...graph(), version: 2 },
  { ...graph(), nodes: { tint: { op: 'glslFn' } } },
  { ...graph(), nodes: { tint: { op: 'add', in: ['tint', 1] } } },
  { ...graph(), nodes: { tint: { op: 'const', value: [1, 2] } } },
  { ...graph(), kind: 'post', nodes: {}, stages: { post: { colour: [1, 1, 1] } } },
  { ...graph(), nodes: { tint: { op: 'loop', count: 17, in: [[1, 1, 1]], body: { nodes: { acc: { op: 'acc' } }, out: 'acc' } } } },
])('refuses invalid graph programs at shardfile admission: %o', (ir) => {
  expect(() => parseShardfile(product(ir))).toThrow();
});

it('uses the engine program ceilings and refuses accessor data before invocation', () => {
  const nodes: Record<string, GraphNode> = { n0: { op: 'const', value: 0.5 } };
  for (let i = 1; i <= 160; i++) nodes[`n${i}`] = { op: 'add', in: [`n${i - 1}`, 0.001] };
  expect(() => parseShardfile(product({ ...graph(), nodes, stages: { surface: { roughness: 'n160' } } }))).toThrow();
  let reads = 0;
  const ir = { ...graph(), get nodes() { reads++; return {}; } };
  expect(() => parseShardfile(product(ir))).toThrow('JSON data only');
  expect(reads).toBe(0);
});

it('admits only scoped public numeric state bindings and matching day-key channel types', () => {
  const base = source();
  base.state.shared.push({ id: 1, name: 'wet', type: 'f64', privacy: 'public', default: 0.2 });
  base.state.player.push({ id: 2, name: 'heat', type: 'i32', privacy: 'public', default: 1 });
  const ir: GraphIr = { ...graph(), params: { wet: { type: 'float', value: 0.2, bind: { state: 'shared.wet' } }, heat: { type: 'float', value: 1, bind: { state: 'player.heat' } } } };
  const input = { ...base, look: { ...base.look, materials: { surface: { family: 'graph', graph: ir } } } };
  expect(() => parseShardfile(input)).not.toThrow();
  for (const privacy of ['owner', 'host'] as const) {
    expect(() => parseShardfile({ ...input, state: { ...base.state, shared: [{ ...base.state.shared[0], privacy }] } })).toThrow();
  }
  for (const state of ['wet', 'shared.missing', 'player.wet']) {
    expect(() => parseShardfile({ ...input, look: { ...input.look, materials: { surface: { family: 'graph', graph: { ...ir, params: { wet: { type: 'float', value: 0, bind: { state } } } } } } } })).toThrow();
  }
  expect(() => parseShardfile({ ...input, state: { ...base.state, shared: [{ id: 1, name: 'wet', type: 'bool', privacy: 'public', default: true }] } })).toThrow();
  const keys = [{ time: 0, sky: { zenith: [0, 0, 0], horizon: [1, 1, 1] }, fog: { colour: [0.2, 0.3, 0.4], density: 0, near: 60, far: 180 }, sun: { colour: [1, 1, 1], intensity: 1 }, ambient: { sky: [1, 1, 1], ground: [0, 0, 0], intensity: 1 } }];
  const day = (channel: string, type: 'colour' | 'float', value: number | readonly number[]) => ({ ...graph(), params: { tint: { type, value, bind: { day: channel } } } });
  const dayProduct = (program: unknown) => { const dayInput = product(program); return { ...dayInput, look: { ...dayInput.look, keys } }; };
  expect(() => parseShardfile(dayProduct(day('fog.colour', 'colour', [0.2, 0.3, 0.4])))).not.toThrow();
  expect(() => parseShardfile(dayProduct(day('fog.near', 'float', 60)))).not.toThrow();
  expect(() => parseShardfile(dayProduct(day('fog.colour', 'float', 1)))).toThrow();
  expect(() => parseShardfile(dayProduct(day('fog.missing', 'float', 1)))).toThrow();
  expect(() => parseShardfile(product(day('fog.colour', 'colour', [0.2, 0.3, 0.4])))).toThrow();
  const parsed = parseShardfile(input);
  expect(materialGraphRules(parsed)).toEqual([]);
});

it('roots graph texture params in admitted KTX2 library closure, including exact commons', () => {
  const hash = 'a'.repeat(64);
  const textured = (value: string): GraphIr => ({ ...graph(), params: { map: { type: 'texture', value } }, nodes: { uv: { op: 'uv' }, sample: { op: 'texture', param: 'map', in: ['uv'] }, tint: { op: 'swizzle', in: ['sample'], mask: 'xyz' } } });
  const input = product(textured(hash));
  expect(() => parseShardfile(input)).toThrow();
  input.files.push({ hash, kind: 'ktx2', compressed: 16, decoded: 16, gpu: 16, triangles: 0, draws: 0, dependencies: [], critical: false });
  input.library.push(hash);
  expect(materialTextureRefs(parseShardfile(input).look.materials)).toEqual([hash]);
  expect(() => parseShardfile({ ...input, files: [{ ...input.files[0], kind: 'binary' }] })).toThrow();
  expect(() => parseShardfile(product(textured('https://example.com/texture.ktx2')))).toThrow();
  const commons = product(textured(`commons:${hash}`));
  commons.requires.commons.push(hash); commons.requires.commonsWire[hash] = 16; commons.library.push(`commons:${hash}`);
  expect(materialTextureRefs(parseShardfile(commons).look.materials)).toEqual([`commons:${hash}`]);
  expect(() => parseShardfile({ ...commons, library: [] })).toThrow();
  const ir = textured(hash);
  expect(() => parseShardfile(product({ ...ir, params: { map: { type: 'texture', value: hash, bind: { day: 'fog.colour' } } } }))).toThrow();
});
