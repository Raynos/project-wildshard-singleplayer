import { afterEach, expect, test, vi } from 'vitest';
import { freshPageArrival, setTitleArrival, consumeTitleArrival } from '../src/engine/boot/titleArrival';
import { SaveStore } from '../src/engine/saves/store';
import { gridIntents } from '../src/game/grid/intent';
import { travelService, travelSlot } from '../src/game/travel/travel';

afterEach(() => { Reflect.deleteProperty(globalThis, 'window'); vi.restoreAllMocks(); });

test.each([
  [10_000, 75_000, 10_010, true],
  [10_000, 75_000, 70_000, true],
  [10_000, 75_000, 70_001, false],
  [10_000, 70_000, 0, true],
  [10_000, 70_001, 0, false],
  [80_000, 75_000, 10_010, false],
  [10_000, 75_000, 80_000, false],
  [Number.NaN, 75_000, 10_010, false],
])('arrival %s at clock %s / document %s keeps freshness %s', (at, now, documentAt, expected) => {
  expect(freshPageArrival(at, now, documentAt)).toBe(expected);
});

function handoffs(documentAt: number) {
  vi.stubGlobal('window', {});
  vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(documentAt);
  const clock = vi.spyOn(Date, 'now').mockReturnValue(10_000);
  const store = new SaveStore({ local: null, session: null });
  const grid = gridIntents(store);
  const travel = travelService({ source: () => null, slot: travelSlot(store), now: () => Date.now(), navigate: () => undefined });
  grid.set({ instance: 'home', slug: 'driftwood-isle' });
  travel.travel({ to: 'driftwood-isle', mode: 'enter' });
  setTitleArrival({ slug: 'driftwood-isle', mode: 'enter' });
  clock.mockReturnValue(75_000);
  return { grid, travel };
}

test('cold modules retain grid, travel and title entry, and each is consumed once', () => {
  const { grid, travel } = handoffs(10_010);
  expect(grid.consume('driftwood-isle')?.instance).toBe('home');
  expect(travel.consume('driftwood-isle')?.mode).toBe('enter');
  expect(consumeTitleArrival('driftwood-isle')).toEqual({ slug: 'driftwood-isle', mode: 'enter' });
  expect(grid.consume('driftwood-isle')).toBeNull();
  expect(travel.consume('driftwood-isle')).toBeNull();
  expect(consumeTitleArrival('driftwood-isle')).toBeNull();
});

test('a navigation starting after expiry cannot revive any old handoff', () => {
  const { grid, travel } = handoffs(70_001);
  expect(grid.consume('driftwood-isle')).toBeNull();
  expect(travel.consume('driftwood-isle')).toBeNull();
  expect(consumeTitleArrival('driftwood-isle')).toBeNull();
});

test('a different destination refuses and consumes both entry copies', () => {
  const { grid, travel } = handoffs(10_010);
  expect(grid.consume('sunscar-dunes')).toBeNull();
  expect(travel.consume('sunscar-dunes')).toBeNull();
  expect(consumeTitleArrival('sunscar-dunes')).toBeNull();
  expect(grid.consume('driftwood-isle')).toBeNull();
  expect(travel.consume('driftwood-isle')).toBeNull();
  expect(consumeTitleArrival('driftwood-isle')).toBeNull();
});
