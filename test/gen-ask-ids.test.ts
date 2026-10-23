// oxlint-disable-next-line import/no-nodejs-modules -- Own tiny ask inventory fixtures under the repository's ignored tmp directory.
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture paths.
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { genAskIds } from '../scripts/gen-ask-ids.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(): string {
  const root = mkdtempSync(resolve('tmp/ask-ids-test-'));
  owned.push(root);
  mkdirSync(join(root, 'lint'));
  return root;
}

test('writes canonical ask IDs only when their bytes change', () => {
  const root = fixture(), asks = join(root, 'docs/tasks/asks'), legacy = join(root, 'project/archive');
  mkdirSync(asks, { recursive: true });
  mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, '2026-09-22-asks-table.md'), '| E1 | original |\n| E2 | duplicate |\n');
  writeFileSync(join(asks, 'E2.md'), 'ask');
  writeFileSync(join(asks, 'E10.md'), 'ask');
  writeFileSync(join(asks, 'other.md'), 'not an ask');
  genAskIds(root);
  const output = join(root, 'lint/ask-ids.json');
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(['E1', 'E10', 'E2']);
  utimesSync(output, 1, 1);
  const before = lstatSync(output);
  genAskIds(root);
  expect(lstatSync(output).mtimeMs).toBe(before.mtimeMs);
  expect(lstatSync(output).ctimeMs).toBe(before.ctimeMs);
  writeFileSync(join(asks, 'E3.md'), 'new ask');
  genAskIds(root);
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(['E1', 'E10', 'E2', 'E3']);
});

test('keeps the committed inventory when docs are excluded', () => {
  const root = fixture(), output = join(root, 'lint/ask-ids.json');
  writeFileSync(output, '["E1"]\n');
  genAskIds(root);
  expect(readFileSync(output, 'utf8')).toBe('["E1"]\n');
});
