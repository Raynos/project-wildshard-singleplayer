import { describe, expect, it } from 'vitest';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { graphParamRoots } from '../src/sdk/looks/graphDaySky';
import { PINE_RAIN_PROGRAMS } from '../src/shards/pine-hollow/data/weatherLook';
import { pineRainChannels } from '../src/shards/pine-hollow/generators/rainChannels';

const { rain, splash, lens, channels } = PINE_RAIN_PROGRAMS;
function rig() {
  const rows = pineRainChannels(), seen = { on: 1, rain: 0.5, dry: 0, cover: 0, lookY: 0.5, room: 0, radius: 11, slots: 14, windX: 10, windZ: -10 };
  const params = graphParamRoots(rows, channels, [rain, splash, lens]), set: Record<string, unknown> = {};
  const lane = installChannelPrograms(rows, channels, new Map<string, unknown>([['rain', seen], ...params.roots]));
  const step = (dt: number): void => { lane.evaluate({ time: 0, delta: dt, values: {} }); params.push({ setParam: (id, name, value) => { set[`${id}.${name}`] = Array.isArray(value) ? [...value] : value; } }); };
  return { seen, set, step };
}

describe('pine.rain channels', () => {
  it('slants the fall by the wind and wraps the offset into the box round the eye', () => {
    const { set, step } = rig();
    step(1);
    expect(set[`${rain}.velocity`]).toEqual([3, -9.5, -3]);
    const offset = set[`${rain}.offset`];
    if (!Array.isArray(offset)) throw new Error('no offset');
    expect(offset[0]).toBeCloseTo(3); expect(offset[1]).toBeCloseTo(22 - 9.5); expect(offset[2]).toBeCloseTo(22 - 3);
    expect(set[`${rain}.length`]).toBeCloseTo(0.55); expect(set[`${rain}.alpha`]).toBeCloseTo(0.26);
  });
  it('runs the lens clock three times as fast under a roof, dries the lens there and stops in a practice room', () => {
    const { seen, set, step } = rig();
    step(0.5);
    const wet = 0.5 * (6.8 / 14) * 0.2; // exposure × slot share × min(1, dt / 2.5); facing up the look is fully open
    expect(set[`${lens}.wet`]).toBeCloseTo(wet); expect(set[`${lens}.clock`]).toBeCloseTo(0.5); expect(set[`${splash}.time`]).toBeCloseTo(0.5);
    seen.dry = 1; step(0.5);
    expect(set[`${lens}.clock`]).toBeCloseTo(2); expect(set[`${lens}.wet`]).toBeCloseTo(wet * 0.8);
    seen.room = 1; step(0.5);
    expect(set[`${lens}.clock`]).toBeCloseTo(2); expect(set[`${lens}.wet`]).toBe(0); expect(set[`${splash}.time`]).toBeCloseTo(1);
  });
});
