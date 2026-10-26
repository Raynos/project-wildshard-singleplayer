// oxlint-disable-next-line import/no-nodejs-modules -- The real producer's cold cache belongs to this test.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine producer scratch to the checkout's ignored tmp.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

test('sealed Pine density stages its SDK manifest and defining codec without checkout fallback', async () => {
  const root = process.cwd(), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'pine-geography');
  if (job === undefined) throw new Error('Missing registered Pine geography producer');
  const cacheDir = mkdtempSync(resolve(root, 'tmp/pine-density-inputs-'));
  try {
    for (const missing of ['src/sdk/package.json', 'src/sdk/bake/byteCodec.ts', 'src/sdk/bake/portableBytes.ts']) {
      expect(job.inputRoots).toContain(missing);
      const negative = { ...job, inputRoots: job.inputRoots.filter(file => file !== missing) };
      const catalogPath = relative(root, resolve(cacheDir, 'negative.json'));
      writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT test fixture',
        jobs: jobs.map(row => row.id === job.id ? negative : row) }));
      await expect(generateShardJob(root, negative, { cacheDir, catalogPath, forceCompare: true }))
        .rejects.toThrow('Generator exited 1');
    }
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hit).toBe(false);
      expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
      expect(result.hashes['src/shards/pine-hollow/data/geography.generated.json']).toBe('ef17640fd8999657be83b457bcd69d49c21d91d64de0c5a7d0fd01bc575a83b5');
      expect(result.hashes['public/assets/pine-hollow/scalars/forest-density.bin']).toBe('baa1e6abbdddea3ffadc63b0297cd5cd6d16e772d2fe708c82fe191b5bcc3186');
      expect(result.hashes['src/shards/pine-hollow/data/ground.generated.json']).toBe('f84775b1430dbeed357445cc60aa4bc16ae1c1489b167c109cb192ffff698464');
      expect(result.hashes['src/shards/pine-hollow/data/pondClip.generated.json']).toBe('577a5d29272068ee12b165d7bf622df002c9b106df933d87e0b642129f554674');
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
}, 30_000);
