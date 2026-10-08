import { expect, it } from 'vitest';
import { MemoryAttribution } from '../../src/engine/render/memoryAttribution';

it('deduplicates shared backing storage, replaces reallocations, and separates domains/native footprint', () => {
  const ledger = new MemoryAttribution(), buffer = new ArrayBuffer(4096), handle = {};
  const first = ledger.buffer(new Float32Array(buffer, 0, 32), { owner: 'level.forest', asset: 'tree/position' });
  expect(ledger.buffer(new Uint8Array(buffer, 512, 10))).toBe(first);
  const gpu = ledger.allocation(handle, 'gpu', 'buffer', 128);
  expect(gpu).not.toBe(first);
  expect(ledger.allocation(handle, 'gpu', 'buffer', 256)).toBe(gpu);
  ledger.measurement({ webContentBytes: 700_000_000, labelledGpuBytes: 256, sampledAt: 123, source: 'native-report.json#revision/settings/pid' });
  expect(ledger.snapshot(500_000_000)).toMatchObject({ totals: { ram: 4096, gpu: 256 }, unattributed: { ram: 0, gpu: 256 }, accountedBytes: 500_000_000,
    measured: { webContentBytes: 700_000_000, labelledGpuBytes: 256 } });
  ledger.label(handle, { owner: 'engine/post', asset: 'composer/color' });
  expect(ledger.snapshot().unattributed.gpu).toBe(0);
  ledger.release(handle, 'gpu');
  expect(ledger.snapshot().totals.gpu).toBe(0);
  structuredClone(buffer, { transfer: [buffer] });
  expect(ledger.snapshot().totals.ram).toBe(0);
});

it('keeps scalar receipts independent and refuses invalid sizes/provenance', () => {
  const ledger = new MemoryAttribution(), resources = [{}, {}, {}];
  const ids = resources.map(resource => ledger.allocation(resource, 'gpu', 'render-target', 1024));
  expect(new Set(ids).size).toBe(3);
  const snapshot = ledger.snapshot();
  ledger.release(resources[0] ?? {}, 'gpu');
  expect(snapshot.allocations).toHaveLength(3);
  expect(ledger.snapshot().allocations).toHaveLength(2);
  const json = JSON.stringify(snapshot);
  expect(JSON.parse(json)).toEqual(snapshot);
  expect(() => ledger.allocation({}, 'ram', 'wasm', -1)).toThrow('bytes');
  expect(() => ledger.snapshot(Number.NaN)).toThrow('bytes');
  expect(() => ledger.measurement({ webContentBytes: 1, labelledGpuBytes: 2, sampledAt: 0, source: '' })).toThrow('provenance');
});
