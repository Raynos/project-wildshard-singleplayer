// G367: build the exact temporary/private index, never an agent's working copy.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { saveCommitInputs } from './commit-inputs.mjs';

export function precommitInputs(root = resolve(import.meta.dirname, '..')) {
const git = (/** @type {string[]} */ args, /** @type {Uint8Array | undefined} */ input) => execFileSync('git', args, { cwd: root, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const paths = git(['diff', '--cached', '--name-only'], undefined).split('\n').filter(Boolean);
if (paths.some(path => /^(src|scripts|lint|public|test|music|sfx)\//u.test(path) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(path))) {
  const started = performance.now(), before = git(['write-tree'], undefined);
  const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-commit-inputs-')));
  try {
    const archive = resolve(scratch, 'source.tar');
    git(['archive', before, '--output', archive, '--', '.', ':!art', ':!progress', ':!sources', ':!ios', ':!android', ':!.claude'], undefined);
    execFileSync('tar', ['-xf', archive, '-C', scratch]);
    rmSync(archive);
    linkNodeModules(root, scratch);
    execFileSync(process.execPath, ['scripts/gen.mjs'], { cwd: scratch, stdio: 'inherit' });
    const tracked = git(['ls-tree', '-r', '--name-only', before], undefined).split('\n');
    // Only these declared tracked tables are written by the boot generator.
    const tables = ['lint/ask-ids.json', 'lint/shard-words.generated.json'];
    for (const file of tables) {
      const bytes = readFileSync(resolve(scratch, file));
      if (bytes.equals(execFileSync('git', ['show', `${before}:${file}`], { cwd: root }))) continue;
      const blob = git(['hash-object', '-w', '--stdin'], bytes);
      git(['update-index', '--add', '--cacheinfo', '100644', blob, file], undefined);
    }
    const files = globSync('src/**/*.generated.*', { cwd: scratch }).map(String).filter(path => !tracked.includes(path));
    /** @type {{jobs: {buildOutputs?: Record<string,string>}[]}} */
    const catalogue = JSON.parse(readFileSync(resolve(scratch, 'scripts/generation-jobs.json'), 'utf8'));
    for (const job of catalogue.jobs) for (const file of Object.keys(job.buildOutputs ?? {})) if (existsSync(resolve(scratch, file)) && !tracked.includes(file)) files.push(file);
    const final = git(['write-tree'], undefined);
    saveCommitInputs(root, final, scratch, [...new Set(files)]);
    console.log(`precommit-inputs: ${((performance.now() - started) / 1000).toFixed(3)}s; staged generation inputs cached`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
