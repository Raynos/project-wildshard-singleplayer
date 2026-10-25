// oxlint-disable-next-line import/no-nodejs-modules -- Compare real retained-producer declarations with their manifest preload.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real authoring preload in its own Node realm.
import { execFileSync } from 'node:child_process';
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
  for (const job of retained) expect(job.inputRoots, job.id).toContain('public/assets/pine-hollow/scalars/forest-density.bin');
});

test('native Pine authoring installs only after its binary scalar intake is ready', () => {
  const result = execFileSync(process.execPath, ['--experimental-transform-types',
    '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs',
    '--input-type=module', '-e', `
      import { setActiveChunk } from './src/game/shard/registry.ts';
      import { readFileSync } from 'node:fs';
      const manifest = setActiveChunk('pine-hollow');
      const row = JSON.parse(readFileSync('src/shards/pine-hollow/data/geography.generated.json')).forest[0];
      if (!manifest.scalarBlocks.prepared) throw Error('Unprepared forest density');
      console.log(manifest.forest.density(row.x, row.z));
    `, '--', '--generation-shard=pine-hollow'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.trim()).toBe('0.7');
});
