// oxlint-disable-next-line import/no-nodejs-modules -- Compare real original native preparation in an isolated process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete author bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

const native = ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs'];
const inputs = `
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';
  import { selectedLevel } from '@wildshard/engine/level/selection';
  import { prepareNalatiDressingInputs } from './src/shards/nalati-grasslands/generators/dressingInputs.ts';
  import { bakeNalatiDressingSource } from './src/shards/nalati-grasslands/generators/dressingSource.ts';
  import { hashImmutableBytes } from '@wildshard/sdk/immutable';
  const terrain=readFileSync('public/assets/baked/nalati-grasslands/terrain.bin');
  const blocks=new Map(['pond','red','green','blue','forest'].map(name=>{
    const file='data/geography-'+name+'.bin';
    return[file,readFileSync('src/shards/nalati-grasslands/'+file)];
  }));
  const hash=value=>hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value)));
`;

test('owned native inputs preserve complete sampled and continuous dressing before any page selection', () => {
  const source = `${inputs}
    import { prepareNalatiDressing } from './scripts/bake/nalatiDressing.mjs';
    import { inSpruceClearing,loneSpruceMask,edgeBermAt } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import { edgeSpruceMask } from './src/shards/nalati-grasslands/generators/edgeRecipe.ts';
    import { TIER_CONFIG } from '@wildshard/engine/core/tier';
    const phone=TIER_CONFIG.maxTexture<=1024;
    assert.equal(selectedLevel(),null);
    const beforeTerrain=hashImmutableBytes(terrain),beforeBlocks=[...blocks.values()].map(hashImmutableBytes);
    const results=[];
    for(const forest of ['sampled','continuous']){
      const input={terrain,scalarBlocks:blocks,forest,phone};
      const made=prepareNalatiDressingInputs(input),next=prepareNalatiDressingInputs(input);
      assert.equal(selectedLevel(),null);assert.notEqual(made.forest.trees,next.forest.trees);
      assert.notEqual(made.meadow.values,next.meadow.values);
      assert.equal(hash(made.forest.trees),hash(next.forest.trees));
      assert.equal(hashImmutableBytes(new Uint8Array(made.meadow.values.buffer)),hashImmutableBytes(new Uint8Array(next.meadow.values.buffer)));
      const result=await bakeNalatiDressingSource(made);
      assert.equal(hash(result),hash(await bakeNalatiDressingSource(next)));
      results.push(result);assert.equal(selectedLevel(),null);
    }
    assert.equal(hashImmutableBytes(terrain),beforeTerrain);
    assert.deepEqual([...blocks.values()].map(hashImmutableBytes),beforeBlocks);
    const continuous=(x,z)=>inSpruceClearing(x,z)?0:Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z)));
    for(const [index,mask] of [undefined,continuous].entries()){
      const predecessor=await prepareNalatiDressing(mask);
      assert.equal(hash(results[index]),hash(predecessor));
    }
  `;
  execFileSync(process.execPath, [...native, '--import', './scripts/generation-level.mjs', '--input-type=module', '--eval', source,
    '--', '--generation-shard=nalati-grasslands']);
});

test('input binding refuses foreign terrain, missing fields and malformed pond without a page fallback', () => {
  const source = `${inputs}
    import { zlibSync } from 'fflate';
    assert.equal(selectedLevel(),null);
    const base={terrain,scalarBlocks:blocks,forest:'sampled',phone:true};
    for(const name of ['pond','red','green','blue','forest']){
      const absent=new Map(blocks);absent.delete('data/geography-'+name+'.bin');
      assert.throws(()=>prepareNalatiDressingInputs({...base,scalarBlocks:absent}),/Missing scalar block/);
    }
    const foreign=Uint8Array.from(terrain);new DataView(foreign.buffer).setUint32(16,1,true);
    assert.throws(()=>prepareNalatiDressingInputs({...base,terrain:foreign}),/original Nalati/);
    assert.throws(()=>prepareNalatiDressingInputs({...base,terrain:new Uint8Array(0)}));
    assert.throws(()=>prepareNalatiDressingInputs({...base,forest:'unknown'}),/forest law/);
    const bad=new Map(blocks),pond=new Float32Array(256**2);pond[0]=2;
    bad.set('data/geography-pond.bin',zlibSync(new Uint8Array(pond.buffer)));
    assert.throws(()=>prepareNalatiDressingInputs({...base,scalarBlocks:bad}),/pond mask/);
    const noForest=new Map(blocks);noForest.delete('data/geography-forest.bin');
    const made=prepareNalatiDressingInputs({...base,scalarBlocks:noForest,forest:'continuous'});
    const before=hash(await bakeNalatiDressingSource(made));
    for(const bytes of noForest.values())bytes.fill(0);terrain.fill(0);
    assert.equal(hash(await bakeNalatiDressingSource(made)),before);
    assert.equal(selectedLevel(),null);
  `;
  execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source]);
});

test('the complete native input binding remains one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingInputs.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing native dressing input bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
