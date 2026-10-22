import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import { installClientPlaceSets, requireClientPlaceSetsBound } from '../src/game/shardfile/clientPlaceSets';
import type { ShardContext } from '../src/game/plugin/context';
import { App } from '../src/engine/app/app';
import type { Game } from '../src/engine/core/Game';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { RopeChain } from '../src/engine/physics/ropeChain';
import { addPiece } from '../src/engine/physics/pieces';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { type Piece, WorldRegistry } from '../src/engine/world/registry';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import type { RopeDeckSpan } from '../src/format/ropeDeckSite';
import { RopeDeckSite } from '../src/game/models/ropeDeckSite';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { driftwoodRopeDeckSite } from '../src/shards/driftwood-isle/generators/ropeDeckSite';
import { bridgeDeck } from '../src/shards/driftwood-isle/generators/ropeBridge';
import { fixtureBytes } from './fixtures/nativeBytes';
import { fakeWorld } from './fake/world';
import { expect, test, vi } from 'vitest';
import { Group, Mesh, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { ModelSite, Placed } from '../src/engine/models/place';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import type { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { legacyDouble } from './fake/FakeGame';
import { modelContext, type ModelContext } from '../src/engine/models/model';

// G571: a world build's typed stages run in their declared order and publish concrete entry loans under their ids.
const stages = { stages: [{ kind: 'place', id: 'piers.world-0', label: 'Pier' }, { kind: 'site', id: 'hut', label: 'Hut', model: 'hut', choice: 'world' },
  { kind: 'mesh', id: 'trail', label: 'Trail', part: 'trail.mesh' }, { kind: 'group', id: 'wreck', label: 'Wreck', part: 'wreck.root' }] };
function fixture() {
  const scope = new Scope('construction'), placedObject = new Group(), mesh = new Mesh(), group = new Group(), siteGroup = new Group(), sliced: string[] = [];
  const placed: Placed = { model: 'pier', object: placedObject, colliders: [], copies: 1, drawnAs: 'single', cull: () => undefined, copyBox: (_i, target) => target,
    nearest: () => 0, registered: Promise.resolve() };
  const scenes = legacyDouble<SceneHandles>({ place: () => Promise.resolve(placed), floorAt: (id: string, x: number) => id === 'piers.world-0' ? x + 1 : undefined,
    mesh: (id: string) => { if (id !== 'trail.mesh') throw new Error('mesh'); return mesh; }, group: (id: string) => { if (id !== 'wreck.root') throw new Error('group'); return group; } });
  const site = legacyDouble<ModelSite>({ group: siteGroup, placed, anchors: { door: { x: 1, y: 2, z: 3, yaw: 0 } }, floorHeightAt: () => 4 });
  const assembly = WorldAssembly.admit(stages, { scope, scenes, sites: { site: () => site }, context: legacyDouble<ModelContext>({}), registry: null,
    slice: label => { sliced.push(label); return Promise.resolve(); } });
  return { scope, assembly, placed, placedObject, mesh, group, siteGroup, sliced };
}

test('each declared stage publishes its owner loans in order, sliced by its label', async () => {
  const f = fixture();
  try {
    await f.assembly.next('piers.world-0');
    expect(entryOwner(f.scope, 'object', 'piers.world-0')).toBe(f.placedObject); expect(entryOwner(f.scope, 'placed', 'piers.world-0')).toHaveLength(1); expect(entryOwner(f.scope, 'placed', 'piers.world-0')[0]).toBe(f.placed);
    expect(entryOwner(f.scope, 'floor', 'piers.world-0')(2, 0)).toBe(3);
    await f.assembly.next('hut');
    expect(entryOwner(f.scope, 'object', 'hut')).toBe(f.siteGroup); expect(entryOwner(f.scope, 'site', 'hut')['door']?.y).toBe(2); expect(entryOwner(f.scope, 'floor', 'hut')(0, 0)).toBe(4);
    await f.assembly.next('trail'); await f.assembly.next('wreck');
    expect(entryOwner(f.scope, 'object', 'trail')).toBe(f.mesh); expect(entryOwner(f.scope, 'object', 'wreck')).toBe(f.group);
    expect(f.sliced).toEqual(['Pier', 'Hut', 'Trail', 'Wreck']); expect(f.assembly.done).toBe(true);
  } finally { f.scope.dispose(); }
});

test('a stage out of its declared order, past the end or after its owner left refuses', async () => {
  const f = fixture();
  try {
    await expect(f.assembly.next('hut')).rejects.toThrow('expected piers.world-0');
    await f.assembly.next('piers.world-0');
    f.scope.dispose();
    await expect(f.assembly.next('hut')).rejects.toThrow();
  } finally { if (!f.scope.disposed) f.scope.dispose(); }
  const ports = { scope: new Scope('refused'), scenes: legacyDouble<SceneHandles>({}), context: legacyDouble<ModelContext>({}), registry: null, slice: () => Promise.resolve() };
  expect(() => WorldAssembly.admit({ stages: [{ kind: 'run', id: 'shore', label: 'Shore' }] }, ports)).toThrow();
  ports.scope.dispose();
});

test('completed stage loans keep the construction owner across repeated entries', async () => {
  const f = fixture(), entered = f.scope.child('entered');
  const dispose = vi.spyOn(f.mesh.geometry, 'dispose'); f.scope.own(f.mesh.geometry);
  try {
    for (const row of stages.stages) await f.assembly.next(row.id);
    WorldAssembly.lend(stages, f.scope, f.scope); // standalone already owns these publications
    WorldAssembly.lend(stages, f.scope, entered);
    for (const kind of ['object', 'placed', 'site', 'floor'] as const) expect(entryOwner(entered, kind, 'hut')).toBe(entryOwner(f.scope, kind, 'hut'));
    expect(entryOwner(entered, 'object', 'trail')).toBe(f.mesh);
    expect(entryOwner(entered, 'floor', 'piers.world-0')(2, 0)).toBe(3);
    entered.dispose(); expect(dispose).not.toHaveBeenCalled();
    expect(() => entryOwner(entered, 'object', 'hut')).toThrow('scope has ended');
    const next = f.scope.child('next'); WorldAssembly.lend(stages, f.scope, next);
    expect(entryOwner(next, 'object', 'hut')).toBe(f.siteGroup);
    f.scope.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => entryOwner(next, 'object', 'hut')).toThrow('scope has ended');
  } finally { f.scope.dispose(); dispose.mockRestore(); }
});

test('missing stages, foreign constructions and duplicate declarations lend nothing', async () => {
  const f = fixture(), entered = f.scope.child('entered'), foreign = new Scope('foreign');
  try {
    await f.assembly.next('piers.world-0');
    expect(() => WorldAssembly.lend(stages, f.scope, entered)).toThrow('Missing live entry owner');
    expect(() => entryOwner(entered, 'object', 'piers.world-0')).toThrow('Missing live entry owner');
    expect(() => WorldAssembly.lend(stages, f.scope, foreign)).toThrow('construction ancestor');
    expect(() => WorldAssembly.lend({ stages: [stages.stages[0], stages.stages[0]] }, f.scope, entered)).toThrow('Repeated');
    expect(() => WorldAssembly.lend({ stages: [{ kind: 'run', id: 'old', label: 'Old' }] }, f.scope, entered)).toThrow();
  } finally { f.scope.dispose(); foreign.dispose(); }
});

// sp-x8 QX: a retired or retiring construction allocates and publishes nothing more
function retiring() {
  const parent = new Scope('cell'), scope = parent.child('construction'); parent.onDispose(() => undefined); // the newest cleanup retires first
  let settle: (value: Placed) => void = () => undefined;
  const late = new Promise<Placed>(resolve => { settle = resolve; }), site = vi.fn<() => ModelSite>();
  const scenes = legacyDouble<SceneHandles>({ place: () => late, floorAt: () => 0 });
  const assembly = WorldAssembly.admit(stages, { scope, scenes, sites: { site }, context: legacyDouble<ModelContext>({}), registry: null, slice: () => Promise.resolve() });
  const placed: Placed = { model: 'pier', object: new Group(), colliders: [], copies: 1, drawnAs: 'single', cull: () => undefined, copyBox: (_i, target) => target,
    nearest: () => 0, registered: Promise.resolve() };
  return { parent, scope, assembly, site, resolve: () => { settle(placed); } };
}
test('duplicate stage ids refuse at admission, before any stage runs', () => {
  const scope = new Scope('construction'), place = vi.fn<() => Promise<Placed>>();
  const twice = { stages: [{ kind: 'place', id: 'pier', label: 'Pier' }, { kind: 'mesh', id: 'pier', label: 'Again', part: 'pier.mesh' }] };
  expect(() => WorldAssembly.admit(twice, { scope, scenes: legacyDouble<SceneHandles>({ place }), context: legacyDouble<ModelContext>({}), registry: null,
    slice: () => Promise.resolve() })).toThrow('Repeated'); expect(place).not.toHaveBeenCalled(); scope.dispose();
});
test('a late place whose ancestor started retiring publishes nothing and refuses', async () => {
  const f = retiring(), pending = f.assembly.next('piers.world-0');
  const steps = f.parent.disposeSteps(); steps.next();
  expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
  f.resolve();
  await expect(pending).rejects.toThrow('owner left');
  for (let step = steps.next(); step.done !== true; step = steps.next()) { /* finish the retirement */ }
  expect(() => entryOwner(f.scope, 'object', 'piers.world-0')).toThrow();
});
test('a site stage never allocates for a retired or retiring construction', async () => {
  const f = retiring(), first = f.assembly.next('piers.world-0'); f.resolve(); await first;
  const steps = f.parent.disposeSteps(); steps.next();
  await expect(f.assembly.next('hut')).rejects.toThrow('owner left'); expect(f.site).not.toHaveBeenCalled();
  for (let step = steps.next(); step.done !== true; step = steps.next()) { /* finish the retirement */ }
  const g = retiring(), pier = g.assembly.next('piers.world-0'); g.resolve(); await pier;
  g.scope.dispose();
  await expect(g.assembly.next('hut')).rejects.toThrow('owner left'); expect(g.site).not.toHaveBeenCalled();
  g.parent.dispose();
});

// G571 entry kind: declared world entry rows as one stage, publishing what its applied rows loaded
const placedNamed = (model: string): Placed => ({ model, object: new Group(), colliders: [], copies: 1, drawnAs: 'single', cull: () => undefined,
  copyBox: (_i, target) => target, nearest: () => 0, registered: Promise.resolve() });
const entryStages = { stages: [{ kind: 'entry', id: 'wreck', label: 'Wreck', object: { as: 'group', part: 'wreck.root' }, floor: 'wreck.ship', rows: [
  { kind: 'place', id: 'wreck.ship' }, { kind: 'place', id: 'wreck.reef.phone', when: { tier: 'phone' } }, { kind: 'place', id: 'wreck.reef.desktop', when: { tier: 'desktop' } },
  { kind: 'attach', id: 'wreck.root', as: 'group' }] }, { kind: 'entry', id: 'decks', label: 'Decks', rows: [{ kind: 'place', id: 'entry.decks' }] }] };
function entryFixture(place: (id: string) => Promise<Placed> = id => Promise.resolve(placedNamed(id)), scope = new Scope('construction')) {
  const root = new Group(), wreckRoot = new Group(), placed: string[] = [];
  const scenes = legacyDouble<SceneHandles>({ frozen: () => false, place: (id: string) => { placed.push(id); return place(id); }, group: (id: string) => { if (id !== 'wreck.root') throw new Error(id); return wreckRoot; },
    floorAt: (id: string, x: number) => id === 'wreck.ship' ? x * 2 : undefined });
  const assembly = WorldAssembly.admit(entryStages, { scope, scenes, context: legacyDouble<ModelContext>({}), registry: null, entry: { root, tier: 'phone' }, slice: () => Promise.resolve() });
  return { scope, root, wreckRoot, placed, assembly };
}
test('an entry stage runs its tier rows in order and publishes its placements, object and floor', async () => {
  const f = entryFixture(), entered = f.scope.child('entered');
  try {
    await f.assembly.next('wreck'); await f.assembly.next('decks');
    expect(f.placed).toEqual(['wreck.ship', 'wreck.reef.phone', 'entry.decks']);
    expect(entryOwner(f.scope, 'placed', 'wreck').map(row => row.model)).toEqual(['wreck.ship', 'wreck.reef.phone']);
    expect(entryOwner(f.scope, 'object', 'wreck')).toBe(f.wreckRoot); expect(f.wreckRoot.parent).toBe(f.root);
    expect(entryOwner(f.scope, 'floor', 'wreck')(3, 0)).toBe(6);
    expect(() => entryOwner(f.scope, 'object', 'decks')).toThrow('Missing live entry owner');
    WorldAssembly.lend(entryStages, f.scope, entered);
    expect(entryOwner(entered, 'placed', 'decks')).toBe(entryOwner(f.scope, 'placed', 'decks')); expect(entryOwner(entered, 'floor', 'wreck')(1, 0)).toBe(2);
  } finally { f.scope.dispose(); }
});
test('an entry placement placed twice, or a floor on a tier row, refuses at admission', () => {
  const ports = { scope: new Scope('refused'), scenes: legacyDouble<SceneHandles>({}), context: legacyDouble<ModelContext>({}), registry: null, slice: () => Promise.resolve() };
  expect(() => WorldAssembly.admit({ stages: [{ kind: 'place', id: 'entry.decks', label: 'Pier' }, entryStages.stages[1]] }, ports)).toThrow('Repeated world assembly placement');
  expect(() => WorldAssembly.admit({ stages: [{ ...entryStages.stages[0], floor: 'wreck.reef.phone' }] }, ports)).toThrow('unconditional place row');
  ports.scope.dispose();
});
test('an entry stage whose ancestor starts retiring during a row loads no more rows and publishes nothing', async () => {
  const parent = new Scope('cell'), scope = parent.child('construction'); parent.onDispose(() => undefined);
  let settle: (value: Placed) => void = () => undefined;
  const late = new Promise<Placed>(resolve => { settle = resolve; }), f = entryFixture(() => late, scope);
  const pending = f.assembly.next('wreck'), steps = parent.disposeSteps(); steps.next();
  settle(placedNamed('wreck.ship'));
  await expect(pending).rejects.toThrow('owner left');
  expect(f.placed).toEqual(['wreck.ship']); expect(f.wreckRoot.parent).toBeNull();
  for (let step = steps.next(); step.done !== true; step = steps.next()) { /* finish the retirement */ }
  expect(() => entryOwner(scope, 'placed', 'wreck')).toThrow();
});
test('an entry stage with a piece row and no piece authority refuses before its first row', async () => {
  const scope = new Scope('construction'), place = vi.fn<() => Promise<Placed>>();
  const rows = { stages: [{ kind: 'entry', id: 'cove', label: 'Cove', rows: [{ kind: 'place', id: 'cove.reef' }, { kind: 'piece', id: 'cove', name: 'Cove', file: 'cove.ts', category: 'nature',
    surface: 'rock', colliders: [], floors: [], floorPolicy: 'first', solidFloor: true, object: null }] }] };
  const assembly = WorldAssembly.admit(rows, { scope, scenes: legacyDouble<SceneHandles>({ frozen: () => false, place }), context: legacyDouble<ModelContext>({}), registry: null,
    entry: { root: new Group(), tier: 'phone' }, slice: () => Promise.resolve() });
  await expect(assembly.next('cove')).rejects.toThrow('piece registration'); expect(place).not.toHaveBeenCalled(); scope.dispose();
});
test('an entry attach row with a parent puts its part under that scene group, not the world root', async () => {
  const scope = new Scope('construction'), root = new Group(), cove = new Group(), cascade = new Group();
  const scenes = legacyDouble<SceneHandles>({ group: (id: string) => { if (id === 'cove.root') return cove; if (id === 'cascade.root') return cascade; throw new Error(id); } });
  const rows = { stages: [{ kind: 'entry', id: 'cove', label: 'Cove', object: { as: 'group', part: 'cove.root' }, rows: [{ kind: 'attach', id: 'cascade.root', as: 'group', parent: 'cove.root' }] }] };
  const assembly = WorldAssembly.admit(rows, { scope, scenes, context: legacyDouble<ModelContext>({}), registry: null, entry: { root, tier: 'phone' }, slice: () => Promise.resolve() });
  try {
    await assembly.next('cove');
    expect(cascade.parent).toBe(cove); expect(root.children).toHaveLength(0); expect(entryOwner(scope, 'object', 'cove')).toBe(cove);
    expect(entryOwner(scope, 'placed', 'cove')).toEqual([]);
  } finally { scope.dispose(); }
});
test('an entry stage with a terrain cut and no physics refuses before its first row; a bad cut row refuses at admission', async () => {
  const scope = new Scope('construction'), place = vi.fn<() => Promise<Placed>>();
  const cut = { kind: 'cut', cuts: [{ x: 1, z: 2, hw: 3, hd: 4, yaw: 0, below: -5 }] };
  const ports = { scope, scenes: legacyDouble<SceneHandles>({ place }), context: legacyDouble<ModelContext>({}), registry: null, entry: { root: new Group(), tier: 'phone' as const }, slice: () => Promise.resolve() };
  const assembly = WorldAssembly.admit({ stages: [{ kind: 'entry', id: 'cove', label: 'Cove', rows: [{ kind: 'place', id: 'cove.reef' }, cut] }] }, ports);
  await expect(assembly.next('cove')).rejects.toThrow('needs its physics'); expect(place).not.toHaveBeenCalled();
  expect(() => WorldAssembly.admit({ stages: [{ kind: 'entry', id: 'cove', label: 'Cove', rows: [{ kind: 'cut', cuts: [] }] }] }, ports)).toThrow();
  scope.dispose();
});

function ropeMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }

