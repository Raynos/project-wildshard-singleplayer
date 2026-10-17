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
  return { scope, app: { registry }, game: {}, cube: cell ? { half: 250 } : null,
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


test('authored stairs retain their surface, native count and repeated world pose', async () => {
  const context = fixture(), rows = section(), first = rows.steps[0];
  if (first === undefined) throw new Error('Missing step');
  const stairs = { kind: 'treads' as const, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 2, z: 4 }, width: 2, count: 8, surface: 'wood' as const };
  const handles = await installWorldScenes(context, parseWorldScenes({ ...rows, steps: [{ ...first,
    repeat: [{ id: 'raised', position: [3, 1, 5] }],
    registry: [{ id: 'stairs', name: 'Stairs', category: 'props', file: 'data/stairs.json', part: 'root', colliders: [stairs], surface: 'wood', solidFloor: true }], publish: {},
  }] }));
  expect(handles.group('harbour.raised.root').position.toArray()).toEqual([3, 1, 5]);
  expect(context.app.registry.pieces[0]?.surface).toBe('wood');
  expect(context.app.registry.pieces[0]?.colliders).toEqual([{ ...stairs, from: { x: 3, y: 1, z: 5 }, to: { x: 3, y: 3, z: 9 } }]);
  expect(() => parseWorldScenes({ ...rows, steps: [{ ...first, registry: [{ ...first.registry[0], colliders: [{ ...stairs, count: 0 }] }] }] })).toThrow();
  context.scope.dispose();
});

test('scene catalogue keeps fixed draws, authored floors and model collision ownership', async () => {
  const [{ defineWorldSceneCatalogue, bindWorldSceneModelSources }, { modelContext }, { Rng }, { BufferGeometry, BufferAttribute, MeshBasicMaterial }] = await Promise.all([
    import('../src/game/models/worldSceneCatalogue'), import('../src/engine/models/model'), import('../src/engine/core/rng'), import('three'),
  ]);
  const owner = new Scope('scene-catalogue'), ctx = modelContext(null), registry = new WorldRegistry();
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const material = new MeshBasicMaterial({ color: 0x7fd9ff });
  const catalogueRows = { product: 'fixture-port', models: [{ key: 'tower', id: 'fixture-port/tower', name: 'Tower', category: 'buildings', pipeline: 'code', file: 'models/fixture.ts', surface: 'stone', defaults: {}, choices: [{ id: 'world', params: {}, size: [2, 3, 4],
    draws: [{ id: 'wall', library: 'bakes', model: 'wall', material: 'glyph', castShadow: true, receiveShadow: true, renderOrder: 1 }],
    colliders: [{ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1, surface: 'stone' }],
    site: { origin: { x: 3, y: 4, z: 5 }, colliders: [], floors: [{ x: 0, z: 0, hw: 2, hd: 2, y: 1 }], anchors: { door: { x: 0, y: 1, z: 1, yaw: 0 } } },
  }] }] };
  const { parseWorldSceneModels } = await import('../src/format/worldSceneModels');
  bindWorldSceneModelSources(ctx, 'fixture-port', { catalogue: parseWorldSceneModels(catalogueRows), geometries: new Map([[JSON.stringify(['bakes', 'wall']), geometry]]), materials: new Map([['glyph', material]]) }, owner);
  const catalogue = defineWorldSceneCatalogue(catalogueRows), model = catalogue.model('tower'), built = model.build(ctx, {}, new Rng(1));
  if (!(built instanceof Group)) throw new Error('Missing scene model group');
  const mesh = built.children[0]; if (!(mesh instanceof Mesh)) throw new Error('Missing scene model draw');
  const actualGeometry: unknown = mesh.geometry; if (!(actualGeometry instanceof BufferGeometry)) throw new Error('Missing owned scene geometry');
  const actualAttribute: unknown = actualGeometry.getAttribute('position'), sourceAttribute: unknown = geometry.getAttribute('position');
  if (!(actualAttribute instanceof BufferAttribute) || !(sourceAttribute instanceof BufferAttribute)) throw new Error('Missing scene vertex channel');
  expect(mesh.material).toBe(material); expect(actualGeometry).not.toBe(geometry); expect(actualAttribute.array).toEqual(sourceAttribute.array);
  expect([mesh.castShadow, mesh.receiveShadow, mesh.renderOrder]).toEqual([true, true, 1]);
  const site = catalogue.site('tower', 'world', ctx, registry);
  expect(site.floorHeightAt(3, 5)).toBe(5); expect(site.floorHeightAt(20, 20)).toBeUndefined();
  expect(site.anchors['door']).toEqual({ x: 3, y: 5, z: 6, yaw: 0 });
  expect(site.colliderDescs()).toEqual([{ kind: 'box', x: 3, y: 5, z: 5, hx: 1, hy: 1, hz: 1, surface: 'stone' }]);
  expect(() => model.build(ctx, { site: 'unbaked' }, new Rng(1))).toThrow('authored choice');
  expect(() => defineWorldSceneCatalogue({ ...catalogueRows, callback: () => undefined })).toThrow();
  owner.dispose(); expect(() => catalogue.material('glyph', ctx)).toThrow('Missing scene model material');
  geometry.dispose(); material.dispose(); registry.retire();
});

