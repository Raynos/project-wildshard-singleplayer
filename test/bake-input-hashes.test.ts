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
  it('lists the King collision bake', () => {
    expect(RECORDED_BAKES[0]?.script).toBe('src/shards/pine-hollow/generators/bake-pine-king-collision.mjs');
    expect(isRecordedBake('src/shards/pine-hollow/runtime/kingCollision.baked.json')).toBe(true);
    expect(isRecordedBake('src/shards/pine-hollow/runtime/physics.baked.json')).toBe(false);
  });
});
