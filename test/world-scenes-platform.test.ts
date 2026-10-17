// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
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

test('authored raw LODs and deferred named placements retain their native model contract', async () => {
  const [{ defineWorldSceneCatalogue }, { sharedModelContext }, { Rng }, { SkyRig }, { parseWorldSceneModels }] = await Promise.all([
    import('../src/game/models/worldSceneCatalogue'), import('../src/engine/models/model'), import('../src/engine/core/rng'), import('../src/engine/world/skyRig'), import('../src/format/worldSceneModels'),
  ]);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  const context = fixture(), rows = section();
  Object.assign(context.game, { renderer: null, runtime: { world: { sky, game: context.game } } });
  const draw = { id: 'face', library: 'shapes', model: 'stone', material: 'paint', castShadow: true, sphere: [0, 0, 0, 3] };
  const data = { product: 'fixture-harbour', models: [{ key: 'marker', id: 'fixture-harbour/marker', name: 'Marker', category: 'props', pipeline: 'blender', file: 'markers.json', defaults: {}, assembly: 'parts',
    choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [draw], lods: [{ from: 20, draws: [{ ...draw, castShadow: false }] }] }] }] };
  const placement = { id: 'markers.placed', model: 'marker', draw: 'single', cull: { far: { phone: 25, desktop: 35 }, minAngular: { phone: 0.004, desktop: 0.0012 } },
    poses: [{ x: 7, y: 0, z: 9, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 0, 9, 1] }], piece: { id: 'marker-copy' },
    colliders: [{ kind: 'box', hx: 1, hy: 1, hz: 1, x: 7, y: 1, z: 9 }],
  };
  const file = context.product.file.bind(context.product), has = context.product.hasFile.bind(context.product);
  vi.spyOn(context.product, 'hasFile').mockImplementation(name => ['models/catalogue.json', 'scenes/placement.json'].includes(name) || has(name));
  vi.spyOn(context.product, 'file').mockImplementation(name => name === 'models/catalogue.json' || name === 'scenes/placement.json'
    ? Promise.resolve(new TextEncoder().encode(JSON.stringify(name === 'models/catalogue.json' ? data : placement))) : file(name));
  try {
    const handles = await installWorldScenes(context, parseWorldScenes({ ...rows, catalogue: 'models/catalogue.json', placements: [{ id: 'markers.placed', file: 'scenes/placement.json' }] }));
    expect(handles.has('markers.placed')).toBe(true);
    expect(handles.has('markers.placed.root')).toBe(false);
    const catalogue = defineWorldSceneCatalogue(data), model = catalogue.model('marker'), ctx = sharedModelContext(sky);
    const near = model.build(ctx, {}, new Rng(1)), far = model.lods?.[0]?.build(ctx, {}, new Rng(1));
    if (near instanceof Object3D) throw new Error('Expected native raw parts');
    expect(near[0]?.geometry.boundingSphere?.radius).toBe(3);
    expect(near[0]?.castShadow).toBe(true); expect(far?.[0]?.castShadow).toBe(false);
    expect(far?.[0]?.geometry).toBe(near[0]?.geometry);
    expect(model.lods?.[0]?.from).toBe(20);
    const placed = await handles.place('markers.placed');
    expect(await handles.place('markers.placed')).toBe(placed);
    expect(handles.object('markers.placed.root')).toBe(placed.object);
    expect(handles.colliders('markers.placed.colliders')).toEqual([{ kind: 'box', x: 7, y: 1, z: 9, hx: 1, hy: 1, hz: 1 }]);
    expect(Object.keys(placed.colliders[0] ?? {})).toEqual(['kind', 'hx', 'hy', 'hz', 'x', 'y', 'z']);
    expect(context.app.registry.pieces.filter(piece => piece.id === 'marker-copy')).toHaveLength(1);
    expect(() => parseWorldSceneModels({ ...data, models: [{ ...data.models[0], choices: [{ ...data.models[0]?.choices[0], lods: [{ from: 20, draws: [] }, { from: 10, draws: [] }] }] }] })).toThrow();
    expect(() => parseWorldScenes({ ...rows, placements: [{ id: 'bad', model: 'marker', draw: 'single', poses: [{ x: 0, y: 0, z: 0, matrix: [1] }] }] })).toThrow();
    const { parseWorldScenePlacement } = await import('../src/format/worldScenePlacement');
    expect(() => parseWorldScenePlacement({ ...placement, poses: [{ ...placement.poses[0], params: { callback: () => 1 } }] })).toThrow('plain JSON');
    expect(() => parseWorldScenePlacement({ ...placement, colliders: [{ callback: () => 1 }] })).toThrow('plain JSON');
  } finally { vi.restoreAllMocks(); context.scope.dispose(); }
});

