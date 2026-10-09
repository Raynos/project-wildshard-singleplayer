// asks.mjs — the ask and plan rules (E423, docs/process/ASKS.md), one parser for the brief and the git hooks.
//
//   node scripts/asks.mjs brief           what is open: unanswered asks, expired claims, picks to ask Jake, each live plan's state
//   node scripts/asks.mjs check           pre-commit: every staged docs/tasks/asks/*.md follows the rules
//
// No commit-msg Plan-State check and no Handoff rules (Jake, 2026-10-09, process audit progress/process/audit-2026-10-09/):
// a plan's status lives in docs/plans/<plan>/STATE.md, written only by its coordinator; lanes keep no handoff files.
//
// An ask is a receipt of Jake's words (decision 1). Its Status is one of the STATES below; follow-up work is a plan row.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ASKS = 'docs/tasks/asks';
const PLANS = 'docs/plans';
const LEASE_HOURS = 71; // decision 9: a claim with no commit for 71 h has expired

/** The Status vocabulary. `folded into` / `superseded by` must name the ask or plan that carries the work. */
export const STATES = ['open', 'in flight', 'needs pick', 'done', 'dropped', 'folded into', 'superseded by'];
const CLOSED = new Set(['done', 'dropped', 'folded into', 'superseded by']);

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : '';
};

/** @param {string} text */
export function parseAsk(text) {
  const status = /^\*\*Status:\*\* *(.*)$/mu.exec(text)?.[1]?.trim() ?? '';
  const lower = status.toLowerCase();
  const state = STATES.find((s) => lower.startsWith(s)) ?? null;
  const date = /(\d{4}-\d{2}-\d{2})/u.exec(status)?.[1] ?? null;
  const target = state === 'folded into' || state === 'superseded by'
    ? /^(?:folded into|superseded by) +([A-Z][A-Z0-9_-]*)/iu.exec(status)?.[1] ?? null
    : null;
  return {
    title: /^# (\S+)/u.exec(text)?.[1] ?? null,
    status,
    state,
    closed: state !== null && CLOSED.has(state),
    date,
    target,
    ask: /^\*\*Ask:\*\* *(.*)$/mu.exec(text)?.[1]?.trim() ?? '',
  };
}

const days = (from, to = Date.now()) => (to - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** Every rule a staged ask file must pass; returns the problems as strings. */
/** A path exists in the tree; a plan path also counts when the plan is archived (project/archive/<date>-<name>.md). */
function inTree(t) {
  if (existsSync(resolve(ROOT, t))) return true;
  if (!t.startsWith(`${PLANS}/`)) return false;
  const name = basename(t, '.md').toLowerCase();
  return readdirSync(resolve(ROOT, 'project/archive')).some((f) => f.toLowerCase().includes(name));
}

export function checkAsk(id, text, exists = inTree) {
  const a = parseAsk(text);
  const out = [];
  if (a.title !== id) out.push(`first line must be "# ${id}" (create asks with scripts/ask-new.sh)`);
  if (!a.status) out.push('no **Status:** line');
  if (!a.ask) out.push('no **Ask:** line (Jake\'s words)');
  if (a.status && a.state === null) out.push(`Status "${a.status.slice(0, 40)}…" is not one of: ${STATES.join(' / ')}`);
  if (a.state === 'in flight' && !/^in flight \(\d{4}-\d{2}-\d{2}, *[^)]+\)/u.test(a.status)) {
    out.push('in flight needs its claim: "in flight (YYYY-MM-DD, <owner>)"');
  }
  if ((a.state === 'needs pick' || a.state === 'open') && !a.date) out.push(`${a.state} needs its date: "${a.state} (YYYY-MM-DD)"`);
  if (a.state === 'folded into' || a.state === 'superseded by') {
    const t = a.target;
    // a plan may be live (docs/plans/) or archived (project/archive/<date>-<name>.md)
    const found = t !== null && [`${ASKS}/${t}.md`, `${PLANS}/${t}.md`].some((path) => exists(path));
    if (!found) out.push(`"${a.state}" must name an existing ask (E123) or plan (NINE-DRAGON-STACK)`);
  }
  return out;
}

