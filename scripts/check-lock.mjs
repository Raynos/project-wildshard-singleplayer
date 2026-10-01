#!/usr/bin/env node
// check-lock.mjs — the E357 lock check (GAME-NORMALIZATION F0, plan spec 02 F0 step 5; R1-09, R2-19, R3-06, R4-09).
//
// Run by .githooks/commit-msg as `node scripts/check-lock.mjs <message file>`. A commit-msg hook can read the message
// (a pre-commit hook runs before it exists) and sees the commit's own index (a pathspec commit's temporary index too).
//
// While `.github/lock.json` says `"locked": true`:
// - a commit whose trailer block carries `E357-Lead: yes` passes (the lead and the subagents it spawns);
// - a commit that touches only `project/sweepguard-ledger.md` passes (.githooks/post-commit's auto-commit);
// - any other commit may touch only the reopened-shard allowlist of a slug in `reopened` (below), else it exits 1
//   naming each refused path (and, for a line-scoped shared file, what in it was refused).
// `"locked": false` (the archive commit) passes everything. `lockVerdict` is pure, so test/check-lock.test.ts calls it
// without git.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LEDGER = 'project/sweepguard-ledger.md';

/** The default asset globs for a shard (R4-09); a reopened slug's own `assetGlobs` add to them. */
export function defaultAssetGlobs(slug) {
  return [
    `public/assets/${slug}/**`,
    `public/assets/gpu/${slug}/**`,
    `public/assets/baked/${slug}/**`,
    `public/assets/gpu/baked/${slug}/**`,
    `public/assets/music/${slug}/**`,
    `public/assets/sfx/${slug}/**`,
    `public/assets/horizon/${slug}-*`,
    `public/assets/gpu/horizon/${slug}-*`,
    `public/assets/lut/${slug}.bin`,
    `public/assets/title/${slug}-portrait.jpg`,
  ];
}

/** Every path glob a reopened slug's lane may commit whole (02 F0 step 5: the plan's one definition). */
export function allowGlobs(slug, extra) {
  return [
    `src/shards/${slug}/**`,
    `test/shards/${slug}/**`,
    `test/parity/baselines/*/${slug}.*`,
    `art/${slug}/**`,
    `scripts/blender/${slug}/**`,
    'docs/tasks/asks/**',
    ...defaultAssetGlobs(slug),
    ...extra,
  ];
}

/** The shared files a lane may change only in the lines that name its slug, checked before / after. */
export const LINE_SCOPED = [
  'scripts/blender/targets.json',
  'art/README.md',
  'scripts/bake-ktx2.list.json',
  'scripts/bake-ktx2.cache.json',
];

const reCache = new Map();
/** A glob → RegExp: `**` any depth, `*` within one segment, `{a,b}` alternatives, everything else literal. */
export function globToRegExp(glob) {
  const hit = reCache.get(glob);
  if (hit) return hit;
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') re += '(?:';
    else if (c === '}') re += ')';
    else if (c === ',') re += '|';
    else re += c.replaceAll(/[.+^$()|[\]\\]/g, String.raw`\$&`);
  }
  const out = new RegExp(`^${re}$`);
  reCache.set(glob, out);
  return out;
}

const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

/** The trailer block = the message's last paragraph (comment lines dropped) when every line in it is `Key: value`. */
export function hasLeadTrailer(message) {
  const text = message.split('\n').filter((l) => !l.startsWith('#')).join('\n').trim();
  const paras = text.split(/\n\s*\n/);
  if (paras.length < 2) return false;
  const last = paras[paras.length - 1].split('\n');
  if (!last.every((l) => /^[A-Za-z0-9-]+:\s/.test(l) || /^\s+\S/.test(l))) return false;
  return last.some((l) => /^E357-Lead:\s*yes\s*$/i.test(l));
}

