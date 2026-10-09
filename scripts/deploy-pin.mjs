#!/usr/bin/env node
// deploy-pin.mjs — what production and the native OTA channel serve (GAME-NORMALIZATION F3.1, plan spec 03 §13;
// decision 32). `.github/deploy-pin.json` holds the pin; deploy.yml and ota-promote.yml read it with `read`.
//
//   node scripts/deploy-pin.mjs read                                  # prints the SHA; sha= mode= gate= to $GITHUB_OUTPUT
//   node scripts/deploy-pin.mjs check-gate <sha>                      # exit 0 only if <sha> has gpu-gate = success
//   node scripts/deploy-pin.mjs release-slot                          # free= to $GITHUB_OUTPUT: no release run in the last hour
//   node scripts/deploy-pin.mjs set <sha> --milestone M<n> --go "<where Jake OKed>"
//   node scripts/deploy-pin.mjs rollback <sha> --go "<Jake's words>"   # any SHA proven previously live in production
//   node scripts/deploy-pin.mjs mode newest-green --go "<…>"          # Z4 only
//   node scripts/deploy-pin.mjs mode newest-ci-green --go "<…>"       # the newest main whose push CI (deploy.yml) passed
//
// `set` refuses unless the SHA is on origin/main, its gpu-gate is green, its pending.json is empty, no shard was only
// bootstrap-recorded there, and it (or a runtime-equal ancestor) has a gpu-perf/memory success (R1-13, R2-27, R2-28,
// R4-15). It only writes the file: the lead commits `.github/deploy-pin.json` alone, pushes, and runs
// `gh workflow run deploy`.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FILE = '.github/deploy-pin.json';
const REPO = 'Raynos/project-wildshard-singleplayer';
const PENDING = 'project/archive/game-normalization/reviews/pending.json';
/** What a build is made of (03 §1's export, without test/parity/): a diff outside these is not a runtime change. */
const RUNTIME = ['src', 'public', 'api', 'index.html', 'package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.json', 'vercel.json'];

/** @param {...string} args */
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
/** @param {() => unknown} fn */
const ok = (fn) => { try { fn(); return true; } catch { return false; } };

/** `gh api …`, retried: one GitHub 5xx (HTTP 503 "No server is currently available", 2026-10-03 run 37157015487) failed
 *  a whole release at this step. Four tries, 5 / 15 / 45 s apart. @param {string[]} args @returns {string} */
function ghApi(args) {
  for (let i = 0; ; i++) {
    try { return execFileSync('gh', ['api', ...args], { encoding: 'utf8' }); } catch (e) {
      if (i === 3) throw e;
      console.error(`gh api ${args[0]}: try ${i + 1} failed, retrying`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000 * 3 ** i);
    }
  }
}

/** @typedef {{ mode: string, sha: string, milestone: string, gate: string, go: string, set: string, by: string }} Pin */

/** @param {Pin} pin @returns {Pin} */
export function validatePin(pin) {
  if (!/^[0-9a-f]{40}$/.test(pin.sha)) throw new Error(`${FILE}: sha must be 40 hex`);
  if (!['pinned', 'newest-green', 'newest-ci-green'].includes(pin.mode)) throw new Error(`${FILE}: mode must be pinned | newest-green | newest-ci-green`);
  if (!['grandfathered', 'required'].includes(pin.gate)) throw new Error(`${FILE}: gate must be grandfathered | required`);
  return pin;
}

/** @returns {Pin} */
const readPin = () => validatePin(JSON.parse(readFileSync(FILE, 'utf8')));
/** @param {Pin} pin */
const writePin = (pin) => writeFileSync(FILE, `${JSON.stringify(validatePin(pin), null, 2)}\n`);

/** @param {string} sha @param {(args:string[])=>string} [query] @returns {Map<string, { state: string, description: string }>} */
function statuses(sha, query = ghApi) {
  const out = query([`repos/${REPO}/commits/${sha}/status`, '--paginate', '--jq', '.statuses[] | [.context, .state, .description] | @tsv']);
  const seen = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [context, state, description = ''] = line.split('\t');
    if (!seen.has(context)) seen.set(context, { state, description }); // newest first
  }
  return seen;
}

