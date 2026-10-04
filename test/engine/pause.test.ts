import { expect, it } from 'vitest';
import { App } from '@wildshard/engine';
import { Game } from '../../src/engine/core/Game';

it('runs no fixed phase while paused, including a forced redraw, and resumes the accumulator unchanged', () => {
  const runFixed: unknown = Reflect.get(Game.prototype, 'runFixed');
  if (typeof runFixed !== 'function') throw new Error('Missing fixed step');
  const app = new App(), calls: string[] = [];
  const state = { app, fixedAcc: 0, alpha: 0, fixedSteps: 0,
    fixed: { pre: 'pre', step: 'step', post: 'post' }, runPhase: (phase: string): void => { calls.push(phase); } };
  const step = runFixed as (this: typeof state, dt: number) => void;
  app.setState('play'); step.call(state, 1 / 120);
  const remainder = state.fixedAcc;
  app.setState('paused');
  for (let i = 0; i < 30; i++) step.call(state, 1 / 30);
  expect(calls).toEqual([]);
  expect(state.fixedAcc).toBe(remainder);
  expect(state.fixedSteps).toBe(0);
  app.setState('play'); step.call(state, 1 / 120);
  expect(calls).toEqual(['pre', 'step', 'post']);
});
