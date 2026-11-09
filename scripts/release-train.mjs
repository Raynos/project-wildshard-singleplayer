// J195: choose immutable, already-tested producer bytes. No tag, version,
// epoch or author-repo update is manufactured by the scheduled consumer.
import {execFileSync} from 'node:child_process';
import {appendFileSync, readFileSync, writeFileSync, renameSync} from 'node:fs';
import {validatePin} from './engine-pin.mjs';
import {codeProvingJobs} from './engine-code-verdict.mjs';
const engine = 'project-wildshard/engine', shell = 'Raynos/project-wildshard-singleplayer';
const api = new URL(process.env.GITHUB_API_URL ?? 'https://api.github.com');
const fixture = api.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(api.hostname);
if (!fixture && api.href !== 'https://api.github.com/') throw new Error('Unexpected GitHub API origin');
async function query(path, raw = false) {
  if (fixture) {
    const response = await fetch(new URL(path, api), {signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(`GitHub read refused: ${response.status} ${path}`);
    return response.json();
  }
  const args = ['api', '-H', 'Cache-Control: no-cache', path];
  if (raw) args.push('-H', 'Accept: application/vnd.github.raw+json');
  else if (path.includes('/actions/') && path.includes('/runs?')) args.push('--jq','{workflow_runs:[.workflow_runs[]|{id,name,event,head_sha,head_branch,status,conclusion}]}');
  else if (path.includes('/compare/')) args.push('--jq','{status,base_commit:{sha:.base_commit.sha}}');
  else if (path.includes('/jobs?')) args.push('--jq','{jobs:[.jobs[]|{name,head_sha,status,conclusion}]}');
  else if (path.endsWith('/branches/main')) args.push('--jq','{commit:{sha:.commit.sha}}');
  try { return JSON.parse(execFileSync('gh', args, {encoding:'utf8', stdio:['ignore','pipe','pipe']})); }
  catch { throw new Error(`GitHub evidence unavailable: ${path.split('?')[0]}`); }
}
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
function advances(comparison, base) {
  return comparison.base_commit?.sha === base && ['ahead', 'identical'].includes(comparison.status);
}
async function select(current) {
  const policy = JSON.parse(readFileSync('.github/deploy-pin.json', 'utf8'));
  if (policy.mode !== 'newest-ci-green') return {state:'held', reason:'explicit production hold'};
  const active = await query(`repos/${shell}/actions/workflows/deploy.yml/runs?branch=main&per_page=100`);
  if (!Array.isArray(active.workflow_runs)) throw new Error('Unreadable shell workflow inventory');
  if (active.workflow_runs.some(run => ['push','workflow_dispatch'].includes(run.event) && run.head_branch === 'main' && run.status !== 'completed')) return {state:'held', reason:'deployment already active'};
  const origin = process.env.WS_RELEASE_ORIGIN ?? 'https://wildshard-singleplayer.vercel.app';
  const liveUrl = new URL(origin);
  if (origin !== 'https://wildshard-singleplayer.vercel.app' && !(fixture && liveUrl.origin === api.origin)) throw new Error('Unexpected production origin');
  const response = await fetch(new URL('/version.json', liveUrl), {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Production version unavailable');
  const live = await response.json();
  if (!Number.isSafeInteger(live.saveEpoch) || live.saveEpoch !== current.saveEpoch || !/^[a-f0-9]{7,40}-/u.test(live.build ?? '')) throw new Error('Automatic release cannot change the live save epoch');
  const head = (await query(`repos/${engine}/branches/main`)).commit?.sha;
  if (!sha(head)) throw new Error('Unreadable engine main');
  const order = [], checks = new Map();
  // Include incomplete/latest runs: a previous green attempt cannot cover a
  // newer cancelled or red verdict. Never cancel/retry a tagged producer run.
  for (let page=1; page<=3; page++) {
    const payload = await query(`repos/${engine}/actions/runs?branch=main&event=push&per_page=100&page=${page}`);
    if (!Array.isArray(payload.workflow_runs)) throw new Error('Unreadable engine workflow inventory');
    for (const run of payload.workflow_runs) {
      if (!['ci','ring-1'].includes(run.name) || run.event !== 'push' || run.head_branch !== 'main' || !sha(run.head_sha)) continue;
      if (!Number.isSafeInteger(run.id)) throw new Error('Invalid producer run identity');
      if (!checks.has(run.head_sha)) { checks.set(run.head_sha, new Map()); order.push(run.head_sha); }
      const row = checks.get(run.head_sha), previous = row.get(run.name);
      if (previous === undefined || run.id > previous.id) row.set(run.name, run);
    }
    if (payload.workflow_runs.length < 100) break;
  }
  for (const candidate of order) {
    const pair = checks.get(candidate);
    if (!['ci','ring-1'].every(name => pair.get(name)?.status === 'completed' && pair.get(name)?.conclusion === 'success')) continue;
    const jobs = [];
    for (let page = 1; ; page++) {
      const payload = await query(`repos/${engine}/actions/runs/${pair.get('ci').id}/jobs?filter=latest&per_page=100&page=${page}`);
      if (!Array.isArray(payload.jobs)) throw new Error('Unreadable exact engine CI jobs');
      jobs.push(...payload.jobs);
      if (payload.jobs.length < 100) break;
    }
    // Pin the exact code-proven ancestor, never its untested docs-only child.
    if (!codeProvingJobs(jobs, candidate)) continue;
    if (!advances(await query(`repos/${engine}/compare/${candidate}...${head}`), candidate)) continue;
    if (candidate === current.engine.commit) return {state:'idle', reason:'newest proven engine already pinned'};
    if (!advances(await query(`repos/${engine}/compare/${current.engine.commit}...${candidate}`), current.engine.commit)) return {state:'held', reason:'producer would move backward or diverge'};
    const metadata = await query(`repos/${engine}/contents/save-epoch.json?ref=${candidate}`, true);
    if (metadata.saveEpoch !== current.saveEpoch) throw new Error('Automatic release cannot increment or downgrade the save epoch');
    return {state:'candidate', pin:validatePin({...current, schema:2, engine:{repo:'engine', source:'main', commit:candidate}}),
      producer:{ci:pair.get('ci').id, ring1:pair.get('ring-1').id}, liveBuild:live.build};
  }
  return {state:'idle', reason:'no complete green producer in the bounded main inventory'};
}
const original = readFileSync('engine.pin.json', 'utf8'), current = validatePin(JSON.parse(original));
const result = await select(current);
if (process.argv.includes('--apply') && result.state === 'candidate') {
  if (readFileSync('engine.pin.json', 'utf8') !== original) throw new Error('Pin changed during selection');
  const temporary = `engine.pin.json.train-${process.pid}`;
  writeFileSync(temporary, JSON.stringify(result.pin, null, 2)+'\n', {flag:'wx'});
  renameSync(temporary, 'engine.pin.json');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${process.argv.includes('--apply') && result.state === 'candidate'}\n`);
console.log(JSON.stringify(result));
