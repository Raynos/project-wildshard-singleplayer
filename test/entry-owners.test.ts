import { expect, test } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { CollectionCatalogue } from '../src/game/models/collectionDisplay';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { entryOwner, lendEntryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';

test('entry ids resolve only their concrete kind and exact construction owner', () => {
  const owner = new Scope('construction'), other = new Scope('another cell');
  const object = new Group(), scenes = new SceneHandles();
  try {
    publishEntryOwner(owner, 'object', 'world.root', object);
    publishEntryOwner(owner, 'scenes', 'world.root', scenes);
    expect(entryOwner(owner, 'object', 'world.root')).toBe(object);
    expect(entryOwner(owner, 'scenes', 'world.root')).toBe(scenes);
    expect(() => entryOwner(other, 'object', 'world.root')).toThrow('Missing live');
    expect(() => entryOwner(owner, 'chain', 'world.root')).toThrow('Missing live');
    expect(() => publishEntryOwner(owner, 'object', 'world.root', object)).toThrow('Duplicate');
    expect(() => publishEntryOwner(owner, 'object', '../world', object)).toThrow('Invalid');
    expect(() => lendEntryOwner(other, owner, 'object', 'world.root')).toThrow('ancestor');
  } finally { other.dispose(); owner.dispose(); }
});

test('re-entered loans leave original resources alive and remove resident cleanup registrations', () => {
  const resident = new Scope('resident'), object = new Group();
  publishEntryOwner(resident, 'object', 'world.root', object);
  const baseline = resident.census.disposers;
  try {
    for (let visit = 0; visit < 4; visit++) {
      const entered = resident.child('entered');
      const beforeLoan = resident.census.disposers;
      lendEntryOwner(entered, resident, 'object', 'world.root');
      expect(entryOwner(entered, 'object', 'world.root')).toBe(object);
      expect(resident.census.disposers).toBe(beforeLoan + 2);
      entered.dispose();
      expect(() => entryOwner(entered, 'object', 'world.root')).toThrow('ended');
      expect(entryOwner(resident, 'object', 'world.root')).toBe(object);
      expect(resident.census.disposers).toBe(baseline);
    }
  } finally { resident.dispose(); }
});

test('a transitive loan cannot outlive its original construction owner', () => {
  const resident = new Scope('resident'), entered = resident.child('entered'), nested = entered.child('nested');
  const object = new Group();
  publishEntryOwner(resident, 'object', 'world.root', object);
  lendEntryOwner(entered, resident, 'object', 'world.root');
  lendEntryOwner(nested, entered, 'object', 'world.root');
  expect(entryOwner(nested, 'object', 'world.root')).toBe(object);
  expect(() => lendEntryOwner(entered, resident, 'object', 'world.root')).toThrow('Duplicate');
  expect(() => lendEntryOwner(resident, resident, 'object', 'world.root')).toThrow('ancestor');
  resident.dispose();
  expect(() => entryOwner(nested, 'object', 'world.root')).toThrow('ended');
  expect(() => publishEntryOwner(resident, 'object', 'late', object)).toThrow('ended');
  expect(resident.census.disposers).toBe(0);
});


test('a collection loan preserves the actual catalogue and its fixed geometry owner', () => {
  const resident = new Scope('collection construction'), entered = resident.child('quest');
  const catalogue = new CollectionCatalogue('fixture-collection', new Map());
  try {
    publishEntryOwner(resident, 'collection', 'keepsakes', catalogue);
    lendEntryOwner(entered, resident, 'collection', 'keepsakes');
    expect(entryOwner(entered, 'collection', 'keepsakes')).toBe(catalogue);
    entered.dispose();
    expect(entryOwner(resident, 'collection', 'keepsakes')).toBe(catalogue);
  } finally { resident.dispose(); }
});
