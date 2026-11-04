import { expect, test } from 'vitest';
import { progressOfCard, stuckMessage, watchStuckStep, type StuckStepPorts } from './stuckStep';

/** A fake clock and timer: `tick(ms)` advances the clock and runs the repeating timer once a second. */
function harness(progress: () => { step: string; signature: string }) {
  let now = 0, run: (() => void) | null = null;
  const stalls: [string, number][] = [];
  const ports: StuckStepPorts = {
    progress, now: () => now,
    every: (_ms, fn) => { run = fn; return () => { run = null; }; },
    stalled: (step, ms) => { stalls.push([step, ms]); },
  };
  const tick = (ms: number): void => { for (let t = 0; t < ms; t += 1000) { now += 1000; run?.(); } };
  return { ports, tick, stalls, running: () => run !== null };
}
const never = new Promise<never>(() => { /* a start that hangs */ });

test('a start that hangs on one step is named once after the bound', () => {
  const h = harness(() => ({ step: 'world.props', signature: 'world.props|40|1000' }));
  watchStuckStep(never, h.ports, 60_000);
  h.tick(59_000); expect(h.stalls).toEqual([]);
  h.tick(1000); expect(h.stalls).toEqual([['world.props', 60_000]]);
  h.tick(120_000); expect(h.stalls).toHaveLength(1);
  expect(h.running()).toBe(false);
});

test('progress (a new step, setup share or bytes) restarts the bound', () => {
  let bytes = 0;
  const h = harness(() => ({ step: 'download', signature: `download|0|${bytes}` }));
  watchStuckStep(never, h.ports, 60_000);
  for (let i = 0; i < 10; i++) { h.tick(30_000); bytes += 1; }
  expect(h.stalls).toEqual([]);
  // the last change is read on the next second; the bound runs from there
  h.tick(60_000); expect(h.stalls).toEqual([]);
  h.tick(1000); expect(h.stalls).toEqual([['download', 60_000]]);
});

test('a start that settles, resolved or thrown, ends the watch without a stall', async () => {
  for (const started of [Promise.resolve(), Promise.reject(new Error('refused'))]) {
    const h = harness(() => ({ step: 'gap', signature: 'gap' }));
    watchStuckStep(started, h.ports, 60_000);
    await started.catch(() => undefined); await Promise.resolve();
    h.tick(120_000);
    expect(h.stalls).toEqual([]);
    expect(h.running()).toBe(false);
  }
});

test('the card gives the step and a signature of its progress; no card is still the modules', () => {
  expect(progressOfCard(null)).toEqual({ step: 'modules', signature: 'modules' });
  const card = { dataset: { step: 'world.props', setup: '40', readBytes: '1000', spawnFilesDone: '3' } };
  expect(progressOfCard(card as unknown as HTMLElement)).toEqual({ step: 'world.props', signature: 'world.props|40|1000|3' });
});

test('the fatal line names the step, for a hang and for a throw', () => {
  expect(stuckMessage('world.props', { stuckMs: 60_400 })).toBe('The game stopped loading at step "world.props" (no progress for 60 s)');
  expect(stuckMessage('admission.download', { error: new TypeError('Load failed') })).toBe('The game failed to start at step "admission.download" (TypeError: Load failed)');
});
