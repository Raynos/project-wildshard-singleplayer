import { afterEach, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated ruler approval fixtures.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all fixture writes under repository scratch.
import { dirname, resolve } from 'node:path';
import { g571HostApprovals } from '../scripts/g571-hosts.mjs';
import { outputShardLines } from '../scripts/shard-platform.mjs';
import { platformOutput } from './fixtures/platformOutputs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function put(root: string, path: string, source: string): void { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); }
function fixture(source = 'export const approved = 1;') {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/g571-host-')); owned.push(root);
  put(root, 'src/game/package.json', JSON.stringify({ name: '@wildshard/game', exports: { './approved': './approved.ts', './unnamed': './unnamed.ts' } }));
  put(root, 'src/game/approved.ts', source); put(root, 'src/game/unnamed.ts', 'export const unnamed = 2;');
  platformOutput(root, 'pine-hollow', { 'runtime/index.ts': "import { approved } from '@wildshard/game/approved'; import { unnamed } from '@wildshard/game/unnamed'; export const live = [approved, unnamed];" });
  return root;
}
function row(root: string) { const measured = outputShardLines(root, true)['pine-hollow']; if (measured === undefined) throw new Error('Missing fixture output'); return measured; }

test('an explicitly named G571 module is platform while an unnamed one-user host remains charged', () => {
  const root = fixture(), before = row(root);
  put(root, 'docs/HOST-BAR.md', '- G571 approved host: `game/approved` passes tests 2-6.');
  const after = row(root);
  expect(before.conversion.gameSystemAttribution.lines).toBe(2);
  expect(after.conversion.gameSystemAttribution.lines).toBe(1);
  expect(after.conversion.gameSystemAttribution.modules).toEqual([{ path: 'src/game/unnamed.ts', lines: 1 }]);
  expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
  expect(after.conversion.shardRuntimeLines).toBe(before.conversion.shardRuntimeLines);
  expect(after.conversion.gameSystemAttribution.pendingSecondUser).toEqual([]);
});

test('a named declaration never waives the other declarations of a one-user module', () => {
  const root = fixture('export const approved = 1;\nconst law = 2;\nexport const helper = law;'), before = row(root);
  put(root, 'docs/HOST-BAR.md', '- G571 approved host: `game/approved#approved`.');
  const after = row(root);
  expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
  expect(after.conversion.gameSystemAttribution.modules).toContainEqual({ path: 'src/game/approved.ts', lines: 2, excludedLines: [1] });
});

test('shared physical declaration lines stay charged when an unapproved binding occupies them', () => {
  const root = fixture('export const approved = 1, rule = 2;\nexport const helper = rule;'), before = row(root);
  put(root, 'docs/HOST-BAR.md', '- G571 approved host: `game/approved#approved`.');
  expect(row(root).conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines);
});

test('named approvals in a shared module preserve every unrelated sole-user declaration', () => {
  const root = fixture('export const approved = 1;\nconst law = 2;\nexport const helper = law;\nexport const other = 3;');
  platformOutput(root, 'driftwood-isle', { 'runtime/index.ts': "import { other } from '@wildshard/game/approved'; export const live = other;" });
  platformOutput(root, 'pine-hollow', { 'runtime/index.ts': "import { approved, helper } from '@wildshard/game/approved'; export const live = [approved, helper];" });
  const before = row(root);
  put(root, 'docs/HOST-BAR.md', '- G571 approved host: `game/approved#approved`.');
  const after = row(root), names = after.conversion.gameSystemAttribution.exports.map(entry => entry.name);
  expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
  expect(names).toContain('helper'); expect(names).toContain('law'); expect(names).not.toContain('approved');
});

test('a listed missing host warns without granting credit or blocking measurement', () => {
  const root = fixture(), before = row(root);
  put(root, 'docs/HOST-BAR.md', '- G571 pending: `game/missing#install`.\n- G571 approved: `game/approved#approved`.');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const approvals = g571HostApprovals(root), after = row(root);
    expect(approvals.has('src/game/missing.ts')).toBe(false);
    expect(approvals.get('src/game/approved.ts')).toEqual(new Set(['approved']));
    expect(warning).toHaveBeenCalledWith('Missing G571 host: src/game/missing.ts; approval skipped');
    expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
    expect(after.conversion.gameSystemAttribution.modules).toEqual([{ path: 'src/game/unnamed.ts', lines: 1 }]);
  } finally { warning.mockRestore(); }
});

