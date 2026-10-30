import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as v from 'valibot';
import { createShardPlan, readDurations, LEGACY_FILE_OVERHEAD } from './test-shard-plan.ts';

const finite = v.pipe(v.number(), v.finite(), v.minValue(0));
const timingsSchema = v.object({ files: v.array(v.object({ file: v.string(), state: v.string(), measuredAt: finite,
  durationMs: finite, collectMs: finite, setupMs: finite, environmentMs: finite, prepareMs: finite })) });
const resultsSchema = v.object({ testResults: v.array(v.object({ name: v.string(), status: v.string(), startTime: finite, endTime: finite })) });
const discovered = v.array(v.object({ file: v.string() }));

/** Latest successful observations replace the old body-only registry per file. */
export function measuredWeights(root: string, paths: readonly string[], results: readonly unknown[], timings: readonly unknown[]): { weights: Map<string, number>; fallbackSeconds: number; measuredFiles: number } {
  const baseline = readDurations(root) ?? new Map<string, number>(), updates = new Map<string, { at: number; seconds: number; complete: boolean }>();
  const overheads: number[] = [];
  const update = (file: string, value: { at: number; seconds: number; complete: boolean }): void => {
    const previous = updates.get(file);
    if (previous === undefined || previous.at < value.at || (previous.at === value.at && value.complete)) updates.set(file, value);
  };
  for (const input of results) for (const row of v.parse(resultsSchema, input).testResults) if (row.status === 'passed' && row.endTime >= row.startTime) {
    update(relative(root, resolve(root, row.name)).replaceAll('\\', '/'), { at: row.endTime, seconds: (row.endTime - row.startTime) / 1000, complete: false });
  }
  for (const input of timings) for (const row of v.parse(timingsSchema, input).files) if (row.state === 'passed') {
    const overhead = (row.collectMs + row.setupMs + row.environmentMs + row.prepareMs) / 1000;
    overheads.push(overhead);
    update(row.file, { at: row.measuredAt, seconds: row.durationMs / 1000 + overhead, complete: true });
  }
  const median = (values: readonly number[], fallback: number): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? fallback;
  const overhead = median(overheads, LEGACY_FILE_OVERHEAD);
  const fallbackSeconds = median([...baseline.values()], 1) + overhead;
  const weights = new Map(paths.map(file => {
    const observation = updates.get(file), body = observation?.seconds ?? baseline.get(file);
    return [file, body === undefined ? fallbackSeconds : body + (observation?.complete === true ? 0 : overhead)];
  }));
  return { weights, fallbackSeconds, measuredFiles: paths.filter(file => updates.has(file)).length };
}

export function planMain(args: readonly string[]): void {
  const { values } = parseArgs({ args: [...args], options: { shards: { type: 'string', default: '12' }, workers: { type: 'string', default: '2' },
    output: { type: 'string' }, files: { type: 'string' }, results: { type: 'string', multiple: true }, timings: { type: 'string', multiple: true } } });
  if (values.output === undefined) throw new Error('Specify --output for the shard plan artifact');
  const root = process.cwd();
  const inventory: unknown = values.files === undefined ? JSON.parse(execFileSync(process.execPath,
    [resolve('node_modules/vitest/vitest.mjs'), 'list', '--filesOnly', '--json', '--config', 'scripts/vitest-ci.config.ts'], { encoding: 'utf8' }))
    : JSON.parse(readFileSync(values.files, 'utf8'));
  const paths = v.parse(discovered, inventory).map(row => relative(root, resolve(root, row.file)).replaceAll('\\', '/'));
  if (paths.length === 0 || paths.some(file => file.startsWith('../') || file.startsWith('/') || file.includes('\n'))) throw new Error('Invalid discovered test inventory');
  const { GITHUB_SHA: providedSha, GITHUB_RUN_ID: run } = process.env;
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (providedSha !== undefined && providedSha !== sha) throw new Error('Planner checkout does not match GITHUB_SHA');
  const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
  const measurements = measuredWeights(root, paths, (values.results ?? []).map(read), (values.timings ?? []).map(read));
  const plan = createShardPlan(paths, measurements.weights, { count: Number(values.shards), workers: Number(values.workers),
    sha, run: run ?? null, fallbackSeconds: measurements.fallbackSeconds, measuredFiles: measurements.measuredFiles });
  mkdirSync(dirname(resolve(values.output)), { recursive: true });
  writeFileSync(values.output, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`vitest-plan: ${paths.length} files / ${plan.shardCount} shards / ${plan.workers} workers; expected ${plan.expectedSeconds.toFixed(1)} s at measured rate; ${plan.measuredFiles} recent observations`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) planMain(process.argv.slice(2));
