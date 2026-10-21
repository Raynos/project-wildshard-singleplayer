import { expect, it } from 'vitest';
import * as v from 'valibot';
import { QuestPageCollectionsSchema, QuestPageDoorSchema, QuestPageMapSchema, QuestPageMoverSchema } from '../src/format/questPageFacets';
import { pageCollectionCalls } from '../src/game/quest/pageFacets';
import { FOREST_STORY } from '../src/shards/pine-hollow/generators/forestStory';

// G565: Pine's forest story rows, as the quest page's optional facets (its second real user after Driftwood's page)
const pine = FOREST_STORY;
const facets = {
  mover: { id: pine.mover.id, target: 'canoe', mesh: pine.mover.mesh, rest: pine.mover.rest, binding: pine.mover.binding, board: { sound: 'door', gain: 0.6 } },
  // a collection's completion text belongs to its page action (083cccad5d)
  collections: { panel: pine.panels.count, rows: pine.collections.map(({ event, completeEvent, prefix, names, label }) => ({ event, completeEvent, prefix, names, label })), pickup: { event: pine.pickupEvent, sting: 'pickup' } },
  map: { publish: { declutter: true, unknownLabel: '?', markerLabels: 'full' }, zones: pine.map.zones, features: { forest: pine.page } },
};

it("admits Pine's mover, collections and map as page facet rows", () => {
  expect(v.parse(QuestPageMoverSchema, facets.mover).target).toBe('canoe');
  expect(v.parse(QuestPageCollectionsSchema, facets.collections).rows).toHaveLength(pine.collections.length);
  expect(v.parse(QuestPageMapSchema, facets.map).zones).toEqual(pine.map.zones);
  expect(() => v.parse(QuestPageCollectionsSchema, { ...facets.collections, pickup: { event: 'x', sting: 'fanfare' } })).toThrow();
});

it("admits Pine's barred mill door on the page flag gates", () => {
  const gate = { id: 'mill-door-bar', name: 'Mill door bar', opensWhen: { all: [pine.door.flag] }, target: { kind: 'piece', piece: pine.door.id } };
  const door = v.parse(QuestPageDoorSchema, { forest: pine.page, door: pine.door.id, gates: { quest: 'pine-hollow', gates: [gate] } });
  expect(door.gates.gates[0]?.target).toEqual({ kind: 'piece', piece: pine.door.id });
  expect(() => v.parse(QuestPageDoorSchema, { forest: pine.page, door: pine.door.id, gates: { gates: [gate, gate] } })).toThrow();
});

it('calls the count chip, the page action and the pickup sting from collection events', () => {
  const shown: { label: string; n: number; of: number }[] = [], ran: string[] = [], stings: string[] = [];
  const set = new Set([`${pine.collections[0]?.prefix ?? ''}1`, `${pine.collections[0]?.prefix ?? ''}2`]);
  const flags = { count: (prefix: string): number => [...set].filter(flag => flag.startsWith(prefix)).length };
  const calls = pageCollectionCalls(facets.collections, { flags, chip: () => ({ show: row => { shown.push(row); } }),
    action: event => () => { ran.push(event); }, sting: name => { stings.push(name); } });
  const first = pine.collections[0];
  if (first === undefined) throw new Error('Pine declares its collections');
  // the collection calls read no event (the kit passes its own)
  for (const id of [first.event, first.completeEvent, pine.pickupEvent]) { const call = calls.get(id); if (call !== undefined) Reflect.apply(call, undefined, []); }
  expect(shown).toEqual([{ label: first.label, n: 2, of: first.names.length }]);
  expect(ran).toEqual([first.completeEvent]);
  expect(stings).toEqual(['pickup']);
  expect(calls.size).toBe(pine.collections.length * 2 + 1);
});
