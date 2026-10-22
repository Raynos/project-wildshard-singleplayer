import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateDefinedSection } from '../src/sdk/sections';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { ModelSite, Placed } from '../src/engine/models/place';
import type { ModelContext } from '../src/engine/models/model';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { BuildingCloudSchema, BuildingCloudPoseSchema, BuildingLifeLookSchema, BuildingLifeRowsSchema } from '../src/format/buildings';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { createBuildingCloud } from '../src/game/shardfile/buildingCloud';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { legacyDouble } from './fake/FakeGame';
import shrineRows from '../src/shards/driftwood-isle/data/buildingLife.json' with { type: 'json' };
import shrineBake from '../src/shards/driftwood-isle/data/shrineBake.json' with { type: 'json' };
import { WORLD_STAGES } from '../src/shards/driftwood-isle/generators/worldAssembly';

const pose = { seeds: false, name: 'shrine-fireflies', at: { point: 'shrine.root', offset: [0, 2, 0] }, parent: 'shrine.root', center: [0, 1, 0], radius: 18, order: 4 } satisfies v.InferOutput<typeof BuildingCloudPoseSchema>;
const lifeRow = { file: 'world/building-life.json', root: 'shrine.root', cloud: { draw: 'shrineFireflies', look: 'site-life-test-look', pose } };
const stages = { stages: [{ kind: 'site', id: 'shrine', label: 'Shrine', model: 'shrine', choice: 'world', life: lifeRow }] };
const bytes = new TextEncoder().encode(JSON.stringify(shrineRows));
function mesh3(node: Object3D): node is Mesh { return node instanceof Mesh; }
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>(resolve => { settle = resolve; });
  return { promise, resolve: settle };
}
function fixture(hot: boolean) {
  const owner = new Scope('cell'), scope = owner.child('construction'), resources = new SceneHandles({ setupMaterial: () => undefined });
  const group = new Group(), glyphs = new MeshBasicMaterial(), material = new MeshBasicMaterial(), events: string[] = [];
  group.position.set(12, 3, -5); group.rotation.y = 0.7; group.updateMatrixWorld(true);
  resources.publish('materials.glyphs', glyphs);
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const intake = createOwnedGeometry('unused'); intake.adopt(geometry);
  const copy = vi.spyOn(intake, 'copy');
  const handle = vi.fn((slot: string) => { if (slot !== 'shrineFireflies') throw new Error('missing slot'); return intake; });
  const draws: FixedDraws = { ready: true, handle, load: vi.fn(() => Promise.resolve()) };
  const lookScope = scope.child('looks');
  if (hot) lendLooks(lookScope, { materials: new Map([[lifeRow.cloud.look, material]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => material });
  const placed: Placed = { model: 'shrine', object: group, colliders: [], copies: 1, drawnAs: 'single', cull: () => undefined,
    copyBox: (_i, box) => box, nearest: () => 0, registered: Promise.resolve() };
  const site = vi.fn(() => { events.push('site'); return legacyDouble<ModelSite>({ group, placed, anchors: {}, floorHeightAt: () => 4 }); });
  const product: { file: ShardProduct['file'] } = { file: vi.fn(() => { events.push('read'); expect(group.children).toHaveLength(1); return Promise.resolve(bytes); }) };
  const ports: WorldAssemblyPorts = { scope, scenes: resources, sites: { site }, context: legacyDouble<ModelContext>({}), registry: null, draws, product,
    slice: label => { events.push(label); return Promise.resolve(); } };
  const close = (): void => { owner.dispose(); for (const child of group.children) if (mesh3(child)) { child.geometry.dispose(); if (child.material instanceof MeshBasicMaterial && child.material !== material) child.material.dispose(); }
    for (const id of [geometry.uuid]) if (resources.has(id)) resources.geometry(id).dispose(); geometry.dispose(); glyphs.dispose(); material.dispose(); };
  return { owner, scope, resources, group, glyphs, material, geometry, intake, copy, handle, draws, lookScope, events, site, product, ports, close };
}

for (const hot of [false, true]) test(`site life matches the original ${hot ? 'lent' : 'cold'} cloud and pulse after exactly one site slice`, async () => {
  const f = fixture(hot), original = fixture(false), assembly = WorldAssembly.admit(stages, f.ports);
  try {
    await assembly.next('shrine');
    original.resources.publish('shrine.root', original.group);
    const expected = createBuildingCloud(original.resources, { ...pose, geometry: original.resources.lend(original.intake.copy()), material: hot ? original.resources.lend(f.material) : null, visible: hot });
    original.group.add(expected);
    const data = v.parse(v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema, initialDusk: v.number() }), shrineRows);
    const oldLife = new LivingBuildings(original.resources, data.look); oldLife.add(data.life); oldLife.setDusk(data.initialDusk); oldLife.update(0);
    const cloud = f.group.children[0]; if (cloud === undefined || !mesh3(cloud)) throw new Error('Missing cloud');
    expect(f.events).toEqual(['site', 'Shrine', 'read']); expect(f.copy).toHaveBeenCalledTimes(1); expect(f.draws.load).not.toHaveBeenCalled();
    expect(cloud.name).toBe(expected.name); expect(cloud.position.toArray()).toEqual(expected.position.toArray());
    expect(cloud.geometry.getAttribute('position').array).toEqual(expected.geometry.getAttribute('position').array);
    expect(cloud.geometry.boundingSphere).toEqual(expected.geometry.boundingSphere); expect(cloud.renderOrder).toBe(expected.renderOrder); expect(cloud.visible).toBe(hot);
    if (hot) expect(cloud.material).toBe(f.material);
    else expect(cloud.material).toBeInstanceOf(MeshBasicMaterial);
    expect(f.resources.object('shrine.root')).toBe(f.group);
    const life = entryOwner(f.scope, 'buildings', 'shrine');
    expect(f.glyphs.color.toArray()).toEqual(original.glyphs.color.toArray());
    for (const dusk of [0, 0.35, 1]) for (const dt of [0, 1 / 30, 0.1, 2]) {
      life.setDusk(dusk); oldLife.setDusk(dusk); life.update(dt); oldLife.update(dt);
      expect(f.glyphs.color.toArray()).toEqual(original.glyphs.color.toArray()); expect(life.snapshot()).toEqual(oldLife.snapshot());
    }
    const child = f.scope.child('entered'); WorldAssembly.lend(stages, f.scope, child);
    expect(entryOwner(child, 'buildings', 'shrine')).toBe(life);
    const disposal = vi.spyOn(f.material, 'dispose'); child.dispose(); expect(disposal).not.toHaveBeenCalled(); disposal.mockRestore();
  } finally { f.close(); original.close(); }
});

