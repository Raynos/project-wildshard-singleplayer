import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { ModelContext } from '../src/engine/models/model';
import type { Placed } from '../src/engine/models/place';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { ToonLook } from '../src/engine/render/families/toon';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { CoverCompositionSchema } from '../src/format/streamedCover';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { createStreamedCover } from '../src/game/looks/streamedCover';
import { toonLighting } from '../src/game/looks/toonLighting';
import { legacyDouble } from './fake/FakeGame';
import { WORLD_STAGES } from '../src/shards/driftwood-isle/generators/worldAssembly';
import authored from '../src/shards/driftwood-isle/data/groundCover.json' with { type: 'json' };
import compositionSource from '../src/shards/driftwood-isle/data/coverComposition.json' with { type: 'json' };
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };

const rows = { cell: 16, refill: 4, cacheMin: 16, growShare: 0.25, farRefill: 8, farSlack: 4, farIn: 0.5, eyeSlack: 1, uploadBytes: 128, nearLag: 1,
  look: 'stage-cover', meshPrefix: 'stage-', lighting: 'stage-light', params: { reach: 'reach', lodReach: 'farReach', mode: 'mode', keep: 'keep', viewer: 'player', slope: 'reachUp', growIn: 'farIn' },
  reachK: { phone: 1, desktop: 1 }, capK: { phone: 1, desktop: 1 }, farBudgetMs: { phone: 10, desktop: 10 },
  slopeReach: { up: 1, lo: 0.01, hi: 0.1, fadeFrom: 3, fadeTo: 10 }, kinds: [{ name: 'reed', geometry: 'reed', cap: 10, reach: [4, 12], scale: [1, 2], far: { geometry: 'reedFar', reach: [10, 24], cap: 10, keep: 1 } }] };
const stage = { kind: 'streamed-cover', id: 'cover', label: 'Ground cover', rows, file: 'world/cover-composition.json', placement: 'foliage.logs',
  draws: { reed: 'reedSlot', reedFar: 'reedFarSlot' }, object: 'driftwood.cover', system: 'shard.driftwood.cover' };
const stages = { stages: [stage] }, composition = v.parse(CoverCompositionSchema, compositionSource), bytes = new TextEncoder().encode(JSON.stringify(composition));
function cells(): Uint8Array {
  const cellBytes = new Uint8Array(84), view = new DataView(cellBytes.buffer);
  [0x43435357, 1, 16, 32768, 32768, 2, 1, 1, 1].forEach((word, i) => { view.setUint32(i * 4, word, true); });
  view.setUint16(36, 1, true); view.setUint16(38, 1, true);
  for (let i = 0; i < 2; i++) { const at = 40 + i * 22; view.setUint16(at, 5000, true); view.setUint16(at + 2, 2000, true); view.setUint16(at + 4, 8192, true); view.setUint16(at + 6, 60000, true); cellBytes.fill(128, at + 8, at + 22); }
  return cellBytes;
}
function gate<T>() { let settle: (value: T) => void = () => undefined; const promise = new Promise<T>(resolve => { settle = resolve; }); return { promise, resolve: settle }; }
function fixture() {
  setTerrainHeight(() => 0);
  const owner = new Scope('cell'), scope = owner.child('construction'), root = new Group(), resources = new SceneHandles({ setupMaterial: () => undefined }), logs = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  resources.publish('logs.mesh', logs);
  const geometry = new BoxGeometry(), near = createOwnedGeometry('near'), far = createOwnedGeometry('far'); near.adopt(geometry.clone()); far.adopt(geometry.clone());
  const copies = [vi.spyOn(near, 'copy'), vi.spyOn(far, 'copy')], handle = vi.fn((slot: string) => { if (slot === 'reedSlot') return near; if (slot === 'reedFarSlot') return far; throw new Error('Missing slot'); });
  const draws: FixedDraws = { ready: true, handle, load: vi.fn(() => Promise.resolve()) }, events: string[] = [], eye = new Vector3();
  const viewer = vi.fn(() => eye), registrations: { run: (dt: number, time: number) => void; label?: string }[] = [];
  const updates: Pick<Game, 'onUpdate'> = { onUpdate(run, label) { expect(this).toBe(updates); events.push('update'); const row = { run, ...(label === undefined ? {} : { label }) }; registrations.push(row); scope.onDispose(() => { const at = registrations.indexOf(row); if (at !== -1) registrations.splice(at, 1); }); } };
  const materials = new Map(['stage-cover-reed', 'stage-cover-reed-far'].map(id => [id, new MeshBasicMaterial()])), toon = new ToonLook();
  toonLighting({ id: rows.lighting, initial: { uToonLift: [0, 0, 0], uToonRim: [0, 0, 0], uCloudShadow: 0, uToonNight: 0, uSeaLevel: 0, uCloudTime: 0 } });
  lendLooks(scope, { materials, toon, setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => new MeshBasicMaterial() });
  const placed: Placed = { model: 'logs', object: logs, colliders: [], copies: 1, drawnAs: 'single', cull: () => undefined, copyBox: (_i, box) => box, nearest: () => 0, registered: Promise.resolve() };
  const place = vi.spyOn(resources, 'place').mockImplementation(() => { events.push('place'); return Promise.resolve(placed); });
  const product: { file: ShardProduct['file'] } = { file: vi.fn((name: string) => { events.push(name); return Promise.resolve(bytes); }) };
  const ports: WorldAssemblyPorts = { scope, scenes: resources, context: legacyDouble<ModelContext>({}), registry: null, product, draws, entry: { root, tier: 'phone' }, cover: { cells: cells(), viewer, updates }, slice: label => { events.push(label); return Promise.resolve(); } };
  const close = (): void => { owner.dispose(); root.traverse(node => { if (instance3(node)) node.geometry.dispose(); }); geometry.dispose(); logs.geometry.dispose(); logs.material.dispose(); for (const m of materials.values()) m.dispose(); near.take().dispose(); far.take().dispose(); };
  return { owner, scope, root, resources, logs, draws, copies, handle, events, eye, viewer, updates, registrations, place, placed, product, ports, materials, close };
}