function check() {
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=AM', '-z').split('\0')
    .filter((p) => p.startsWith(`${ASKS}/`) && p.endsWith('.md'));
  let bad = 0;
  for (const p of staged) {
    const id = basename(p, '.md');
    const problems = checkAsk(id, git('show', `:${p}`));
    for (const m of problems) console.error(`${p}: ${m}`);
    bad += problems.length;
  }
  if (bad > 0) {
    console.error('\nBLOCKED by scripts/asks.mjs check (E423): the ask rules are in docs/process/ASKS.md.');
    process.exitCode = 1;
  }
}

const livePlans = () => readdirSync(resolve(ROOT, PLANS)).filter((f) => f.endsWith('.md')).map((f) => basename(f, '.md'));

function brief() {
  const now = Date.now();
  const rows = [];
  for (const f of readdirSync(resolve(ROOT, ASKS)).filter((n) => n.endsWith('.md')).sort((x, y) => x.localeCompare(y, 'en', { numeric: true }))) {
    const a = parseAsk(readFileSync(resolve(ROOT, ASKS, f), 'utf8'));
    if (a.closed) continue;
    const id = basename(f, '.md');
    let flag = '';
    if (a.state === 'in flight') {
      const last = Math.max(a.date ? Date.parse(`${a.date}T23:59:59Z`) : 0, Number(git('log', '-1', '--format=%ct', '--', `${ASKS}/${f}`).trim()) * 1000);
      if ((now - last) / 3_600_000 > LEASE_HOURS) flag = ` !! CLAIM EXPIRED (no commit in ${LEASE_HOURS} h): anyone may take it`;
    }
    if (a.state === 'needs pick') flag = ` !! ASK JAKE with the question tool${a.date ? ` (open ${Math.floor(days(a.date, now))} d)` : ''}: a pick never expires`;
    if (a.state === null) flag = ' !! Status outside the vocabulary (docs/process/ASKS.md)';
    rows.push(`${id} | ${a.status.slice(0, 90)}${flag} | ${a.ask.slice(0, 120)}`);
  }
  console.log('-- asks still unanswered (docs/tasks/asks/: receipts of Jake\'s words; the work queue is docs/plans/) --');
  console.log(rows.length > 0 ? rows.join('\n') : '(none)');
  console.log('');
  console.log('-- live plans (docs/plans/<plan>/STATE.md, else the plan\'s State line) --');
  const log = git('log', '--since=30.days', '--format=%cs%x09%h%x09%s');
  for (const name of livePlans()) {
    // The coordinator's STATE.md (≤ 3 KB) is the plan's status once it exists; it is refreshed per landing batch, not per
    // commit. Plan folders are lower-case (docs/plans/shard-platform/ beside SHARD-PLATFORM.md).
    const stateFile = [name.toLowerCase(), name].map((dir) => `${PLANS}/${dir}/STATE.md`).find((p) => existsSync(resolve(ROOT, p)));
    if (stateFile !== undefined) {
      const line = readFileSync(resolve(ROOT, stateFile), 'utf8').split('\n').map((l) => l.trim()).find((l) => l !== '' && !l.startsWith('#')) ?? '(empty)';
      console.log(`${name} | ${stateFile}: ${line.slice(0, 220)}`);
      continue;
    }
    const text = readFileSync(resolve(ROOT, PLANS, `${name}.md`), 'utf8');
    const state = /^\*\*State:\*\* *(.*)$/mu.exec(text)?.[1] ?? '(no State line: add one, see docs/process/ASKS.md)';
    const stateDate = /(\d{4}-\d{2}-\d{2})/u.exec(state)?.[1] ?? '0000-00-00';
    const re = new RegExp(`(^|[^A-Za-z0-9_-])${name}([^A-Za-z0-9_-]|$)`, 'u');
    const newer = log.split('\n').find((l) => re.test(l.split('\t')[2] ?? '') && (l.split('\t')[0] ?? '') > stateDate);
    const flag = newer ? ` !! State older than ${newer.split('\t')[1]} (${newer.split('\t')[0]}): its coordinator rewrites it` : '';
    console.log(`${name} | ${state.slice(0, 220)}${flag}`);
  }
}

const [mode] = process.argv.slice(2);
if (mode === 'check') check();
else if (mode === 'brief') brief();
else if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('usage: node scripts/asks.mjs brief | check');
  process.exitCode = 2;
}
