// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native map with a physical-public-input refusal.
import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

test('native map models preserve both full geometry pins without public painted inputs or repeated model reads', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    import { hashImmutableBytes } from './src/sdk/immutable.ts';
    const prior=fs.readFileSync, reads=new Map();
    fs.readFileSync=(path,...options)=>{
      const file=String(path).replaceAll('\\\\','/');
      assert.ok(!file.includes('/public/assets/nalati/baked/painted-models/'),'Unexpected public painted model read');
      assert.ok(!/data\\/dressing-[a-z]+\\.generated\\.json/.test(file),'Unexpected generated map dressing input');
      if(file.includes('/public/assets/nalati/models/'))reads.set(file,(reads.get(file)??0)+1);
      return prior(path,...options);
    };
    syncBuiltinESMExports();
    try{
      const {nalatiMapFiles}=await import('./src/shards/nalati-grasslands/generators/mapAssembly.mjs');
      const files=await nalatiMapFiles(path=>new Uint8Array(fs.readFileSync(process.cwd()+'/'+path)));
      const pins=JSON.parse(prior('test/fixtures/nalati-map-files.json','utf8'));
      assert.deepEqual([...files.keys()],['map/assembly.json','map/geometry.bin']);
      for(const [index,name]of ['map/assembly.json','map/geometry.bin'].entries()){
        const bytes=files.get(name),pin=pins[index];assert.ok(bytes);assert.ok(pin);
        assert.equal(bytes.length,pin.bytes);assert.equal(hashImmutableBytes(bytes),pin.hash);
      }
      assert.equal(reads.size,12);
      for(const [file,count]of reads)assert.equal(count,1,file);
    }finally{fs.readFileSync=prior;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});
