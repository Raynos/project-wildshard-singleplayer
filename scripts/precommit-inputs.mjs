// The shell checks its own exact index and storage policy. Runtime layers are
// checked in their pinned engine repository, and browser proofs run in CI.
import { resolve } from 'node:path';
import { runCommitJobs } from './precommit-jobs.mjs';
export async function precommitInputs(root = resolve(import.meta.dirname, '..')) {
  const results = await runCommitJobs(root, [
    { name: 'storage', command: [process.execPath, 'scripts/repo-size.mjs', '--index'] },
    { name: 'shell inventory', command: [process.execPath, 'scripts/check-shell.mjs', '--index'] },
  ], performance.now() + 5_000);
  for (const result of results) {
    if (result.output !== '') console.error(result.output.trimEnd());
    if (result.timedOut || result.code === 124) console.warn(`pre-commit: ${result.name} unfinished; CI owns it`);
    else if (result.code !== 0) throw new Error(`${result.name}: refused`);
  }
}
if (import.meta.main) {
  try { await precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
