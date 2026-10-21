// Mirror transport belongs to the checkout; source checks belong to the staged tree.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openMirror } from './build-mirror.mjs';

/** Keep the staged mirror locked until its checker and imported policies finish. */
export function precommitInputs(root = resolve(import.meta.dirname, '..')) {
  const repo = resolve(root);
  const tree = execFileSync('git', ['write-tree'], { cwd: repo, encoding: 'utf8' }).trim();
  const mirror = openMirror(tree, { repo, slot: 'commit' });
  try {
    const checker = resolve(mirror.dir, 'scripts/check-staged-inputs.mjs');
    if (!existsSync(checker)) throw new Error('pre-commit: staged checker is missing; refusing checkout fallback');
    // Preserve the original private index for staged comparisons. The checker
    // clears Git-local variables before invoking this tree's source tools.
    execFileSync(process.execPath, [checker, repo], { cwd: mirror.dir, stdio: 'inherit' });
  } finally { mirror.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