async function original(f: ReturnType<typeof fixture>) {
  const data = v.parse(CoverCompositionSchema, JSON.parse(new TextDecoder().decode(await f.product.file(stage.file))));
  const placed = await f.resources.place(data.placement);
  for (const [name, slot] of Object.entries(stage.draws)) f.resources.publish(name, f.draws.handle(slot).copy());
  const cover = createStreamedCover(f.resources, rows, f.ports.cover?.cells ?? new Uint8Array()); cover.group.name = data.name;
  Object.assign(f.logs.userData, data.userData); cover.group.add(f.logs); f.root.add(cover.group);
  f.updates.onUpdate(dt => { cover.update(dt, f.viewer()); }, stage.system); await f.ports.slice(stage.label);
  return { cover, placed };
}
function group3(value: unknown): value is Group { return value instanceof Group; }
function instance3(value: unknown): value is InstancedMesh { return value instanceof InstancedMesh; }
function instances(root: Group) { return root.children.filter((node): node is InstancedMesh => node instanceof InstancedMesh).map(mesh => ({ name: mesh.name, count: mesh.count, matrix: Array.from(mesh.instanceMatrix.array), ground: Array.from(mesh.geometry.getAttribute('aGround').array), cover: Array.from(mesh.geometry.getAttribute('aCover').array) })); }

test('cover construction retains original decoder buffers, viewer, update receiver and one labelled slice', async () => {
  const old = fixture(), expected = await original(old), f = fixture();
  try {
    await WorldAssembly.admit(stages, f.ports).next('cover');
    const root = entryOwner(f.scope, 'object', 'driftwood.cover'); if (!group3(root)) throw new Error('Missing cover group');
    expect(f.events).toEqual(old.events); expect(f.events).toEqual([stage.file, 'place', 'update', 'Ground cover']);
    expect(f.place).toHaveBeenCalledExactlyOnceWith(stage.placement); expect(entryOwner(f.scope, 'placed', 'cover')).toEqual([f.placed]);
    expect(root.parent).toBe(f.root); expect(root.name).toBe(expected.cover.group.name); expect(f.logs.parent).toBe(root); expect(f.logs.userData).toEqual(old.logs.userData);
    for (const copy of f.copies) expect(copy).toHaveBeenCalledTimes(1); expect(f.draws.load).not.toHaveBeenCalled(); expect(f.viewer).not.toHaveBeenCalled();
    expect(f.registrations.map(row => row.label)).toEqual(['shard.driftwood.cover']);
    for (let frame = 0; frame < 12; frame++) {
      if (frame === 6) { f.eye.set(20, 2, 0); old.eye.copy(f.eye); }
      f.registrations[0]?.run(1 / 60, frame / 60); old.registrations[0]?.run(1 / 60, frame / 60);
      expect(instances(root)).toEqual(instances(expected.cover.group));
    }
    const entered = f.scope.child('entered'); WorldAssembly.lend(stages, f.scope, entered);
    expect(entryOwner(entered, 'object', 'driftwood.cover')).toBe(root); expect(entryOwner(entered, 'placed', 'cover')).toBe(entryOwner(f.scope, 'placed', 'cover'));
    entered.dispose(); expect(f.registrations).toHaveLength(1); f.owner.dispose(); expect(f.registrations).toHaveLength(0);
  } finally { f.close(); old.close(); }
});

