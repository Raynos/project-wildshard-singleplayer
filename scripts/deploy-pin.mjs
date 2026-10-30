#!/usr/bin/env node
// deploy-pin.mjs — what production and the native OTA channel serve (GAME-NORMALIZATION F3.1, plan spec 03 §13;
// decision 32). `.github/deploy-pin.json` holds the pin; deploy.yml and ota-promote.yml read it with `read`.
//
//   node scripts/deploy-pin.mjs read                                  # prints the SHA; sha= mode= gate= to $GITHUB_OUTPUT
//   node scripts/deploy-pin.mjs check-gate <sha>                      # exit 0 only if <sha> has gpu-gate = success
//   node scripts/deploy-pin.mjs release-ready                         # ready=, sha= to $GITHUB_OUTPUT; no wait
//   node scripts/deploy-pin.mjs check-live-floor <sha>                # automatic releases never move behind production
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
    try { return execFileSync('gh', ['api', '-H', 'Cache-Control: no-cache', ...args], { encoding: 'utf8' }); } catch (e) {
      if (i === 3) throw e;
      console.error(`gh api ${args[0]}: try ${i + 1} failed, retrying`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000 * 3 ** i);
    }
  }
}

/** @type {WeakMap<(args:string[])=>string, Map<string, string>>} */
const workflowIds = new WeakMap();

/** Resolve workflow paths once per API client; filename-based run queries can return empty results.
 * @param {'deploy.yml' | 'boot-smoke.yml'} workflow @param {(args:string[])=>string} [query] */
export function workflowRunsPath(workflow, query = ghApi) {
  let ids = workflowIds.get(query);
  if (ids === undefined) {
    ids = new Map();
    const rows = query([`repos/${REPO}/actions/workflows?per_page=100&page=1`, '--paginate', '--jq',
      '.workflows[] | [.path, .id] | @tsv']).trim().split('\n').filter(Boolean);
    for (const row of rows) {
      const [path = '', id = ''] = row.split('\t');
      if (path !== '.github/workflows/deploy.yml' && path !== '.github/workflows/boot-smoke.yml') continue;
      if (!/^\d+$/.test(id) || ids.has(path)) throw new Error(`Invalid workflow identity: ${row}`);
      ids.set(path, id);
    }
    workflowIds.set(query, ids);
  }
  const id = ids.get(`.github/workflows/${workflow}`);
  if (id === undefined) throw new Error(`Missing workflow: ${workflow}`);
  return `repos/${REPO}/actions/workflows/${id}/runs`;
}

/** @typedef {{ mode: string, sha: string, milestone: string, gate: string, go: string, set: string, by: string, ciRun?: string }} Pin */

/** @param {Pin} pin @returns {Pin} */
export function validatePin(pin) {
  if (!/^[0-9a-f]{40}$/.test(pin.sha)) throw new Error(`${FILE}: sha must be 40 hex`);
  if (!['pinned', 'newest-green', 'newest-ci-green'].includes(pin.mode)) throw new Error(`${FILE}: mode must be pinned | newest-green | newest-ci-green`);
  if (!['grandfathered', 'required'].includes(pin.gate)) throw new Error(`${FILE}: gate must be grandfathered | required`);
  if (pin.ciRun !== undefined && !/^\d+$/.test(pin.ciRun)) throw new Error(`${FILE}: ciRun must be a numeric workflow run`);
  return pin;
}

/** @returns {Pin} */
const readPin = () => validatePin(JSON.parse(readFileSync(FILE, 'utf8')));
/** @param {Pin} pin */
const writePin = (pin) => writeFileSync(FILE, `${JSON.stringify(validatePin(pin), null, 2)}\n`);

