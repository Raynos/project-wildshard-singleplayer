// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native scripts with physical painted-model input refusals.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only isolated producer caches and compare complete original outputs.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every sealed producer fixture beneath repository tmp.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';

for (const entry of ['bake-cover']) {
  test(`${entry} preserves its complete existing outputs without public painted models or repeated authored reads`, () => {
    const source = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const prior=fs.readFileSync, reads=new Map();
      fs.readFileSync=(path,...options)=>{
        const file=String(path).replaceAll('\\\\','/');
        assert.ok(!file.includes('/public/assets/nalati/baked/painted-models/'),'Unexpected public painted model input');
        assert.ok(!/data\\/dressing-[a-z]+\\.generated\\.json/.test(file),'Unexpected generated contact placement input');
        if(file.includes('/public/assets/nalati/models/'))reads.set(file,(reads.get(file)??0)+1);
        return prior(path,...options);
      };
      syncBuiltinESMExports();process.argv.push('--check');
      try{
        await import('./src/shards/nalati-grasslands/generators/${entry}.mjs');
        assert.equal(reads.size,6);for(const [file,count]of reads)assert.equal(count,1,file);
      }finally{fs.readFileSync=prior;syncBuiltinESMExports();}
    `;
    execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
  });
}

for (const id of ['nalati-cover']) {
  test(`${id} honors its platform contract with authored inputs and unchanged output bytes`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === id);
    if (job === undefined) throw new Error('Missing retained cover or POI producer');
    const models = job.inputRoots.filter(file => file.startsWith('public/assets/nalati/models/'));
    expect(models).toHaveLength(6);
    expect(job.inputRoots.some(file => file.startsWith('public/assets/nalati/baked/painted-models/'))).toBe(false);
    const originals = new Map(job.outputs.map(file => [file, readFileSync(file)]));
    const cacheDir = mkdtempSync(resolve('tmp/nalati-cover-model-source-'));
    try {
      if(job.platform==='darwin'&&process.platform!=='darwin'){
        await expect(generateShardJob(root, job, { cacheDir, forceCompare: true })).rejects.toThrow(`Darwin-only generator: ${id}`);
        expect(readdirSync(cacheDir)).toEqual([]);
        for(const [file,before]of originals)expect(Buffer.compare(readFileSync(file),before),file).toBe(0);
        return;
      }
      const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
      try {
        expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        for (const [file, before] of originals) {
          const actual = readFileSync(resolve(result.directory, file));
          expect(result.hashes[file], file).toBe(hashImmutableBytes(before));
          expect(actual.byteLength, file).toBe(before.byteLength);
          expect(Buffer.compare(actual, before), file).toBe(0);
        }
      } finally { result.release(); }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}

test('the POI scheduler retires in favor of an explicit native source cache', () => {
  const jobs = discoverGeneration(resolve('.')).jobs;
  expect(jobs.some(job => job.id === 'nalati-poi-paint')).toBe(false);
  expect(jobs.flatMap(job => job.outputs).some(file => /poi-shape-|\/poiPaint\.json$/u.test(file))).toBe(false);
});
