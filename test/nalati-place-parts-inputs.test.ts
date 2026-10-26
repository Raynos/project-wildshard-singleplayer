// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove each sealed producer fixture.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep each isolated producer inside repository tmp.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';

const root = resolve('.'), leaf = 'src/shards/nalati-grasslands/generators/placeParts.ts';
const inputHashes = new InputHashMemo(root);
const prefix = 'src/shards/nalati-grasslands/data/';
const pins = [
  ['nalati-balbal-specimen', [
    ['balbalSpecimen.generated.json', '2eb6117fd6b08dc2b6d8ac8c09b7c1e4e0aacbc77879154e2bfad810df48a948'],
    ['balbal-carving-0.generated.bin', '822694b3287b5b09781e531c2edfbc5def284a757fc097dcc23061b09e79f85c'],
    ['balbal-carving-1.generated.bin', '45ac62fdf44b83dd06ed55de034577712732a535385de1718e16862279b4634f'],
  ]],

] as const;

for (const [id, files] of pins) {
  for (const omitted of [leaf, undefined]) {
    test(`${id} ${omitted === undefined ? 'preserves every original wire byte in isolation' : `refuses omitted ${omitted}`}`, async () => {
      const job = discoverGeneration(root).jobs.find(row => row.id === id);
      if (job === undefined) throw new Error('Missing retained place part producer');
      expect(job.inputRoots).toContain(leaf);
      const cacheDir = mkdtempSync(resolve('tmp', 'nalati-place-parts-'));
      try {
        if (omitted !== undefined) {
          expect(job.inputRoots).toContain(omitted);
          const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== omitted) };
          const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
          const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }),
            JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
          writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row =>
            typeof row === 'object' && row !== null && Reflect.get(row, 'id') === id ? descriptor : row) }));
          await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true, inputHashes })).rejects.toThrow('Generator exited 1');
        } else {
          const result = await generateShardJob(root, job, { cacheDir, forceCompare: true, inputHashes });
          try {
            expect(Object.keys(result.hashes).sort()).toEqual(files.map(([file]) => prefix + file).sort());
            for (const [file, hash] of files) {
              expect(result.hashes[prefix + file], file).toBe(hash);
              expect(Buffer.compare(readFileSync(resolve(result.directory, prefix + file)), readFileSync(prefix + file)), file).toBe(0);
            }
          } finally { result.release(); }
        }
      } finally { rmSync(cacheDir, { recursive: true, force: true }); }
    });
  }
}