test('life preflights original draws, product and publication before allocating the site', async () => {
  for (const missing of ['draws', 'ready', 'product', 'slot', 'root'] as const) {
    const f = fixture(false);
    try {
      let ports = f.ports;
      if (missing === 'draws') { const { draws: _draws, ...rest } = ports; ports = rest; }
      if (missing === 'ready') ports = { ...ports, draws: { ...f.draws, ready: false } };
      if (missing === 'product') { const { product: _product, ...rest } = ports; ports = rest; }
      if (missing === 'slot') ports = { ...ports, draws: { ...f.draws, handle: () => { throw new Error('slot'); } } };
      if (missing === 'root') f.resources.publish('shrine.root', new Group());
      await expect(WorldAssembly.admit(stages, ports).next('shrine')).rejects.toThrow();
      expect(f.site).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled(); expect(f.product.file).not.toHaveBeenCalled();
    } finally { f.close(); }
  }
});

test('retiring during the original site slice creates no cloud and reads no life file', async () => {
  const f = fixture(true), gate = deferred<undefined>();
  try {
    const assembly = WorldAssembly.admit(stages, { ...f.ports, slice: () => gate.promise }), pending = assembly.next('shrine');
    f.owner.onDispose(() => undefined); const steps = f.owner.disposeSteps(); steps.next();
    expect(f.scope.disposing).toBe(true); gate.resolve(undefined);
    await expect(pending).rejects.toThrow('owner left'); expect(f.copy).not.toHaveBeenCalled(); expect(f.product.file).not.toHaveBeenCalled();
    for (let step = steps.next(); step.done !== true; step = steps.next()) { /* drain */ }
  } finally { f.close(); }
});

test('leaving during the life read cannot construct or publish buildings or dispose a lent look', async () => {
  const f = fixture(true), gate = deferred<Uint8Array>();
  f.product.file = vi.fn(() => { expect(f.group.children).toHaveLength(1); return gate.promise; });
  const add = vi.spyOn(LivingBuildings.prototype, 'add'), disposed = vi.spyOn(f.material, 'dispose');
  try {
    const pending = WorldAssembly.admit(stages, f.ports).next('shrine');
    // the original site slice resolves before the cloud and file read
    await Promise.resolve(); expect(f.product.file).toHaveBeenCalledTimes(1);
    f.owner.dispose(); gate.resolve(bytes);
    await expect(pending).rejects.toThrow('owner left'); expect(add).not.toHaveBeenCalled(); expect(disposed).not.toHaveBeenCalled();
    expect(() => entryOwner(f.scope, 'buildings', 'shrine')).toThrow();
  } finally { add.mockRestore(); disposed.mockRestore(); f.close(); }
});