test('missing cover authorities and geometry bindings refuse before reading or placement', async () => {
  for (const missing of ['cover', 'draws', 'ready', 'slot', 'root', 'product', 'look', 'mapping'] as const) {
    const f = fixture();
    try {
      let ports = f.ports, input: unknown = stages;
      if (missing === 'cover') { const { cover: _cover, ...rest } = ports; ports = rest; }
      if (missing === 'draws') { const { draws: _draws, ...rest } = ports; ports = rest; }
      if (missing === 'ready') ports = { ...ports, draws: { ...f.draws, ready: false } };
      if (missing === 'slot') f.handle.mockImplementation(() => { throw new Error('Missing slot'); });
      if (missing === 'root') { const { entry: _entry, ...rest } = ports; ports = rest; }
      if (missing === 'product') { const { product: _product, ...rest } = ports; ports = rest; }
      if (missing === 'look') input = { stages: [{ ...stage, rows: { ...rows, look: 'missing' } }] };
      if (missing === 'mapping') input = { stages: [{ ...stage, draws: { reed: 'reedSlot' } }] };
      await expect(WorldAssembly.admit(input, ports).next('cover')).rejects.toThrow();
      expect(f.product.file).not.toHaveBeenCalled(); expect(f.place).not.toHaveBeenCalled(); for (const copy of f.copies) expect(copy).not.toHaveBeenCalled(); expect(f.registrations).toHaveLength(0);
    } finally { f.close(); }
  }
});

test('a leave during the read or placement prevents later cover allocations and registration', async () => {
  for (const during of ['read', 'place'] as const) {
    const f = fixture(), read = gate<Uint8Array>(), place = gate<Placed>();
    if (during === 'read') f.product.file = () => read.promise; else f.place.mockImplementation(() => place.promise);
    try {
      const pending = WorldAssembly.admit(stages, f.ports).next('cover');
      if (during === 'place') await Promise.resolve();
      f.owner.onDispose(() => undefined); const steps = f.owner.disposeSteps(); steps.next();
      read.resolve(bytes); place.resolve(f.placed);
      await expect(pending).rejects.toThrow('owner left'); for (const copy of f.copies) expect(copy).not.toHaveBeenCalled(); expect(f.registrations).toHaveLength(0);
      for (let step = steps.next(); step.done !== true; step = steps.next()) { /* drain */ }
    } finally { f.close(); }
  }
});

test('changed readers, draws or native viewer authority after the read refuses before placement', async () => {
  for (const change of ['reader', 'handle', 'look', 'cover'] as const) {
    const f = fixture(), read = gate<Uint8Array>(); f.product.file = () => read.promise;
    try {
      const mutable = { ...f.ports }, pending = WorldAssembly.admit(stages, mutable).next('cover');
      if (change === 'reader') f.product.file = () => Promise.resolve(bytes);
      if (change === 'handle') f.handle.mockImplementation(() => createOwnedGeometry('replacement'));
      if (change === 'look') lendLooks(f.scope, { materials: new Map([['stage-cover-reed', new MeshBasicMaterial()]]), toon: new ToonLook(), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => new MeshBasicMaterial() });
      if (change === 'cover' && f.ports.cover !== undefined) mutable.cover = { ...f.ports.cover, viewer: () => new Vector3() };
      read.resolve(bytes); await expect(pending).rejects.toThrow('owners changed'); expect(f.place).not.toHaveBeenCalled(); expect(f.registrations).toHaveLength(0);
    } finally { f.close(); }
  }
});

test('cross-kind placement and object collisions refuse at admission; file placement must match its binding', async () => {
  const f = fixture();
  try {
    expect(() => WorldAssembly.admit({ stages: [stage, { kind: 'place', id: stage.placement, label: 'Duplicate' }] }, f.ports)).toThrow('Repeated world assembly placement');
    expect(() => WorldAssembly.admit({ stages: [stage, { kind: 'mesh', id: stage.object, label: 'Duplicate', part: 'logs.mesh' }] }, f.ports)).toThrow('Repeated world assembly object');
    f.product.file = () => Promise.resolve(new TextEncoder().encode(JSON.stringify({ ...composition, placement: 'other' })));
    await expect(WorldAssembly.admit(stages, f.ports).next('cover')).rejects.toThrow('placement differs'); expect(f.place).not.toHaveBeenCalled();
  } finally { f.close(); }
});

test('production cover rows preserve named composition and the late bridge-chain ordering', () => {
  const parsed = v.parse(WorldAssemblySchema, WORLD_STAGES), at = parsed.stages.findIndex(row => row.kind === 'streamed-cover'), row = parsed.stages[at];
  if (row?.kind !== 'streamed-cover') throw new Error('Missing cover');
  expect(row.rows).toMatchObject({ cell: authored.GROUND_COVER.cell, look: authored.GROUND_COVER.look }); expect(row.draws).toEqual(inventory.groups.cover);
  expect(row.placement).toBe(composition.placement); expect(row.object).toBe('driftwood.cover'); expect(row.system).toBe('shard.driftwood.cover');
  expect(parsed.stages[at - 1]?.id).toBe('palms'); expect(parsed.stages[at + 1]?.id).toBe('bridge.deck');
});
