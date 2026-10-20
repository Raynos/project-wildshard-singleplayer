import { expect, it, vi } from 'vitest';
import { createBootPlan } from '../src/engine/boot/plan';
import { STEP_INFO } from '../src/engine/boot/steps';

const empty = { bytes: 0, files: 0 };
const totals = { sky: empty, baked: empty, terrain: empty, trees: empty, physics: empty,
  cabins: empty, props: empty, art: empty, music: empty, sfx: empty };

it('accounts for an inter-step wait and keeps the displayed number with its name', async () => {
  let clock = 0;
  const frames: (() => void)[] = [];
  let firstYield = true;
  const plan = createBootPlan(vi.fn<() => void>(), { totals, now: () => clock, record: vi.fn<() => void>(),
    schedule: frame => { frames.push(frame); }, yieldTask: () => {
      if (firstYield) { clock += 75_700; firstYield = false; }
      return Promise.resolve();
    } });
  clock = 20;
  await plan.step('renderer', () => { clock += 30; });
  frames.shift()?.();
  const view = plan.view;
  expect(view.gaps.map(row => [row.label, row.ms, row.state])).toEqual([
    ['gap before Renderer', 20, 'ok'], ['gap after Renderer', 75_700, 'on'],
  ]);
  const displayed = view.rows.findIndex(row => row.key === view.step);
  expect([displayed + 1, view.label]).toEqual([1, STEP_INFO.renderer.label]);
  expect(view.rows.reduce((sum, row) => sum + row.ms, 0)
    + view.gaps.reduce((sum, row) => sum + row.ms, 0)).toBe(clock);
  clock += 10;
  await plan.step('sky', () => { clock += 12; });
  expect(plan.view.gaps.find(row => row.after === 'renderer')).toMatchObject({ ms: 75_710, state: 'ok' });
  expect(plan.view.rows.findIndex(row => row.key === plan.view.step) + 1).toBe(2);
  expect(plan.view.label).toBe(STEP_INFO.sky.label);
  expect(plan.view.rows.reduce((sum, row) => sum + row.ms, 0)
    + plan.view.gaps.reduce((sum, row) => sum + row.ms, 0)).toBe(clock);
  plan.fail('End test');
  frames.shift()?.();
});

it('keeps an active parallel step labelled and opens no overlapping gap', async () => {
  let clock = 0;
  let finish = (): void => { throw new Error('Uninitialized barrier'); };
  const barrier = new Promise<void>(resolve => { finish = resolve; });
  const plan = createBootPlan(vi.fn<() => void>(), { totals, now: () => clock,
    record: vi.fn<() => void>(), schedule: null, yieldTask: null });
  const renderer = plan.step('renderer', async () => { await barrier; });
  clock = 10;
  await plan.step('sky', () => { clock = 20; });
  expect(plan.view.step).toBe('renderer');
  expect(plan.view.gaps.every(row => row.state === 'ok')).toBe(true);
  clock = 30;
  finish();
  await renderer;
  expect(plan.view.gaps.at(-1)).toMatchObject({ after: 'renderer', state: 'on', ms: 0 });
  plan.fail('End test');
});
