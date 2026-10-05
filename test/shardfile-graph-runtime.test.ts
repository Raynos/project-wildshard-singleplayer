// SF59 step 5: the client runtime adapter for shardfile graph materials: admission → compile → bind, with refusals.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import type { GraphIr, GraphLiteral, GraphNode, GraphValidationOptions } from '../src/engine/core/materialGraph';
import { compileGraph, type CompileGraphOptions } from '../src/engine/render/graph/compile';
import type { GraphCompiler } from '../src/engine/render/graphBackend';
import { clientGraphs, graphFallbackEntry, isGraphEntry } from '../src/game/shardfile/clientGraphs';
import { graphBindingSources, materialGraphRules } from '../src/game/shardfile/materials';

const key = (time: number, sun: readonly [number, number, number]) => ({ time, sky: { zenith: [0.1, 0.2, 0.4], horizon: [0.6, 0.7, 0.8] }, fog: { colour: [0.5, 0.5, 0.5], density: 0.01 }, sun: { colour: sun, intensity: 2 }, ambient: { sky: [1, 1, 1], ground: [0, 0, 0], intensity: 0.5 } });
const graph = (params: NonNullable<GraphIr['params']>, extra: Record<string, GraphNode> = {}): GraphIr => ({
  version: 1, kind: 'material', params,
  nodes: { tint: { op: 'param', param: 'tint' }, rough: { op: 'param', param: 'rough' }, ...extra },
  stages: { surface: { colour: 'tint', roughness: 'rough', metalness: 0 } },
});
const bound: NonNullable<GraphIr['params']> = { tint: { type: 'colour', value: [1, 1, 1], bind: { day: 'sun.colour' } }, rough: { type: 'float', value: 0.5, bind: { state: 'shared.wet' } } };
/** an admitted product: two day keys (noon white-ish, midnight blue) and a public shared `wet` (default 0.8) */
function admitted(ir: unknown) {
  const base = emptyShardfile({ slug: 'graph-runtime', name: 'Graph runtime', author: 'Local', seed: 1, revision: 1 });
  base.state.shared.push({ id: 1, name: 'wet', type: 'f64', privacy: 'public', default: 0.8 });
  base.state.shared.push({ id: 2, name: 'secret', type: 'f64', privacy: 'owner', default: 0 });
  return parseShardfile({ ...base, look: { ...base.look, keys: [key(0, [0, 0, 0.2]), key(0.5, [1, 0.5, 0.25])], dayOverride: 0.5, materials: { surface: { family: 'graph', graph: ir } } } });
}
/** the real compiler, recording the options it is given and every param it is fed */
function recording() {
  const calls: CompileGraphOptions[] = [], fed: [string, GraphLiteral][] = [];
  const compiler: GraphCompiler = { compileGraph: (input: unknown, opts?: CompileGraphOptions) => {
    if (opts === undefined) throw new Error('the adapter always passes its lists');
    calls.push(opts);
    const compiled = compileGraph(input, opts);
    return { ...compiled, setParam: (name: string, value: GraphLiteral) => { fed.push([name, typeof value === 'number' ? value : [...value]]); compiled.setParam(name, value); } };
  } };
  return { compiler, calls, fed };
}
const fallbackMaterial = new THREE.MeshBasicMaterial({ name: 'fallback' });
const last = (fed: readonly [string, GraphLiteral][], name: string): GraphLiteral | undefined => [...fed].reverse().find(([n]) => n === name)?.[1];

it('compiles an admitted graph with the admitted binding lists and feeds day keys and state as uniforms', () => {
  const source = admitted(graph(bound));
  expect(materialGraphRules(source)).toEqual([]);
  const entry = source.look.materials['surface'];
  if (!isGraphEntry(entry)) throw new Error('expected a graph entry');
  const { compiler, calls, fed } = recording(), fallbacks: unknown[] = [];
  const graphs = clientGraphs(source, { compiler, fallback: (e) => { fallbacks.push(e); return fallbackMaterial; }, textures: () => new THREE.Texture() });
  const material = graphs.compile(entry);
  expect(material).toBeInstanceOf(MeshStandardNodeMaterial);
  expect(fallbacks).toEqual([]);
  expect(graphs.readout).toMatchObject({ compiled: 1, fallback: 0 });
  // the compiler saw the shard's real lists, never an open default
  const lists = graphBindingSources(source), opts: GraphValidationOptions | undefined = calls[0];
  expect(opts?.dayKeys).toEqual([...lists.day.keys()]);
  expect(opts?.stateFields).toEqual(['shared.wet']);
  // the first frame: noon (dayOverride 0.5) → the noon key's sun, written in sRGB; wet at its declared default
  const noon = new THREE.Color(1, 0.5, 0.25).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const tint = last(fed, 'tint');
  const round = (x: number): number => Number(x.toFixed(4));
  expect(typeof tint === "number" || tint === undefined ? tint : tint.map(round)).toEqual([noon.r, noon.g, noon.b].map(round));
  expect(last(fed, 'rough')).toBe(0.8);
  // live sources: the frame owner's hour (midnight) and a live state value; a tick moves the uniforms, never the program
  const before = fed.length;
  graphs.bind({ hour: () => 0, state: (scope, name) => (scope === 'shared' && name === 'wet' ? 0.25 : undefined) });
  graphs.tick(1 / 60);
  expect(fed.length).toBeGreaterThan(before);
  const midnight = new THREE.Color(0, 0, 0.2).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  expect(last(fed, 'tint')).toEqual([0, 0, midnight.b]);
  expect(last(fed, 'rough')).toBe(0.25);
  expect(calls.length).toBe(1);
});

