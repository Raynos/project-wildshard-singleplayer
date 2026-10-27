// oxlint-disable-next-line import/no-nodejs-modules -- Exercise persistent native cache isolation in the real author loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining author entry for its capability boundary.
import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, test } from 'vitest';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiSpeciesProgram } from '../src/shards/nalati-grasslands/generators/speciesProgram';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { compileReturnProjectionV2 } from '../src/sdk/returnProjectionV2';
import { NALATI_ADMISSION_PROGRAM } from './fixtures/nalati-admission';

test('cold, persistent and rebuilt species preserve all five original files and detached loans', () => {
  const source = `
    import assert from 'node:assert/strict';
    import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
    import {resolve} from 'node:path';
    import * as v from 'valibot';
    import {CreatureGuestSchema} from './src/format/speciesBookRows.ts';
    import {readDecisionSources} from './src/sdk/buildDecisionScripts.ts';
    import {createProjectGeneration} from './src/sdk/projectGeneration.ts';
    import {hashImmutableBytes} from './src/sdk/immutable.ts';
    import {nalatiSpeciesProgram} from './src/shards/nalati-grasslands/generators/speciesProgram.ts';
    import {originalSpeciesFile} from './test/fixtures/nalati-original-species.ts';
    const pins=JSON.parse(readFileSync('test/fixtures/nalati-species-files.json','utf8'));
    const names=['species.json','bodies.bin','boot.json','held-weapons.wasm','held-witness.bin'];
    const cache=mkdtempSync(resolve('tmp/nalati-species-program-'));
    const inputs=[],steps=[],admissionSteps=[];let constructions=0,admissions=0;
    const context=hash=>{
      const real=createProjectGeneration(resolve('src/shards/nalati-grasslands'),hash.repeat(64),new Map(),cache,
        [{prefix:'/assets/nalati/baked/',directory:resolve('public/assets/nalati/baked')}]);
      return {compileDecisionRows:real.compileDecisionRows,compileReturnProjection:real.compileReturnProjection,cached:(step,make)=>{
        inputs.push(...step.inputs);(step.id==='species'?steps:admissionSteps).push(step);
        return real.cached(step,bytes=>{if(step.id==='species')constructions++;else admissions++;return make(bytes);});
      }};
    };
    const build=ctx=>nalatiSpeciesProgram(ctx,value=>value,value=>v.parse(CreatureGuestSchema,value),hash=>'/assets/nalati/baked/bodies-'+hash+'.bin');
    const check=files=>{
      assert.equal(files.size,5);
      for(const [i,pin]of pins.entries()){
        const bytes=files.get(names[i]);assert.ok(bytes,pin.path);
        assert.equal(bytes.length,pin.bytes,pin.path);assert.equal(hashImmutableBytes(bytes),pin.sha256,pin.path);
        assert.equal(Buffer.compare(bytes,originalSpeciesFile(names[i])),0,pin.path);
      }
    };
    try{
      const cold=await build(context('a'));check(cold);assert.equal(constructions,1);assert.equal(admissions,1);
      const before=new Map([...cold].map(([name,bytes])=>[name,bytes.slice()]));
      for(const bytes of cold.values())bytes.fill(0);
      const warm=await build(context('a'));check(warm);assert.equal(constructions,1);assert.equal(admissions,1);
      for(const [name,bytes]of warm)assert.notEqual(bytes.buffer,cold.get(name).buffer);
      check(await build(context('b')));assert.equal(constructions,2);assert.equal(admissions,2);check(before);
      assert.deepEqual(steps.map(step=>[step.id,step.native]),[['species',true],['species',true],['species',true]]);
      assert.deepEqual(admissionSteps.map(step=>[step.id,step.native]),[['admission-program',true],['admission-program',true],['admission-program',true]]);
      const authored=[...readDecisionSources('src/shards/nalati-grasslands').keys()].sort();
      assert.deepEqual(steps[0].inputs.filter(name=>name.endsWith('.as')).sort(),authored);
      for(const name of ['data/species.generated.json','boot/speciesRows.generated.json','behaviour/held-weapons.generated.wasm','behaviour/held-witness.generated.bin'])assert.ok(!inputs.includes(name),name);
      const noCompiler=context('c');delete noCompiler.compileReturnProjection;
      await assert.rejects(build(noCompiler),/Admission requires injected decision and projection compilers/);
      const noDecision=context('d');delete noDecision.compileDecisionRows;
      await assert.rejects(build(noDecision),/Admission requires injected decision and projection compilers/);
      // All complete pinned originals remain available: an omitted raw or authored input must still refuse.
      for(const omitted of ['/assets/nalati/baked/bodies.bin','behaviour/heldWeapons.as','data/bodies.json']){
        const supplied=context('a');
        await assert.rejects(build({...supplied,cached:async(step,make)=>{
          if(step.id!=='species')return supplied.cached(step,make);
          const bytes=new Map(step.inputs.filter(name=>name!==omitted).map(name=>[name,readFileSync(name.startsWith('/')?'public'+name:'src/shards/nalati-grasslands/'+name)]));
          return make(bytes);
        }}),/Missing original species input/);
      }
    }finally{rmSync(cache,{recursive:true,force:true});}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});

test('empty, partial, extra and empty-byte persistent species inventories refuse before admission', async () => {
  const names = ['species.json', 'boot.json', 'bodies.bin', 'held-weapons.wasm', 'held-witness.bin'];
  const admit = (): never => { throw new Error('Unexpected source admission on cache hit'); };
  for (const files of [new Map<string, Uint8Array>(), new Map(names.slice(1).map(name => [name, new Uint8Array([1])])),
    new Map([...names, 'extra'].map(name => [name, new Uint8Array([1])])), new Map(names.map(name => [name, new Uint8Array()]))]) {
    const admission = new Map([['admission.json', new TextEncoder().encode(JSON.stringify(NALATI_ADMISSION_PROGRAM.program))],
      ['admission.wasm', NALATI_ADMISSION_PROGRAM.wasm], ['admission-witness.bin', NALATI_ADMISSION_PROGRAM.witness]]);
    await expect(nalatiSpeciesProgram({ compileDecisionRows: compileDecisionScripts,
      compileReturnProjection: compileReturnProjectionV2,
      cached: step => Promise.resolve(step.id === 'admission-program' ? admission : files),
    }, admit, admit, admit)).rejects.toThrow('Owned species inventory differs');
  }
});

test('the species reader author bundle has no compiler or filesystem dependency', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/speciesProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing species reader author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect(Object.keys(chunk.modules).some(path => /assemblyscriptCompiler|buildDecisionScripts|bake-output/u.test(path))).toBe(false);
  }
});
