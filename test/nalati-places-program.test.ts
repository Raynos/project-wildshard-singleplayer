import {originalGeographyFiles} from './fixtures/nalati-geography-original';
// oxlint-disable-next-line import/no-nodejs-modules -- Run original native arithmetic in an isolated process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the defining source bundle for the config guard.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiPlacesProgram } from '../src/shards/nalati-grasslands/generators/placesProgram';

function runOwnedPlaceCheck(checks: string): void {
  const source = `
    import assert from 'node:assert/strict';
    import { mkdtempSync,rmSync } from 'node:fs';
    import { resolve } from 'node:path';
    import { createProjectGeneration } from './src/sdk/projectGeneration.ts';
    import { encodeBuildBytes } from './src/sdk/bake/byteCodec.ts';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { nalatiPlacesProgram } from './src/shards/nalati-grasslands/generators/placesProgram.ts';
    assert.equal(selectedLevel(),null);
    const cache=mkdtempSync(resolve('tmp/nalati-places-owned-'));
    let constructions=0,compressions=0,geographies=0,shippingBakes=0;
    const context=(memo=false)=>{
      const context=createProjectGeneration(resolve('src/shards/nalati-grasslands'),'a'.repeat(64),new Map(),cache,
        [{prefix:'/assets/baked/nalati-grasslands/',directory:resolve('public/assets/baked/nalati-grasslands')}]);
      // the exact bake (the pins'), under its own step since cd955cd8d9 shipped the I3 one as 'places'
      return{...context,...(memo?{encodeZstdBytes:(bytes,level)=>{
        assert.equal(level,19);compressions++;const result=encodeBuildBytes(bytes,'zstd',level);
        const memoized=context.encodeZstdBytes(bytes,level);
        assert.equal(Buffer.compare(result,memoized),0);return memoized;
      }}:{encodeZstdBytes:undefined}),cached:(step,make)=>{
        // Only the codec variants need different place slots. Geography keeps
        // the same complete program/input key instead of being rebuilt.
        const selected=memo&&step.id==='places'?{...step,id:'places-memo'}:step;
        return context.cached(selected,inputs=>{
          if(step.id==='places-exact')constructions++;
          if(step.id==='geography')geographies++;
          if(step.id==='places')shippingBakes++;
          return make(inputs);
        });
      }};
    };
    try{${checks}}finally{rmSync(cache,{recursive:true,force:true});}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
}

test('fresh owned places stay service-free and cache hits isolate caller mutations', () => {
  runOwnedPlaceCheck(`
      const cold=await nalatiPlacesProgram(context());assert.equal(selectedLevel(),null);
      const before=new Map([...cold].map(([name,bytes])=>[name,bytes.slice()]));
      for(const bytes of cold.values())bytes.fill(0);
      const hit=await nalatiPlacesProgram(context());assert.equal(selectedLevel(),null);
      assert.equal(constructions,1);
      assert.deepEqual([...hit.keys()],[...before.keys()]);
      for(const [name,bytes] of hit){assert.notEqual(bytes,cold.get(name));assert.equal(Buffer.compare(bytes,before.get(name)),0);}
  `);
});

test('shipping places preserve every byte with the original and memoized codecs', () => {
  runOwnedPlaceCheck(`
      const fallback=await nalatiPlacesProgram(context(),'i3');
      const shipping=await nalatiPlacesProgram(context(true),'i3');
      assert.equal(compressions,1);assert.equal(selectedLevel(),null);
      const shippingHit=await nalatiPlacesProgram(context(true),'i3');
      assert.equal(compressions,1);
      for(const [name,bytes] of shippingHit)assert.equal(Buffer.compare(bytes,shipping.get(name)),0);
      assert.deepEqual([...shipping.keys()],[...fallback.keys()]);
      for(const [name,bytes] of shipping)assert.equal(Buffer.compare(bytes,fallback.get(name)),0);
      assert.equal(geographies,1);assert.equal(shippingBakes,2);
  `);
});

test('missing terrain and incomplete or extra cached outputs refuse', async () => {
  await expect(nalatiPlacesProgram({ cached: (step, make) => step.id==='geography'?Promise.resolve(originalGeographyFiles()):Promise.resolve(make(new Map())) })).rejects.toThrow('Missing original Nalati placement terrain');
  await expect(nalatiPlacesProgram({ cached: step => Promise.resolve(step.id==='geography'?originalGeographyFiles():new Map()) })).rejects.toThrow('Owned Nalati placement inventory differs');
  const names = ['places.bin', 'places.json', 'specimens.bin', 'placeSpecimens.json', 'placeParts.json', 'actor:balbal:0:2977.bin', 'actor:balbal:1:2977.bin', 'actor:goat.bin'];
  for (const files of [new Map(names.map(name => [name, new Uint8Array()])), new Map([...names, 'extra'].map(name => [name, new Uint8Array([1])]))]) {
    await expect(nalatiPlacesProgram({ cached: step => Promise.resolve(step.id==='geography'?originalGeographyFiles():files) })).rejects.toThrow('Owned Nalati placement inventory differs');
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
