// Fast proofs (Jake 2026-10-15, "make each proof quick and cheap"): a shardfile product is rebuilt only when a file it
// can read changed. Opt-in (`build-shardfiles.mjs --reuse`, used by serve-build.sh and `pnpm build:proof`); the push gate,
// CI and Vercel run the plain `pnpm build`, which never reads this cache and rebuilds every shard.
//
// A shard's key hashes every file of the tree it could read, by content, minus what provably belongs elsewhere:
//   - the other first-party shards' own folders (src/shards/<other>/; shards never import one another, `shard-sandbox`),
//   - public paths with a folder named after another first-party shard (public/assets/<other>/, …/music/<other>/, …),
//   - the outputs (public/shardfiles/, the legacy boot packs public/assets/packs/ that pile up per build and no SDK
//     build reads, dist*, tmp/, .wildshard/ intermediates), the derived docs a full gen writes (lint/api-surface.json,
//     scripts/README.md), scripts/generation-jobs.json (its effect is the generated files, hashed themselves) and the
//     folders no build reads (docs/, test/ but its fixtures, art/, progress/, sources/,
//     the native shells, the side sites).
// Generated files (src/**/*.generated.*, restored bakes) are hashed as they sit on disk, so a gen output change is a
// key change. Frozen legacy folders and anything shared stay in every key. node_modules is keyed by the lockfiles.
// Products live in ~/.cache/wildshard/shardfiles/<slug>/<key>/ (shared by the mirror slots and the checkout), copied in
// and out as APFS clones; a stat memo (path, size, mtime, inode) keeps the re-hash of ~9k files at ~0.1 s (1 s cold).
// A full local build (the push gate's `pnpm build`) still builds every shard from scratch, then publishes what it built,
// so a lane proving the pushed HEAD plus its own shard reuses every other shard.
import { createHash, randomBytes } from 'node:crypto';
import { constants, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const KEY_VERSION = 'shardfile-key/1';
export const KEY_FILE = '.build-key';
const KEEP_PER_SHARD = 6;
// Top-level entries no shardfile build reads (outputs, docs, native shells, side sites, local caches).
const SKIP_TOP = new Set(['.git', '.github', '.githooks', '.claude', '.cache', '.review', '.vercel', '.native-build', '.tsc-layers',
  'node_modules', 'tmp', 'dist', 'dist-native', 'dist-drafts', 'dist-site', 'dist-admin', 'coverage',
  'art', 'progress', 'sources', 'docs', 'admin', 'site', 'drafts', 'ios', 'android', 'api', 'deploy', 'project', 'calibration']);
const SKIP_ANYWHERE = new Set(['node_modules', '.git', '.wildshard', '.DS_Store']);
// Outputs and derived docs inside included folders: products, legacy boot packs, the catalogue (its effect is the
// generated files), the API surface and the scripts index (full `pnpm gen` only, so they differ by slot history).
const SKIP_PATHS = new Set(['public/shardfiles', 'public/assets/packs', 'scripts/generation-jobs.json', 'lint/api-surface.json', 'scripts/README.md']);

export function shardfileCacheRoot(env = process.env) {
  return resolve(env.WILDSHARD_SHARDFILE_CACHE ?? join(homedir(), '.cache/wildshard/shardfiles'));
}

/** Every candidate input file under root with its content hash (stat-memoized). @param {string} root */
export function treeHashes(root) {
  const memoPath = join(root, '.cache', 'shardfile-hashes.json');
  /** @type {Record<string,[number,number,number,string]>} */
  let memo = {};
  try { memo = JSON.parse(readFileSync(memoPath, 'utf8')); } catch { /* first run */ }
  /** @type {Record<string,[number,number,number,string]>} */
  const next = {};
  /** @type {Map<string,string>} */
  const files = new Map();
  /** @param {string} rel @param {boolean} top */
  const walk = (rel, top) => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      if (SKIP_ANYWHERE.has(name) || (top && SKIP_TOP.has(name))) continue;
      const path = rel === '' ? name : `${rel}/${name}`;
      if (path === 'test') { if (existsSync(join(root, 'test/fixtures'))) walk('test/fixtures', false); continue; }
      if (SKIP_PATHS.has(path)) continue;
      const stat = lstatSync(join(root, path));
      if (stat.isDirectory()) walk(path, false);
      else if (stat.isSymbolicLink()) files.set(path, `link:${readlinkSync(join(root, path))}`);
      else if (stat.isFile()) {
        const seen = Object.hasOwn(memo, path) ? memo[path] : undefined;
        const digest = seen !== undefined && seen[0] === stat.size && seen[1] === stat.mtimeMs && seen[2] === stat.ino ? seen[3]
          : createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
        next[path] = [stat.size, stat.mtimeMs, stat.ino, digest];
        files.set(path, digest);
      }
    }
  };
  walk('', true);
  // pnpm writes this on every install; with the lockfile it pins what node_modules holds.
  for (const extra of ['node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml']) {
    if (existsSync(join(root, extra))) files.set(extra, createHash('sha256').update(readFileSync(join(root, extra))).digest('hex'));
  }
  try { mkdirSync(join(root, '.cache'), { recursive: true }); writeFileSync(memoPath, JSON.stringify(next)); } catch { /* memo is an optimization */ }
  return files;
}

