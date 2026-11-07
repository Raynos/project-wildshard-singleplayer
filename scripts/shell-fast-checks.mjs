// Read committed sources only. Called by the existing scheduled pusher.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function shellFastChecks(root, base, tip, phase, paths) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (phase === 'storage') {
    const { createChecker } = await import(pathToFileURL(resolve(root, 'scripts/repo-size.mjs')).href);
    createChecker({ cwd: root }).checkPush(`refs/heads/main ${tip} refs/heads/main ${base}\n`, { rangeOnly: true });
  } else if (phase === 'fast-lint') {
    for (const file of paths.filter(file => /\.(?:mjs|js)$/u.test(file))) {
      let source; try { source = git(['show', `${tip}:${file}`]); } catch { continue; }
      execFileSync(process.execPath, ['--check', '--input-type=module'], { input: source, stdio: ['pipe', 'pipe', 'pipe'] });
    }
  } else {
    // Use the candidate's checker and inventory, never a loose policy edit.
    const checker = git(['show', `${tip}:scripts/check-shell.mjs`]);
    const pinModule = git(['show', `${tip}:scripts/engine-pin.mjs`]);
    if (checker !== readFileSync(resolve(root, 'scripts/check-shell.mjs'), 'utf8') || pinModule !== readFileSync(resolve(root, 'scripts/engine-pin.mjs'), 'utf8')) throw new Error('Shell checker differs from committed candidate');
    const { checkShell } = await import(pathToFileURL(resolve(root, 'scripts/check-shell.mjs')).href);
    checkShell(tip);
  }
  console.log(`Shell ${phase}: passed`);
}