const parse = (text) => {
  if (text === null || text === undefined) return {};
  try { return JSON.parse(text); } catch { return null; }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A served URL (`/assets/…`, maybe `#layer`) → its repo path. */
const urlPath = (url) => `public${url.replace(/#.*$/, '')}`;

/** Why a line-scoped file's change is outside every reopened slug's scope: [] when it is inside. */
export function lineScopedRefusals(path, before, after, slugs) {
  const assetGlobs = slugs.flatMap(([slug, extra]) => [...defaultAssetGlobs(slug), ...extra]);
  const ownsUrl = (url) => typeof url === 'string' && matchesAny(urlPath(url), assetGlobs);
  const out = [];
  if (path === 'art/README.md') {
    const count = (text) => {
      const m = new Map();
      for (const l of (text ?? '').split('\n')) m.set(l, (m.get(l) ?? 0) + 1);
      return m;
    };
    const b = count(before);
    const a = count(after);
    for (const l of new Set([...b.keys(), ...a.keys()])) {
      if ((b.get(l) ?? 0) === (a.get(l) ?? 0)) continue;
      if (!slugs.some(([slug]) => l.includes(`art/${slug}/`))) out.push(`line "${l.slice(0, 80)}"`);
    }
    return out;
  }
  const b = parse(before);
  const a = parse(after);
  if (b === null || a === null) return ['not valid JSON'];
  if (path === 'scripts/blender/targets.json') {
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (k === 'targets' || same(b[k], a[k])) continue;
      out.push(`field "${k}"`);
    }
    const bt = b.targets ?? {};
    const at = a.targets ?? {};
    for (const k of new Set([...Object.keys(bt), ...Object.keys(at)])) {
      if (same(bt[k], at[k])) continue;
      if (!slugs.some(([slug]) => k.startsWith(`${slug}/`))) out.push(`target "${k}"`);
    }
    return out;
  }
  if (path === 'scripts/bake-ktx2.list.json') {
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (same(b[k], a[k])) continue;
      if (!Array.isArray(b[k] ?? []) || !Array.isArray(a[k] ?? [])) { out.push(`field "${k}"`); continue; }
      const bs = new Set(b[k]);
      const as = new Set(a[k]);
      for (const u of [...bs].filter((x) => !as.has(x)).concat([...as].filter((x) => !bs.has(x)))) {
        if (!ownsUrl(u)) out.push(`${k} entry "${u}"`);
      }
    }
    return out;
  }
  if (path === 'scripts/bake-ktx2.cache.json') {
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (b[k] === a[k]) continue;
      const urls = [b[k], a[k]].filter((v) => v !== undefined && v !== 'none');
      const newNone = !(k in b) && a[k] === 'none';
      if (newNone || (urls.length > 0 && urls.every(ownsUrl) && b[k] !== 'none' && a[k] !== 'none')) continue;
      out.push(`cache key "${k}"`);
    }
    return out;
  }
  return [`no line-scope rule for ${path}`];
}

/**
 * The verdict for one commit.
 * @param {string} message the commit message
 * @param {string[]} paths the paths the commit touches
 * @param {{ locked: boolean, reopened: Record<string, string[]> }} lock `.github/lock.json`
 * @param {Record<string, { before: string | null, after: string | null }>} diffs each touched line-scoped file's text
 * @returns {{ ok: boolean, why: string, refused: string[] }}
 */
export function lockVerdict(message, paths, lock, diffs) {
  if (!lock.locked) return { ok: true, why: 'unlocked', refused: [] };
  if (hasLeadTrailer(message)) return { ok: true, why: 'E357-Lead: yes', refused: [] };
  if (paths.length > 0 && paths.every((p) => p === LEDGER)) return { ok: true, why: 'sweepguard ledger', refused: [] };
  const slugs = Object.entries(lock.reopened);
  const globs = slugs.flatMap(([slug, extra]) => allowGlobs(slug, extra));
  const refused = [];
  for (const p of paths) {
    if (slugs.length > 0 && matchesAny(p, globs)) continue;
    if (slugs.length > 0 && LINE_SCOPED.includes(p)) {
      const d = diffs[p] ?? { before: null, after: null };
      const why = lineScopedRefusals(p, d.before, d.after, slugs);
      if (why.length === 0) continue;
      refused.push(`${p}: ${why.join('; ')}`);
      continue;
    }
    refused.push(p);
  }
  return refused.length === 0
    ? { ok: true, why: 'reopened-shard allowlist', refused }
    : { ok: false, why: 'outside every reopened shard', refused };
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
  } catch {
    return null;
  }
}

function main() {
  const msgFile = process.argv[2];
  if (!msgFile || !existsSync('.github/lock.json')) return 0;
  const lock = JSON.parse(readFileSync('.github/lock.json', 'utf8'));
  if (!lock.locked) return 0;
  const message = readFileSync(msgFile, 'utf8');
  const paths = (git(['diff', '--cached', '--name-only', '--no-renames']) ?? '').split('\n').filter(Boolean);
  const diffs = {};
  for (const p of paths) {
    if (!LINE_SCOPED.includes(p)) continue;
    diffs[p] = { before: git(['show', `HEAD:${p}`]), after: git(['show', `:${p}`]) };
  }
  const v = lockVerdict(message, paths, lock, diffs);
  if (v.ok) return 0;
  console.error('check-lock: the E357 lock refuses this commit (AGENTS.md → The E357 lock).');
  console.error('  Only the E357 lead (trailer `E357-Lead: yes`) or a reopened shard\'s lane may commit. Refused:');
  for (const r of v.refused) console.error(`  - ${r}`);
  const open = Object.keys(lock.reopened ?? {});
  console.error(`  Reopened shards: ${open.length > 0 ? open.join(', ') : 'none'}. If you are not the E357 lead, stop and ask Jake.`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