test('source PBR slots preserve original maps and own material retirement', async () => {
  const [{ worldSceneSourceMaterial }, rig, { SkyRig }, { Texture, BufferGeometry }, { GLTFLoader }] = await Promise.all([
    import('../src/game/shardfile/worldSceneMaterials'), import('../src/engine/anim/rig'), import('../src/engine/world/skyRig'), import('three'), import('three/examples/jsm/loaders/GLTFLoader.js'),
  ]);
  const owner = new Scope('pbr-source-fixture'), sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  const setup = vi.fn(); Object.defineProperty(sky, 'setupMaterial', { value: setup });
  const texture = new Texture(), material = new MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture, aoMap: texture });
  const geometry = new BufferGeometry(), scene = new Group(); scene.add(new Mesh(geometry, material));
  const disposed = vi.fn(), released = vi.fn(); material.addEventListener('dispose', () => { disposed(); }); geometry.addEventListener('dispose', () => { released(); });
  const file = await new GLTFLoader().parseAsync(Uint8Array.from(triangle()).buffer, '');
  file.scene.clear(); file.scene.add(...scene.children);
  const loader = vi.spyOn(rig, 'loadRigFile').mockResolvedValue(file);
  const rows = parseWorldScenes({ version: 1, libraries: [], materials: [{ id: 'pbr', kind: 'source', url: '/fixture.glb', aliases: { '/fixture.glb': '/material-only.glb' }, anisotropy: 4, envMapIntensity: 0.8 }], steps: [] });
  const row = rows.materials[0]; if (row?.kind !== 'source') throw new Error('Missing material fixture');
  try {
    expect(await worldSceneSourceMaterial(row, sky, owner)).toBe(material);
    expect(await worldSceneSourceMaterial(row, sky, owner)).toBe(material);
    expect(loader).toHaveBeenCalledTimes(1); expect(loader).toHaveBeenCalledWith('/fixture.glb', row.aliases);
    expect(setup).toHaveBeenCalledWith(material); expect(texture.anisotropy).toBe(4); expect(material.envMapIntensity).toBe(0.8);
    expect(released).toHaveBeenCalledOnce(); owner.dispose(); expect(disposed).toHaveBeenCalledOnce();
  } finally { loader.mockRestore(); owner.dispose(); }
});

test('deferred source slots decode at their named placement', async () => {
  const [sources, { SkyRig }] = await Promise.all([import('../src/game/shardfile/worldSceneMaterials'), import('../src/engine/world/skyRig')]);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  const context = fixture(), rejected = fixture(), retired = fixture(), material = new MeshStandardMaterial(), rows = section();
  Object.assign(context.game, { renderer: null, runtime: { world: { sky, game: context.game } } });
  const data = { product: 'fixture-harbour', models: [{ key: 'marker', id: 'fixture-harbour/deferred', name: 'Marker', category: 'props', pipeline: 'blender', file: 'markers.json', defaults: {}, assembly: 'parts',
    choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: 'face', library: 'shapes', model: 'stone', material: 'paint' }] }] }] };
  const source = { id: 'paint', kind: 'source', load: 'placement', url: '/fixture.glb' };
  const declaration = { ...rows, catalogue: 'models/catalogue.json', materials: [source], placements: [{ id: 'markers.placed', model: 'marker', draw: 'single', poses: [{ x: 0, y: 0, z: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }] }], steps: [] };
  const file = context.product.file.bind(context.product), has = context.product.hasFile.bind(context.product);
  vi.spyOn(context.product, 'hasFile').mockImplementation(name => name === 'models/catalogue.json' || has(name));
  vi.spyOn(context.product, 'file').mockImplementation(name => name === 'models/catalogue.json' ? Promise.resolve(new TextEncoder().encode(JSON.stringify(data))) : file(name));
  const load = vi.spyOn(sources, 'worldSceneSourceMaterial').mockResolvedValue(material);
  try {
    const handles = await installWorldScenes(context, parseWorldScenes(declaration));
    expect(load).not.toHaveBeenCalled();
    await handles.place('markers.placed'); await handles.place('markers.placed');
    expect(load).toHaveBeenCalledOnce();
    await expect(installWorldScenes(rejected, parseWorldScenes({ ...rows, materials: [source] }))).rejects.toThrow('Deferred source material');
    Object.assign(retired.game, { renderer: null, runtime: { world: { sky, game: retired.game } } });
    const retiredFile = retired.product.file.bind(retired.product), retiredHas = retired.product.hasFile.bind(retired.product);
    vi.spyOn(retired.product, 'hasFile').mockImplementation(name => name === 'models/catalogue.json' || retiredHas(name));
    vi.spyOn(retired.product, 'file').mockImplementation(name => name === 'models/catalogue.json' ? Promise.resolve(new TextEncoder().encode(JSON.stringify(data))) : retiredFile(name));
    const stale = await installWorldScenes(retired, parseWorldScenes(declaration));
    let complete: (value: MeshStandardMaterial) => void = () => { throw new Error('Missing deferred source initializer'); };
    const decode = new Promise<MeshStandardMaterial>(resolve => { complete = resolve; });
    load.mockReturnValueOnce(decode);
    const placing = stale.place('markers.placed');
    retired.scope.dispose(); complete(material);
    await expect(placing).rejects.toThrow('Scene placement owner is disposed');
    expect(retired.app.registry.pieces).toHaveLength(0);
  } finally { vi.restoreAllMocks(); context.scope.dispose(); rejected.scope.dispose(); retired.scope.dispose(); material.dispose(); }
});
