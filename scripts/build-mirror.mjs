#!/usr/bin/env node
// One persistent, incrementally synced copy of a commit, for builds and gates that must not read the shared working
// tree. It replaces every per-run `git archive | tar -x` export.
//
//   node scripts/build-mirror.mjs run <rev> [--slot name] [--full] -- <command...>   sync, then run <command> in it
//   node scripts/build-mirror.mjs sync <rev> [--slot name] [--full]                  sync and print the mirror path
//   node scripts/build-mirror.mjs status
//
// The mirror is a work tree with its own index (GIT_INDEX_FILE), so `read-tree -u` rewrites only the files that differ
// from the commit it last held: a sync to a nearby commit writes kilobytes, never a fresh 23k-file export. It holds the
// commit minus art/, progress/ and sources/ (what the exports always excluded; --full keeps them). There is one mirror
// per slot under the git-ignored ./tmp/build-mirror (Jake 2026-10-15: three slots machine-wide, gate, commit and the
// shared default `check` that every lane queues for; no per-lane slots): never /tmp, $TMPDIR or a session scratchpad (macOS empties those
// at boot, before login, and the piled-up exports stalled the boot for hours on 2026-10-15), and `du -sh tmp` shows
// what this repo holds. A lock serializes users of a slot: the mirror cannot change under a running build.
// node_modules is linked by link-node-modules.mjs (E432): @wildshard/* resolves to the mirror's own sources.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';

const REPO = resolve(import.meta.dirname, '..');
const EXCLUDED = new Set(['art', 'progress', 'sources']);
const LOCK_WAIT_MS = 30 * 60_000;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function mirrorRoot(env = process.env, repo = REPO) {
  return resolve(env.WILDSHARD_BUILD_MIRROR ?? join(repo, 'tmp', 'build-mirror'));
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function acquire(lockDir) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(lockDir);
      writeFileSync(join(lockDir, 'owner'), `${process.pid}\n`);
      return () => rmSync(lockDir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    let owner = 0;
    try { owner = Number(readFileSync(join(lockDir, 'owner'), 'utf8')); } catch { /* owner not written yet */ }
    if (owner && !alive(owner)) { rmSync(lockDir, { recursive: true, force: true }); continue; }
    if (Date.now() > deadline) throw new Error(`build-mirror: ${lockDir} still held by pid ${owner} after ${LOCK_WAIT_MS / 60_000} min`);
    sleep(2000);
  }
}

