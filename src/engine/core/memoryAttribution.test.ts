import { expect, test } from 'vitest';
import { MemoryAttribution } from './memoryAttribution';

test('summary keeps live totals, labels and provenance without detail rows', () => {
  const ledger = new MemoryAttribution(), resource = {}, source = {}, unknown = {};
  let bytes = 300, reads = 0;
  ledger.observe(resource, 'gpu', 'buffer', () => { reads++; return bytes; });
  ledger.source(resource, source);
  ledger.allocation(unknown, 'ram', 'capacity', 100);
  const release = ledger.bindAccounting(() => 900);
  ledger.measurement({ webContentBytes: 1000, labelledGpuBytes: 200, sampledAt: 1, source: 'native receipt' });
  const compare = (): void => {
    const summary = ledger.summary(), full = ledger.snapshot();
    expect(summary).toEqual({ version: full.version, totals: full.totals, unattributed: full.unattributed,
      measured: full.measured, accountedBytes: full.accountedBytes });
    expect('allocations' in summary).toBe(false);
  };
  compare(); expect(reads).toBe(3);
  expect(ledger.summary().unattributed).toEqual({ gpu: 300, ram: 100 });
  ledger.label(source, { owner: 'world', asset: 'mesh' }); bytes = 700;
  compare(); expect(ledger.summary().unattributed).toEqual({ gpu: 0, ram: 100 });
  ledger.release(resource, 'gpu'); ledger.measurement(null); release();
  compare();
  expect(ledger.summary()).toMatchObject({ totals: { gpu: 0, ram: 100 }, measured: null, accountedBytes: null });
});

test('summary validates the same live capacities and accounting as snapshot', () => {
  const ledger = new MemoryAttribution(), resource = {};
  let bytes = 1;
  ledger.observe(resource, 'ram', 'buffer', () => bytes);
  bytes = -1;
  expect(() => ledger.summary()).toThrow('Invalid memory allocation bytes');
  expect(() => ledger.snapshot()).toThrow('Invalid memory allocation bytes');
  bytes = 0;
  expect(() => ledger.summary(-1)).toThrow('Invalid memory allocation bytes');
  expect(ledger.summary(50).totals).toEqual({ gpu: 0, ram: 0 });
});
