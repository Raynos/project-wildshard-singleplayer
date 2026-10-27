// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the owned native cover producer with physical input refusals.
import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

test('the cover producer preserves every original output without public painted models or repeated authored reads', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { resolve } from 'node:path';
    import { createHash } from 'node:crypto';
    import { syncBuiltinESMExports } from 'node:module';
    const prior=fs.readFileSync, reads=new Map();
    fs.readFileSync=(path,...options)=>{
      const file=String(path).replaceAll('\\\\','/');
      assert.ok(!file.includes('/public/assets/nalati/baked/painted-models/'),'Unexpected public painted model input');
      assert.ok(!/data\\/dressing-[a-z]+\\.generated\\.json/.test(file),'Unexpected generated contact placement input');
      if(file.includes('/public/assets/nalati/models/'))reads.set(file,(reads.get(file)??0)+1);
      return prior(path,...options);
    };
    syncBuiltinESMExports();
    try{
      const { COVER_INPUTS, coverBinName, nalatiCoverBake }=await import('./src/shards/nalati-grasslands/generators/coverBake.mjs');
      const inputs=new Map(), files=new Map();
      const made=await nalatiCoverBake(url=>{
        assert.ok(COVER_INPUTS.includes(url),'Undeclared cover input');
        const bytes=new Uint8Array(fs.readFileSync(resolve('public'+url)));inputs.set(url,bytes);return bytes;
      });
      const original=structuredClone(made.rows);
      for(const tier of ['phone','desktop']){
        const bank=made.bins.get(coverBinName(tier));assert.ok(bank,'Missing cover bank');
        files.set('public/assets/nalati/baked/cover-'+tier+'.bin',bank);
        assert.deepEqual(original[tier].packed.bin,{file:coverBinName(tier),bytes:bank.length});
        original[tier].packed.bin='/assets/nalati/baked/cover-'+tier+'.bin';
        for(const row of original[tier].catalogue){
          assert.equal(row.model.file,'src/shards/nalati-grasslands/generators/coverBake.mjs');
          row.model.file='src/shards/nalati-grasslands/generators/bake-cover.mjs';
        }
      }
      const json=new TextEncoder().encode(JSON.stringify(original,null,2)+'\\n');
      for(const folder of ['boot','data'])files.set('src/shards/nalati-grasslands/'+folder+'/cover.generated.json',json);
      for(const name of ['boulder-1','boulder-2','boulder-3']){
        const url='/assets/nalati/baked/cover-'+name+'.webp',bytes=inputs.get(url);assert.ok(bytes,'Missing verified cover atlas');
        files.set('public'+url,bytes);
      }
      const pins=JSON.parse(fs.readFileSync('test/fixtures/nalati-cover-files.json','utf8'));
      assert.deepEqual([...files.keys()].sort(),Object.keys(pins).sort());
      for(const [file,pin]of Object.entries(pins)){
        const bytes=files.get(file);assert.ok(bytes,'Missing original cover output '+file);
        assert.deepEqual({bytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex')},pin,file);
      }
      assert.equal(reads.size,6);for(const [file,count]of reads)assert.equal(count,1,file);
    }finally{fs.readFileSync=prior;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});
