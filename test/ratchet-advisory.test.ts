import { expect, it } from 'vitest';
import { ratchetApproved } from '../scripts/ratchet-advisory.mjs';
import type { GeneratedIncrease } from '../scripts/generated-policy.mjs';

const key = 'wildshard/shard-engine-imports', file = 'src/shards/pine-hollow/models/logCabin.ts';
const row: GeneratedIncrease = { kind: 'debt', key, file, before: 2, after: 3 };
const output = `Ratchet rose:\n${file}: ${key} was 2, now 3`;
const receipt = { approver: 'wildshard-new', increases: [row] };

it('recognizes exact approved debt without accepting stale or partial receipts', () => {
  expect(ratchetApproved(output, receipt, new Set())).toBe(true);
  expect(ratchetApproved(`src/shards/example/rows.ts: ${key} was 2, now 1 (central regeneration will lower the debt)\n${output}`, receipt, new Set())).toBe(true);
  expect(ratchetApproved(output, { ...receipt, approver: 'another-lane' }, new Set())).toBe(false);
  expect(ratchetApproved(output, { ...receipt, increases: [{ ...row, before: 1 }] }, new Set())).toBe(false);
  expect(ratchetApproved(output, { ...receipt, increases: [{ ...row, after: 4 }] }, new Set())).toBe(false);
  expect(ratchetApproved(`${output}\nsrc/shards/pine-hollow/world/cabins.ts: ${key} was 7, now 8`, receipt, new Set())).toBe(false);
});

it('retains hard-rule and unknown guard failures even with an exact receipt', () => {
  expect(ratchetApproved(output, receipt, new Set([key]))).toBe(false);
  expect(ratchetApproved(`${output}\ndebugRows: was 20, now 21`, receipt, new Set())).toBe(false);
  expect(ratchetApproved('oxlint failed without diagnostics', receipt, new Set())).toBe(false);
  expect(ratchetApproved(`Unknown guard failure\n${output}`, receipt, new Set())).toBe(false);
  expect(ratchetApproved('Ratchet rose:\n', receipt, new Set())).toBe(false);
  expect(ratchetApproved(output.replace('now 3', 'now 9007199254740992'), receipt, new Set())).toBe(false);
});