test('ordinary prose and other decisions grant no approval; overlapping or missing bindings refuse', () => {
  const root = fixture();
  put(root, 'docs/HOST-BAR.md', '`game/approved` is discussed.\n- G475 another feature: `game/approved`.');
  expect(g571HostApprovals(root).size).toBe(0);
  put(root, 'docs/HOST-BAR.md', '- G571 overlap: `game/approved` and `game/approved#approved`.');
  expect(() => g571HostApprovals(root)).toThrow('Overlapping');
  put(root, 'docs/HOST-BAR.md', '- G571 typo: `game/approved#missing`.');
  expect(() => row(root)).toThrow('Missing G571 binding');
});


test.each(['G599', 'G600', 'G601'])('%s explicitly tagged Jake approvals credit only the named module', decision => {
  const root = fixture(), before = row(root);
  put(root, 'docs/HOST-BAR.md', `- ${decision} L3 Jake-approved host: \`game/approved\` passes tests 2-6.`);
  const after = row(root);
  expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
  expect(after.conversion.shardRuntimeLines).toBe(before.conversion.shardRuntimeLines);
  expect(after.conversion.gameSystemAttribution.modules).toEqual([{ path: 'src/game/unnamed.ts', lines: 1 }]);
});

test.each(['G599', 'G600', 'G601'])('%s binding approval preserves every other declaration', decision => {
  const root = fixture('export const approved = 1;\nconst law = 2;\nexport const helper = law;'), before = row(root);
  put(root, 'docs/HOST-BAR.md', `- ${decision} Jake-approved host: \`game/approved#approved\`.`);
  const after = row(root);
  expect(after.conversion.customRuntimeLines).toBe(before.conversion.customRuntimeLines - 1);
  expect(after.conversion.gameSystemAttribution.modules).toContainEqual({ path: 'src/game/approved.ts', lines: 2, excludedLines: [1] });
});

test.each([
  '`game/approved` is a G600 Jake-approved host.',
  'Proposed: - G600 L3 Jake-approved host: `game/approved`.',
  '- G600 view programs (Jake\'s L7 pick): `game/approved`.',
  '- G599 N1 (Jake, 2026-10-22): `game/approved`. Approved on condition that Nalati joins; until it does, it charges to Nine.',
  '- G599 N1 Jake-approved host: `game/approved`, on condition that Nalati joins.',
  '- G600 L3 Jake-approved host: `game/approved` if Nalati joins.',
  '- G600 L3 Jake-approved host: `game/approved`, conditional approval.',
  '- G601 C11 Jake-approved host: `game/approved` until the review.',
  '- G601 C11 Jake-approved host: `game/approved` unless the review refuses.',
  '- G475 L3 Jake-approved host: `game/approved`.',
  '- G6000 L3 Jake-approved host: `game/approved`.',
  '- G602 L3 Jake-approved host: `game/approved`.',
])('unapproved or conditional prose stays fully charged: %s', prose => {
  const root = fixture(), before = row(root);
  put(root, 'docs/HOST-BAR.md', prose);
  expect(g571HostApprovals(root).size).toBe(0);
  expect(row(root).conversion).toEqual(before.conversion);
});

test('picked approvals retain overlap and missing-binding refusal', () => {
  const root = fixture();
  put(root, 'docs/HOST-BAR.md', '- G600 L3 Jake-approved host: `game/approved`.\n- G601 C11 Jake-approved host: `game/approved#approved`.');
  expect(() => g571HostApprovals(root)).toThrow('Overlapping');
  put(root, 'docs/HOST-BAR.md', '- G600 L3 Jake-approved host: `game/approved#missing`.');
  expect(() => row(root)).toThrow('Missing G571 binding');
});