/** Does `path` belong to one of `others` (first-party shards other than the one keyed)? @param {string} path @param {Set<string>} others */
function belongsElsewhere(path, others) {
  const parts = path.split('/');
  if (parts[0] === 'src' && parts[1] === 'shards' && parts.length > 3) return others.has(parts[2] ?? '');
  if (parts[0] !== 'public') return false;
  return parts.slice(1, -1).some(part => others.has(part));
}

/** The content key of one shard's product. @param {Map<string,string>} files @param {string} slug @param {string[]} built
 * @param {string[]} args the build flags, root-relative */
export function shardfileKey(files, slug, built, args) {
  const others = new Set(built.filter(other => other !== slug));
  const hash = createHash('sha256').update(`${KEY_VERSION}\0${process.version}\0${slug}\0${args.join('\0')}\0`);
  for (const [path, digest] of files) if (!belongsElsewhere(path, others)) hash.update(`${path}\0${digest}\0`);
  return hash.digest('hex');
}

/** Clone a product folder (APFS clonefile; a plain copy elsewhere). @param {string} from @param {string} to */
function cloneDir(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, mode: constants.COPYFILE_FICLONE });
}

/** A complete cache entry for this key, or undefined. @param {string} cacheRoot @param {string} slug @param {string} key */
function entryFor(cacheRoot, slug, key) {
  const entry = join(cacheRoot, slug, key);
  try { if (readFileSync(join(entry, KEY_FILE), 'utf8').trim() === key) return entry; } catch { /* missing or partial */ }
  return undefined;
}

/** Keep the newest entries per shard; never one touched in the last 10 minutes (a sibling may be cloning it). */
function prune(cacheRoot, slug) {
  const dir = join(cacheRoot, slug);
  const entries = readdirSync(dir).filter(name => /^[a-f0-9]{64}$/u.test(name))
    .map(name => ({ name, at: statSync(join(dir, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  for (const old of entries.slice(KEEP_PER_SHARD)) if (Date.now() - old.at > 600_000) rmSync(join(dir, old.name), { recursive: true, force: true });
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.staging-') && Date.now() - statSync(join(dir, name)).mtimeMs > 3_600_000) rmSync(join(dir, name), { recursive: true, force: true });
  }
}

/**
 * Bring `destination` to the product for `key`: already there, cloned from the cache, or built by `build(staging)` into a
 * fresh folder, published to the cache and cloned in. `fresh` always builds (the full build) and serves its own bytes.
 * @param {{slug:string, key:string, destination:string, cacheRoot?:string, fresh?:boolean, build:(out:string)=>Promise<void>}} job
 * @returns {Promise<'slot'|'cache'|'built'>}
 */
export async function reuseOrBuild({ slug, key, destination, cacheRoot = shardfileCacheRoot(), fresh = false, build }) {
  const existing = fresh ? undefined : entryFor(cacheRoot, slug, key);
  const now = new Date();
  if (existing !== undefined) {
    utimesSync(existing, now, now);
    let here = '';
    try { here = readFileSync(join(destination, KEY_FILE), 'utf8').trim(); } catch { /* no stamp */ }
    // The slot's own copy counts only while its shard.json still matches the entry's byte for byte.
    if (here === key && existsSync(join(destination, 'shard.json'))
      && readFileSync(join(destination, 'shard.json')).equals(readFileSync(join(existing, 'shard.json')))) return 'slot';
    cloneDir(existing, destination);
    return 'cache';
  }
  mkdirSync(join(cacheRoot, slug), { recursive: true });
  const staging = join(cacheRoot, slug, `.staging-${process.pid}-${randomBytes(4).toString('hex')}`);
  try {
    await build(staging);
    writeFileSync(join(staging, KEY_FILE), `${key}\n`);
    cloneDir(staging, destination);
    const entry = join(cacheRoot, slug, key);
    if (entryFor(cacheRoot, slug, key) === undefined) {
      try { rmSync(entry, { recursive: true, force: true }); renameSync(staging, entry); } catch (error) {
        // A sibling published the same key first: theirs is as good as ours.
        if (entryFor(cacheRoot, slug, key) === undefined) throw error;
      }
    } else utimesSync(entry, now, now);
    prune(cacheRoot, slug);
    return 'built';
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
