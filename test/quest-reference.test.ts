import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { placesWithDiscovery } from '../src/engine/quest/view';
import { LastPlace } from '../src/game/LastPlace';
import type { QuestPageComposition } from '../src/game/quest/pageComposition';
import { QuestPageReference } from '../src/game/quest/pageReference';
import { legacyDouble } from './fake/FakeGame';

function quest(): QuestPageComposition {
  const flags = new Flags('reference-fixture', false);
  const places = placesWithDiscovery([{ id: 'harbour', label: 'Harbour', x: 4, z: 8, r: 6 }], flags, () => undefined, () => []);
  return { flags, places, content: null, kit: legacyDouble({}), spine: null, finale: null, ecology: null,
    complete: null, zipline: null, trader: null, place: row => ({ x: row.x, z: row.z, y: row.y ?? 0, yaw: row.yaw ?? 0 }),
    floorAt: () => 0, setAnchor: () => undefined,
    facets: { achievements: null, people: [], cable: null, motion: null, director: null, board: null, shop: null, pages: new Map() } };
}

test('a places reader captured before play follows the completed quest without changing identity', () => {
  const scope = new Scope('captured entry'), reference = new QuestPageReference(scope), captured = reference.places;
  const checkpoint = new LastPlace(captured), adventure = quest();
  try {
    checkpoint.observe({ x: 4, z: 8, y: 0, grounded: true });
    expect(checkpoint.stand).toBeNull();
    reference.publish(adventure);
    expect(reference.places).toBe(captured);
    expect(captured()).toBe(adventure.places?.points);
    checkpoint.observe({ x: 4, z: 8, y: 0, grounded: true });
    expect(checkpoint.stand?.id).toBe('harbour');
    expect(() => reference.publish(adventure)).toThrow('already published');
    scope.dispose();
    expect(captured()).toEqual([]);
    expect(adventure.places?.points).toHaveLength(1);
    expect(() => reference.publish(adventure)).toThrow('expired');
  } finally { scope.dispose(); }
});

test('ancestor retirement hides the old quest while a new entered reference remains independent', () => {
  const resident = new Scope('resident'), oldScope = resident.child('old entry'), scope = resident.child('new entry');
  const old = new QuestPageReference(oldScope), next = new QuestPageReference(scope), adventure = quest();
  old.publish(adventure);
  expect(next.places()).toEqual([]);
  next.publish(quest());
  oldScope.dispose();
  expect(old.places()).toEqual([]);
  expect(next.places()).toHaveLength(1);
  const retiring = resident.disposeSteps();
  resident.onDispose(() => undefined);
  retiring.next();
  expect(scope.disposed).toBe(false);
  expect(scope.disposing).toBe(true);
  expect(next.places()).toEqual([]);
  for (const _step of retiring) { /* Finish the actual ancestor's retirement. */ }
});
