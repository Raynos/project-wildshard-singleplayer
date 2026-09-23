#!/usr/bin/env node
/**
 * `pnpm inbox:pull [--url <site>] [--all]` — download every review note not yet in `.review/inbox/` (or
 * `.review/handled/`) as `<id>.json` + `<id>.jpg`, then print a table (time, category, shard, pose, note).
 * The notes come from the in-game FEEDBACK tab / quick note (src/ui/Feedback.ts) through `api/inbox.ts`.
 *
 * The password comes from `REVIEW_PASSWORD` in the environment, else from `.env.local` (what `vercel env pull`
 * writes; gitignored). The site defaults to production; `INBOX_URL` or `--url` point it at a preview deployment.
 * `--all` re-downloads entries already handled. The drain-inbox skill (.claude/skills/drain-inbox) reads the output.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INBOX = path.join(ROOT, '.review', 'inbox');
const HANDLED = path.join(ROOT, '.review', 'handled');
const DEFAULT_URL = 'https://wildshard-singleplayer.vercel.app';

/** @param {string} name */
function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

/** @param {string} key */
function envLocal(key) {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = /^(?<k>[A-Z_]+)=(?<q>"?)(?<v>.*)\k<q>$/u.exec(line.trim());
      if (m?.groups?.k === key) return m.groups.v;
    }
  } catch {
    /* no .env.local */
  }
  return null;
}

/** @param {string} s @param {number} n */
const pad = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

/**
 * @param {string} base @param {Record<string, string>} headers @param {{ id: string, jpg: string | null }} e
 * @returns {Promise<boolean>}
 */
async function download(base, headers, e) {
  const q = `${base}/api/inbox?id=${encodeURIComponent(e.id)}`;
  const [j, p] = await Promise.all([fetch(`${q}&file=json`, { headers }), e.jpg === null ? null : fetch(`${q}&file=jpg`, { headers })]);
  if (!j.ok) {
    console.error(`  ${e.id}: json ${j.status}`);
    return false;
  }
  fs.writeFileSync(path.join(INBOX, `${e.id}.json`), Buffer.from(await j.arrayBuffer()));
  if (p?.ok === true) fs.writeFileSync(path.join(INBOX, `${e.id}.jpg`), Buffer.from(await p.arrayBuffer()));
  else if (p !== null) console.error(`  ${e.id}: jpg ${p.status}`);
  return true;
}

async function main() {
  const base = (arg('--url') ?? process.env.INBOX_URL ?? DEFAULT_URL).replace(/\/$/u, '');
  const password = process.env.REVIEW_PASSWORD ?? envLocal('REVIEW_PASSWORD');
  if (password === null || password === '') {
    console.error('inbox-pull: no REVIEW_PASSWORD (env or .env.local — run `vercel env pull`)');
    process.exit(2);
  }
  const headers = { 'x-review-password': password };
  const res = await fetch(`${base}/api/inbox`, { headers });
  if (!res.ok) {
    console.error(`inbox-pull: ${base}/api/inbox → ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const { entries } = await res.json();
  fs.mkdirSync(INBOX, { recursive: true });
  fs.mkdirSync(HANDLED, { recursive: true });
  const all = process.argv.includes('--all');
  /** @param {string} id */
  const have = (id) => {
    if (fs.existsSync(path.join(INBOX, `${id}.json`))) return true;
    return !all && fs.existsSync(path.join(HANDLED, `${id}.json`));
  };
  const fresh = entries.filter((/** @type {{ id: string }} */ e) => !have(e.id));
  const ok = await Promise.all(fresh.map((/** @type {{ id: string, jpg: string | null }} */ e) => download(base, headers, e)));
  const rows = fs
    .readdirSync(INBOX)
    .filter((f) => f.endsWith('.json'))
    .toSorted()
    .map((f) => JSON.parse(fs.readFileSync(path.join(INBOX, f), 'utf8')));
  console.info(`inbox: ${entries.length} on the server, ${ok.filter(Boolean).length} new, ${rows.length} in .review/inbox/ (${base})`);
  if (rows.length === 0) return;
  console.info(`${pad('time (UTC)', 20)} ${pad('cat', 5)} ${pad('shard', 15)} ${pad('pos', 16)} ${pad('build', 8)} ${pad('id', 34)} note`);
  for (const n of rows) {
    const c = n.context ?? {};
    const one = String(n.note).replaceAll(/\s+/gu, ' ').trim();
    const pos = Array.isArray(c.pos) ? c.pos.map((v) => Math.round(Number(v))).join(',') : '—';
    console.info(
      `${pad(String(n.receivedAt).slice(0, 19).replace('T', ' '), 20)} ${pad(String(n.category ?? '—'), 5)} ${pad(String(c.shard ?? '—'), 15)} ${pad(pos, 16)} ${pad(String(c.build ?? '—').slice(0, 7), 8)} ${pad(String(n.id), 34)} ${one.length > 80 ? `${one.slice(0, 79)}…` : one}`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