/** @param {string} sha */
export function gateGreen(sha) {
  return statuses(sha).get('gpu-gate')?.state === 'success';
}

/** An exact SHA must have a successful real built-dist boot. A later pending/failing run overrides an older success.
 * @param {string} sha @param {(args:string[])=>string} [query] */
export function bootGreen(sha, query = ghApi) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('boot-smoke requires an exact 40-hex SHA');
  return statuses(sha, query).get('boot-smoke')?.state === 'success';
}

/** Historical successful release logs bind the full pin to a matching version actually read from production.
 * A pin history entry, a deployment attempt, or a neighbouring short SHA alone is not proof of shipping.
 * @param {string} sha @param {string} log */
export function logProvesProduction(sha, log) {
  if (!/^[0-9a-f]{40}$/.test(sha)) return false;
  const pins = new Set([...log.matchAll(/\bDEPLOY_SHA: ([0-9a-f]{40})\b/g)].map(match => match[1]));
  if (pins.size !== 1 || !pins.has(sha)) return false;
  return [...log.matchAll(/\bProduction ([0-9a-f]{7,40})-[^\s;]+; target ([0-9a-f]{7,40}); match true\b/g)]
    .some(match => sha.startsWith(match[1]) && sha.startsWith(match[2]));
}

/** Emergency rollback proof, including releases older than the boot workflow. New releases record a durable
 * exact-SHA status after verification; older releases are verified against successful release-job logs.
 * @param {string} sha @param {(args:string[])=>string} [query] */
export function productionLive(sha, query = ghApi) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('production proof requires an exact 40-hex SHA');
  if (statuses(sha, query).get('production-live')?.state === 'success') return true;
  for (const event of ['schedule', 'workflow_dispatch']) {
    for (let page = 1; ; page++) {
      const runs = query([`repos/${REPO}/actions/workflows/deploy.yml/runs?event=${event}&status=success&per_page=100&page=${page}`,
        '--jq', '.workflow_runs[].id']).trim().split('\n').filter(Boolean);
      if (runs.length === 0) break;
      for (const run of runs) {
        if (!/^\d+$/.test(run)) throw new Error('Invalid release workflow run identity');
        const jobs = query([`repos/${REPO}/actions/runs/${run}/jobs`, '--paginate', '--jq',
          '.jobs[] | select(.name == "build-and-deploy" and .conclusion == "success") | .id']).trim().split('\n').filter(Boolean);
        for (const job of jobs) {
          if (!/^\d+$/.test(job)) throw new Error('Invalid release job identity');
          let log;
          try { log = query([`repos/${REPO}/actions/jobs/${job}/logs`]); } catch { continue; /* Expired logs cannot prove a release. */ }
          if (logProvesProduction(sha, log)) return true;
        }
      }
      if (runs.length < 100) break;
    }
  }
  return false;
}

/** Reuse only a completed successful main push workflow for this exact commit, never a release or neighbour SHA.
 * @param {string} sha @param {(args:string[])=>string} [query] @returns {boolean} */
export function ciGreen(sha, query = ghApi) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('push CI requires an exact 40-hex SHA');
  const runs = query([`repos/${REPO}/actions/workflows/deploy.yml/runs?branch=main&event=push&status=success&head_sha=${sha}&per_page=1`,
    '--jq', '.workflow_runs[].head_sha']).trim().split('\n');
  return runs.includes(sha);
}

/** The newest successful push CI on main with a separate, successful real boot on that exact SHA. macOS boot
 * queueing never holds push CI, and an unproven/failing boot can never become a release pin. Each newer CI-green SHA it
 * passes over is logged with its boot-smoke state (SF74 W15: a stuck release says why); main SHAs whose push CI failed
 * or is still running are never candidates.
 * @param {(args:string[])=>string} [query] @param {(line: string) => void} [log] @returns {string} */
