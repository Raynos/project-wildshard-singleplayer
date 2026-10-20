#!/usr/bin/env node
// Fresh plugin workers bound AST retention while every selected file keeps the full lint policy.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const listed = spawnSync('pnpm', ['exec', 'oxlint', '--debug', 'files'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (listed.error !== undefined || listed.status !== 0) {
  console.error(listed.error?.message ?? listed.stderr);
  process.exit(listed.status ?? 1);
}
const files = listed.stdout.trim().split(/\r?\n/u);
if (files.length === 0 || files.some(file => !file || !existsSync(resolve(root, file)))) {
  console.error('lint-all: could not enumerate the complete oxlint file selection');
  process.exit(1);
}
const batchSize = 256;
for (let offset = 0; offset < files.length; offset += batchSize) {
  console.info(`lint-all: batch ${offset / batchSize + 1}/${Math.ceil(files.length / batchSize)}`);
  const result = spawnSync('pnpm', ['exec', 'oxlint', ...files.slice(offset, offset + batchSize)], { cwd: root, stdio: 'inherit' });
  if (result.error !== undefined || result.status !== 0) {
    if (result.error !== undefined) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
}
