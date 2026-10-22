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