export function newestCiGreen(query = ghApi, log = (line) => console.error(line)) {
  const candidates = query([`repos/${REPO}/actions/workflows/deploy.yml/runs?branch=main&event=push&status=success&per_page=100`,
    '--jq', '.workflow_runs[].head_sha']).trim().split('\n');
  for (const sha of new Set(candidates)) {
    if (!/^[0-9a-f]{40}$/.test(sha)) continue;
    const boot = statuses(sha, query).get('boot-smoke');
    if (boot?.state === 'success') return sha;
    log(`newest-ci-green: skipped ${sha.slice(0, 9)}: push CI green, boot-smoke ${boot ? `${boot.state} (${boot.description})` : 'not run yet'}`);
  }
  throw new Error('newest-ci-green: no successful push CI with a successful exact-SHA boot-smoke in the last 100 runs');
}

/** Release runs (the hourly schedule or a dispatch) of deploy.yml that hold the hourly slot: one that started in the last
 * `windowMs` or one still queued / running. A green boot smoke dispatches a release only when this is empty (Jake, G284:
 * at most one release an hour; "Hourly is fine"). Any status that is not `completed` counts as live.
 * @param {number} [now] @param {(args:string[])=>string} [query] @param {number} [windowMs]
 * @returns {{ free: boolean, why: string }} */
export function releaseSlot(now = Date.now(), query = ghApi, windowMs = 60 * 60 * 1000) {
  for (const event of ['schedule', 'workflow_dispatch']) {
    const rows = query([`repos/${REPO}/actions/workflows/deploy.yml/runs?event=${event}&per_page=10`,
      '--jq', '.workflow_runs[] | [.id, .status, .created_at] | @tsv']).trim().split('\n').filter(Boolean);
    for (const row of rows) {
      const [id = '', status = '', created = ''] = row.split('\t');
      const at = Date.parse(created);
      if (!/^\d+$/.test(id) || Number.isNaN(at)) throw new Error(`release slot: unreadable run row ${JSON.stringify(row)}`);
      if (status !== 'completed') return { free: false, why: `${event} run ${id} is ${status}` };
      if (now - at < windowMs) return { free: false, why: `${event} run ${id} started ${Math.round((now - at) / 60000)} min ago` };
    }
  }
  return { free: true, why: 'no release run started in the last hour and none is queued or running' };
}

/** Every SHA the pin file has held, oldest first (R1-16). */
function history() {
  const log = ok(() => git('log', '--format=%H', '--', FILE)) ? git('log', '--reverse', '--format=%H', '--', FILE).split('\n').filter(Boolean) : [];
  /** @type {Pin[]} */
  const out = [];
  for (const c of log) {
    try {
      const pin = JSON.parse(git('show', `${c}:${FILE}`));
      if (!out.some((p) => p.sha === pin.sha)) out.push(pin);
    } catch { /* a commit that deleted it */ }
  }
  return out;
}

/** @param {string} name */
function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** @param {string} sha @returns {string | null} */
function memoryReading(sha) {
  if (statuses(sha).get('gpu-perf/memory')?.state === 'success') return sha;
  // a runtime-equal ancestor with a reading (R4-15)
  for (const a of git('rev-list', '-n', '200', `${sha}^`).split('\n').filter(Boolean)) {
    if (!ok(() => git('diff', '--quiet', a, sha, '--', ...RUNTIME))) return null;
    if (statuses(a).get('gpu-perf/memory')?.state === 'success') return a;
  }
  return null;
}

