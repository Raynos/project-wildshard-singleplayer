// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete outputs inside the existing sealed generation boundary.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep isolated generation caches below repository tmp.
import { relative, resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import pins from './fixtures/nalati-held-files.json' with { type: 'json' };
import speciesPins from './fixtures/nalati-species-files.json' with { type: 'json' };

for (const omitted of [undefined, 'src/shards/nalati-grasslands/generators/bake-species.mjs', 'public/assets/nalati/baked/bodies.bin']) {
  test(omitted === undefined ? 'sealed held metadata constructs its original program without the generated species handoff'
    : `sealed held metadata refuses omitted source ${omitted} despite complete original outputs`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-held-weapons');
    if (job === undefined) throw new Error('Missing retained held producer');
    expect(job.inputRoots).not.toContain(speciesPins[0]?.path);
    expect(job.inputRoots).toContain('src/shards/nalati-grasslands/generators/bake-species.mjs');
    const cacheDir = mkdtempSync(resolve('tmp/nalati-held-source-'));
    try {
      if (omitted !== undefined) {
        const missing = { ...job, inputRoots: job.inputRoots.filter(name => name !== omitted) };
        expect(missing.inputRoots.length).toBe(job.inputRoots.length - 1);
        const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
        const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }),
          JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
        writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row =>
          typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? missing : row) }));
        await expect(generateShardJob(root, missing, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
        for (const pin of speciesPins) expect(hashImmutableBytes(readFileSync(pin.path))).toBe(pin.sha256);
      } else {
        const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
        try {
          expect(Object.keys(result.hashes).sort((a, b) => a.localeCompare(b))).toEqual(pins.map(pin => pin.path).sort((a, b) => a.localeCompare(b)));
          for (const pin of speciesPins.slice(0, 3)) expect(existsSync(resolve(result.directory, pin.path)), pin.path).toBe(false);
          for (const pin of pins) {
            const bytes = readFileSync(resolve(result.directory, pin.path));
            expect(bytes.length, pin.path).toBe(pin.bytes); expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
            expect(Buffer.compare(bytes, readFileSync(pin.path)), pin.path).toBe(0);
          }
        } finally { result.release(); }
      }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}
