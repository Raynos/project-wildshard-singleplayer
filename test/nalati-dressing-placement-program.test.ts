// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native producer without page installation or a shared cache.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the exact defining author entry.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiDressingPlacementProgram } from '../src/shards/nalati-grasslands/generators/dressingPlacementProgram';

test('fresh and persistent placement rows retain all eighteen complete native predecessor files with detached loans', () => {
  const source = `
    import assert from 'node:assert/strict';
    import {mkdtempSync,rmSync} from 'node:fs';
    import {resolve} from 'node:path';
    import {createProjectGeneration} from './src/sdk/projectGeneration.ts';
    import {hashImmutableBytes} from './src/sdk/immutable.ts';
    import {selectedLevel} from '@wildshard/engine/level/selection';
    import {nalatiDressingPlacementProgram} from './src/shards/nalati-grasslands/generators/dressingPlacementProgram.ts';
    import {prepareNalatiDressing} from './scripts/bake/nalatiDressing.mjs';
    import {nalatiDressingPlacementBlobs,nalatiDressingBlob} from './src/shards/nalati-grasslands/generators/dressingSchemas.ts';
    import {packDressingTable} from './src/shards/nalati-grasslands/generators/dressingTable.ts';
    import {nameBlob} from './src/sdk/blobs.ts';
    import {encodeCanonicalJson} from './src/sdk/immutable.ts';
    const cache=mkdtempSync(resolve('tmp/nalati-dressing-placement-'));
    let constructions=0;
    const context=program=>{
      const real=createProjectGeneration(resolve('src/shards/nalati-grasslands'),program.repeat(64),new Map(),cache,
        [{prefix:'/assets/baked/nalati-grasslands/',directory:resolve('public/assets/baked/nalati-grasslands')}]);
      return{cached:(step,make)=>{
        assert.equal(step.native,true);
        assert.deepEqual(step.inputs,['/assets/baked/nalati-grasslands/terrain.bin',...['pond','red','green','blue','forest'].map(name=>'data/geography-'+name+'.bin')]);
        return real.cached(step,inputs=>{constructions++;return make(inputs);});
      }};
    };
    let originals=[];
    const check=files=>{
      assert.deepEqual([...files.keys()],originals.map(row=>row.file));
      for(const row of originals){const bytes=files.get(row.file);assert.ok(bytes,row.file);assert.equal(bytes.length,row.bytes.length,row.file);assert.equal(hashImmutableBytes(bytes),row.hash,row.file);assert.equal(Buffer.compare(bytes,row.bytes),0,row.file);}
    };
    try{
      assert.equal(selectedLevel(),null);
      const cold=await nalatiDressingPlacementProgram(context('a'));assert.equal(selectedLevel(),null);assert.equal(constructions,1);
      const originalCold=new Map([...cold].map(([name,bytes])=>[name,bytes.slice()]));
      for(const bytes of cold.values())bytes.fill(0);
      const hit=await nalatiDressingPlacementProgram(context('a'));assert.equal(selectedLevel(),null);assert.equal(constructions,1);
      for(const [name,bytes]of hit)assert.notEqual(bytes.buffer,cold.get(name).buffer);
      const rebuilt=await nalatiDressingPlacementProgram(context('b'));assert.equal(selectedLevel(),null);assert.equal(constructions,2);
      const predecessor=await prepareNalatiDressing();
      originals=Object.entries({...predecessor.plan,clutter:predecessor.clutter}).map(([group,rows])=>{
        const bytes=new TextEncoder().encode(JSON.stringify(rows)+'\\n');
        return{file:'dressing-'+group+'.json',bytes,hash:hashImmutableBytes(bytes)};
      });
      assert.equal(originals.length,18);check(originalCold);check(hit);check(rebuilt);
      const expected=Object.entries({...predecessor.plan,clutter:predecessor.clutter}).map(([key,native])=>{
        const rows=JSON.parse(JSON.stringify(native));
        return key==='stone'||key==='daisy'
          ?nameBlob('world/dressing-'+key+'.bin','bin',packDressingTable(rows))
          :nalatiDressingBlob('world/dressing-'+key+'.json','json',new TextEncoder().encode(encodeCanonicalJson(rows)));
      });
      const actual=nalatiDressingPlacementBlobs(originalCold);
      assert.deepEqual(actual.map(row=>row.file),expected.map(row=>row.file));
      for(const [i,row]of actual.entries())assert.equal(Buffer.compare(row.bytes,expected[i].bytes),0,row.file.name);
    }finally{rmSync(cache,{recursive:true,force:true});}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
});

test('missing native terrain and incomplete, extra or empty placement inventories refuse', async () => {
  await expect(nalatiDressingPlacementProgram({ cached: (_step, make) => Promise.resolve(make(new Map())) })).rejects.toThrow('Missing original Nalati dressing terrain');
  const names = ['boulder', 'slab', 'stone', 'juniper', 'rose', 'willow', 'lupin', 'daisy', 'reed', 'logs', 'stumps', 'ovoos', 'poles', 'fences', 'gates', 'drifts', 'colliders', 'clutter'];
  for (const files of [new Map<string, Uint8Array>(), new Map(names.map(name => [`dressing-${name}.json`, new Uint8Array()])),
    new Map([...names, 'extra'].map(name => [`dressing-${name}.json`, new Uint8Array([1])]))]) {
    await expect(nalatiDressingPlacementProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('placement inventory differs');
  }
});

test('the whole native placement producer stays in one publication-free author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingPlacementProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing dressing placement author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/scripts/bake-output.mjs'))).toBe(false);
  }
});
