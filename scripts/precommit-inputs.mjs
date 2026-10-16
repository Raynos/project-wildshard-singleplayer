// G416: lint/layer checks on the actual private/pathspec staged tree. A commit lands in under 10 s (Jake, 2026-10-15):
// the slow checks (pnpm gen, the changed-root type check) run in the push gate (scripts/local-gate.py), which already
// runs them, plus oxlint, check-graph, the related tests and the build, over every file changed since origin/main.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openMirror } from './build-mirror.mjs';
import { discoverGeneration, generateShardJob } from './generate.mjs';
import { compareRuntimeFiles, RUNTIME_FILES_LIST } from '../lint/runtime-files.mjs';
import { compareCustomSections, CUSTOM_SECTION_POLICY } from './custom-section-policy.mjs';

/** A warm mirror needs missing declared build outputs before resolving typed imports. */
export async function prepareMissingCheapInputs(root = resolve(import.meta.dirname, '..')) {
  for (const job of discoverGeneration(root).jobs) {
    const outputs = [...(job.buildTimeOutputs ?? []), ...Object.keys(job.buildOutputs ?? {})];
    if (outputs.some(file => !existsSync(resolve(root, file)))) {
      await generateShardJob(root, job, { restore: true, restoreOutputs: outputs });
    }
  }
}

/** Check source in the `commit` slot of the build mirror, synced to the staged tree; generated inputs stay cached there
 * (generated once per slot, so type-aware lint can resolve them; the push gate regenerates them from scratch). */
export function precommitInputs(root = resolve(import.meta.dirname, '..')) {
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const changed = git(['diff', '--cached', '--name-only', '--no-renames']).split('\n').filter(Boolean);
  if(changed.includes('lint/ratchet.json')||changed.includes(CUSTOM_SECTION_POLICY)) {
    const show=spec=>{try{return JSON.parse(git(['show',spec]));}catch{return undefined;}};
    const failures=compareCustomSections(show('HEAD:lint/ratchet.json')?.budgets??{},show(':lint/ratchet.json')?.budgets??{},
      show(`HEAD:${CUSTOM_SECTION_POLICY}`),show(`:${CUSTOM_SECTION_POLICY}`));
    if(failures.length>0)throw new Error(failures.join('\n'));
  }
  // Per-shard runtime/ file ceilings are shrink-only: a rise needs a new raises line (lint/runtime-files.mjs).
  if (changed.includes(RUNTIME_FILES_LIST)) {
    const show = (/** @type {string} */ spec) => { try { return /** @type {unknown} */ (JSON.parse(git(['show', spec]))); } catch { return undefined; } };
    const staged = show(`:${RUNTIME_FILES_LIST}`), failures = staged === undefined ? [`${RUNTIME_FILES_LIST}: removed or unreadable`] : compareRuntimeFiles(show(`HEAD:${RUNTIME_FILES_LIST}`), staged);
    if (failures.length > 0) throw new Error(failures.join('\n'));
  }
  if (!changed.some(file => /^(src|scripts|lint|test|api|admin|drafts)\//u.test(file) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(file))) return;
  const mirror = openMirror(git(['write-tree']), { repo: root, slot: 'commit' });
  const scratch = mirror.dir;
  try {
    const env = { ...process.env };
    for (const key of git(['rev-parse', '--local-env-vars']).split('\n')) delete env[key];
    const run = (/** @type {string} */ command, /** @type {string[]} */ args) => execFileSync(command, args, { cwd: scratch, env, stdio: 'inherit' });
    // `pnpm gen` costs 30-100 s when a broad job's key changes (nine-layout); run it only for a fresh slot.
    // The stamp sits beside the slot's tree: the sync deletes untracked files inside it, but keeps ignored outputs.
    const generated = resolve(scratch, '..', 'precommit-generated');
    if (!existsSync(generated)) { run(process.execPath, ['scripts/gen.mjs', '--build-inputs']); writeFileSync(generated, `${new Date().toISOString()}\n`); }
    run(process.execPath, ['scripts/precommit-inputs.mjs', '--missing-cheap']);
    // Discovery changes when authored manifests change, even in an already warm
    // slot. Refresh this cheap source glue before typed lint resolves imports.
    run(process.execPath, ['scripts/gen-shards.mjs']);
    const present = changed.filter(file => existsSync(resolve(scratch, file)) && /\.[cm]?[jt]sx?$/u.test(file));
    if (present.length > 0) {
      // oxlint exits 1 on 'No files found to lint' when every staged file is in its ignorePatterns (e.g. test/fixtures/).
      // .oxlintrc.json is JSONC (comments, globs with '/*'), so read only its ignorePatterns array.
      const ignoreList = /"ignorePatterns"\s*:\s*\[([^\]]*)\]/u.exec(readFileSync(resolve(scratch, '.oxlintrc.json'), 'utf8'))?.[1] ?? '';
      const ignored = [...ignoreList.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
      // gitignore-style: a pattern with an inner '/' is anchored at the root, otherwise it matches at any depth.
      const isIgnored = (/** @type {string} */ file) => ignored.some(pattern => pattern.slice(0, -1).includes('/')
        ? file.startsWith(pattern) : file.startsWith(pattern) || file.includes(`/${pattern}`));
      const lintable = present.filter(file => !isIgnored(file));
      if (lintable.length > 0) run('pnpm', ['exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', ...lintable]);
      run(process.execPath, ['scripts/check-graph.mjs', '--source-only']);
    }
  } finally { mirror.release(); }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (process.argv.includes('--missing-cheap')) await prepareMissingCheapInputs();
    else precommitInputs();
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