it.each([
  ['an undeclared state field', { rough: { type: 'float', value: 0.5, bind: { state: 'shared.missing' } } }],
  ['a non-public state field', { rough: { type: 'float', value: 0.5, bind: { state: 'shared.secret' } } }],
  ['an unscoped state name', { rough: { type: 'float', value: 0.5, bind: { state: 'wet' } } }],
  ['a day channel the keys do not carry', { rough: { type: 'float', value: 0.5, bind: { day: 'fog.near' } } }],
  ['an unknown day channel', { rough: { type: 'float', value: 0.5, bind: { day: 'sun.direction' } } }],
] as const)('refuses %s on the client, with the row on or off', (_, params) => {
  const ir = graph({ tint: { type: 'colour', value: [1, 1, 1] }, ...params });
  const base = admitted(graph(bound));
  // the shape is valid IR, so only the admitted lists can refuse it: the client must not fall back to open defaults
  const source = { ...base, look: { ...base.look, materials: {} } };
  for (const compiler of [recording().compiler, null]) {
    const graphs = clientGraphs(source, { compiler, fallback: () => fallbackMaterial, textures: () => new THREE.Texture() });
    expect(() => graphs.compile({ family: 'graph', graph: ir })).toThrow(/material graph refused/);
    expect(graphs.readout.fallback).toBe(0);
  }
});

it('falls back to the family preset for an over-budget graph and for every graph while the row is off', () => {
  const nodes: Record<string, GraphNode> = { n0: { op: 'const', value: 0.5 } };
  for (let i = 1; i <= 170; i++) nodes[`n${i}`] = { op: 'add', in: [`n${i - 1}`, 0.001] };
  const heavy: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes, stages: { surface: { colour: 'n170' } } };
  const source = admitted(graph(bound));
  const { compiler, calls } = recording(), fallbacks: unknown[] = [];
  const graphs = clientGraphs(source, { compiler, fallback: (e) => { fallbacks.push(e); return fallbackMaterial; }, textures: () => new THREE.Texture() });
  expect(graphs.compile({ family: 'graph', graph: heavy })).toBe(fallbackMaterial);
  expect(calls).toEqual([]);
  expect(fallbacks).toEqual([graphFallbackEntry({ model: 'unlit' })]);
  expect(graphs.readout.reasons[0]).toMatch(/^budget:/);
  // row off: an admitted graph is drawn by its preset and the compiler never loads
  const off = clientGraphs(source, { compiler: null, fallback: (e) => { fallbacks.push(e); return fallbackMaterial; }, textures: () => new THREE.Texture() });
  expect(off.compile({ family: 'graph', graph: graph(bound) })).toBe(fallbackMaterial);
  expect(fallbacks.at(-1)).toEqual({ family: 'pbr', vertexColours: true, metalness: 0, doubleSided: false });
  expect(off.readout).toMatchObject({ compiled: 0, fallback: 1 });
});

it('resolves texture params through the admitted library textures', () => {
  const hash = 'b'.repeat(64);
  const ir: GraphIr = { version: 1, kind: 'material', params: { map: { type: 'texture', value: hash } },
    nodes: { uv: { op: 'uv' }, sample: { op: 'texture', param: 'map', in: ['uv'] }, rgb: { op: 'swizzle', in: ['sample'], mask: 'xyz' } }, stages: { surface: { colour: 'rgb' } } };
  const asked: string[] = [], texture = new THREE.Texture();
  const graphs = clientGraphs(admitted(graph(bound)), { compiler: recording().compiler, fallback: () => fallbackMaterial, textures: (ref) => { asked.push(ref); return texture; } });
  graphs.compile({ family: 'graph', graph: ir });
  expect(asked).toEqual([hash]);
});
