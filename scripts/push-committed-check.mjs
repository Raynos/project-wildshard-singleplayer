import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { openMirror } from './build-mirror.mjs';

/** @type {import('./push-committed-check.mjs').CommittedCheckPorts} */
const NATIVE_PORTS = {
  open: openMirror,
  gitDirectory: repository => execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: repository, encoding: 'utf8' }).trim(),
  run: (command, args, options) => spawnSync(command, args, options),
};

/** Native lint resolves files through Rust; execute it on the existing clean
 * mirror instead of asking dirty working inputs to match the commit.
 * @param {string} root @param {string} base @param {string} tip
 * @param {string} phase @param {string[]} files
 * @param {import('./push-committed-check.mjs').CommittedCheckPorts} [ports] */
export function runCommittedCheck(root, base, tip, phase, files, ports = NATIVE_PORTS) {
  const mirror = ports.open(tip, { repo: root });
  try {
    // These four pure writers run before discovery in ordinary gen. Native
    // lint needs their files too; run only the exact mirror-owned writers.
    const prepare = ports.run(process.execPath, ['--input-type=module','--eval', `
      for (const [file,name] of [['weapons','genStarterWeapons'],['bag','genStarterBag'],['effects','genStarterEffects'],['arm-clips','genStarterArmClips']]) {
        const module = await import('./scripts/gen-starter-'+file+'.mjs');
        module[name](process.cwd());
      }
    `], { cwd: mirror.dir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_DIR: ports.gitDirectory(root), GIT_WORK_TREE: mirror.dir,
        GIT_INDEX_FILE: resolve(mirror.dir, '../index') } });
    if (prepare.error !== undefined) throw prepare.error;
    if (prepare.status !== 0) return { status: prepare.status ?? 1, stdout: prepare.stdout ?? '', stderr: prepare.stderr ?? '' };
    const result = ports.run(process.execPath, [resolve(mirror.dir, 'scripts/committed-fast-checks.mjs'),
      mirror.dir, base, mirror.sha, phase, JSON.stringify(files)], {
      cwd: mirror.dir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_DIR: ports.gitDirectory(root), GIT_WORK_TREE: mirror.dir,
        GIT_INDEX_FILE: resolve(mirror.dir, '../index') },
    });
    if (result.error !== undefined) throw result.error;
    return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } finally { mirror.release(); }
}

if (import.meta.main) {
  const [root, base, tip, phase, encoded] = process.argv.slice(2);
  if (root === undefined || base === undefined || tip === undefined || phase === undefined || encoded === undefined) throw new Error('Expected root base tip phase files');
  /** @type {unknown} */ const files = JSON.parse(encoded);
  if (!Array.isArray(files) || !files.every(file => typeof file === 'string')) throw new Error('Expected exact changed paths');
  const result = runCommittedCheck(root, base, tip, phase, files);
  process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  process.exitCode = result.status;
}
