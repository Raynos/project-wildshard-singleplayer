// oxlint-disable-next-line import/no-nodejs-modules -- Observe real native file intake without allowing a generated-row fallback.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own an isolated sealed producer cache and compare every original output.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the sealed cache beneath repository tmp.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('native Node authors preserve every original sampled placement with no generated-row reads or page selection', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    import {selectedLevel} from '@wildshard/engine/level/selection';
    const originalRead=fs.readFileSync,reads=new Map();
    fs.readFileSync=(path,...options)=>{
      const file=String(path).replaceAll('\\\\','/');
      assert.ok(!/data\\/dressing-[a-z]+\\.generated\\.json/.test(file),'Unexpected generated dressing input');
      if(/(?:geography-(?:pond|red|green|blue|forest)\\.bin|baked\\/nalati-grasslands\\/terrain\\.bin)$/.test(file))reads.set(file,(reads.get(file)??0)+1);
      return originalRead(path,...options);
    };
    syncBuiltinESMExports();
    try{
      const {nativeNalatiDressingPlacements}=await import('./src/shards/nalati-grasslands/generators/nativeDressingPlacements.mjs');
      assert.equal(selectedLevel(),null);
      const files=await nativeNalatiDressingPlacements(file=>fs.readFileSync(file));assert.equal(selectedLevel(),null);assert.equal(files.size,18);
      assert.equal(reads.size,6);for(const [file,count]of reads)assert.equal(count,1,file);
      const again=await nativeNalatiDressingPlacements(file=>fs.readFileSync(file));assert.equal(selectedLevel(),null);
      for(const [name,bytes]of files){assert.equal(Buffer.compare(bytes,again.get(name)),0,name);assert.notEqual(bytes.buffer,again.get(name).buffer);}
      const {prepareNalatiDressing}=await import('./scripts/bake/nalatiDressing.mjs');
      const before=await prepareNalatiDressing();
      for(const [group,rows]of Object.entries({...before.plan,clutter:before.clutter})){
        const name='dressing-'+group+'.json',expected=Buffer.from(JSON.stringify(rows)+'\\n'),actual=files.get(name);
        assert.ok(actual,name);assert.equal(actual.length,expected.length,name);assert.equal(Buffer.compare(actual,expected),0,name);
      }
    }finally{fs.readFileSync=originalRead;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
});

test('the grass writer preserves all original files while generated dressing reads are forbidden', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    const prior=fs.readFileSync;
    fs.readFileSync=(path,...options)=>{
      assert.ok(!/data\\/dressing-[a-z]+\\.generated\\.json/.test(String(path)),'Unexpected generated grass keep-out input');
      return prior(path,...options);
    };
    syncBuiltinESMExports();process.argv.push('--check');
    try{await import('./src/shards/nalati-grasslands/generators/bake-grass.mjs');}
    finally{fs.readFileSync=prior;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});

test('sealed grass production preserves every original output over only declared native inputs', async () => {
  const root=resolve('.'),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-grass');
  if(job===undefined)throw new Error('Missing native grass producer');
  const originals=new Map(job.outputs.map(file=>[file,readFileSync(file)]));
  const cacheDir=mkdtempSync(resolve('tmp/nalati-native-dressing-'));
  try{
    const result=await generateShardJob(root,job,{cacheDir,forceCompare:true});
    try{
      expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
      for(const [file,before]of originals){
        const bytes=readFileSync(resolve(result.directory,file));
        expect(result.hashes[file],file).toBe(hashImmutableBytes(before));
        expect(bytes.length,file).toBe(before.length);expect(Buffer.compare(bytes,before),file).toBe(0);
      }
    }finally{result.release();}
  }finally{rmSync(cacheDir,{recursive:true,force:true});}
});
