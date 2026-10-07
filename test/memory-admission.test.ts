import { expect, it } from 'vitest';
import { MemoryAdmission, type MemoryAdmissionRequest } from '../src/game/grid/memoryAdmission';

const request: MemoryAdmissionRequest = { stage: 'resident', owner: 'cell', id: 'sim:cell', claimedBytes: 900_000_000,
  accountedBytes: 900_000_000, playingBytes: 1_379_000_000, loadingBytes: 1_459_000_000 };
it('keeps public admission strict and lets Developer exceed the unchanged cap with every actual byte reported', () => {
  let developer = false;
  const policy = new MemoryAdmission(() => developer);
  expect(policy.accept(request)).toBe(false); expect(policy.reports()).toEqual([]);
  developer = true;
  expect(policy.accept(request)).toBe(true);
  expect(policy.reports()).toEqual([{ ...request, playingCap: 1_000_000_000, loadingCap: 1_800_000_000, playingOverBytes: 379_000_000, loadingOverBytes: 0 }]);
  developer = false; expect(policy.accept({ ...request, id: 'another' })).toBe(false);
});
it('also warns for a loading-only overage and clears scoped readouts when residency becomes affordable', () => {
  const policy = new MemoryAdmission(() => true), paints: number[] = [];
  const remove = policy.subscribe(() => { paints.push(policy.reports().length); });
  policy.accept({ ...request, playingBytes: 900_000_000, loadingBytes: 1_900_000_000 });
  expect(policy.reports()[0]?.loadingOverBytes).toBe(100_000_000);
  policy.clearResidents(); expect(paints).toEqual([0, 1, 0]);
  remove(); policy.accept(request); expect(paints).toEqual([0, 1, 0]);
  policy.dispose(); expect(policy.reports()).toEqual([]);
});
it('never treats malformed or understated memory numbers as a Developer permission', () => {
  const policy = new MemoryAdmission(() => true);
  for (const value of [-1, Number.NaN, Infinity, 0.5]) expect(() => policy.accept({ ...request, claimedBytes: value })).toThrow('Invalid memory admission report');
});
