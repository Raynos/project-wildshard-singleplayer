import { afterEach, expect, test } from 'vitest';
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

test('ordinary prose and other decisions grant no approval; stale or overlapping selectors refuse', () => {
  const root = fixture();
  put(root, 'docs/HOST-BAR.md', '`game/approved` is discussed.\n- G475 another feature: `game/approved`.');
  expect(g571HostApprovals(root).size).toBe(0);
  put(root, 'docs/HOST-BAR.md', '- G571 missing: `game/missing`.');
  expect(() => g571HostApprovals(root)).toThrow('Missing G571');
  put(root, 'docs/HOST-BAR.md', '- G571 overlap: `game/approved` and `game/approved#approved`.');
  expect(() => g571HostApprovals(root)).toThrow('Overlapping');
  put(root, 'docs/HOST-BAR.md', '- G571 typo: `game/approved#missing`.');
  expect(() => row(root)).toThrow('Missing G571 binding');
});