// Rope placement stays early; allocation and fixed-post capture stay after cover.
const ropeSpan = { a: [0, 0], b: [12, 0], sag: 0.9 } satisfies RopeDeckSpan;
function ropeRows() {
  return { stages: [
    { kind: 'rope-deck' as const, id: 'bridge', label: 'Rope bridge', site: driftwoodRopeDeckSite(), span: ropeSpan },
    { kind: 'rope-chain' as const, id: 'bridge.deck', label: 'Bridge physics and paths', deck: 'bridge', capture: 'shard.driftwood.bridge.capture' },
  ] } as const;
}
async function ropeFixture() {
  const scope = new Scope('rope-construction'), entered = scope.child('rope-entered'), world = fakeWorld(), app = new App();
  const R = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm', import.meta.url))));
  const physics = new Physics(R, undefined, scope), registry = new WorldRegistry(); registry.scope = scope;
  registry.onAdd(piece => { addPiece(physics, piece); });
  const template = createOwnedGeometry('rope-test'); template.adopt(bridgeDeck(ropeSpan, () => 0));
  const copy = vi.spyOn(template, 'copy'), load = vi.fn<FixedDraws['load']>(() => Promise.reject(new Error('The stage must not load a second library')));
  const draws: FixedDraws = { ready: true, handle: slot => { if (slot !== 'bridgeDeck' && slot !== 'bridgeSpecimenDeck') throw new Error('Unknown original slot'); return template; }, load };
  const order: string[] = [], captures: { phase: string; id: string | undefined; scope: Scope }[] = [];
  const fixed: Pick<Game, 'onFixed'> = { onFixed: (phase, run, id) => {
    order.push('capture'); captures.push({ phase, id, scope });
    if (phase !== 'post' || id === undefined) throw new Error('Wrong fixed authority');
    app.addContentSystem({ id, phase: 'fixed.post', run }, scope);
  } };
  const ports: WorldAssemblyPorts = { scope, scenes: legacyDouble<SceneHandles>({}), context: modelContext(world.sky), registry, draws, physics, fixed,
    slice: label => { order.push(label); return Promise.resolve(); } };
  const clean = (): void => {
    for (const piece of registry.pieces) piece.object?.traverse(object => {
      if (ropeMesh(object)) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); }
    });
    scope.dispose(); registry.retire(); physics.dispose(); template.take().dispose();
  };
  return { scope, entered, physics, registry, draws, copy, load, order, captures, app, ports, world, clean };
}
test('rope stages retain original bodies/handles, rest/posed floors and the late capture order', async () => {
  const actual = await ropeFixture(), original = await ropeFixture(), rows = ropeRows();
  setTerrainHeight(() => 0);
  try {
    const site = new RopeDeckSite(rows.stages[0].site, { ready: true, draw: slot => original.draws.handle(slot), load: () => original.draws.load() });
    const oldDeck = site.place(original.world.sky, ropeSpan, original.registry);
    const assembly = WorldAssembly.admit(rows, actual.ports); await assembly.next('bridge');
    const deck = entryOwner(actual.scope, 'rope-deck', 'bridge');
    expect(entryOwner(actual.scope, 'object', 'bridge')).toBe(deck.placed.object);
    expect(entryOwner(actual.scope, 'placed', 'bridge')).toEqual([deck.placed]);
    expect(entryOwner(actual.scope, 'floor', 'bridge')).toBe(deck.floorHeightAt);
    expect(deck.floorHeightAt(6, 0)).toBe(oldDeck.floorHeightAt(6, 0));
    expect(actual.captures).toEqual([]); expect(() => entryOwner(actual.scope, 'chain', 'bridge.deck')).toThrow('Missing live entry owner');
    expect(() => WorldAssembly.lend(rows, actual.scope, actual.entered)).toThrow('Missing live entry owner');
    expect(() => entryOwner(actual.entered, 'object', 'bridge')).toThrow('Missing live entry owner');
    // A body owned by the intervening cover stage makes allocation order observable in the native handles.
    actual.order.push('cover');
    actual.physics.world.createRigidBody(actual.physics.R.RigidBodyDesc.fixed().setTranslation(0, 0, 100));
    original.physics.world.createRigidBody(original.physics.R.RigidBodyDesc.fixed().setTranslation(0, 0, 100));
    const oldChain = new RopeChain(original.physics, oldDeck.chainSpec());
    await assembly.next('bridge.deck');
    const chain = entryOwner(actual.scope, 'chain', 'bridge.deck');
    expect(actual.order).toEqual(['Rope bridge', 'cover', 'capture', 'Bridge physics and paths']);
    expect(actual.captures).toEqual([{ phase: 'post', id: 'shard.driftwood.bridge.capture', scope: actual.scope }]);
    expect(chain.bodies.map(body => body.handle)).toEqual(oldChain.bodies.map(body => body.handle));
    expect(chain.spec.segments).toEqual(oldChain.spec.segments); expect(chain.spec.owners?.map(owner => typeof owner==='object'&&owner!==null&&'id' in owner?owner.id:null)).toEqual(oldChain.spec.owners?.map(owner => typeof owner==='object'&&owner!==null&&'id' in owner?owner.id:null));
    const capture = vi.spyOn(chain, 'capture');
    for (let frame = 0; frame < 8; frame++) {
      actual.physics.step(); original.physics.step(); oldChain.capture();
      for (const system of actual.app.systemsByPhase()['fixed.post']) system.run(1 / 60, frame / 60);
      deck.setPoses(chain, 0.4); oldDeck.setPoses(oldChain, 0.4);
      expect(chain.bodies.map(body => [body.translation(), body.rotation()])).toEqual(oldChain.bodies.map(body => [body.translation(), body.rotation()]));
      expect(deck.floorHeightAt(6, 0)).toBe(oldDeck.floorHeightAt(6, 0));
    }
    expect(capture).toHaveBeenCalledTimes(8); expect(actual.load).not.toHaveBeenCalled();
    expect(Array.from(actual.physics.snapshot())).toEqual(Array.from(original.physics.snapshot()));
    WorldAssembly.lend(rows, actual.scope, actual.entered);
    expect(entryOwner(actual.entered, 'rope-deck', 'bridge')).toBe(deck); expect(entryOwner(actual.entered, 'chain', 'bridge.deck')).toBe(chain);
    actual.entered.dispose(); expect(actual.app.systemsByPhase()['fixed.post']).toHaveLength(1);
    const count = chain.bodies.length; expect(count).toBeGreaterThan(0);
    actual.scope.dispose(); expect(actual.app.systemsByPhase()['fixed.post']).toHaveLength(0);
    expect(actual.physics.world.bodies.len()).toBe(0);
  } finally { actual.clean(); original.clean(); setTerrainHeight(() => 0); }
});
test('rope-chain admission requires an earlier deck and one capture per deck', async () => {
  const f = await ropeFixture(), rows = ropeRows(), deck = rows.stages[0], chain = rows.stages[1];
  try {
    expect(() => WorldAssembly.admit({ stages: [deck, { kind: 'entry', id: 'duplicate-entry', label: 'Duplicate', rows: [{ kind: 'place', id: 'bridge' }] }] }, f.ports)).toThrow('Repeated world assembly placement');
    expect(() => WorldAssembly.admit({ stages: [chain, deck] }, f.ports)).toThrow('earlier rope-deck');
    expect(() => WorldAssembly.admit({ stages: [deck, { ...chain, deck: 'absent' }] }, f.ports)).toThrow('earlier rope-deck');
    expect(() => WorldAssembly.admit({ stages: [deck, chain, { ...chain, id: 'another.chain' }] }, f.ports)).toThrow('Repeated world rope chain');
    expect(f.copy).not.toHaveBeenCalled(); expect(f.physics.world.bodies.len()).toBe(0);
  } finally { f.clean(); }
});
test('missing or unloaded fixed draws and a missing registry refuse before rope placement', async () => {
  const f = await ropeFixture();
  try {
    const { draws: _draws, ...withoutDraws } = f.ports;
    await expect(WorldAssembly.admit(ropeRows(), withoutDraws).next('bridge')).rejects.toThrow('loaded fixed draws');
    await expect(WorldAssembly.admit(ropeRows(), { ...f.ports, draws: { ...f.draws, ready: false } }).next('bridge')).rejects.toThrow('loaded fixed draws');
    await expect(WorldAssembly.admit(ropeRows(), { ...f.ports, registry: null }).next('bridge')).rejects.toThrow('registry');
    expect(f.copy).not.toHaveBeenCalled(); expect(f.registry.pieces).toHaveLength(0); expect(f.load).not.toHaveBeenCalled();
  } finally { f.clean(); }
});
test('missing native physics or fixed-post authority refuses before the first rope body', async () => {
  for (const missing of ['physics', 'fixed'] as const) {
    const f = await ropeFixture();
    try {
      const { [missing]: _missing, ...ports } = f.ports, assembly = WorldAssembly.admit(ropeRows(), ports);
      await assembly.next('bridge'); const before = f.physics.world.bodies.len();
      await expect(assembly.next('bridge.deck')).rejects.toThrow('physics and fixed-post');
      expect(f.physics.world.bodies.len()).toBe(before); expect(f.captures).toEqual([]);
    } finally { f.clean(); }
  }
});
test('retirement across the placement slice refuses late chain allocation and publication', async () => {
  const f = await ropeFixture(); let release = (): void => undefined;
  const slice = new Promise<void>(resolve => { release = resolve; });
  const assembly = WorldAssembly.admit(ropeRows(), { ...f.ports, slice: () => slice });
  try {
    const pending = assembly.next('bridge'); f.scope.dispose(); release();
    await expect(pending).rejects.toThrow('owner left');
    await expect(assembly.next('bridge.deck')).rejects.toThrow('owner left'); expect(f.captures).toEqual([]);
    expect(() => entryOwner(f.scope, 'rope-deck', 'bridge')).toThrow('scope has ended'); expect(f.physics.world.bodies.len()).toBe(0);
  } finally { f.clean(); }
});
test('a retiring construction never copies a rope draw or allocates a chain', async () => {
  const f = await ropeFixture(), assembly = WorldAssembly.admit(ropeRows(), f.ports);
  f.scope.onDispose(() => undefined); const steps = f.scope.disposeSteps(); steps.next();
  try {
    await expect(assembly.next('bridge')).rejects.toThrow('owner left'); expect(f.copy).not.toHaveBeenCalled(); expect(f.captures).toEqual([]);
  } finally { for (const step of steps) void step; f.clean(); }
});

