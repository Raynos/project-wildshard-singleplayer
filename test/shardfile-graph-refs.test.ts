// SF59: a material may name a graph file of the library closure or an engine-owned built-in preset, admitted through the
// shardfile path (schema → product admission with bytes → client compile), with pass and refusal fixtures.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules } from '@wildshard/game/shardfile/schema';
import { DEFAULT_GRAPH_BUDGET, validateGraph, type GraphIr, type GraphNode } from '../src/engine/core/materialGraph';
import { attachOutline, compileGraph, type CompileGraphOptions } from '../src/engine/render/graph/compile';
import type { GraphCompiler } from '../src/engine/render/graphBackend';
import { parseFamilyMaterial, parseToonLook, presetRefusal } from '../src/engine/render/families/params';
import { familyPresetGraph, PRESET_GRAPH_BUDGET, toonGraph } from '../src/engine/render/graph/presets';
import { clientGraphs, isGraphEntry } from '../src/game/shardfile/clientGraphs';
import { graphFileRules, graphFileTextureRefs, materialGraphRules, presetLooks } from '../src/game/shardfile/materials';

const FILE = 'a'.repeat(64), TEX = 'b'.repeat(64), OTHER = 'c'.repeat(64);
const surface = (extra: Partial<GraphIr> = {}): GraphIr => ({
  version: 1, kind: 'material', params: { tint: { type: 'colour', value: [0.8, 0.6, 0.4] }, wet: { type: 'float', value: 0, bind: { state: 'shared.wet' } } },
  nodes: { tint: { op: 'param', param: 'tint' }, wet: { op: 'param', param: 'wet' }, rough: { op: 'oneMinus', in: ['wet'] } },
  stages: { surface: { colour: 'tint', roughness: 'rough', metalness: 0 } }, ...extra,
});
const fileRow = (hash: string, kind: string, dependencies: string[] = []) => ({ hash, kind, compressed: 1, decoded: 1, gpu: 0, triangles: 0, draws: 0, dependencies, critical: false });
function product(material: unknown, files: ReturnType<typeof fileRow>[] = [], library: string[] = []) {
  const base = emptyShardfile({ slug: 'graph-refs', name: 'Graph refs', author: 'Local', seed: 1, revision: 1 });
  base.state.shared.push({ id: 1, name: 'wet', type: 'f64', privacy: 'public', default: 0.25 });
  return { ...base, files, library, look: { ...base.look, materials: { m: material } } };
}
const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const toon = { family: 'toon', colour: [0.85, 0.6, 0.4] };
const measured = { family: 'pbr', measure: {} };

it('admits a preset reference for each family IR version 1 expresses, through the engine-owned door under the preset budget', () => {
  for (const preset of [toon, { family: 'painterly', colour: [0.5, 0.7, 0.3], sway: 0.1 }, { family: 'emissive', colour: [1, 0.3, 0.6] }, measured]) {
    const source = parseShardfile(product({ family: 'graph', preset, version: 1 }));
    expect(materialGraphRules(source)).toEqual([]);
    const entry = source.look.materials['m'];
    if (entry?.family !== 'graph' || !('preset' in entry)) throw new Error('expected a preset reference');
    const checked = validateGraph(familyPresetGraph(entry.preset, presetLooks(source.look.familyLooks)), { budget: PRESET_GRAPH_BUDGET });
    expect(checked.ok).toBe(true);
  }
  // the door is the same program the family presets are held to parity with
  const looks = presetLooks({}), entry = parseFamilyMaterial(toon);
  if (entry.family !== 'toon') throw new Error('toon');
  expect(familyPresetGraph(entry, looks)).toEqual(toonGraph(entry, parseToonLook({})));
});

