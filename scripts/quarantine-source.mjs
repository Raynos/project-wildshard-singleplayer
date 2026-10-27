// CF3: optional reporting consumes its exact producing run without holding the push verdict.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';

const id = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER));
const shaSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u));
const Run = v.object({ id, head_sha: shaSchema, event: v.literal('push'), head_branch: v.literal('main'),
  head_repository: v.object({ full_name: v.string() }), path: v.literal('.github/workflows/deploy.yml'), status: v.literal('completed') });
const Job = v.object({ name: v.string(), run_id: id, status: v.string(), conclusion: v.nullable(v.string()) });

/** Bind authenticated API responses to the triggering main push and both complete producers.
 * Other checks may be red: reporting must retain those tests too.
 * @param {unknown} input @param {unknown} pages
 * @param {{run:string,sha:string,repository:string}} expected */
export function quarantineSource(input, pages, expected) {
  const run = v.parse(Run, input);
  if (String(run.id) !== expected.run || run.head_sha !== expected.sha || run.head_repository.full_name !== expected.repository) {
    throw new Error('Quarantine source differs from the triggering main push');
  }
  const jobs = v.parse(v.array(v.object({ jobs: v.array(Job) })), pages).flatMap(page => page.jobs);
  for (const name of ['generated-inputs', 'products']) {
    const found = jobs.filter(job => job.name === name), job = found[0];
    if (found.length !== 1 || job === undefined || job.run_id !== run.id || job.status !== 'completed' || job.conclusion !== 'success') {
      throw new Error(`Quarantine requires the complete successful ${name} producer`);
    }
  }
  return { sha: run.head_sha, run: String(run.id) };
}

function main() {
  const { SOURCE_RUN: run, SOURCE_SHA: sha, GITHUB_REPOSITORY: repository, GITHUB_OUTPUT: output } = process.env;
  if (run === undefined || sha === undefined || repository === undefined || output === undefined) throw new Error('Missing quarantine source binding');
  const source = quarantineSource(JSON.parse(readFileSync('source-run.json', 'utf8')),
    JSON.parse(readFileSync('source-jobs.json', 'utf8')), { run, sha, repository });
  appendFileSync(output, `sha=${source.sha}\nrun=${source.run}\n`);
}
if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
