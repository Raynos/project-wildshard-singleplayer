import { expect, test } from 'vitest';
import { spillInputs, type NineSpillAtlas } from './spillBake';

test.each(['phone', 'desktop'] as const)('the %s spill consumes its supplied native atlas rows', tier => {
  const empty: NineSpillAtlas = { phone: { placed: [], lights: [] }, desktop: { placed: [], lights: [] } };
  const light = { at: ['3', 4, 5], color: [.2, .4, .6], w: 6, h: 7, power: 8, spill: 9 };
  const supplied: NineSpillAtlas = { ...empty, [tier]: { placed: [], lights: [light] } };
  const before = spillInputs(false, tier, empty), after = spillInputs(false, tier, supplied);
  try {
    const first = after.emitters[0]; if (first === undefined) throw new Error('Missing supplied light');
    expect(first.at.toArray()).toEqual([3, 4, 5]);
    expect(first.color.toArray()).toEqual(light.color);
    expect({ w: first.w, h: first.h, power: first.power, spill: first.spill }).toEqual({ w: 6, h: 7, power: 8, spill: 9 });
    expect(after.emitters.slice(1)).toEqual(before.emitters);
    expect([...after.geometry.keys()]).toEqual([...before.geometry.keys()]);
  } finally {
    for (const geometry of [...before.geometry.values(), ...after.geometry.values()]) geometry.dispose();
  }
});
