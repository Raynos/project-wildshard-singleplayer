import { expect, test, vi } from 'vitest';
import { Group, Mesh } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { ModelSite, Placed } from '../src/engine/models/place';
import { WorldAssembly } from '../src/game/shardfile/worldAssembly';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import type { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { legacyDouble } from './fake/FakeGame';
import type { ModelContext } from '../src/engine/models/model';

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
  const scenes = legacyDouble<SceneHandles>({ place: (id: string) => { placed.push(id); return place(id); }, group: (id: string) => { if (id !== 'wreck.root') throw new Error(id); return wreckRoot; },
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
  const assembly = WorldAssembly.admit(rows, { scope, scenes: legacyDouble<SceneHandles>({ place }), context: legacyDouble<ModelContext>({}), registry: null,
    entry: { root: new Group(), tier: 'phone' }, slice: () => Promise.resolve() });
  await expect(assembly.next('cove')).rejects.toThrow('piece registration'); expect(place).not.toHaveBeenCalled(); scope.dispose();
});
