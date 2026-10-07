import { describe, expect, it } from 'vitest';
import { parseFlock } from '../src/game/shardfile/crowds';

const DATA = { id: 'crowd.pasture', kind: 'flock', x: 0, z: 0, count: 40, seed: 357,
  range: 45, runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' };
describe('ordered flock declarations', () => {
  it('admits the complete shipping home/roster/tuning without guessing native recipes', () => {
    expect(parseFlock(DATA)).toEqual(DATA);
  });
  it.each([{ count: 0 }, { count: 257 }, { count: 1.5 }, { seed: -1 }, { seed: 0x100000000 },
    { range: 7 }, { range: Number.POSITIVE_INFINITY }, { x: Number.NaN }, { walkSpeed: 16 },
    { id: 'bad id' }, { thinkDivisor: 6 }, { body: 'author-chosen' }])('refuses malformed data before installation: %j', change => {
    expect(() => parseFlock({ ...DATA, ...change })).toThrow();
  });
});
