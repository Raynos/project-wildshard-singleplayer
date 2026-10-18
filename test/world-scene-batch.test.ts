// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial, PerspectiveCamera, BatchedMesh } from 'three';
import { modelPoseMatrix } from '../src/engine/models/placementBatch';
import { parseWorldScenePlacement } from '../src/format/worldScenePlacement';
import { Scope } from '../src/engine/app/scope';
import { WorldSceneBatchSchema } from '../src/format/worldSceneBatch';
import { WorldSceneBatch } from '../src/game/shardfile/worldSceneBatch';
import type { ShardContext } from '../src/game/plugin/context';

const triangle = () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), 3));
  geometry.setIndex([0, 1, 2]);
  return geometry;
};
const batchRows = () => v.parse(WorldSceneBatchSchema, { id: 'harbour', material: 'stone',
  capacity: { instances: 3, vertices: 9, indices: 9 }, cull: { frustum: false, radiusBias: 0, step: 0 },
  geometry: [{ library: 'walls', model: 'near' }, { library: 'walls', model: 'far' }],
  fixed: [{ lod0: 0, lod1: 1, near: 2, far: 10, sphere: [0, 0, -5, 1], matrix: new Matrix4().makeTranslation(0, 0, -5).elements }],
});

test('a second setting shares one draw and appends its fixed instances after model calls', () => {
  const owner = new Scope('harbour'), material = new MeshBasicMaterial(), geometry = triangle();
  const batch = new WorldSceneBatch(batchRows(), material, [geometry, geometry], owner), mesh = batch.mesh();
  const modelGeometry = mesh.addGeometry(geometry), modelInstance = mesh.addInstance(modelGeometry);
  expect(modelGeometry).toBe(0); expect(modelInstance).toBe(0);
  expect(batch.finish()).toBe(mesh); expect(batch.finish()).toBe(mesh);
  expect(mesh.instanceCount).toBe(2); expect(mesh.getGeometryIdAt(1)).toBe(1);
  const matrix = new Matrix4(); mesh.getMatrixAt(1, matrix);
  expect(matrix.elements).toEqual(new Matrix4().makeTranslation(0, 0, -5).elements);
  expect(() => batch.reserve()).toThrow('finalized');
  owner.dispose(); material.dispose(); geometry.dispose();
});

test('fixed instances keep authored range and LOD boundaries', () => {
  const owner = new Scope('harbour'), material = new MeshBasicMaterial(), geometry = triangle();
  const batch = new WorldSceneBatch(batchRows(), material, [geometry, geometry], owner), mesh = batch.finish();
  const camera = new PerspectiveCamera(); camera.updateMatrixWorld(true); batch.update(camera);
  expect(mesh.getGeometryIdAt(0)).toBe(1); expect(mesh.getVisibleAt(0)).toBe(true);
  camera.position.z = -4; camera.updateMatrixWorld(true); batch.update(camera);
  expect(mesh.getGeometryIdAt(0)).toBe(0); expect(mesh.getVisibleAt(0)).toBe(true);
  camera.position.z = -30; camera.updateMatrixWorld(true); batch.update(camera);
  expect(mesh.getVisibleAt(0)).toBe(false);
  owner.dispose(); material.dispose(); geometry.dispose();
});