/** The commit's tree, or (unless full) a tree object of its top level without the excluded folders. */
function buildTree(repo, sha, full) {
  if (full) return `${sha}^{tree}`;
  const entries = execFileSync('git', ['ls-tree', '-z', sha], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\0').filter((line) => line && !EXCLUDED.has(line.slice(line.indexOf('\t') + 1)));
  return execFileSync('git', ['mktree', '-z'], { cwd: repo, input: `${entries.join('\0')}\0`, encoding: 'utf8' }).trim();
}

/** Lock the slot, bring its tree to `rev`, return { dir, sha, release }. The lock also releases at process exit. */
export function openMirror(rev, { repo = REPO, slot = 'check', full = false, env = process.env, linkModules = true } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(slot)) throw new Error(`build-mirror: invalid slot ${slot}`);
  const root = join(mirrorRoot(env, repo), slot);
  const dir = join(root, 'tree');
  mkdirSync(dir, { recursive: true });
  // ./tmp ignores itself, so scratch there never shows up in `git status` or a commit.
  const scratchIgnore = join(repo, 'tmp', '.gitignore');
  if (existsSync(join(repo, 'tmp')) && !existsSync(scratchIgnore)) writeFileSync(scratchIgnore, '*\n');
  const unlock = acquire(`${root}.lock`);
  let released = false;
  const release = () => { if (!released) { released = true; unlock(); } };
  process.once('exit', release);
  try {
    // A commit, or a bare tree (the pre-commit check syncs `git write-tree` of the staged index).
    const commit = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], { cwd: repo, encoding: 'utf8' });
    const sha = commit.status === 0 ? commit.stdout.trim()
      : execFileSync('git', ['rev-parse', '--verify', `${rev}^{tree}`], { cwd: repo, encoding: 'utf8' }).trim();
    const gitEnv = { ...env, GIT_INDEX_FILE: join(root, 'index') };
    const git = (args, options = {}) => execFileSync('git', ['--work-tree', dir, ...args], { cwd: repo, env: gitEnv, maxBuffer: 1 << 28, ...options });
    git(['read-tree', '--reset', '-u', buildTree(repo, sha, full)]);
    spawnSync('git', ['--work-tree', dir, 'update-index', '-q', '--refresh'], { cwd: repo, env: gitEnv });
    const drifted = git(['diff-files', '--name-only', '-z']);
    if (drifted.length > 0) git(['checkout-index', '-f', '-z', '--stdin'], { input: drifted });
    const strays = git(['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const stray of strays) if (!stray.split('/').includes('node_modules')) unlinkSync(join(dir, stray));
    if (linkModules) linkNodeModules(repo, dir);
    writeFileSync(join(root, 'HEAD'), `${sha}${full ? ' full' : ''}\n`);
    // git run inside the mirror must not find the checkout's .git above it (it would report the checkout's HEAD
    // and dirty status, and vite would stamp the checkout's sha): stop discovery at the slot, as a /tmp export did.
    // Children of this process inherit it; git run from the checkout itself is unaffected.
    const ceilings = (env.GIT_CEILING_DIRECTORIES ?? '').split(':').filter(Boolean);
    if (!ceilings.includes(root)) process.env.GIT_CEILING_DIRECTORIES = [...ceilings, root].join(':');
    return { dir, sha, release };
  } catch (error) {
    release();
    throw error;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === import.meta.filename;
if (isMain) {
  const args = process.argv.slice(2);
  const dash = args.indexOf('--');
  const head = dash === -1 ? args : args.slice(0, dash);
  const command = dash === -1 ? [] : args.slice(dash + 1);
  const slotAt = head.indexOf('--slot');
  const slot = slotAt === -1 ? 'check' : head[slotAt + 1];
  const full = head.includes('--full');
  const [action, rev = 'HEAD'] = head.filter((a, i) => a !== '--full' && (slotAt === -1 || (i !== slotAt && i !== slotAt + 1)));
  if (action === 'status') {
    const root = mirrorRoot();
    console.info(root);
    for (const name of existsSync(root) ? readdirSync(root).filter((n) => !n.endsWith('.lock')) : []) {
      const at = existsSync(join(root, name, 'HEAD')) ? readFileSync(join(root, name, 'HEAD'), 'utf8').trim() : '-';
      console.info(`${name}\t${at}\t${existsSync(join(root, `${name}.lock`)) ? 'locked' : 'free'}`);
    }
  } else if (action === 'run' && /^(pnpm|npm|yarn|bun)$/.test(command[0] ?? '') &&
      command.slice(1).some((a) => /^(i|install|add|ci|update|up|remove|rm|prune)$/.test(a))) {
    // The mirror's node_modules entries are links into the checkout's: an install here rewrites the checkout's.
    console.error('build-mirror: refusing a package install in the mirror; install in the checkout.');
    process.exit(2);
  } else if (action === 'sync' || (action === 'run' && command.length > 0)) {
    const { dir, sha, release } = openMirror(rev, { slot, full });
    if (action === 'sync') {
      release();
      console.info(dir);
    } else {
      const result = spawnSync(command[0], command.slice(1), { cwd: dir, stdio: 'inherit', env: { ...process.env, VERCEL_GIT_COMMIT_SHA: sha } });
      release();
      process.exit(result.status ?? 1);
    }
  } else {
    console.error('usage: build-mirror.mjs run <rev> [--slot name] [--full] -- <command...> | sync <rev> [--slot name] [--full] | status');
    process.exit(2);
  }
}
