// oxlint-disable-next-line import/no-nodejs-modules -- Compare original authored outputs and isolate actual sealed-driver fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-source catalogues under repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original byte without expanding geometry assertions.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyIsletRigRows } from '../src/shards/far-reach/generators/isletRigRows';
import { isletMotionRows } from '../src/shards/far-reach/generators/isletMotion';
import { isletGlb, isletScenes } from '../src/shards/far-reach/generators/isletScene';

const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
const cases = [
  { id: 'sky-islet-motion', output: 'src/shards/far-reach/data/isletMotion.generated.json', make: () => jsonBytes(isletMotionRows()) },
];
// GR5: the islet scenes and pool are no longer written to files (the product and the map call these functions);
// their original bytes stay pinned by hash.
const pinned = [
  { id: 'islet scenes', make: () => jsonBytes(isletScenes()), bytes: 10_644, hash: 'c78727f373fef3a73e342c63969681e2322cf7400ba9614dffb48df51197b905' },
  { id: 'islet pool', make: isletGlb, bytes: 12_956, hash: '3c18959354dfbd48b6faa7f68d5a4072b88e2b4c2133084b9cee8e07f6c1f048' },
];
const original = v.parse(v.object({ rigs: v.unknown(), rails: v.unknown() }), JSON.parse(readFileSync('src/shards/far-reach/data/isletRig.json', 'utf8')));

test('authored rig rows retain every original chain anchor, rail box and field order', () => {
  expect(JSON.stringify(skyIsletRigRows())).toBe(JSON.stringify(original));
});

test('each authored rig bank owns its chain and rail arrays', () => {
  const first = skyIsletRigRows(), second = skyIsletRigRows(), local = first.rigs[0]?.local[0], rails = first.rails[0];
  if (local === undefined || rails === undefined) throw new Error('Missing original chain/rail bank');
  local[0] += 1; rails.length = 0;
  expect(JSON.stringify(second)).toBe(JSON.stringify(original));
  expect(JSON.stringify(skyIsletRigRows())).toBe(JSON.stringify(original));
});

test.each(cases)('$id retains its complete original output from authored rig rows', ({ output, make }) => {
  expect(Buffer.compare(make(), readFileSync(output))).toBe(0);
});

test.each(pinned)('the $id keep their complete original bytes from authored rig rows', ({ make, bytes, hash }) => {
  const made = make();
  expect(made.byteLength).toBe(bytes);
  expect(hashImmutableBytes(made)).toBe(hash);
});

test.each(cases)('the real cold sealed $id writer retains every byte without the rig metadata handoff', async ({ id, output }) => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained islet writer ${id}`);
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/isletRig.json');
  const source = 'src/shards/far-reach/generators/isletRigRows.ts';
  expect(job.inputRoots).toContain(source);
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-islet-rig-inputs-'));
  try {
    if (id === 'sky-islet-motion') {
      const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) }, catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
      writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
      await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    }
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
