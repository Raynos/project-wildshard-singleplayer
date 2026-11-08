// Only the same-run, two-engine staged verdict can admit an automatic release.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {validatePin, verify} from './engine-pin.mjs';
import {productionFloor} from './deploy-pin.mjs';
import {existingReleaseBypass} from './release-access.mjs';
const api = args => {
  const path=args[0], command=['api','-H','Cache-Control: no-cache',...args];
  if(path.includes('/compare/'))command.push('--jq','{status,base_commit:{sha:.base_commit.sha}}');
  if(path.includes('/jobs?'))command.push('--jq','{jobs:[.jobs[]|{name,status,conclusion,head_sha}]}');
  try{return JSON.parse(execFileSync('gh',command,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}
  catch{throw new Error(`GitHub release evidence unavailable: ${path.split('?')[0]}`);}
};
const repo = 'Raynos/project-wildshard-singleplayer';
const [url, build, archive] = process.argv.slice(2);
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const run = process.env.GITHUB_RUN_ID, attempt = process.env.GITHUB_RUN_ATTEMPT;
if (!/^https:\/\/wildshard-singleplayer-[a-z0-9]+-raynos-projects\.vercel\.app$/u.test(url ?? '')
  || !build?.startsWith(sha.slice(0,7)+'-') || !/^[a-f0-9]{64}$/u.test(archive ?? '') || !/^[1-9][0-9]*$/u.test(run ?? '') || !/^[1-9][0-9]*$/u.test(attempt ?? '')) throw new Error('Invalid exact staged release identity');
const policy = JSON.parse(readFileSync('.github/deploy-pin.json','utf8'));
if (policy.mode !== 'newest-ci-green' && !(policy.mode === 'pinned' && policy.sha === sha)) { console.log('Production explicitly held'); process.exit(0); }
const workflow = api([`repos/${repo}/actions/runs/${run}`]);
if (workflow.head_sha !== sha || workflow.head_branch !== 'main' || !['push','workflow_dispatch'].includes(workflow.event)
  || workflow.path !== '.github/workflows/deploy.yml' || workflow.run_attempt !== Number(attempt)) throw new Error('Foreign release workflow or attempt');
const jobs = api([`repos/${repo}/actions/runs/${run}/attempts/${attempt}/jobs?per_page=100`]);
for (const name of ['build-pinned','stage-pinned','staged-Chromium','staged-WebKit']) {
  const rows = jobs.jobs.filter(job => job.name === name);
  if (rows.length !== 1 || rows[0].status !== 'completed' || rows[0].conclusion !== 'success' || rows[0].head_sha !== sha) throw new Error(`Missing same-source successful release job: ${name}`);
}
for (const job of jobs.jobs) {
  if (job.name === 'release' && job.status === 'in_progress' && job.head_sha === sha) continue;
  if (job.name === 'prove-pr' && job.status === 'completed' && job.conclusion === 'skipped') continue;
  if (job.status !== 'completed' || job.conclusion !== 'success' || job.head_sha !== sha) throw new Error(`Unfinished or red release gate: ${job.name}`);
}
const pin = validatePin(JSON.parse(readFileSync('engine.pin.json','utf8'))); verify(pin);
const bypass = await existingReleaseBypass();
const staged = await fetch(new URL('/version.json',url), {headers:{'x-vercel-protection-bypass':bypass},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
if (!staged.ok) throw new Error('Staged version unavailable');
const candidate = await staged.json();
if (candidate.build !== build || candidate.saveEpoch !== pin.saveEpoch) throw new Error('Staged bytes differ from proven identity');
const response = await fetch('https://wildshard-singleplayer.vercel.app/version.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
if (!response.ok) throw new Error('Live floor unavailable');
const live = await response.json();
if (!Number.isSafeInteger(live.saveEpoch) || candidate.saveEpoch < live.saveEpoch || (pin.schema === 2 && candidate.saveEpoch !== live.saveEpoch)) throw new Error('Save-epoch floor refused automatic wipe/downgrade');
const liveSha = productionFloor(live.build,sha);
const livePin = validatePin(api([`repos/${repo}/contents/engine.pin.json?ref=${liveSha}`,'-H','Accept: application/vnd.github.raw+json']));
const lineage = api([`repos/project-wildshard/engine/compare/${livePin.engine.commit}...${pin.engine.commit}`]);
if (!['ahead','identical'].includes(lineage.status) || lineage.base_commit?.sha !== livePin.engine.commit) throw new Error('Engine would move backward or diverge');
if (api([`repos/${repo}/branches/main`]).commit?.sha !== sha) throw new Error('Newer shell main superseded this release');
if (!process.env.VERCEL_BUILD_TOKEN) throw new Error('Existing production deployment credential unavailable');
try { execFileSync('vercel',['promote',url,'--yes','--scope','raynos-projects','--token',process.env.VERCEL_BUILD_TOKEN],{stdio:'inherit'}); }
catch { throw new Error('Vercel promotion failed; production was not rolled back'); }
execFileSync(process.execPath,['scripts/deploy-version.mjs','verify'],{stdio:'inherit',env:{...process.env,DEPLOY_SHA:sha,DEPLOY_EXPECTED_BUILD:build}});
console.log(`Production ${build}; engine ${pin.engine.commit}; epoch ${pin.saveEpoch}; proven archive ${archive}`);
