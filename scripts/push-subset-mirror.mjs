import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { openMirror } from './build-mirror.mjs';

/** @type {import('./push-subset-mirror.mjs').PushSubsetMirrorPorts} */
const NATIVE_PORTS = {
  open: openMirror,
  gitDirectory: root => execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim(),
  run: (command, args, options) => spawnSync(command, args, options),
};

const writeStdout = promisify(process.stdout.write.bind(process.stdout));
const writeStderr = promisify(process.stderr.write.bind(process.stderr));
/** @type {import('./push-subset-mirror.mjs').SubsetWriterPorts} */
const NATIVE_WRITERS = {
  stdout: async text => { await writeStdout(text); },
  stderr: async text => { await writeStderr(text); },
};

/** @param {{stdout:string,stderr:string}} result
 * @param {import('./push-subset-mirror.mjs').SubsetWriterPorts} [ports] */
export async function writeCommittedSubset(result, ports = NATIVE_WRITERS) {
  // stdout is the machine record. The parent intentionally merges descriptors;
  // starting stderr before this callback can split JSON inside a quoted field.
  await ports.stdout(result.stdout);
  await ports.stderr(result.stderr);
}

/** Hold one existing slot through input production and every selected reader.
 * @param {string} root @param {string} tip @param {string[]} files @param {number} deadline
 * @param {import('./push-subset-mirror.mjs').PushSubsetMirrorPorts} [ports] */
export function runCommittedSubset(root, tip, files, deadline, ports = NATIVE_PORTS) {
  if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error('Missing or exhausted push subset deadline');
  const mirror = ports.open(tip, { repo: root, deadline });
  try {
    const result = ports.run(process.execPath, [resolve(mirror.dir, 'scripts/push-ci-subset.mjs'), JSON.stringify(files)], {
      cwd: mirror.dir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, WS_GIT_CHECK_DEADLINE: String(deadline), GIT_DIR: ports.gitDirectory(root),
        GIT_WORK_TREE: mirror.dir, GIT_INDEX_FILE: resolve(mirror.dir, '../index') },
    });
    if (result.error !== undefined) throw result.error;
    return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } finally { mirror.release(); }
}

if (import.meta.main) {
  const [root, tip, encoded] = process.argv.slice(2);
  if (root === undefined || tip === undefined || encoded === undefined || process.argv.length !== 5)
    throw new Error('Expected repository, exact tip and changed-path JSON');
  /** @type {unknown} */ const files = JSON.parse(encoded);
  if (!Array.isArray(files) || !files.every(file => typeof file === 'string')) throw new Error('Invalid changed paths');
  const result = runCommittedSubset(root, tip, files, Number(process.env.WS_GIT_CHECK_DEADLINE));
  await writeCommittedSubset(result); process.exitCode = result.status;
}
