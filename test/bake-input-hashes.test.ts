import { describe, expect, it } from 'vitest';
import { bakeOutcome, isRecordedBake, RECORDED_BAKES } from '../scripts/bake-input-hashes.mjs';

// SF74 W22: the pusher re-records a recorded bake's input hashes only when every other byte of the bake is identical.
describe('recorded bake input hashes', () => {
  it('compares everything but the inputs', () => {
    const base = { version: 1, inputs: { 'a.ts': '00' }, joints: [1, 2] };
    expect(bakeOutcome(JSON.stringify(base))).toBe(bakeOutcome(JSON.stringify({ ...base, inputs: { 'a.ts': 'ff' } })));
    expect(bakeOutcome(JSON.stringify(base))).not.toBe(bakeOutcome(JSON.stringify({ ...base, joints: [1, 3] })));
    expect(() => bakeOutcome('{"version":1}')).toThrow('no "inputs"');
  });
  it('lists no recorded bake since the King table generates from authored rows (G350)', () => {
    expect(RECORDED_BAKES).toEqual([]);
    expect(isRecordedBake('src/shards/pine-hollow/runtime/kingCollision.baked.json')).toBe(false);
    expect(isRecordedBake('src/shards/pine-hollow/data/kingCollision.generated.json')).toBe(false);
  });
});
