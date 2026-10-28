// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { HUD, type HUDState } from '../src/engine/ui/HUD';
import { CABIN_SITES } from '../src/engine/world/Heightfield';
import { markersBefore, type MarkerFixture } from '../src/engine/test/hud-markers-before';

const actual: unknown = Reflect.get(HUD.prototype, 'updateMarkers'), place: unknown = Reflect.get(HUD.prototype, 'placeMark');
if (typeof actual !== 'function' || typeof place !== 'function') throw new Error('Missing actual HUD marker methods');
const nativePlace = place;
function fixture() {
  const root = document.createElement('div'), house = document.createElement('i'), paw = document.createElement('i'), range = document.createElement('span');
  root.append(house, paw, range);
  const calls: { key: string; rel: number }[] = [];
  const receiver: MarkerFixture = { animals: [], markHouse: house, markPaw: paw, range,
    band: document.createElement('div'), bandW: 144, ppd: 1.2,
    lastMark: { house: Number.NaN, paw: Number.NaN, range: '' },
    placeMark(mark, key, rel) { calls.push({ key, rel }); Reflect.apply(nativePlace, receiver, [mark, key, rel]); },
  };
  return { root, receiver, calls };
}

test('full original compass DOM and candidate order survive live positions and range transitions', () => {
  const saved = [...CABIN_SITES], before = fixture(), now = fixture();
  try {
    for (let frame = 0; frame < 512; frame++) {
      CABIN_SITES.length = 0;
      if (frame % 19 !== 0) CABIN_SITES.push({ x: -10, z: 0, rot: 0 }, { x: 10, z: 0, rot: 0 }, { x: 0, z: 70.49 + (frame % 3) * .01, rot: 0 });
      if (frame % 23 === 0) CABIN_SITES.unshift({ x: Number.NaN, z: 0, rot: 0 });
      const animals = [{ x: -10, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 120 }, { x: Infinity, z: 0 }];
      if (frame % 17 === 0) animals.reverse();
      before.receiver.animals = animals; now.receiver.animals = animals;
      const state: Pick<HUDState, 'pos' | 'nearest'> = { pos: { x: frame % 5 === 0 ? 0 : frame / 16, z: frame % 7 },
        nearest: frame % 4 === 0 ? { bearing: frame % 360, distance: [120, 120.01, Number.NaN, 0][(frame / 4) % 4] ?? 0, kind: 'original nearest' } : undefined };
      const heading = frame % 31 === 0 ? Number.NaN : frame * 1.1;
      markersBefore.call(before.receiver, state, heading); Reflect.apply(actual, now.receiver, [state, heading]);
      expect(now.calls).toEqual(before.calls); expect(now.receiver.lastMark).toEqual(before.receiver.lastMark);
      expect(now.root.innerHTML).toBe(before.root.innerHTML);
    }
    CABIN_SITES.splice(0, CABIN_SITES.length, { x: -10, z: 0, rot: 0 }, { x: 10, z: 0, rot: 0 });
    const state: Pick<HUDState, 'pos' | 'nearest'> = { pos: { x: 0, z: 0 } };
    for (let frame = 0; frame < 128; frame++) { markersBefore.call(before.receiver, state, 0); Reflect.apply(actual, now.receiver, [state, 0]); }
    expect(now.root.innerHTML).toBe(before.root.innerHTML); expect(now.receiver.range.textContent).toBe('Cabin · 10 m');
    expect(now.calls.at(-2)).toEqual({ key: 'house', rel: 90 });
  } finally { CABIN_SITES.splice(0, CABIN_SITES.length, ...saved); }
});
