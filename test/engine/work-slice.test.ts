import { describe, expect, it } from 'vitest';
import { WORK_SLICE_MS, buildYield, workSlice, yieldTask } from '@wildshard/engine/core/workSlice';
import { Scope } from '@wildshard/engine/app/scope';
import { setFramePacing } from '@wildshard/engine/core/framePacing';

// op-hitch23 (E435 frame floor): sliced builders let a drawn frame through every WORK_SLICE_MS.
describe('workSlice', () => {
  it('is due only after its budget and restarts its clock on yield', async () => {
    const slice = workSlice(5);
    expect(slice.due()).toBe(false);
    expect(slice.check()).toBeUndefined();
    const until = performance.now() + 6;
    while (performance.now() < until) { /* spend the budget */ }
    expect(slice.due()).toBe(true);
    await slice.check();
    expect(slice.due()).toBe(false);
  });
  it('keeps the frame budget at half a 60 Hz frame and yields on a macrotask', async () => {
    expect(WORK_SLICE_MS).toBeLessThanOrEqual(8);
    const order: string[] = [];
    const task = yieldTask().then(() => order.push('task'));
    void Promise.resolve().then(() => order.push('microtask'));
    await task;
    expect(order).toEqual(['microtask', 'task']);
  });
  it('pauses a world build on a timer task of its scope, and stops a build whose scope has closed (op-hitch45)', async () => {
    setFramePacing(false); // the shipped default: exactly the scope's own timer task
    const scope = new Scope('build');
    const order: string[] = [];
    const pause = buildYield(scope).then(() => order.push('task'));
    void Promise.resolve().then(() => order.push('microtask'));
    await pause;
    expect(order).toEqual(['microtask', 'task']);
    scope.dispose();
    await expect(buildYield(scope)).rejects.toThrow(/scope has closed/u);
  });
});
