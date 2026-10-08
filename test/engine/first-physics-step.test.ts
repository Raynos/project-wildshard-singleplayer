import { expect, it } from 'vitest';
import { Game } from '../../src/engine/core/Game';
import { FIXED_STEP } from '../../src/engine/core/fixedStep';

function fixture(mode: 'live' | 'capture' = 'live') {
  const run: unknown = Reflect.get(Game.prototype, 'runFixed');
  if (typeof run !== 'function') throw new Error('Missing production fixed accumulator');
  const calls: string[] = [];
  const state = { app: { state: 'playing', clock: { mode } }, fixedAcc: 0, firstFixedStep: true, fixedSteps: 0, alpha: 0,
    fixed: { pre: 'pre', step: 'step', post: 'post' }, runPhase: (phase: string) => { calls.push(phase); } };
  return { state, calls, step: (dt: number) => { Reflect.apply(run, state, [dt]); } };
}
it('waits through sub-tick startup frames, clamps the first overdue physics tick, then keeps ordinary catch-up', () => {
  const f = fixture();
  f.step(0); f.step(FIXED_STEP / 4);
  expect(f.state.fixedSteps).toBe(0); expect(f.state.firstFixedStep).toBe(true);
  f.step(10);
  expect(f.calls).toEqual(['pre', 'step', 'post']); expect(f.state.fixedAcc).toBe(0);
  f.step(0.1); expect(f.state.fixedSteps).toBe(3);
});
it('does not consume the first-tick fence while paused and preserves deterministic capture cadence', () => {
  const f = fixture(); f.state.app.state = 'paused'; f.step(10);
  expect(f.calls).toHaveLength(0); expect(f.state.firstFixedStep).toBe(true);
  f.state.app.state = 'playing'; f.step(10); expect(f.state.fixedSteps).toBe(1);
  const capture = fixture('capture'); capture.step(1 / 30); expect(capture.state.fixedSteps).toBe(2);
});
