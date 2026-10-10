import { expect, it } from 'vitest';
import { CompendiumRules } from '../../src/game/compendium/rules';
import { CompendiumTracker, type TrackedAnimal, type TrackerEye } from '../../src/game/compendium/tracker';
import type { ShardCompendium } from '../../src/game/compendium/types';

const def: ShardCompendium = { chunkId: 'tracker', skin: { className: 'test', title: 'Test', tabs: [], stamp: () => '', stats: () => [] },
  entries: [
    { id: 'animal', kind: 'species', tab: 'beasts', name: 'Animal', notes: '', plate: { sketch: '' }, match: { kind: 'herd' }, massKg: 100 },
    { id: 'place', kind: 'place', tab: 'places', name: 'Place', notes: '', plate: { sketch: '' }, place: { x: 0, z: 0, r: 10 } },
  ] };
type Body = TrackedAnimal & { entityId: string };
const animal = (id: string, x: number, z: number): Body => ({ entityId: id, kind: 'herd', variant: 'common', scale: 1.25,
  alive: true, hidden: false, position: { x, y: 0, z } });
const eye = (x = 0): TrackerEye => ({ position: { x, y: 0.8, z: 0 }, forward: { x: 0, y: 0, z: -1 } });
const identity = (list: readonly Body[]): ((body: TrackedAnimal) => string) => {
  const ids = new Map<TrackedAnimal, string>(list.map(body => [body, body.entityId]));
  return body => ids.get(body) ?? '';
};

it('restores the partial poll, exact object sightings, kill mass and place-edge hysteresis without duplicate counts', () => {
  const bodies = [animal('one', 0, -10), animal('two', 0, 10)];
  const originalState = new CompendiumRules(def), original = new CompendiumTracker(originalState);
  original.update(0.25, eye(), bodies); original.update(0.2, eye(), bodies);
  expect(originalState.stats('animal')).toMatchObject({ state: 'seen', seen: 1 });
  expect(originalState.stats('place').seen).toBe(1);
  const replacement = bodies.map(body => ({ ...body, position: { ...body.position } }));
  const restoredState = new CompendiumRules(def); restoredState.restore(originalState.snapshot());
  const restored = new CompendiumTracker(restoredState);
  restored.prepareRestore(original.snapshot(bodies, identity(bodies)), replacement, identity(replacement))();
  for (const [tracker, current] of [[original, bodies], [restored, replacement]] as const) {
    tracker.update(0.04, eye(12), current); // Partial clock is not due yet.
    tracker.update(0.02, eye(12), current); // Outside the place but within its hysteresis.
    tracker.update(0.25, eye(), current); // No second visit or first-body sighting.
    const first = current[0]; if (first === undefined) throw new Error('Missing fixture body'); tracker.killed(first);
    tracker.update(0.25, eye(15), current); tracker.update(0.25, eye(), current); // Re-enter after actual departure.
    tracker.update(0.25, { position: eye().position, forward: { x: 0, y: 0, z: 1 } }, current);
  }
  expect(restoredState.snapshot()).toEqual(originalState.snapshot());
  expect(restoredState.stats('place').seen).toBe(2);
  expect(restoredState.stats('animal')).toEqual({ state: 'taken', seen: 2, taken: 1, best: 195 });
  expect(restored.snapshot(replacement, identity(replacement))).toEqual(original.snapshot(bodies, identity(bodies)));
});

it('does not spot blocked/hidden bodies, and drops weak references to retired identities from continuation', () => {
  const hidden = animal('hidden', 0, -10); hidden.hidden = true;
  const bodies = [animal('blocked', 0, -20), hidden];
  const state = new CompendiumRules(def), tracker = new CompendiumTracker(state, { canSee: () => false });
  tracker.update(1, eye(), bodies);
  expect(state.stats('animal')).toMatchObject({ state: 'discovered', seen: 0 });
  expect(tracker.snapshot(bodies, identity(bodies))).toMatchObject({ heard: ['blocked'], spotted: [] });
  expect(tracker.snapshot([], identity([]))).toMatchObject({ heard: [], spotted: [] });
});

it('refuses unknown, duplicate and corrupt identity/clock records atomically', () => {
  const one = animal('one', 0, -10), bodies = [one], state = new CompendiumRules(def), tracker = new CompendiumTracker(state);
  tracker.update(0.1, eye(), bodies); const before = tracker.snapshot(bodies, identity(bodies));
  for (const input of [
    { ...before, heard: ['missing'] }, { ...before, spotted: ['missing'] }, { ...before, inside: ['animal'] },
    { ...before, heard: ['one', 'one'] }, { ...before, acc: 0.25 }, { ...before, acc: -1 },
    { ...before, acc: Infinity }, { ...before, version: 2 }, { ...before, extra: true },
  ]) {
    expect(() => tracker.prepareRestore(input, bodies, identity(bodies))).toThrow();
    expect(tracker.snapshot(bodies, identity(bodies))).toEqual(before);
  }
  expect(() => tracker.snapshot([one, one], identity(bodies))).toThrow('identity');
});
