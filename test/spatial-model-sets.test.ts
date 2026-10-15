import { expect, test } from 'vitest';
import { Box3, Group, Vector3 } from 'three';
import type { Placed } from '../src/engine/models/place';
import { placedWithin, registerPlaceSets } from '../src/engine/models/sets';
import { WorldRegistry } from '../src/engine/world/registry';

test('spatial sets preserve ordered copy views, explicit members and distinct bounds/centre policies', () => {
  const boxes = [new Box3(new Vector3(-1, 0, -1), new Vector3(11, 2, 1)), new Box3(new Vector3(-0.2, 0, -0.2), new Vector3(0.2, 2, 0.2)), new Box3(new Vector3(20, 0, 0), new Vector3(21, 2, 1))];
  const source: Placed = { model: 'fixture/poles', object: new Group(), colliders: [{ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1 }],
    copies: boxes.length, drawnAs: 'instanced', cull: () => undefined, registered: Promise.resolve(), nearest: () => -1,
    copyBox: (i, target) => { const box = boxes[i]; if (box === undefined) throw new Error('Missing fixture copy'); return target.copy(box); } };
  const bounds = placedWithin(source, 0, 0, 1, 'bounds'), centre = placedWithin(source, 0, 0, 1, 'centre');
  expect(bounds?.copies).toBe(2);
  expect(centre?.copies).toBe(1);
  expect(centre?.copyBox(0, new Box3()).equals(boxes[1] ?? new Box3())).toBe(true);
  expect(bounds?.object).toBe(source.object);
  expect(bounds?.colliders).toEqual([]);
  expect(source.colliders).toHaveLength(1);
  expect(bounds?.nearest(new Vector3())).toBe(0);
  expect(placedWithin(source, 0, 0, 10, 'centre')?.nearest(new Vector3())).toBe(1);
  expect(placedWithin(source, 0, 0, 100, 'bounds')).toBe(source);
  expect(placedWithin(source, -100, 0, 1, 'bounds')).toBeNull();
  const registry = new WorldRegistry(), rows = [{ id: 'near', name: 'Near', place: 'fixture/near' }, { id: 'explicit', name: 'Explicit', place: 'fixture/explicit' }, { id: 'empty', name: 'Empty', place: 'fixture/empty' }];
  const count = registerPlaceSets(rows, { file: 'test/spatial-model-sets.test.ts', registry, members: row => row.id === 'explicit' ? { whole: [source] } : {
    near: { placed: [null, source, undefined], x: row.id === 'empty' ? -100 : 0, z: 0, r: 1, mode: 'bounds' },
  } });
  expect(count).toBe(3);
  expect(registry.sets.map(row => [row.id, row.members])).toEqual([
    ['near', [{ model: source.model, copies: 2 }]], ['explicit', [{ model: source.model, copies: 3 }]], ['empty', []],
  ]);
  expect(registry.sets[0]?.placed?.[0]?.copyBox(1, new Box3()).equals(boxes[1] ?? new Box3())).toBe(true);
  expect(registry.pieces).toHaveLength(0);
  expect(registerPlaceSets([{ id: 'skip', name: 'Skip' }], { file: 'fixture', registry, skipEmpty: true, members: () => ({}) })).toBe(0);
});
