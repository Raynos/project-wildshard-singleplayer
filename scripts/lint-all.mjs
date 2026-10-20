#!/usr/bin/env node
// Fresh plugin workers bound AST retention while every selected file keeps the full lint policy.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const shard = args.length === 1 ? /^--shard=([1-9]\d*)\/([1-9]\d*)$/u.exec(args[0]) : null;
const part = shard === null ? 1 : Number(shard[1]), parts = shard === null ? 1 : Number(shard[2]);
if ((args.length > 0 && shard === null) || !Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || part > parts) {
  console.error('lint-all: expected --shard=PART/TOTAL with 1 <= PART <= TOTAL');
  process.exit(2);
}
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
const selected = (parts === 1 ? files : files.toSorted()).filter((_, index) => index % parts === part - 1);
if (selected.length === 0) {
  console.error('lint-all: shard selected no files');
  process.exit(1);
}
for (let offset = 0; offset < selected.length; offset += batchSize) {
  console.info(`lint-all: shard ${part}/${parts}, batch ${offset / batchSize + 1}/${Math.ceil(selected.length / batchSize)}`);
  const result = spawnSync('pnpm', ['exec', 'oxlint', ...selected.slice(offset, offset + batchSize)], { cwd: root, stdio: 'inherit' });
  if (result.error !== undefined || result.status !== 0) {
    if (result.error !== undefined) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
}
