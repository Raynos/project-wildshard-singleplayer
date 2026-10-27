// Invoked only by the committed push adapter while it owns the existing mirror.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { stagedFiles } from './precommit-projects.mjs';
import { selectGateChecks } from './gate-selection.mjs';
import { pushSubsetJobs, runPushSubset, pushSubsetVerdict } from './push-subset-jobs.mjs';

if (import.meta.main) {
  const [encoded] = process.argv.slice(2);
  if (encoded === undefined || process.argv.length !== 3) throw new Error('Expected exact changed-path JSON');
  const changed = v.parse(v.array(v.pipe(v.string(), v.check(file => file.length > 0 && !file.startsWith('/') && !file.split('/').includes('..')))), JSON.parse(encoded));
  const until = Number(process.env.WS_GIT_CHECK_DEADLINE);
  if (!Number.isFinite(until) || until <= 0) throw new Error('Missing shared push batch deadline');
  // Keep teardown inside the outer batch cap. Its final process-group kill
  // must not race the descendant drain or prevent release of the owned slot.
  const root = resolve(process.cwd()), deadline = performance.now() + Math.max(0, until - Date.now() - 1500);
  // Selection is sealed from the slot's private index. Children must not inherit
  // that index: a nested Git fixture could otherwise mutate the gate candidate.
  const candidate = stagedFiles(root);
  const selection = selectGateChecks(root, candidate, changed);
  const raw = candidate.read('scripts/test-products.json');
  if (raw === undefined) throw new Error('Missing candidate product-consumer registry');
  const products = v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(raw));
  const jobs = pushSubsetJobs(selection, changed, candidate.paths, products);
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const results = await runPushSubset(root, jobs, deadline, environment);
  for (const result of results) if (result.output.length > 0) process.stderr.write(`${result.name}:\n${result.output}\n`);
  // The adapter keeps this record separate from tool diagnostics and never
  // treats a missing record or collection failure as a successful subset.
  const verdict = pushSubsetVerdict(results);
  process.stdout.write(`PUSH_SUBSET_RESULT ${JSON.stringify({ selection, results, verdict })}\n`);
  process.exitCode = verdict.failed.length > 0 ? 1 : verdict.unfinished.length > 0 ? 2 : 0;
}