function main() {
  const [cmd, a1] = process.argv.slice(2);
  if (cmd === 'read') {
    const pin = readPin();
    let sha = pin.sha;
    if (pin.mode === 'newest-green') {
      const found = git('rev-list', 'origin/main', '-n', '50').split('\n').find((s) => ok(() => { if (!gateGreen(s)) throw new Error('red'); }));
      if (!found) throw new Error('newest-green: no gpu-gate-green SHA in the last 50 on origin/main');
      sha = found;
    }
    if (pin.mode === 'newest-ci-green') sha = newestCiGreen();
    // An explicit emergency rollback may return to a previously live build, including pre-smoke releases.
    if (!bootGreen(sha) && !(pin.mode === 'pinned' && productionLive(sha))) {
      throw new Error(`release refused: ${sha} has neither a green boot-smoke nor prior production proof`);
    }
    const ciPassed = pin.mode === 'newest-ci-green' || ciGreen(sha);
    console.log(sha);
    console.error(`Release selection: mode=${pin.mode}, exact push CI=${ciPassed}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\nmode=${pin.mode}\ngate=${pin.gate}\nci_green=${ciPassed}\n`);
    return 0;
  }
  if (cmd === 'release-slot') {
    const slot = releaseSlot();
    console.log(`release slot: ${slot.free ? 'free' : 'taken'}: ${slot.why}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `free=${slot.free}\n`);
    return 0;
  }
  if (cmd === 'check-gate') {
    if (!a1) throw new Error('check-gate <sha>');
    const green = gateGreen(a1);
    console.log(`gpu-gate on ${a1.slice(0, 8)}: ${green ? 'success' : 'not success'}`);
    return green ? 0 : 1;
  }
  if (cmd === 'set') {
    const milestone = arg('--milestone');
    const go = arg('--go');
    if (!a1 || !milestone || !go) throw new Error('set <sha> --milestone M<n> --go "<where Jake OKed>"');
    const sha = git('rev-parse', a1);
    /** @param {string} why */
    const refuse = (why) => { console.error(`deploy-pin set: refused — ${why}`); return 1; };
    if (!ok(() => git('merge-base', '--is-ancestor', sha, 'origin/main'))) return refuse(`${sha.slice(0, 8)} is not on origin/main`);
    const st = statuses(sha);
    if (st.get('gpu-gate')?.state !== 'success') return refuse('gpu-gate is not success');
    let pending;
    try { pending = JSON.parse(git('show', `${sha}:${PENDING}`)); } catch { pending = []; }
    if (Array.isArray(pending) ? pending.length > 0 : Object.keys(pending).length > 0) return refuse(`${PENDING} has entries at that SHA`);
    const boot = [...st].filter(([c, s]) => c.startsWith('gpu-gate/') && s.description.startsWith('bootstrap record'));
    if (boot.length > 0) return refuse(`bootstrap-only records: ${boot.map(([c]) => c).join(', ')}`);
    const mem = memoryReading(sha);
    if (!mem) return refuse(`no gpu-perf/memory success on it or a runtime-equal ancestor: run scripts/gpu-perf/nightly.sh --memory-only --sha=${sha}`);
    writePin({ ...readPin(), mode: 'pinned', sha, milestone, gate: 'required', go, set: new Date().toISOString(), by: 'E357 lead' });
    console.log(`pinned ${sha.slice(0, 8)} as ${milestone} (memory reading on ${mem.slice(0, 8)}). Commit ${FILE} alone, push, gh workflow run deploy.`);
    return 0;
  }
  if (cmd === 'rollback') {
    const go = arg('--go');
    if (!a1 || !go) throw new Error('rollback <sha> --go "<Jake\'s words>"');
    const sha = git('rev-parse', a1);
    if (!productionLive(sha)) { console.error(`deploy-pin rollback: refused — ${sha.slice(0, 8)} has no prior production proof`); return 1; }
    const old = history().find((p) => p.sha === sha) ?? readPin();
    writePin({ ...old, mode: 'pinned', sha, gate: 'grandfathered', milestone: `${old.milestone}-rollback`, go, set: new Date().toISOString(), by: 'E357 lead' });
    const f10 = ok(() => git('merge-base', '--is-ancestor', sha, 'HEAD')) && !ok(() => git('show', `${sha}:src/engine/saves/store.ts`));
    if (f10) console.log('NOTE: this build predates SaveStore (F10): it cannot read the v2 saves made since, so progress resets again (decision 95). Tell Jake.');
    console.log(`rolled back to ${sha.slice(0, 8)} (${old.milestone}). Commit ${FILE} alone, push, gh workflow run deploy.`);
    return 0;
  }
  if (cmd === 'mode') {
    const go = arg('--go');
    if ((a1 !== 'newest-green' && a1 !== 'newest-ci-green') || !go) throw new Error('mode newest-green | newest-ci-green --go "<…>"');
    writePin({ ...readPin(), mode: a1, gate: 'grandfathered', go, set: new Date().toISOString(), by: 'E357 lead' });
    return 0;
  }
  console.error('usage: deploy-pin.mjs read | release-slot | check-gate <sha> | set <sha> --milestone M<n> --go "…" | rollback <sha> --go "…" | mode newest-green|newest-ci-green --go "…"');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