test('changed look identity across the old slice refuses before cloud creation or reading', async () => {
  const f = fixture(true), gate = deferred<undefined>(), successor = new MeshBasicMaterial();
  try {
    const pending = WorldAssembly.admit(stages, { ...f.ports, slice: () => gate.promise }).next('shrine');
    lendLooks(f.scope, { materials: new Map([[lifeRow.cloud.look, successor]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => successor }); gate.resolve(undefined);
    await expect(pending).rejects.toThrow('owners changed'); expect(f.copy).not.toHaveBeenCalled(); expect(f.product.file).not.toHaveBeenCalled();
  } finally { f.close(); successor.dispose(); }
});

test('changed read or look identity during a pending read prevents life effects and publication', async () => {
  for (const changed of ['read', 'look', 'draw', 'root'] as const) {
    const f = fixture(true), gate = deferred<Uint8Array>(), successor = new MeshBasicMaterial();
    f.product.file = () => gate.promise;
    const add = vi.spyOn(LivingBuildings.prototype, 'add');
    try {
      const pending = WorldAssembly.admit(stages, f.ports).next('shrine'); await Promise.resolve();
      if (changed === 'read') f.product.file = () => Promise.resolve(bytes);
      if (changed === 'look') lendLooks(f.scope, { materials: new Map([[lifeRow.cloud.look, successor]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => successor });
      if (changed === 'draw') f.handle.mockImplementation(() => createOwnedGeometry('replacement'));
      if (changed === 'root') { f.resources.release('shrine.root', f.group); f.resources.publish('shrine.root', new Group()); }
      gate.resolve(bytes); await expect(pending).rejects.toThrow(/changed/u); expect(add).not.toHaveBeenCalled();
      expect(() => entryOwner(f.scope, 'buildings', 'shrine')).toThrow();
    } finally { add.mockRestore(); f.close(); successor.dispose(); }
  }
});

test('the life descriptor is strict and reuses the original cloud parent-point law', () => {
  expect(v.parse(BuildingCloudPoseSchema, pose)).toEqual(pose);
  expect(() => v.parse(BuildingCloudPoseSchema, { ...pose, at: [0, 0, 0] })).toThrow('scene point');
  expect(() => v.parse(BuildingCloudSchema, { ...pose, at: [0, 0, 0], geometry: 'draw', material: null, visible: false })).toThrow('scene point');
  for (const life of [{ ...lifeRow, run: 'shrine' }, { ...lifeRow, cloud: { ...lifeRow.cloud, visible: true } }, { ...lifeRow, file: 'wrong.bin' }]) {
    expect(() => v.parse(WorldAssemblySchema, { stages: [{ ...stages.stages[0], life }] })).toThrow();
  }
});

test('production site data retains original firefly offsets and order without another stage', () => {
  const rows = v.parse(WorldAssemblySchema, WORLD_STAGES), shrine = rows.stages.find(row => row.id === 'shrine');
  if (shrine?.kind !== 'site') throw new Error('Missing shrine');
  expect(shrine.life).toEqual({ file: 'world/building-life.json', root: 'shrine.root', cloud: { draw: 'shrineFireflies', look: 'driftwood-shrine-fireflies',
    pose: { ...pose, at: { point: 'shrine.root', offset: [0, shrineBake.world.baseY, 0] }, center: [0, shrineBake.world.terrace - shrineBake.world.baseY, 0] } } });
  expect(rows.stages.filter(row => row.kind === 'site' && row.life !== undefined)).toHaveLength(1);
});

test('site-life custom sections convert with their suffix and defining checks intact', () => {
  expect(() => formatJsonSchema(WorldAssemblySchema, 'draft-07')).not.toThrow();
  const schema = formatJsonSchema(WorldAssemblySchema, 'draft-07');
  if (schema === undefined) throw new Error('Missing generated stage schema');
  const encoded = new TextEncoder().encode(encodeCanonicalJson(schema));
  expect(validateDefinedSection(encoded, stages)).toEqual(stages);
  const wrong = { stages: [{ ...stages.stages[0], life: { ...lifeRow, file: 'wrong.bin' } }] };
  expect(() => v.parse(WorldAssemblySchema, wrong)).toThrow();
  expect(() => validateDefinedSection(encoded, wrong)).toThrow();
});
