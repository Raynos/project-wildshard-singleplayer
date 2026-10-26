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
  { id: 'sky-islet-scenes', output: 'src/shards/far-reach/data/isletScenes.generated.json', make: () => jsonBytes(isletScenes()) },
  { id: 'sky-islet-rest', output: 'public/assets/far-reach/baked/rest-islets.glb', make: isletGlb },
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