test('retirement across the chain slice removes capture, loans and native bodies', async () => {
  const f = await ropeFixture(); let release = (): void => undefined;
  const slice = new Promise<void>(resolve => { release = resolve; });
  const assembly = WorldAssembly.admit(ropeRows(), { ...f.ports, slice: label => label === 'Bridge physics and paths' ? slice : Promise.resolve() });
  try {
    await assembly.next('bridge'); const pending = assembly.next('bridge.deck');
    expect(f.captures).toHaveLength(1); expect(f.physics.world.bodies.len()).toBeGreaterThan(0);
    f.scope.dispose(); release(); await expect(pending).rejects.toThrow('owner left');
    expect(f.app.systemsByPhase()['fixed.post']).toHaveLength(0); expect(f.physics.world.bodies.len()).toBe(0);
    expect(() => entryOwner(f.scope, 'chain', 'bridge.deck')).toThrow('scope has ended');
  } finally { f.clean(); }
});
test('an entry piece row registers its collider owner, its declared collider surfaces and no scene object when it names none', async () => {
  const scope = new Scope('construction'), pieces: Piece[] = [];
  const rows = { stages: [{ kind: 'entry', id: 'decks', label: 'Decks', rows: [{ kind: 'piece', id: 'nds-deck.north', name: 'North deck', file: 'deck.ts', category: 'buildings',
    surface: 'stone', surfaces: ['stone', 'wood'], colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1, surface: 'stone' }, { kind: 'box', x: 2, y: 0, z: 0, hx: 1, hy: 1, hz: 1, surface: 'wood' }],
    floors: [], floorPolicy: 'first', solidFloor: false, object: null, colliderOwner: 'deck.north' }] }] };
  const assembly = WorldAssembly.admit(rows, { scope, scenes: legacyDouble<SceneHandles>({}), context: legacyDouble<ModelContext>({}), registry: null,
    entry: { root: new Group(), tier: 'phone', piece: piece => { pieces.push(piece); } }, slice: () => Promise.resolve() });
  try {
    await assembly.next('decks');
    expect(pieces).toHaveLength(1); expect(pieces[0]?.colliderOwner).toBe('deck.north'); expect(pieces[0]?.object).toBeUndefined();
    expect(pieces[0]?.colliders).toHaveLength(2);
  } finally { scope.dispose(); }
});


