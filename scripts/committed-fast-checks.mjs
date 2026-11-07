// The existing pusher invokes this exact committed module for each phase.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function committedFastChecks(root, base, tip, phase, paths) {
  process.chdir(root);
  const file = 'scripts/shell-fast-checks.mjs';
  const committed = execFileSync('git', ['show', `${tip}:${file}`], { cwd: root, encoding: 'utf8' });
  if (committed !== readFileSync(resolve(root, file), 'utf8')) throw new Error('Shell fast checker differs from candidate');
  const { shellFastChecks } = await import(pathToFileURL(resolve(root, file)).href);
  await shellFastChecks(root, base, tip, phase, paths);
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  const [root, base, tip, phase, paths] = process.argv.slice(2);
  await committedFastChecks(root, base, tip, phase, JSON.parse(paths));
}