it.each([
  [{ family: 'graph', preset: toon, version: 2 }, 'another preset version'],
  [{ family: 'graph', preset: toon }, 'no version'],
  [{ family: 'graph', preset: { family: 'toon', shader: 'void main() {}' }, version: 1 }, 'a field the family does not have'],
  [{ family: 'graph', preset: { family: 'graph', graph: surface() }, version: 1 }, 'a graph as a preset'],
  [{ family: 'graph', preset: toon, version: 1, graph: surface() }, 'a preset with inline nodes'],
  [{ family: 'graph', file: 'not-a-hash' }, 'a file that is not a content hash'],
])('refuses a malformed reference through the schema: %o (%s)', (material: unknown, why: string) => {
  expect(() => parseShardfile(product(material)), why).toThrow();
});

it.each([
  [{ family: 'pbr' }, 'pbr preset'],
  [{ family: 'pbr', measure: {}, maps: { colour: TEX, normal: null, orm: null } }, 'pbr preset'],
  [{ family: 'emissive', blend: 'additive' }, 'additive blend'],
  [{ family: 'emissive', fog: 0.5 }, 'fog share'],
])('refuses a preset IR version 1 cannot express, with the engine door\'s own reason: %o', (preset, reason) => {
  const material = { family: 'graph', preset, version: 1 }, files = [fileRow(TEX, 'ktx2')];
  expect(() => parseShardfile(product(material, files, [TEX]))).toThrow('semantic');
  const source = parseShardfile(product({ family: 'graph', preset: toon, version: 1 }, files, [TEX]));
  expect(shardfileRules({ ...source, look: { ...source.look, materials: { m: { family: 'graph', preset: parseFamilyMaterial(preset), version: 1 } } } }).join('; ')).toContain(reason);
  const entry = parseFamilyMaterial(preset);
  expect(presetRefusal(entry)).toContain(reason);
  expect(() => familyPresetGraph(entry, presetLooks({}))).toThrow(reason);
});

it('admits a graph file only as a JSON file of the library closure', () => {
  const ref = { family: 'graph', file: FILE };
  expect(() => parseShardfile(product(ref, [fileRow(FILE, 'json')], [FILE]))).not.toThrow();
  expect(() => parseShardfile(product(ref, [fileRow(FILE, 'json')], []))).toThrow();
  expect(() => parseShardfile(product(ref, [fileRow(FILE, 'binary')], [FILE]))).toThrow('semantic');
  const source = parseShardfile(product(ref, [fileRow(FILE, 'json')], [FILE]));
  expect(materialGraphRules({ ...source, library: [] }).join('; ')).toContain('library closure');
  expect(materialGraphRules({ ...source, files: [{ ...fileRow(FILE, 'binary'), kind: 'binary' }] }).join('; ')).toContain('library closure');
  expect(() => parseShardfile(product(ref))).toThrow();
  // a dependency of a library root is in the closure
  expect(() => parseShardfile(product(ref, [fileRow(OTHER, 'json', [FILE]), fileRow(FILE, 'json')], [OTHER]))).not.toThrow();
});

