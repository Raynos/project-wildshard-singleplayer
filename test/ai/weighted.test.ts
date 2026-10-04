import { describe, expect, it, vi } from 'vitest';
import { WeightedTable } from '../../src/engine/ai/weighted';

describe('weighted spawn and loot tables', () => {
  it('keeps author order, clamped weights, boundary behavior and exact draw consumption', () => {
    const table = new WeightedTable({ mode: 'weighted', rows: [{ item: 'a', weight: 2 }, { item: 'b', weight: 3 }, { item: 'c', weight: -1 }] });
    expect(table.pick(undefined, 0.4)?.item).toBe('a');
    expect(table.pick(undefined, 0.40001)?.item).toBe('b');
    expect(table.pick(undefined, 1)?.item).toBe('b');
    const next = vi.fn(() => 0.7); expect(table.roll(undefined, next)).toEqual([{ item: 'b', count: 1 }]); expect(next).toHaveBeenCalledOnce();
  });
  it('filters eligibility and drops each eligible row with inclusive count ranges', () => {
    const table = new WeightedTable<string, boolean>({ mode: 'each', rows: [
      { item: 'hide', weight: 1, count: 2 }, { item: 'tusk', weight: 1, when: (sow) => !sow },
      { item: 'meat', weight: 1, count: [3, 5] },
    ] });
    const next = vi.fn(() => 0.999);
    expect(table.roll(true, next)).toEqual([{ item: 'hide', count: 2 }, { item: 'meat', count: 5 }]); expect(next).toHaveBeenCalledOnce();
    expect(table.roll(false, () => 0)).toEqual([{ item: 'hide', count: 2 }, { item: 'tusk', count: 1 }, { item: 'meat', count: 3 }]);
    expect(new WeightedTable({ mode: 'weighted', rows: [] }).roll(undefined, () => 0)).toEqual([]);
  });
});
