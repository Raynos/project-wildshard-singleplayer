// oxlint-disable-next-line import/no-nodejs-modules -- Compare real retained-producer declarations with their manifest preload.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';

function modules(input: unknown): string[] {
  if (Array.isArray(input)) return input.flatMap((item: unknown) => modules(item));
  const record = v.safeParse(v.record(v.string(), v.unknown()), input);
  if (!record.success) return [];
  const ref = v.safeParse(v.object({ module: v.string() }), input);
  return [...(ref.success ? [ref.output.module] : []), ...Object.values(record.output).flatMap(modules)];
}

test('retained Pine level producers explicitly stage every generated manifest binding', () => {
  const manifest: unknown = JSON.parse(readFileSync('src/shards/pine-hollow/manifest.json', 'utf8'));
  const paths = modules(manifest).filter(module => module.includes('.generated'))
    .map(module => `src/shards/pine-hollow/${module.slice(2)}${module.endsWith('.generated') ? '.ts' : ''}`);
  expect(paths.length).toBeGreaterThan(0);
  const { jobs } = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), command: v.array(v.string()), inputRoots: v.array(v.string()),
    buildOutputs: v.optional(v.record(v.string(), v.string()), {}), buildTimeOutputs: v.optional(v.array(v.string()), []) })) }),
  JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  const retained = jobs.filter(job => job.command.includes('--generation-shard=pine-hollow') && job.command.includes('./scripts/generation-level.mjs')
    && Object.keys(job.buildOutputs).length === 0 && job.buildTimeOutputs.length === 0);
  expect(retained.length).toBeGreaterThan(0);
  for (const job of retained) for (const path of paths) expect(job.inputRoots, `${job.id}: ${path}`).toContain(path);
});
