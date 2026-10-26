// oxlint-disable-next-line import/no-nodejs-modules -- Run original native arithmetic in an isolated process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the defining source bundle for the config guard.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiPlacesProgram } from '../src/shards/nalati-grasslands/generators/placesProgram';

test('fresh owned places retain native bytes and metadata with detached cache hits', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
    import { resolve } from 'node:path';
    import { createProjectGeneration } from './src/sdk/projectGeneration.ts';
    import { hashImmutableBytes } from './src/sdk/immutable.ts';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { nalatiPlacesProgram } from './src/shards/nalati-grasslands/generators/placesProgram.ts';
    import { alike } from './src/shards/nalati-grasslands/generators/bake-nalati-places.mjs';
    assert.equal(selectedLevel(),null);
    const cache=mkdtempSync(resolve('tmp/nalati-places-owned-'));
    let constructions=0;
    const context=()=>{
      const context=createProjectGeneration(resolve('src/shards/nalati-grasslands'),'a'.repeat(64),new Map(),cache,
        [{prefix:'/assets/baked/nalati-grasslands/',directory:resolve('public/assets/baked/nalati-grasslands')}]);
      return{...context,cached:(step,make)=>context.cached(step,inputs=>{constructions++;return make(inputs);})};
    };
    const pins=JSON.parse(readFileSync('test/fixtures/nalati-place-wires.json','utf8'));
    const check=files=>{
      assert.deepEqual([...files.keys()].sort(),['placeSpecimens.json','places.bin','places.json','specimens.bin']);
      for(const [name,file] of [['places','places.json'],['specimens','placeSpecimens.json']]){
        const binary=files.get(name+'.bin'),document=files.get(file);
        const pin=pins.find(row=>row.path==='public/assets/nalati/baked/'+name+'.bin');
        assert.equal(binary.length,pin.bytes);assert.equal(hashImmutableBytes(binary),pin.hash);
        const original=readFileSync('src/shards/nalati-grasslands/data/'+file);
        const jsonPin=pins.find(row=>row.path==='src/shards/nalati-grasslands/data/'+file);
        assert.equal(original.length,jsonPin.bytes);assert.equal(hashImmutableBytes(original),jsonPin.hash);
        const actual=JSON.parse(new TextDecoder().decode(document)),expected=JSON.parse(original);
        assert.equal(alike(expected,actual,name,()=>false),null);
        assert.notEqual(alike(expected,{...actual,rows:actual.rows.slice(1)},name,()=>false),null);
      }
    };
    try{
      const cold=await nalatiPlacesProgram(context());check(cold);assert.equal(selectedLevel(),null);
      const hashes=new Map([...cold].map(([name,bytes])=>[name,hashImmutableBytes(bytes)]));
      for(const bytes of cold.values())bytes.fill(0);
      const hit=await nalatiPlacesProgram(context());check(hit);assert.equal(selectedLevel(),null);
      assert.equal(constructions,1);
      for(const [name,bytes] of hit)assert.equal(hashImmutableBytes(bytes),hashes.get(name));
    }finally{rmSync(cache,{recursive:true,force:true});}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
});

test('missing terrain and incomplete or extra cached outputs refuse', async () => {
  await expect(nalatiPlacesProgram({ cached: (_step, make) => Promise.resolve(make(new Map())) })).rejects.toThrow('Missing original Nalati placement terrain');
  await expect(nalatiPlacesProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('Owned Nalati placement inventory differs');
  const names = ['places.bin', 'places.json', 'specimens.bin', 'placeSpecimens.json'];
  for (const files of [new Map(names.map(name => [name, new Uint8Array()])), new Map([...names, 'extra'].map(name => [name, new Uint8Array([1])]))]) {
    await expect(nalatiPlacesProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Owned Nalati placement inventory differs');
  }
});

test('the owned construction source is one config-safe chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/placesProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing owned places source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
