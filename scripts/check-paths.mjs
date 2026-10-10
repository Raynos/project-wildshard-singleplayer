#!/usr/bin/env node
// E357 F1: reject stale tooling paths and import.meta.glob patterns before a move can make a check vacuous.
// Run from the repository root; tests run this same CLI from a small temporary tree.
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { checkShards } from './check-shards.mjs';

const ROOT = process.cwd();
const failures = new Set();
const allowFile = 'scripts/check-paths.allow.json';
const allow = existsSync(resolve(ROOT, allowFile)) ? JSON.parse(readFileSync(resolve(ROOT, allowFile), 'utf8')) : [];
const allowed = new Set();
if (!Array.isArray(allow)) failures.add(`${allowFile}: expected an array`);
else for (const entry of allow) {
  if (typeof entry?.path !== 'string' || typeof entry.file !== 'string' || typeof entry.why !== 'string' || !entry.why.trim()) {
    failures.add(`${allowFile}: every entry needs path, file and a non-empty why`);
    continue;
  }
  const at = resolve(ROOT, entry.file);
  if (!existsSync(at) || !readFileSync(at, 'utf8').includes(entry.path)) failures.add(`${allowFile}: stale allowance ${entry.file}: ${entry.path}`);
  allowed.add(`${entry.file}\0${entry.path}`);
}

const PATH = /^(?:\.\/)?(?:src|test)\//;
const GLOB = /[*{?[]/;
const STRINGS = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g;
const ARGUMENT = `(?:\\[(?:\\s|,|${STRINGS.source})*\\]|${STRINGS.source})`;
const CALLS = new RegExp(`${STRINGS.source}|\\bimport\\.meta\\.glob(?:<[^()]*>)?\\s*\\(\\s*(${ARGUMENT})`, 'g');
// Preserve strings and line positions while blanking comments. Documentation of deleted paths is not executable code.
function codeOnly(text, shell) {
  const tokens = shell
    ? /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|#[^\n]*/g
    : /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  return text.replaceAll(tokens, (token) => (token.startsWith(shell ? '#' : '/') ? token.replaceAll(/[^\n]/g, ' ') : token));
}
function strings(text) {
  return [...text.matchAll(STRINGS)].filter((m) => !(m[0].startsWith('`') && m[0].includes('${')));
}
function check(file, text, path, index, folder = ROOT) {
  if (allowed.has(`${file}\0${path}`)) return;
  const at = resolve(folder, path);
  const found = GLOB.test(path) ? globSync(at).some((p) => statSync(p).isFile()) : existsSync(at);
  if (!found) failures.add(`${file}:${text.slice(0, index).split('\n').length}: ${GLOB.test(path) ? 'empty glob' : 'missing path'} ${path}`);
}

const tooling = globSync(['scripts/**/*.{mjs,js,sh,py,json}', 'src/shards/*/generators/**/*.mjs', 'vite.config.ts', 'vite/**/*.ts', '.oxlintrc.json'], { cwd: ROOT });
for (const file of tooling) {
  if (file === allowFile || file === 'scripts/normalize/move.dry-run.json') continue; // allowances are checked against their named file, not as paths in this JSON
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  const shell = /\.(sh|py)$/.test(file);
  const code = codeOnly(text, shell);
  for (const match of strings(code)) {
    if (file.endsWith('.py') && /\bf$/.test(code.slice(Math.max(0, match.index - 2), match.index))) continue;
    const path = match[0].slice(1, -1);
    if (PATH.test(path)) check(file, text, path, match.index);
  }
  // Match standalone tokens, never a suffix of /tmp/.../src or weapons-src/...; punctuation may follow prose paths.
  if (shell) for (const match of code.matchAll(/(?<![\w/.-])(?:\.\/)?src\/[\w./*{}?[\],$-]+/g)) check(file, text, match[0].replace(/\.$/, ''), match.index);
}

for (const file of globSync(['src/**/*.ts', 'test/**/*.ts'], { cwd: ROOT })) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  const code = codeOnly(text, false);
  // Vite's optional generic precedes the call; only the first argument supplies glob patterns.
  for (const call of code.matchAll(CALLS)) for (const match of strings(call[1] ?? '')) {
    const pattern = match[0].slice(1, -1);
    if (pattern.startsWith('!')) continue;
    const folder = pattern.startsWith('/') ? ROOT : dirname(resolve(ROOT, file));
    check(file, text, pattern.startsWith('/') ? pattern.slice(1) : pattern, call.index, folder);
  }
}

// E362 AG9: the same policy also runs in pnpm test, beyond pre-commit and the Vitest CI check.
if (existsSync(resolve(ROOT, 'lint/shard-layout.json'))) for (const failure of checkShards(ROOT)) failures.add(failure);

if (failures.size > 0) {
  console.error(`check-paths: ${failures.size} failure(s)\n${[...failures].sort((a, b) => a.localeCompare(b)).join('\n')}`);
  process.exitCode = 1;
} else console.info('check-paths: all tooling paths and code globs exist');
