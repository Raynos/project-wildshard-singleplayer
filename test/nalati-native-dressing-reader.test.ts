// oxlint-disable-next-line import/no-nodejs-modules -- Observe real native file intake without allowing a generated-row fallback.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe the keep-outs' native file intake.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { nativeNalatiDressingPlacements } from '../src/shards/nalati-grasslands/generators/nativeDressingPlacements.mjs';

test('native Node authors preserve every original continuous-forest placement with no generated-row reads or page selection', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    import {selectedLevel} from '@wildshard/engine/level/selection';
    import {originalGeographyFiles} from './test/fixtures/nalati-geography-original.ts';
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
      assert.equal(reads.size,1);for(const [file,count]of reads)assert.equal(count,1,file);
      const again=await nativeNalatiDressingPlacements(file=>fs.readFileSync(file));assert.equal(selectedLevel(),null);
      for(const [name,bytes]of files){assert.equal(Buffer.compare(bytes,again.get(name)),0,name);assert.notEqual(bytes.buffer,again.get(name).buffer);}
      const {prepareNalatiDressing}=await import('./scripts/bake/nalatiDressing.mjs');
      const {inSpruceClearing,loneSpruceMask,edgeBermAt}=await import('./src/shards/nalati-grasslands/generators/terrainRecipe.ts');
      const {edgeSpruceMask}=await import('./src/shards/nalati-grasslands/generators/edgeRecipe.ts');
      // QF24 (2c1ad0bbcc): LEGACY's continuous spruce mask, not the 256 lattice
      const before=await prepareNalatiDressing((x,z)=>inSpruceClearing(x,z)?0:Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z))),originalGeographyFiles());
      for(const [group,rows]of Object.entries({...before.plan,clutter:before.clutter})){
        const name='dressing-'+group+'.json',expected=Buffer.from(JSON.stringify(rows)+'\\n'),actual=files.get(name);
        assert.ok(actual,name);assert.equal(actual.length,expected.length,name);assert.equal(Buffer.compare(actual,expected),0,name);
      }
    }finally{fs.readFileSync=originalRead;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
});

test('the grass keep-outs read only the native lattice, never generated dressing rows', async () => {
  const reads: string[] = [];
  await nativeNalatiDressingPlacements(file => { reads.push(file); return new Uint8Array(readFileSync(file)); });
  expect(reads).toEqual(['public/assets/baked/nalati-grasslands/terrain.bin']);
});