it('validates a graph file with its bytes at product admission under the author caps and the shard\'s bindings', () => {
  const ok = parseShardfile(product({ family: 'graph', file: FILE }, [fileRow(FILE, 'json', [TEX]), fileRow(TEX, 'ktx2')], [FILE]));
  const admit = (value: unknown, raw?: Uint8Array): string[] => graphFileRules(ok, (hash) => (hash === FILE ? raw ?? bytes(value) : undefined));
  expect(admit(surface())).toEqual([]);
  const textured = surface({ params: { ...surface().params, map: { type: 'texture', value: TEX } }, nodes: { ...surface().nodes, uv: { op: 'uv' }, s: { op: 'texture', param: 'map', in: ['uv'] } } });
  expect(admit(textured)).toEqual([]);
  expect(graphFileTextureRefs(ok.look.materials, () => bytes(textured))).toEqual([TEX]);
  expect(admit(surface({ params: { ...surface().params, map: { type: 'texture', value: OTHER } } })).join('; ')).toContain('KTX2 dependency of its file row');
  expect(admit(surface({ params: { ...surface().params, wet: { type: 'float', value: 0, bind: { state: 'shared.missing' } } } })).join('; ')).toContain('material m');
  expect(admit(null, new Uint8Array([0xff, 0xfe]))).toEqual([`material m: material graph file ${FILE} is not UTF-8 JSON`]);
  expect(admit(null, new Uint8Array(64_001).fill(32)).join('; ')).toContain('at most 64000');
  expect(graphFileRules(ok, () => undefined).join('; ')).toContain('is not an admitted file');
  const post: GraphIr = { version: 1, kind: 'post', nodes: { c: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['c'], mask: 'xyz' } }, stages: { post: { colour: 'rgb' } } };
  expect(admit(post).join('; ')).toContain('not a post pass');
  // the author caps: a file is authored content, never a trusted preset
  const nodes: Record<string, GraphNode> = { ...surface().nodes };
  for (let i = Object.keys(nodes).length; i <= DEFAULT_GRAPH_BUDGET.nodes; i++) nodes[`n${i}`] = { op: 'const', value: 0 };
  expect(admit(surface({ nodes })).join('; ')).toContain('budget');
});

/** the real compiler, recording each compile's budget and every param fed */
function recording() {
  const budgets: (CompileGraphOptions['budget'])[] = [], fed: [string, unknown][] = [];
  const compiler: GraphCompiler = { compileGraph: (input: unknown, opts?: CompileGraphOptions) => {
    budgets.push(opts?.budget); const compiled = compileGraph(input, opts);
    return { ...compiled, setParam: (name, value) => { fed.push([name, value]); compiled.setParam(name, value); } };
  }, attachOutline };
  return { compiler, budgets, fed };
}

it('compiles a preset reference under the preset budget (its clock moving with the tick) and draws its family while the row is off', () => {
  const source = parseShardfile(product({ family: 'graph', preset: toon, version: 1 })), entry = source.look.materials['m'];
  if (!isGraphEntry(entry)) throw new Error('graph entry');
  const fallbacks: unknown[] = [], fallback = (e: unknown): THREE.Material => { fallbacks.push(e); return new THREE.MeshBasicMaterial(); };
  const off = clientGraphs(source, { compiler: null, fallback, textures: () => new THREE.Texture() });
  off.compile(entry);
  expect(fallbacks).toEqual([parseFamilyMaterial(toon)]);
  const { compiler, budgets, fed } = recording();
  const on = clientGraphs(source, { compiler, fallback, textures: () => new THREE.Texture() });
  expect(on.compile(entry)).toBeInstanceOf(MeshStandardNodeMaterial);
  expect(budgets).toEqual([PRESET_GRAPH_BUDGET]);
  on.tick(0.5); on.tick(0.25);
  expect(fed.filter(([name]) => name === 'cloudTime').map(([, value]) => value)).toEqual([0.5, 0.75]);
});

it('compiles a graph file from the admitted bytes under the author caps', () => {
  const source = parseShardfile(product({ family: 'graph', file: FILE }, [fileRow(FILE, 'json')], [FILE])), entry = source.look.materials['m'];
  if (!isGraphEntry(entry)) throw new Error('graph entry');
  const { compiler, budgets, fed } = recording();
  const graphs = clientGraphs(source, { compiler, fallback: () => new THREE.MeshBasicMaterial(), textures: () => new THREE.Texture(), file: (hash) => (hash === FILE ? bytes(surface()) : undefined) });
  expect(graphs.compile(entry)).toBeInstanceOf(MeshStandardNodeMaterial);
  expect(budgets).toEqual([DEFAULT_GRAPH_BUDGET]);
  expect(fed).toContainEqual(['wet', 0.25]); // the state binding's declared default
  const missing = clientGraphs(source, { compiler, fallback: () => new THREE.MeshBasicMaterial(), textures: () => new THREE.Texture() });
  expect(() => missing.compile(entry)).toThrow('is not an admitted file');
});