test('native dressing stages borrow original groups and complete the original place-set owner without scene handles', async () => {
  const scope = new Scope('orchard-native'), root = new Group(), registry = new WorldRegistry();
  const product = legacyDouble<ShardContext['product']>({ slug: 'orchard', hasFile: () => false });
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  const world = legacyDouble<NonNullable<Runtime['world']>>({ sky: legacyDouble<NonNullable<Runtime['world']>['sky']>({}), game: legacyDouble<Game>({}) });
  const runtime = legacyDouble<Runtime>({ world });
  const ctx = legacyDouble<ShardContext>({ scope, root, product, app: legacyDouble<ShardContext['app']>({ registry }),
    game: legacyDouble<ShardContext['game']>({ runtime }), system: () => undefined });
  const rows = { name: 'orchard', catalogues: [], packs: {}, geometry: {}, materials: {}, layers: [], animations: [],
    statics: [{ name: 'gate', anchors: { tie: [{ x: 1.25, y: 3, z: 5 }] }, tris: 0, members: [], geometry: {}, materials: {}, recipe: { version: 1, root: 'root', materials: [], nodes: [{ kind: 'group', id: 'root', children: [] }] } }] };
  try {
    const original = await SceneDressing.install(ctx, rows);
    installClientPlaceSets(ctx, { kind: 'world.sets', rows: [] });
    const assembly = WorldAssembly.admit({ stages: [{ kind: 'dressing-piece', id: 'gate', part: 'gate' }, { kind: 'dressing-anchor', id: 'tie', part: 'gate', anchor: 'tie' }, { kind: 'dressing-anchor', id: 'absent', part: 'gate', anchor: 'absent' }, { kind: 'dressing', id: 'dressing', bindSets: true }] },
      { scope, weatherContext: ctx, context: legacyDouble<ModelContext>({}), registry, slice: () => { throw new Error('Native stages have no implicit slice'); } });
    await assembly.next('gate'); await assembly.next('tie'); await assembly.next('absent'); await assembly.next('dressing');
    expect(entryOwner(scope, 'object', 'gate')).toBe(original.pieces.get('gate')?.object);
    expect(entryOwner(scope, 'object', 'dressing')).toBe(original.group);
    const tie = entryOwner(scope, 'world-point', 'tie');
    expect(tie?.toArray()).toEqual([1.25, 3, 5]);
    expect(entryOwner(scope, 'world-point', 'absent')).toBeNull();
    expect(root.children).toEqual([original.group]); expect(assembly.done).toBe(true);
    expect(() => requireClientPlaceSetsBound(ctx)).not.toThrow();
  } finally { scope.dispose(); }
});
