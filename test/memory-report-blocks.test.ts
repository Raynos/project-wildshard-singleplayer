import { expect, it } from 'vitest';
import { MEMORY_BLOCK_BYTES, memoryBlocks, memoryOwnerInventory, type MemoryAllocation } from '../scripts/memory-report-blocks.mjs';

const allocation = (changes: Partial<MemoryAllocation> = {}): MemoryAllocation => ({
  id: 'gpu:context1:texture1', domain: 'gpu', owner: 'platform/road/signs', asset: 'atlas', kind: 'texture', bytes: 100_000_001, precision: 'exact', ...changes,
});

it('splits exact owner subtotals into at most 50 MB without rounding away the last byte', () => {
  const owners = memoryOwnerInventory([allocation(), allocation({ id: 'ram:audio1', domain: 'ram', owner: 'engine/audio', bytes: 23_919_360 })]);
  const blocks = memoryBlocks(owners);
  expect(blocks.filter(row => row.domain === 'gpu').map(row => row.bytes)).toEqual([50_000_000, 50_000_000, 1]);
  expect(blocks.every(row => row.bytes > 0 && row.bytes <= MEMORY_BLOCK_BYTES)).toBe(true);
  expect(blocks.reduce((total, row) => total + row.bytes, 0)).toBe(123_919_361);
  expect(memoryBlocks([{ owner: 'zero', domain: 'ram', bytes: 0 }])).toEqual([]);
});

it('counts a shared native identity once and keeps domains, estimates and owners separate', () => {
  const shared = allocation();
  expect(memoryOwnerInventory([shared, { ...shared }, allocation({ id: 'ram:shared1', domain: 'ram', bytes: 200, precision: 'estimate' })])).toEqual([
    { owner: 'platform/road/signs', domain: 'gpu', bytes: 100_000_001, exactBytes: 100_000_001, estimatedBytes: 0, allocations: 1 },
    { owner: 'platform/road/signs', domain: 'ram', bytes: 200, exactBytes: 0, estimatedBytes: 200, allocations: 1 },
  ]);
  for (const changes of [{ bytes: 1 }, { owner: 'somewhere else' }, { domain: 'ram' as const }, { asset: 'other atlas' }]) {
    expect(() => memoryOwnerInventory([shared, allocation(changes)])).toThrow('Conflicting memory allocation identity');
  }
});

it('refuses invalid arithmetic instead of drawing a plausible but false total', () => {
  for (const bytes of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => memoryOwnerInventory([allocation({ bytes })])).toThrow('Invalid memory allocation');
  }
  expect(() => memoryBlocks([{ owner: 'capacity', domain: 'ram', bytes: 128_000_000_001 }])).toThrow();
});