test('cold Explorer cards admit their product catalogue and fill from verified geometry', async () => {
  const [{ defineWorldSceneCatalogue }, { modelContext }, { Rng }, { withOwner }, runtime] = await Promise.all([
    import('../src/game/models/worldSceneCatalogue'), import('../src/engine/models/model'), import('../src/engine/core/rng'), import('../src/engine/app/ownership'), import('../src/game/shardfile/runtimeProduct'),
  ]);
  const context = fixture(), owner = new Scope('cold-catalogue'), ctx = modelContext(null), rows = section();
  const catalogueRows = { product: 'fixture-harbour', models: [{ key: 'cold', id: 'fixture-harbour/cold', name: 'Cold model', category: 'props', pipeline: 'code', file: 'models/cold.ts', defaults: {}, choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: 'stone', library: 'shapes', model: 'stone', material: 'paint' }] }] }] };
  const oldFile = context.product.file.bind(context.product);
  const file = vi.spyOn(context.product, 'file').mockImplementation(name => name === 'models/catalogue.json' ? Promise.resolve(new TextEncoder().encode(JSON.stringify(catalogueRows))) : oldFile(name));
  Object.assign(context.product, { section: () => parseWorldScenes({ ...rows, catalogue: 'models/catalogue.json' }) });
  const product = vi.spyOn(runtime, 'loadFirstPartyProduct').mockResolvedValue(context.product);
  try {
    const catalogue = defineWorldSceneCatalogue(catalogueRows), built = withOwner(owner, () => catalogue.model('cold').build(ctx, {}, new Rng(1)));
    if (!(built instanceof Group)) throw new Error('Missing loading specimen');
    expect(built.children[0]).toBeInstanceOf(Mesh);
    await vi.waitFor(() => { expect(built.children[0]).toBeInstanceOf(Group); });
    expect(product).toHaveBeenCalledWith('fixture-harbour', expect.objectContaining({ name: 'scene-models/fixture-harbour' }));
    expect(product.mock.calls[0]?.[1]?.belongsTo(owner)).toBe(true);
    expect(file).toHaveBeenCalledWith('models/catalogue.json');
    const filled = built.children[0]; if (!(filled instanceof Group)) throw new Error('Missing filled specimen');
    expect(filled.children[0]).toBeInstanceOf(Mesh);
  } finally { file.mockRestore(); product.mockRestore(); owner.dispose(); context.scope.dispose(); }
});

test('trail scene collider rows retain the native decoder output exactly', async () => {
  const [{ readColliderRows }, { default: trail }] = await Promise.all([
    import('../src/engine/models/colliders'), import('../src/shards/driftwood-isle/data/trailsideBake.json'),
  ]);
  const context = fixture(), rows = section(), first = rows.steps[0];
  if (first === undefined) throw new Error('Missing first step');
  await installWorldScenes(context, parseWorldScenes({ ...rows, steps: [{ ...first, registry: [{ id: 'trail', name: 'Trail', file: 'trail.json', category: 'props', part: 'root', colliders: trail.worldColliders }], publish: {} }] }));
  const want = readColliderRows(trail.worldColliders, { kinds: ['box', 'treads'], surfaces: [] });
  expect(context.app.registry.pieces[0]?.colliders).toEqual(want);
  expect(JSON.stringify(context.app.registry.pieces[0]?.colliders)).toBe(JSON.stringify(want));
  context.scope.dispose();
});


test('resident catalogue loans reach later world placements through the shared sky context', async () => {
  const [{ defineWorldSceneCatalogue }, { sharedModelContext }, { Rng }, { SkyRig }] = await Promise.all([
    import('../src/game/models/worldSceneCatalogue'), import('../src/engine/models/model'), import('../src/engine/core/rng'), import('../src/engine/world/skyRig'),
  ]);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  const context = fixture(), rows = section(); Object.assign(context.game, { runtime: { world: { sky } } });
  const data = { product: 'fixture-harbour', models: [{ key: 'tower', id: 'fixture-harbour/tower', name: 'Tower', category: 'buildings', pipeline: 'code', file: 'models/tower.ts', defaults: {}, choices: [{ id: 'world', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: 'wall', library: 'shapes', model: 'stone', material: 'paint' }] }] }] };
  const file = context.product.file.bind(context.product), has = context.product.hasFile.bind(context.product);
  vi.spyOn(context.product, 'hasFile').mockImplementation(name => name === 'models/catalogue.json' || has(name));
  vi.spyOn(context.product, 'file').mockImplementation(name => name === 'models/catalogue.json' ? Promise.resolve(new TextEncoder().encode(JSON.stringify(data))) : file(name));
  try {
    await installWorldScenes(context, parseWorldScenes({ ...rows, catalogue: 'models/catalogue.json' }));
    const catalogue = defineWorldSceneCatalogue(data), built = catalogue.model('tower').build(sharedModelContext(sky), {}, new Rng(1));
    if (!(built instanceof Group)) throw new Error('Missing resident model');
    expect(built.children[0]).toBeInstanceOf(Mesh); // No loading placeholder group.
    expect(catalogue.material('paint', sharedModelContext(sky))).toBe(built.children[0] instanceof Mesh ? built.children[0].material : null);
  } finally { vi.restoreAllMocks(); context.scope.dispose(); }
});
