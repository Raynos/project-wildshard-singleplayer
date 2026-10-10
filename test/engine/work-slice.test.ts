import { describe, expect, it } from 'vitest';
import { WORK_SLICE_MS, workSlice, yieldTask } from '@wildshard/engine/core/workSlice';

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
});
