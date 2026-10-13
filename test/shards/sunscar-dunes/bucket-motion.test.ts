import { expect, it } from 'vitest';
import { createClientChannels } from '../../../src/game/plugin/ui';
import { SIGNAL_BUCKET_CHANNELS } from '../../../src/shards/sunscar-dunes/data/bucketMotion';
import { WELL_RIG } from '../../../src/shards/sunscar-dunes/data/places';
import source from '../../../src/shards/sunscar-dunes/shard.config';

it('admits exactly the bucket visual rows with trusted ownership and no physics mover', () => {
  expect(source.clientChannels).toEqual(SIGNAL_BUCKET_CHANNELS);
  expect(source.runtime?.binds).toContain('clientChannels');
  expect(source.movers).toEqual([]);
});

it('keeps the initial oil-loaded pose literal, without starting a new ramp', () => {
  const lane = createClientChannels(SIGNAL_BUCKET_CHANNELS[0]);
  for (const delta of [0, 0.01, 0.7, 8, 0]) {
    lane.evaluate({ time: 123, delta, values: [1, 1, WELL_RIG.drop] });
    expect(Object.is(lane.frame.y, 1.85 - 0.5)).toBe(true);
    expect(Object.is(lane.frame.scaleY, 0.2)).toBe(true);
  }
});

it('matches every shipping bucket/rope scalar at unequal frame deltas, including mid-lift oil', () => {
  for (const drop of [WELL_RIG.drop, 0.5, 7.17]) {
    const lane = createClientChannels(SIGNAL_BUCKET_CHANNELS[0]);
    let progress = 0, y = 1.85 - drop, rope = 1, time = 0;
    lane.evaluate({ time, delta: 0, values: [0, 0, drop] });
    for (const [index, delta] of [0, 0.019, 0.1, 0.011, 0.27, 0.016, 0.8, 0.012, 1.4].entries()) {
      const raised = index !== 0 && index !== 4, oil = index >= 3;
      if (raised && progress < 1) {
        progress = Math.min(1, progress + delta / 1.2);
        y = 1.85 - drop + (drop - 0.5) * progress; rope = 1 - progress * 0.8;
      }
      time += delta;
      lane.evaluate({ time, delta, values: [Number(oil), Number(raised), drop] });
      expect(Object.is(lane.frame.y, y)).toBe(true);
      expect(Object.is(lane.frame.scaleY, rope)).toBe(true);
    }
    expect(Object.is(lane.frame.scaleY, 0.2)).toBe(false);
    expect(Object.is(lane.frame.scaleY, 1 - 1 * 0.8)).toBe(true);
  }
});

it('holds an unpulled bucket indefinitely and cannot write its copied interaction state', () => {
  const lane = createClientChannels(SIGNAL_BUCKET_CHANNELS[0]), values = [0, 0, WELL_RIG.drop];
  for (const delta of [0, 0.1, 30]) {
    lane.evaluate({ time: delta, delta, values });
    expect(lane.frame).toMatchObject({ y: 1.85 - WELL_RIG.drop, scaleY: 1 });
  }
  expect(values).toEqual([0, 0, WELL_RIG.drop]);
  expect(Reflect.set(lane.frame, 'well.raised', 1)).toBe(false);
  expect(Reflect.set(lane, 'player', { position: [0, 0, 0] })).toBe(false);
});