test('a batch owns only its allocation and refuses use after its lifetime ends', () => {
  const owner = new Scope('harbour'), material = new MeshBasicMaterial(), geometry = triangle();
  const materialDispose = vi.spyOn(material, 'dispose'), geometryDispose = vi.spyOn(geometry, 'dispose');
  const batch = new WorldSceneBatch(batchRows(), material, [geometry, geometry], owner), mesh = batch.finish(), dispose = vi.spyOn(mesh, 'dispose');
  owner.dispose(); owner.dispose();
  expect(dispose).toHaveBeenCalledTimes(1); expect(materialDispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
  expect(() => batch.mesh()).toThrow('disposed');
  material.dispose(); geometry.dispose();
});

test('batch rows reject executable values, missing fixed geometry and unbounded capacity', () => {
  expect(() => v.parse(WorldSceneBatchSchema, { ...batchRows(), callback: () => undefined })).toThrow();
  expect(() => v.parse(WorldSceneBatchSchema, { ...batchRows(), capacity: { instances: 9000, vertices: 9, indices: 9 } })).toThrow();
  expect(() => v.parse(WorldSceneBatchSchema, { ...batchRows(), geometry: [] })).toThrow();
  const outsideRange = batchRows();
  for (const part of outsideRange.fixed) part.far = -1;
  expect(() => v.parse(WorldSceneBatchSchema, outsideRange)).toThrow();
  const nearBeyondRange = batchRows();
  for (const part of nearBeyondRange.fixed) part.near = 100;
  expect(v.parse(WorldSceneBatchSchema, nearBeyondRange)).toEqual(nearBeyondRange);
});

test('resident rows share one native batch across a named model and fixed tail', async () => {
  const [{ installWorldScenes }, { parseWorldScenes }, { emptyShardfile }, { staticGlb }, { WorldRegistry }, { SkyRig }] = await Promise.all([
    import('../src/game/shardfile/worldScenes'), import('../src/format/worldScenes'), import('../src/sdk/author'),
    import('../src/sdk/bake/glb'), import('../src/engine/world/registry'), import('../src/engine/world/skyRig'),
  ]);
  const owner = new Scope('harbour-resident'), registry = new WorldRegistry(), geometry = triangle(), material = new MeshBasicMaterial();
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  Object.defineProperty(sky, 'viewCamera', { value: new PerspectiveCamera() });
  const draw = { id: 'stone', library: 'walls', model: 'stone', material: 'paint' };
  const catalogue = { product: 'fixture-harbour', models: [{ key: 'marker', id: 'fixture-harbour/marker', name: 'Marker', file: 'markers.json', category: 'props', pipeline: 'blender', defaults: {}, assembly: 'parts',
    choices: [{ id: 'only', params: {}, size: [1, 1, 1], draws: [draw], lods: [{ from: { phone: 2, desktop: 4 }, draws: [draw] }], colliders: [] }] }] };
  const files = new Map([['models/stone.glb', staticGlb([{ geometry, material }])], ['models/catalogue.json', new TextEncoder().encode(JSON.stringify(catalogue))]]);
  const game = { renderer: null, onUpdate: vi.fn() };
  const context = { scope: owner, app: { registry }, game: {}, cube: null,
    product: { shardfile: emptyShardfile({ slug: 'fixture-harbour', name: 'Harbour', author: 'Fixture', revision: 1, seed: 3 }),
      hasFile: (id: string) => files.has(id), url: (id: string) => id,
      file: (id: string) => { const bytes = files.get(id); return bytes === undefined ? Promise.reject(new Error('Missing fixture blob')) : Promise.resolve(bytes); } } } as ShardContext;
  Object.assign(context.game, { runtime: { world: { sky, game } } });
  const rows = parseWorldScenes({ version: 1, catalogue: 'models/catalogue.json', steps: [],
    libraries: [{ id: 'walls', kind: 'owned', models: [{ id: 'stone', file: 'models/stone.glb' }] }], materials: [{ id: 'paint', kind: 'basic', properties: {} }],
    batches: [{ ...rowsForFixture(), id: 'shared', material: 'paint', geometry: [{ library: 'walls', model: 'stone' }],
      fixed: [{ near: 2, far: 10, lod0: 0, lod1: 0, sphere: [0, 0, -5, 1], matrix: new Matrix4().makeTranslation(0, 0, -5).elements }] }],
    placements: [{ id: 'marker', model: 'marker', draw: 'batched', batch: 'shared', poses: [{ x: 0, y: 0, z: 0, yxz: { yaw: 1.2, scale: 0.8, pitch: 0.2, roll: -0.1 } }] }],
  });
  try {
    const anotherProduct = () => ({ ...context, product: { ...context.product } }) as ShardContext;
    const tooSmall = structuredClone(rows), incompatible = structuredClone(rows);
    const capacityBatch = tooSmall.batches[0], incompatibleBatch = incompatible.batches[0];
    if (capacityBatch === undefined || incompatibleBatch === undefined) throw new Error('Missing fixture batches');
    capacityBatch.capacity.instances = 1;
    incompatible.materials.push({ id: 'other', kind: 'basic', properties: {} }); incompatibleBatch.material = 'other';
    await expect(installWorldScenes(anotherProduct(), tooSmall)).rejects.toThrow('instance capacity');
    await expect(installWorldScenes(anotherProduct(), incompatible)).rejects.toThrow('cannot share');
    const handles = await installWorldScenes(context, rows);
    const [{ defineWorldSceneCatalogue }, { TIER }] = await Promise.all([import('../src/game/models/worldSceneCatalogue'), import('../src/engine/core/tier')]);
    expect(defineWorldSceneCatalogue(catalogue).model('marker').lods?.[0]?.from).toBe(TIER === 'phone' ? 2 : 4);
    const placed = await handles.place('marker'), batch = handles.object('shared');
    expect(batch).toBe(placed.object); expect(handles.mesh('shared')).toBe(batch);
    expect(await handles.place('marker')).toBe(placed);
    expect(batch).toHaveProperty('instanceCount', 2);
    if (!(batch instanceof BatchedMesh)) throw new Error('Missing native batch');
    const transform = new Matrix4(); batch.getMatrixAt(0, transform);
    const native = Float32Array.from(modelPoseMatrix({ x: 0, y: 0, z: 0, yaw: 1.2, scale: 0.8, pitch: 0.2, roll: -0.1 }).elements);
    expect(transform.elements).toEqual(Array.from(native));
    expect(() => parseWorldScenePlacement({ id: 'bad', model: 'marker', draw: 'batched',
      poses: [{ x: 0, y: 0, z: 0, matrix: new Matrix4().elements, yxz: { yaw: 0, scale: 1 } }] })).toThrow();
    expect(game.onUpdate).toHaveBeenCalledOnce();
    expect(await installWorldScenes(context, rows)).toBe(handles);
  } finally { owner.dispose(); registry.retire(); geometry.dispose(); material.dispose(); }
});

function rowsForFixture() {
  return { capacity: { instances: 2, vertices: 9, indices: 9 }, cull: { frustum: false, radiusBias: 0, step: 0 } };
}
