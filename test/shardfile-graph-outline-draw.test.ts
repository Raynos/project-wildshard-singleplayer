// SF59: a declared graph outline is drawn through the shardfile client: the mesh-level hook adds the hull as each bound
// mesh's second draw (same buffers, an instanced mesh's own matrices), disposes it with the scope, and attaches nothing for
// a graph without `stages.outline` or while the Debug row is off.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { DEFAULT_GRAPH_BUDGET, validateGraph, type GraphIr } from '../src/engine/core/materialGraph';
import { attachOutline, compileGraph } from '../src/engine/render/graph/compile';
import { Scope } from '../src/engine/app/scope';
import { clientGraphs, graphOutlineHook, isGraphEntry } from '../src/game/shardfile/clientGraphs';
import { installClientWater } from '../src/game/shardfile/clientWater';
import { WaterSchema } from '../src/game/shardfile/water';
import { materialGraphRules } from '../src/game/shardfile/materials';
import { inkGraph } from '../scripts/tsl-spike/stress.js';

const plain: GraphIr = { version: 1, kind: 'material', nodes: { tint: { op: 'const', value: [0.2, 0.4, 0.6] } }, stages: { surface: { colour: 'tint' } } };
/** an admitted product whose catalogue carries the ink preset (it declares `stages.outline`) and a plain graph */
function admitted() {
  const base = emptyShardfile({ slug: 'outline-draw', name: 'Outline draw', author: 'Local', seed: 1, revision: 1 });
  return parseShardfile({ ...base, look: { ...base.look, materials: { ink: { family: 'graph', graph: inkGraph() }, plain: { family: 'graph', graph: plain } } } });
}
const fallbackMaterial = new THREE.MeshBasicMaterial({ name: 'fallback' });
function graphsOf(row: boolean) {
  const source = admitted();
  const graphs = clientGraphs(source, { compiler: row ? { compileGraph, attachOutline } : null, fallback: () => fallbackMaterial, textures: () => new THREE.Texture() });
  const compile = (id: string): THREE.Material => { const entry = source.look.materials[id]; if (!isGraphEntry(entry)) throw new Error(`no graph ${id}`); return graphs.compile(entry); };
  return { source, graphs, compile, hook: graphOutlineHook(graphs.outline) };
}
const disposals = (target: THREE.EventDispatcher<{ dispose: object }>): { count: number } => {
  const seen = { count: 0 }; target.addEventListener('dispose', () => { seen.count++; }); return seen;
};

it('the ink preset still admits under the default graph budget, its outline counted', () => {
  const { source } = graphsOf(true);
  expect(materialGraphRules(source)).toEqual([]);
  const ink = validateGraph(inkGraph(), { budget: DEFAULT_GRAPH_BUDGET });
  if (!ink.ok) throw new Error(ink.errors.join('; '));
  const { outline: _outline, ...rest } = inkGraph().stages, bare = validateGraph({ ...inkGraph(), stages: rest }, { budget: DEFAULT_GRAPH_BUDGET });
  if (!bare.ok) throw new Error(bare.errors.join('; '));
  expect(ink.cost.instructions).toBeGreaterThan(bare.cost.instructions);
  expect(ink.cost.instructions).toBeLessThanOrEqual(DEFAULT_GRAPH_BUDGET.instructions);
});

it('draws a declared outline as a second mesh over the same geometry buffers and disposes both with the scope', () => {
  const { graphs, compile, hook } = graphsOf(true);
  const material = compile('ink'), outline = graphs.outline(material);
  if (outline === null) throw new Error('the ink graph declares an outline');
  const scope = new Scope('outline-test'), geometry = scope.own(new THREE.BoxGeometry(1, 1, 1));
  const body = new THREE.Mesh(geometry, material), root = new THREE.Group(); root.add(body);
  const bodyDisposed = disposals(geometry);
  const hulls = hook(root, material, scope);
  expect(hulls).toHaveLength(1);
  const hull = hulls[0]; if (hull === undefined) throw new Error('no hull');
  expect(hull.parent).toBe(body);
  expect(hull.material).toBe(outline.material);
  expect(hull.geometry).not.toBe(geometry);
  for (const [name, attribute] of Object.entries(geometry.attributes)) expect(hull.geometry.getAttribute(name)).toBe(attribute);
  expect(hull.geometry.index).toBe(geometry.index);
  expect(hull.castShadow).toBe(false);
  // two draws in the scene: the body and its hull
  const meshes: THREE.Object3D[] = []; root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
  expect(meshes).toEqual([body, hull]);
  // walking the root again attaches nothing more
  expect(hook(root, material, scope)).toEqual([]);
  const hullDisposed = disposals(hull.geometry);
  scope.dispose();
  expect(hull.parent).toBeNull();
  expect(hullDisposed.count).toBe(1);
  expect(bodyDisposed.count).toBe(1);
});

it("an instanced mesh's hull shares its instance matrices and count", () => {
  const { compile, hook } = graphsOf(true);
  const material = compile('ink'), scope = new Scope('outline-instanced');
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 4);
  body.count = 3;
  const [hull] = hook(body, material, scope);
  if (!(hull instanceof THREE.InstancedMesh)) throw new Error('an instanced body gets an instanced hull');
  expect(hull.instanceMatrix).toBe(body.instanceMatrix);
  expect(hull.count).toBe(3);
  scope.dispose();
  expect(hull.parent).toBeNull();
});

it('attaches nothing for a graph without an outline, or for any graph while the row is off', () => {
  const on = graphsOf(true), plainMaterial = on.compile('plain');
  expect(on.graphs.outline(plainMaterial)).toBeNull();
  const scope = new Scope('outline-none'), body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plainMaterial);
  expect(on.hook(body, plainMaterial, scope)).toEqual([]);
  expect(body.children).toEqual([]);
  const off = graphsOf(false), fallback = off.compile('ink');
  expect(fallback).toBe(fallbackMaterial);
  expect(off.graphs.outline(fallback)).toBeNull();
  const offBody = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), fallback);
  expect(off.hook(offBody, fallback, scope)).toEqual([]);
  expect(offBody.children).toEqual([]);
  scope.dispose();
});

it('a view that binds the material (the water surface) draws its hull through the hook', () => {
  const { compile, hook } = graphsOf(true);
  const material = compile('ink'), scope = new Scope('outline-water'), root = new THREE.Group();
  const water = v.parse(WaterSchema, [{ id: 'pond', kind: 'pool', level: 1, shape: { kind: 'circle', x: 0, z: 0, radius: 4 }, dryEntries: [] }]);
  const [surface] = installClientWater(water, { root, scope, materials: new Map([['water', material]]), outline: hook });
  if (surface === undefined) throw new Error('no water surface');
  expect(surface.children).toHaveLength(1);
  expect(surface.children[0]?.name).toBe('water:pond:outline');
  scope.dispose();
  expect(root.children).toEqual([]);
  expect(surface.children).toEqual([]);
});
