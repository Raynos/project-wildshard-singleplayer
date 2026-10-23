// oxlint-disable-next-line import/no-nodejs-modules -- Real isolated producer processes and byte comparisons.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths inside owned toy repositories.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { generateShardJob, prepareGeneration, type ShardGenerationJob } from '../scripts/generate.mjs';
import { verifyStagedGeneration } from '../scripts/generation-determinism.mjs';

const owned: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function put(root: string, file: string, text: string): void { mkdirSync(dirname(resolve(root, file)), { recursive: true }); writeFileSync(resolve(root, file), text); }
function fixture(source: string) {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/generation-determinism-')); owned.push(root);
  const entry = 'src/shards/quarry/generators/bake-sample.mjs', output = 'src/shards/quarry/data/sample.json';
  const job: ShardGenerationJob = { id: 'quarry-sample', shard: 'quarry', entry, command: [entry], inputRoots: ['src/shards/quarry'], outputs: [output], platform: 'portable', buildTimeOutputs: [output] };
  put(root, entry, `import fs from 'node:fs';const output=${JSON.stringify(output)};${source}`);
  put(root, 'scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT fixture', jobs: [job] }));
  return { root, entry, output, job };
}

test('audits fresh processes in the same stage, resets seeds/incidental files and never uses or publishes shared cache', async () => {
  const f = fixture(`const seed=JSON.parse(fs.readFileSync(output,'utf8'));fs.mkdirSync('scratch',{recursive:true});const old=fs.existsSync('scratch/previous');fs.writeFileSync('scratch/previous','run');fs.writeFileSync(output,JSON.stringify({n:seed.n+1,old,cwd:process.cwd()}));`);
  f.job.seedOutputs = [f.output]; f.job.buildTimeOutputs = []; put(f.root, f.output, '{"n":4}');
  const cacheDir = resolve(f.root, 'cache');
  const result = await generateShardJob(f.root, f.job, { cacheDir, determinism: true });
  try {
    const actual: unknown = JSON.parse(readFileSync(resolve(result.directory, f.output), 'utf8'));
    expect(actual).toMatchObject({ n: 5, old: false });
    expect(readFileSync(resolve(f.root, f.output), 'utf8')).toBe('{"n":4}');
    expect(existsSync(cacheDir)).toBe(false);
    expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([result.directory.split('/').at(-1)]);
  } finally { result.release(); }
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});

test('names every random-byte difference and leaves no result/cache/source publication', async () => {
  const f = fixture(`const {randomBytes}=await import('node:crypto');fs.writeFileSync(output,JSON.stringify(randomBytes(32).toString('hex')));`);
  await expect(generateShardJob(f.root, f.job, { cacheDir: resolve(f.root, 'cache'), determinism: true }))
    .rejects.toThrow(`Non-deterministic generation: quarry-sample; ${f.output}`);
  expect(existsSync(resolve(f.root, f.output))).toBe(false);
  expect(existsSync(resolve(f.root, 'cache'))).toBe(false);
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});

test('refuses a producer that mutates its staged source before a second run', async () => {
  const f = fixture(`fs.writeFileSync('src/shards/quarry/input.txt','changed');fs.writeFileSync(output,'{}');`);
  put(f.root, 'src/shards/quarry/input.txt', 'original');
  await expect(generateShardJob(f.root, f.job, { determinism: true })).rejects.toThrow('Generator changed staged input: quarry-sample src/shards/quarry/input.txt');
  expect(readFileSync(resolve(f.root, 'src/shards/quarry/input.txt'), 'utf8')).toBe('original');
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});

test('a missing second output cannot reuse the first run and a seed must be rewritten both times', async () => {
  const f = fixture(`fs.writeFileSync(output,'{}');`);
  let runs = 0;
  await expect(verifyStagedGeneration(f.root, { id: f.job.id, outputs: [f.output] }, () => {
    if (++runs === 1) put(f.root, f.output, '{}');
    return Promise.resolve();
  })).rejects.toThrow('sample.json');
  expect(runs).toBe(2);
  f.job.seedOutputs = [f.output]; f.job.buildTimeOutputs = []; put(f.root, f.output, '{}'); put(f.root, f.entry, '/* no output write */');
  await expect(generateShardJob(f.root, f.job, { determinism: true })).rejects.toThrow('Generator did not write declared outputs');
});

test('checks all jobs including report-only producers with original upstream bytes, without restoring or sealing a phase', async () => {
  const f = fixture(`fs.writeFileSync(output,JSON.stringify('first'));`);
  const second = 'src/shards/quarry/data/second.json', entry = 'src/shards/quarry/generators/bake-second.mjs';
  put(f.root, entry, `import fs from 'node:fs';fs.writeFileSync('${second}',JSON.stringify({first:JSON.parse(fs.readFileSync('${f.output}','utf8'))}));`);
  const next = { ...f.job, id: 'quarry-second', entry, command: [entry], outputs: [second], buildTimeOutputs: [] };
  put(f.root, 'scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT fixture', jobs: [f.job, next] }));
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await prepareGeneration(f.root, { determinism: true, concurrency: 2 });
  expect(log.mock.calls.some(row => row[0] === 'generate: determinism PASS, 2 jobs checked twice, 0 differ')).toBe(true);
  expect(existsSync(resolve(f.root, f.output))).toBe(false); expect(existsSync(resolve(f.root, second))).toBe(false);
  expect(existsSync(resolve(f.root, '.cache/generation-phase.json'))).toBe(false);
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});

test('a warm production cache cannot satisfy the audit, and audit mode cannot restore files', async () => {
  const f = fixture(`fs.writeFileSync(output,JSON.stringify('fixed'));`), cacheDir = resolve(f.root, 'cache');
  const cold = await generateShardJob(f.root, f.job, { cacheDir }); cold.release();
  const warm = await generateShardJob(f.root, f.job, { cacheDir }); expect(warm.hit).toBe(true); warm.release();
  const audit = await generateShardJob(f.root, f.job, { cacheDir, determinism: true });
  try { expect(audit.hit).toBe(false); expect(audit.hashes).toEqual(cold.hashes); } finally { audit.release(); }
  await expect(generateShardJob(f.root, f.job, { determinism: true, restore: true })).rejects.toThrow('Determinism audit cannot restore outputs');
});

test('a deterministic result does not waive a stale retained pin in normal generation', async () => {
  const f = fixture(`fs.writeFileSync(output,JSON.stringify('fixed'));`);
  f.job.buildTimeOutputs = []; f.job.buildOutputs = { [f.output]: '0'.repeat(64) };
  const result = await generateShardJob(f.root, f.job, { determinism: true }); result.release();
  await expect(generateShardJob(f.root, f.job, { cacheDir: resolve(f.root, 'cache'),
    preparation: { outputs: [f.output], retained: new Set([f.output]), upstream: new Map() } }))
    .rejects.toThrow('Pinned generation output differs: quarry-sample');
  expect(existsSync(resolve(f.root, f.output))).toBe(false);
});
