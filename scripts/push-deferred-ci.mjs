// G757 runs handed-off work first in its own CI job; all original jobs remain.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { stagedFiles } from './precommit-projects.mjs';
import { selectGateChecks } from './gate-selection.mjs';
import { pushSubsetJobs, runPushSubset, pushSubsetVerdict, selectPushSteps, nativeOutputReplayJob } from './push-subset-jobs.mjs';

if (import.meta.main) {
  const [base, encoded] = process.argv.slice(2);
  if (base === undefined || encoded === undefined || process.argv.length !== 4 || !/^[a-f0-9]{40}$/u.test(base))
    throw new Error('Expected exact handoff base and named-step JSON');
  const steps = v.parse(v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/u))), v.minLength(1)), JSON.parse(encoded));
  const root = resolve(process.cwd());
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const tip = git(['rev-parse', 'HEAD']);
  if (git(['merge-base', base, tip]) !== base) throw new Error('CI handoff base is outside its exact commit history');
  const changed = git(['diff', '--name-only', '--no-renames', base, tip]).split('\n').filter(Boolean);
  const deleted = git(['diff', '--name-only', '--diff-filter=D', '--no-renames', base, tip]).split('\n').filter(Boolean);
  const candidate = stagedFiles(root), selection = selectGateChecks(root, candidate, changed);
  const raw = candidate.read('scripts/test-products.json');
  if (raw === undefined) throw new Error('Missing committed product-consumer registry');
  const products = v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(raw));
  const subset = pushSubsetJobs(selection, changed, candidate.paths, products);
  /** @type {import('./push-subset-jobs.mjs').PushSubsetJob[]} */
  const policy = ['storage', 'deleted-paths', 'ratchet', 'guards', 'fast-lint'].map(name => ({ name, after: [],
    command: [process.execPath, 'scripts/committed-fast-checks.mjs', root, base, tip, name, JSON.stringify(name === 'deleted-paths' ? deleted : changed)] }));
  policy.push({ name: 'binary-json', after: [], command: [process.execPath, 'scripts/no-binary-json.mjs', '--range', base, tip] });
  // Tool-input preparation is re-established by this clean checkout and the
  // same complete subset selection, not a waiver of the unavailable local step.
  const complete = steps.some(step => step === 'ci-subset' || step === 'tool-inputs');
  const names = [...new Set(steps.filter(step => step !== 'ci-subset' && step !== 'tool-inputs').concat(complete ? subset.map(job => job.name) : []))];
  const candidates = [...policy, ...subset];
  if (steps.includes('native-outputs')) candidates.push(nativeOutputReplayJob(candidates,
    changed.filter(file => candidate.paths.includes(file) && /\.[cm]?[jt]sx?$/u.test(file))));
  const jobs = selectPushSteps(candidates, names);
  const deadline = performance.now() + 38 * 60_000;
  const results = await runPushSubset(root, jobs, deadline);
  for (const result of results) process.stdout.write(`${result.name}: exit${result.code}\n${result.output}\n`);
  if (results.some(result => result.output.includes('DEFERRED TO CI')))
    throw new Error('CI handoff contains an unverified native input');
  const verdict = pushSubsetVerdict(results);
  if (verdict.failed.length > 0 || verdict.unfinished.length > 0)
    throw new Error(`CI handoff refused: ${[...verdict.failed, ...verdict.unfinished].join(', ')}`);
}