/** @param {string} sha @param {(args:string[])=>string} [query] @returns {Map<string, { state: string, description: string, createdAt: string }>} */
function statuses(sha, query = ghApi) {
  const out = query([`repos/${REPO}/commits/${sha}/status`, '--paginate', '--jq', '.statuses[] | [.context, .state, .description, .created_at] | @tsv']);
  const seen = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [context, state, description = '', createdAt = ''] = line.split('\t');
    if (!seen.has(context)) seen.set(context, { state, description, createdAt }); // newest first
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

/** Automatic releases may keep or advance production, never replace it with an older or divergent tree.
 * Resolve the live build's abbreviated SHA through GitHub's immutable comparison, not run completion order.
 * @param {string} build @param {string} candidate @param {(args:string[])=>string} [query] @returns {string} */
export function productionFloor(build, candidate, query = ghApi) {
  const short = build.split('-')[0] ?? '';
  if (!/^[0-9a-f]{7,40}$/.test(short) || !/^[0-9a-f]{40}$/.test(candidate)) throw new Error('Invalid production floor identity');
  const comparison = JSON.parse(query([`repos/${REPO}/compare/${short}...${candidate}`, '--jq', '{status,base_commit:{sha:.base_commit.sha}}']));
  const live = comparison.base_commit?.sha;
  if (typeof live !== 'string' || !/^[0-9a-f]{40}$/.test(live) || !live.startsWith(short)) throw new Error('Unreadable production floor comparison');
  if (comparison.status !== 'ahead' && comparison.status !== 'identical') {
    throw new Error(`release refused: ${candidate} does not advance production ${live} (${comparison.status})`);
  }
  return live;
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
      const runs = query([`${workflowRunsPath('deploy.yml', query)}?event=${event}&status=success&per_page=100&page=${page}`,
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
  const runs = query([`${workflowRunsPath('deploy.yml', query)}?branch=main&event=push&status=success&head_sha=${sha}&per_page=1&page=1`,
    '--jq', '.workflow_runs[].head_sha']).trim().split('\n');
  return runs.includes(sha);
}

/** Exact successful producer identity for the prebuilt release artifact.
 * @param {string} sha @param {(args:string[])=>string} [query] @returns {string} */
export function ciSourceRun(sha, query = ghApi) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Prebuilt producer requires an exact SHA');
  const data = JSON.parse(query([`${workflowRunsPath('deploy.yml', query)}?branch=main&event=push&status=success&head_sha=${sha}&per_page=1&page=1`]));
  const run = data.workflow_runs?.[0];
  if (run?.head_sha !== sha || run.event !== 'push' || run.head_branch !== 'main'
    || run.status !== 'completed' || run.conclusion !== 'success'
    || run.path !== '.github/workflows/deploy.yml' || run.head_repository?.full_name !== REPO
    || !/^\d+$/.test(String(run.id))) throw new Error('No exact successful prebuilt producer');
  return String(run.id);
}

/** Explicit operator-selected CI proof for the legacy 16-job pipeline. GitHub can leave its aggregate
 * running after every required job has completed. No missing, skipped or extra job supplies this proof.
 * @param {string} sha @param {string} runId @param {(args:string[])=>string} [query] @returns {boolean} */
export function ciRunGreen(sha, runId, query = ghApi) {
  if (!/^[0-9a-f]{40}$/.test(sha) || !/^\d+$/.test(runId)) throw new Error('Explicit CI proof requires an exact SHA and numeric run');
  /** @type {{id:number,workflow_id:number,event:string,head_branch:string,head_sha:string,path:string,status:string,conclusion:string|null,head_repository?:{full_name:string}}} */
  const run = JSON.parse(query([`repos/${REPO}/actions/runs/${runId}`]));
  const workflowId = workflowRunsPath('deploy.yml', query).split('/').at(-2);
  if (String(run.id) !== runId || String(run.workflow_id) !== workflowId || run.event !== 'push'
    || run.head_branch !== 'main' || run.head_sha !== sha || run.path !== '.github/workflows/deploy.yml'
    || run.head_repository?.full_name !== REPO) return false;
  if (run.status === 'completed' && run.conclusion === 'success') return true;
  if (run.status !== 'in_progress' || run.conclusion !== null) return false;
  const required = new Set(['products', 'build-and-deploy',
    ...Array.from({length:4}, (_, i) => `typecheck-lint (${i+1})`),
    ...Array.from({length:10}, (_, i) => `behaviour (${i+1})`)]);
  const rows = query([`repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`, '--paginate', '--jq',
    '.jobs[] | [.name, .status, .conclusion] | @tsv']).trim().split('\n').filter(Boolean);
  if (rows.length !== required.size) return false;
  for (const row of rows) {
    const [name = '', status, conclusion] = row.split('\t');
    if (!required.delete(name) || status !== 'completed' || conclusion !== 'success') return false;
  }
  return required.size === 0;
}

/** Explicit recovery of proven source after shipping failed. Only the original
 * source gates may grant proof; the failed aggregate never becomes CI success.
 * @param {string} runId @param {(args:string[])=>string} [query]
 * @returns {{sha:string,run:string}} */
export function recoverySource(runId, query = ghApi) {
  const {sha,run} = recoveryEvidence(runId, query, false);
  return {sha,run};
}

/** G917 is an explicit deadline decision, never an automatic green verdict.
 * All jobs must finish; prepare, SIX and latest same-run boot remain green.
 * @param {string} runId @param {(args:string[])=>string} [query] @param {number} [now] */
export function deadlineRecoverySource(runId, query = ghApi, now = Date.now()) {
  if (!Number.isFinite(now) || now < Date.parse('2026-10-30T10:30:00Z'))
    throw new Error('G917 deadline recovery is unavailable before 2026-10-30T10:30:00Z');
  const selected = recoveryEvidence(runId, query, true);
  const green = JSON.parse(query([`${workflowRunsPath('deploy.yml', query)}?branch=main&event=push&status=success&per_page=1&page=1`,
    '--jq','{workflow_runs:[.workflow_runs[]|{id,head_sha,event,head_branch,status,conclusion,path,head_repository:{full_name:.head_repository.full_name}}]}']));
  if (!Array.isArray(green.workflow_runs) || green.workflow_runs.length > 1)
    throw new Error('Invalid latest green main inventory');
  const latest = green.workflow_runs[0];
  if (latest !== undefined) {
    if (!/^[1-9][0-9]*$/u.test(String(latest.id)) || !/^[a-f0-9]{40}$/u.test(latest.head_sha)
      || latest.event !== 'push' || latest.head_branch !== 'main' || latest.status !== 'completed'
      || latest.conclusion !== 'success' || latest.path !== '.github/workflows/deploy.yml'
      || latest.head_repository?.full_name !== REPO) throw new Error('Invalid latest green main proof');
    if (BigInt(latest.id) >= BigInt(runId)) throw new Error('Use the newer fully green main release instead of G917');
  }
  return selected;
}

/** @param {string} runId @param {(args:string[])=>string} query @param {boolean} deadline */
function recoveryEvidence(runId, query, deadline) {
  if (!/^[1-9][0-9]*$/u.test(runId)) throw new Error('Recovery requires a numeric source run');
  const run = JSON.parse(query([`repos/${REPO}/actions/runs/${runId}`]));
  const workflowId = workflowRunsPath('deploy.yml', query).split('/').at(-2);
  if (String(run.id) !== runId || String(run.workflow_id) !== workflowId || run.event !== 'push'
    || run.head_branch !== 'main' || typeof run.head_sha !== 'string' || !/^[a-f0-9]{40}$/u.test(run.head_sha)
    || run.status !== 'completed' || !['success','failure'].includes(run.conclusion)
    || run.path !== '.github/workflows/deploy.yml' || run.head_repository?.full_name !== REPO)
    throw new Error('Recovery source is not a completed exact main push');
  const sha = String(run.head_sha);
  const ancestry = JSON.parse(query([`repos/${REPO}/compare/${sha}...main`, '--jq',
    '{status,base_commit:{sha:.base_commit.sha}}']));
  if (ancestry.base_commit?.sha !== sha || !['ahead','identical'].includes(ancestry.status))
    throw new Error('Recovery source is outside main ancestry');
  const source = query([`repos/${REPO}/contents/.github/workflows/deploy.yml?ref=${sha}`,
    '-H','Accept: application/vnd.github.raw+json']);
  // The complete behavior wave owned the native file before its dedicated job.
  const native = source.includes('\n  native-escape:\n');
  const phone = /\n {2}phone-route:\n([\s\S]*?)(?=\n {2}[a-z][a-z0-9-]*:\n|$)/u.exec(source)?.[1];
  if (phone === undefined ? !source.includes(`continue-on-error: \${{ matrix.part == 'phone-route' }}`)
    : !/(?:^|\n) {4}continue-on-error: true(?:\n|$)/u.test(phone))
    throw new Error('Recovery source lacks the reviewed report-only phone policy');
  const required = new Set(['prepare','typecheck-lint','derived-docs','boot-verdict',
    ...Array.from({length:12},(_,i)=>`behaviour (${i+1})`),
    ...['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'].map(name=>`journeys (${name})`),
    ...(native?['native-escape']:[])]);
  const rows = query([`repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`, '--paginate', '--jq',
    '.jobs[] | [.name, .status, .conclusion] | @tsv']).trim().split('\n').filter(Boolean);
  const optional = new Set(['build-and-deploy',phone === undefined ? 'journeys (phone-route)' : 'phone-route']);
  const essential = new Set(['prepare','boot-verdict',
    ...['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'].map(name=>`journeys (${name})`)]);
  /** @type {{name:string,status:string,conclusion:string}[]} */
  const jobs = [];
  for (const row of rows) {
    const [name='',status,conclusion] = row.split('\t');
    if (row.split('\t').length !== 3 || status !== 'completed' || conclusion === undefined)
      throw new Error(`Recovery job has no completed verdict: ${name}`);
    if (optional.delete(name)) {
      const terminal = deadline ? ['success','failure','timed_out',...(name === 'build-and-deploy' ? ['skipped'] : [])] : ['success','failure'];
      if (!terminal.includes(conclusion))
        throw new Error(`Recovery terminal job did not finish: ${name}`);
    } else if (!required.delete(name) || (deadline && !essential.has(name)
      ? !['success','failure','timed_out'].includes(conclusion) : conclusion !== 'success'))
      throw new Error(`Recovery source gate did not succeed: ${name}`);
    jobs.push({name,status,conclusion});
  }
  if (required.size > 0 || optional.size > 0) throw new Error('Recovery job inventory differs');
  const boot = query([`repos/${REPO}/commits/${sha}/status`, '--paginate', '--jq',
    '.statuses[] | select(.context == "boot-smoke") | [.state, .target_url] | @tsv']).trim().split('\n')[0];
  if (boot !== `success\thttps://github.com/${REPO}/actions/runs/${runId}`)
    throw new Error('Recovery requires the latest successful same-run boot status');
  return {sha,run:runId,jobs,failures:jobs.filter(job=>['failure','timed_out'].includes(job.conclusion))};
}

/** Bind the current push's successful wave before its own ship job completes.
 * GitHub supplies needs from this exact run; no neighbouring aggregate grants proof.
 * @param {{mode:string,event:string,ref:string,repository:string,sha:string,run:string,head:string,needs:unknown}} input
 * @returns {{skip:boolean,sha:string,run:string}} */
export function waveSource(input) {
  if (input.event !== 'push' || input.ref !== 'refs/heads/main' || input.repository !== REPO
    || !/^[a-f0-9]{40}$/u.test(input.sha) || input.head !== input.sha || !/^[1-9][0-9]*$/u.test(input.run))
    throw new Error('Wave source is not the exact main push checkout');
  if (typeof input.needs !== 'object' || input.needs === null || Array.isArray(input.needs))
    throw new Error('Missing exact-run wave verdicts');
  const required = ['prepare','typecheck-lint','derived-docs','behaviour','native-escape','journeys','boot-verdict'];
  /** @type {Map<string, unknown>} */
  const rows = new Map(Object.entries(input.needs));
  if (rows.size !== required.length) throw new Error('Wave verdict inventory differs');
  for (const name of required) {
    const row = rows.get(name);
    if (typeof row !== 'object' || row === null || !('result' in row) || row.result !== 'success')
      throw new Error(`Wave prerequisite did not succeed: ${name}`);
  }
  return {skip:input.mode !== 'newest-ci-green',sha:input.sha,run:input.run};
}

/** No CI-green SHA has a successful exact-SHA smoke yet. */
export class PendingBootSmokeError extends Error {
  /** @param {string} sha */
  constructor(sha) { super(`newest-ci-green: awaiting exact-SHA boot-smoke for ${sha}`); this.name = 'PendingBootSmokeError'; this.sha = sha; }
}

/** The newest successful push CI on main with a separate, successful real boot on that exact SHA.
 * A newer pending smoke never delays an already proven candidate. With no proven candidate,
 * pending smoke can defer selection; unproven/failing boots never become a release pin.
 * @param {(args:string[])=>string} [query] @param {(line: string) => void} [log] @param {number} [now] @returns {string} */
export function newestCiGreen(query = ghApi, log = (line) => console.error(line), now = Date.now()) {
  const candidates = query([`${workflowRunsPath('deploy.yml', query)}?branch=main&event=push&status=success&per_page=100&page=1`,
    '--jq', '.workflow_runs[] | [.head_sha, .updated_at] | @tsv']).trim().split('\n');
  const seen = new Set();
  let pending;
  for (const row of candidates) {
    const [sha = '', completed = ''] = row.split('\t');
    if (seen.has(sha)) continue;
    seen.add(sha);
    if (!/^[0-9a-f]{40}$/.test(sha)) continue;
    const proof = statuses(sha, query), boot = proof.get('boot-smoke');
    const completedAt = Date.parse(completed);
    if (Number.isNaN(completedAt)) throw new Error(`newest-ci-green: unreadable completed CI time for ${sha}`);
    if (boot?.state === 'success') return sha;
    if (boot?.state === 'pending' || (!boot && now - completedAt >= 0 && now - completedAt < 15 * 60 * 1000)) {
      pending ??= sha;
      continue;
    }
    log(`newest-ci-green: skipped ${sha.slice(0, 9)}: push CI green, boot-smoke ${boot ? `${boot.state} (${boot.description})` : 'not run yet'}`);
  }
  if (pending !== undefined) throw new PendingBootSmokeError(pending);
  throw new Error('newest-ci-green: no successful push CI with a successful exact-SHA boot-smoke in the last 100 runs');
}

/** Dispatch readiness for the newest fully proven candidate. Newer pending proofs do not spend
 * or block the hourly slot; actual releases reselect and enforce every exact-SHA proof.
 * @param {(args:string[])=>string} [query] @param {(line:string)=>void} [log] @param {number} [now]
 * @returns {{ready:boolean, sha:string}} */
export function releaseReady(query = ghApi, log = (line) => console.error(line), now = Date.now()) {
  try { return { ready: true, sha: newestCiGreen(query, log, now) }; } catch (error) {
    if (!(error instanceof PendingBootSmokeError)) throw error;
    log(error.message);
    return { ready: false, sha: error.sha };
  }
}

/** Wait at most 20 minutes only when no candidate has both proofs. Unresolved candidates
 * still fail closed; an existing BOTH-proof-green SHA is selected without waiting.
 * Re-read CI and statuses every 30 seconds so a newer green push or coalesced smoke is observed.
 * @param {(args:string[])=>string} [query] @param {(line:string)=>void} [log]
 * @param {{now?:()=>number, wait?:(ms:number)=>Promise<void>, maxWaitMs?:number}} [options] @returns {Promise<string>} */
export async function newestCiGreenAfterBoot(query = ghApi, log = (line) => console.error(line), options = {}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => { setTimeout(resolve, ms); }));
  const deadline = now() + (options.maxWaitMs ?? 20 * 60 * 1000);
  for (;;) {
    try { return newestCiGreen(query, log, now()); } catch (error) {
      if (!(error instanceof PendingBootSmokeError)) throw error;
      if (now() >= deadline) throw new Error(`release refused: exact-SHA boot-smoke still unresolved after wait: ${error.sha}`, { cause: error });
      log(error.message);
      await wait(Math.min(30000, deadline - now()));
    }
  }
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

async function main() {
  const [cmd, a1] = process.argv.slice(2);
  if (cmd === 'check-live-floor') {
    if (!a1) throw new Error('check-live-floor <sha>');
    const response = await fetch(`https://wildshard-singleplayer.vercel.app/version.json?release-floor=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-store' }, signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Production floor returned HTTP ${response.status}`);
    const version = await response.json();
    if (typeof version?.build !== 'string') throw new Error('Production floor has no build ID');
    const floor = productionFloor(version.build, a1);
    console.log(`Production floor ${floor}; target ${a1}; forward-only verified`);
    return 0;
  }
  if (cmd === 'read-recovery' || cmd === 'read-deadline-recovery') {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REF !== 'refs/heads/main'
      || process.env.GITHUB_REPOSITORY !== REPO) throw new Error('Recovery requires an explicit main dispatch');
    const deadline = cmd === 'read-deadline-recovery';
    const selected = deadline ? deadlineRecoverySource(a1 ?? '') : recoverySource(a1 ?? '');
    if (deadline) {
      const proof = process.env.DEADLINE_RECOVERY_PROOF;
      if (!proof) throw new Error('G917 recovery requires a retained evidence path');
      writeFileSync(proof, `${JSON.stringify({authority:'G917',deadline:'2026-10-30T10:30:00Z',verifiedAt:new Date().toISOString(),
        requestRun:process.env.GITHUB_RUN_ID,actor:process.env.GITHUB_ACTOR??null,...selected},null,2)}\n`);
    }
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `sha=${selected.sha}\nmode=recovery\ngate=required\nsource_run=${selected.run}\nrecovery=${!deadline}\nskip=false\n`);
    console.log(deadline
      ? `G917 explicit deadline recovery ${selected.run}: ${selected.sha}; prepare/SIX/latest boot verified; actual CI verdicts retained, not CI green`
      : `Explicit source recovery ${selected.run}: ${selected.sha}; all original source gates and SIX verified`);
    return 0;
  }
  if (cmd === 'read-wave') {
    const pin = readPin();
    /** @type {unknown} */
    const needs = JSON.parse(process.env.CI_WAVE_NEEDS ?? 'null');
    const selected = waveSource({mode:pin.mode,event:process.env.GITHUB_EVENT_NAME??'',ref:process.env.GITHUB_REF??'',
      repository:process.env.GITHUB_REPOSITORY??'',sha:process.env.GITHUB_SHA??'',run:process.env.GITHUB_RUN_ID??'',
      head:git('rev-parse','HEAD'),needs});
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `sha=${selected.sha}\nmode=${pin.mode}\ngate=${pin.gate}\nci_green=true\nsource_run=${selected.run}\nskip=${selected.skip}\n`);
    console.log(`Exact push wave ${selected.run}: ${selected.sha}; automatic mode ${!selected.skip}`);
    return 0;
  }
  if (cmd === 'read') {
    const pin = readPin();
    let sha = pin.sha;
    if (pin.mode === 'newest-green') {
      const found = git('rev-list', 'origin/main', '-n', '50').split('\n').find((s) => ok(() => { if (!gateGreen(s)) throw new Error('red'); }));
      if (!found) throw new Error('newest-green: no gpu-gate-green SHA in the last 50 on origin/main');
      sha = found;
    }
    if (pin.mode === 'newest-ci-green') sha = await newestCiGreenAfterBoot();
    // An explicit emergency rollback may return to a previously live build, including pre-smoke releases.
    if (!bootGreen(sha) && !(pin.mode === 'pinned' && productionLive(sha))) {
      throw new Error(`release refused: ${sha} has neither a green boot-smoke nor prior production proof`);
    }
    const explicitCi = pin.mode === 'pinned' && pin.ciRun !== undefined && ciRunGreen(sha, pin.ciRun);
    const ciPassed = explicitCi || pin.mode === 'newest-ci-green' || ciGreen(sha);
    console.log(sha);
    if (explicitCi) console.error(`CI aggregate exception: exact run ${pin.ciRun}, every required job verified successful`);
    console.error(`Release selection: mode=${pin.mode}, exact push CI=${ciPassed}`);
    const sourceRun = ciPassed ? ciSourceRun(sha) : '';
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\nmode=${pin.mode}\ngate=${pin.gate}\nci_green=${ciPassed}\nsource_run=${sourceRun}\n`);
    return 0;
  }
  if (cmd === 'release-ready') {
    const pin = readPin();
    // Other modes retain their existing release-job proof checks; this preflight defers only newest-CI dispatches.
    const candidate = pin.mode === 'newest-ci-green' ? releaseReady() : { ready: true, sha: pin.sha };
    console.log(`release readiness: ${candidate.ready ? 'ready' : 'deferred'} ${candidate.sha} (${pin.mode})`);
    const output = process.env.GITHUB_OUTPUT;
    if (output) appendFileSync(output, `ready=${candidate.ready}\nsha=${candidate.sha}\n`);
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
  console.error('usage: deploy-pin.mjs read | release-ready | check-gate <sha> | set <sha> --milestone M<n> --go "…" | rollback <sha> --go "…" | mode newest-green|newest-ci-green --go "…"');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main());
