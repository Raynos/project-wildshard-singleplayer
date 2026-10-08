// oxlint-disable-next-line import/no-nodejs-modules -- Execute the exact self-contained Inspector expression without a browser.
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { pageMemoryAttributionExpression, readPageMemoryAttribution } from '../scripts/memory-report-snapshot.mjs';

it('reads the public scalar port without evaluating getters or inventing a zero on an old probe', () => {
  let calls = 0;
  const scalar = { version: 1, totals: { ram: 12, gpu: 34 }, allocations: [] };
  const api = { memory() { calls++; return scalar; } };
  expect(readPageMemoryAttribution(api)).toBe(scalar);
  expect(vm.runInNewContext(pageMemoryAttributionExpression, { api })).toBe(scalar);
  expect(calls).toBe(2);
  expect(readPageMemoryAttribution({})).toBeNull();
  expect(readPageMemoryAttribution(null)).toBeNull();
  const retired = { get memory() { throw new Error('must not invoke getter'); } };
  expect(readPageMemoryAttribution(retired)).toBeNull();
  expect(vm.runInNewContext(pageMemoryAttributionExpression, { api: retired })).toBeNull();
});
