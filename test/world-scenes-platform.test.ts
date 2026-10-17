// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import { installWorldScenes } from '../src/game/shardfile/worldScenes';
import { parseWorldScenes } from '../src/format/worldScenes';
import type { ShardContext } from '../src/game/plugin/context';
import { emptyShardfile } from '../src/sdk/author';

// A made-up second shard: two steps, cube variants, repeated groups and named handles.
const recipe = { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['stone'] },
  { kind: 'mesh', id: 'stone', name: 'fixture-stone', geometry: 'rock', material: 'paint', missing: 'empty' }],
  materials: [{ kind: 'port', id: 'paint', source: 'paint' }] }, imports: [] };
const section = () => parseWorldScenes({ version: 1,
  libraries: [{ id: 'shapes', kind: 'owned', models: [{ id: 'stone', file: 'models/stone.glb' }] }],
  materials: [{ id: 'paint', kind: 'standard', properties: { color: 0x987654, roughness: 0.7 } }],
  steps: [{ id: 'harbour', variants: { standalone: 'scenes/open.json', cell: 'scenes/cell.json' },
    geometry: { rock: { library: 'shapes', model: 'stone' } }, materials: { paint: 'paint' },
    registry: [{ id: 'harbour-wall', name: 'Harbour wall', category: 'props', file: 'data/scenes.json', part: 'root',
      colliders: [{ kind: 'box', x: 1, y: 2, z: 3, hx: 1, hy: 1, hz: 1 }] }],
    publish: { collision: { kind: 'colliders', part: 'harbour-wall' }, at: { kind: 'vector', value: [1, 2, 3] }, height: { kind: 'number', value: 7 } } },
  { id: 'markers', scene: 'scenes/open.json', geometry: { rock: { library: 'shapes', model: 'stone' } }, materials: { paint: 'paint' },
    repeat: [{ id: 'east', position: [4, 0, 0] }, { id: 'west', position: [-4, 0, 0] }], publish: { stone: { kind: 'object', part: 'stone' } } }],
});

function triangle(): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }] }));
  const padded = Math.ceil(json.length / 4) * 4, bytes = new Uint8Array(12 + 8 + padded + 8 + 36), header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.length, true);
  header.setUint32(12, padded, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + padded); bytes.set(json, 20);
  header.setUint32(20 + padded, 36, true); header.setUint32(24 + padded, 0x004e4942, true);
  bytes.set(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer), 28 + padded);
  return bytes;
}
function fixture(cell = false): ShardContext {
  const scope = new Scope('fixture-harbour'), registry = new WorldRegistry();
  const cellRecipe = { ...recipe, scene: { ...recipe.scene, nodes: recipe.scene.nodes.map(node => node.id === 'stone' ? { ...node, name: 'cell-stone' } : node) } };
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const files = new Map([['models/stone.glb', triangle()], ['scenes/open.json', encode(recipe)], ['scenes/cell.json', encode(cellRecipe)]]);
  const source = emptyShardfile({ slug: 'fixture-harbour', name: 'Harbour', author: 'Fixture', revision: 1, seed: 3 });
  return { scope, app: { registry }, cube: cell ? { half: 250 } : null,
    product: { shardfile: source, hasFile: (name: string) => files.has(name), url: (name: string) => name,
      file: (name: string) => { const value = files.get(name); return value === undefined ? Promise.reject(new Error('Missing fixture blob')) : Promise.resolve(value); } } } as ShardContext;
}

test('fictional shard builds ordered, repeated, cube-selected rows and typed handles', async () => {
  const context = fixture(true), handles = await installWorldScenes(context, section());
  expect(handles.group('harbour.root')).toBeInstanceOf(Group);
  expect(handles.group('harbour.root').children[0]?.name).toBe('cell-stone');
  expect(handles.object('markers.east.stone')).toBeInstanceOf(Mesh);
  expect(handles.group('markers.east.root').position.toArray()).toEqual([4, 0, 0]);
  expect(handles.group('markers.west.root').position.toArray()).toEqual([-4, 0, 0]);
  expect(handles.vector('harbour.at').toArray()).toEqual([1, 2, 3]); expect(handles.number('harbour.height')).toBe(7);
  expect(handles.colliders('harbour.collision')).toEqual(context.app.registry.pieces[0]?.colliders);
  expect(context.app.registry.pieces.map(piece => piece.id)).toEqual(['harbour-wall']);
  expect(context.app.registry.pieces[0]?.colliders).toEqual([{ kind: 'box', x: 1, y: 2, z: 3, hx: 1, hy: 1, hz: 1 }]);
  expect(() => handles.mesh('harbour.height')).toThrow('Expected scene mesh'); context.scope.dispose();
});

test('resident owns one build across entries and frees owned geometry and materials', async () => {
  const context = fixture(), resident = new Scope('resident'), rows = section();
  const a = await installWorldScenes(context, rows, resident), b = await installWorldScenes(context, rows, resident);
  expect(a).toBe(b);
  const mesh = a.group('harbour.root').children[0]; if (!(mesh instanceof Mesh)) throw new Error('Missing fixture mesh');
  const material: unknown = mesh.material; if (!(material instanceof MeshStandardMaterial)) throw new Error('Missing fixture material');
  const disposed = vi.fn(); material.addEventListener('dispose', () => { disposed(); });
  context.scope.dispose(); expect(disposed).not.toHaveBeenCalled();
  resident.dispose(); expect(disposed).toHaveBeenCalledOnce();
  expect(context.app.registry.pieces).toHaveLength(0);
});

test('admission rejects executable, duplicate, missing and crossed references before construction', async () => {
  expect(() => parseWorldScenes({ ...section(), callback: () => undefined })).toThrow();
  expect(() => parseWorldScenes({ ...section(), steps: [section().steps[0], section().steps[0]] })).toThrow();
  const context = fixture(), rows = section(), first = rows.steps[0]; if (first === undefined) throw new Error('Missing step');
  await expect(installWorldScenes(context, { ...rows, steps: [{ ...first, variants: { standalone: 'scenes/missing.json', cell: 'scenes/missing.json' } }] })).rejects.toThrow();
  await expect(installWorldScenes(context, { ...rows, steps: [{ ...first, geometry: { rock: { library: 'missing', model: 'stone' } } }] })).rejects.toThrow('Missing world scene model');
  expect(context.app.registry.pieces).toHaveLength(0);
  await expect(installWorldScenes(context, rows)).resolves.toBeDefined(); context.scope.dispose();
});
