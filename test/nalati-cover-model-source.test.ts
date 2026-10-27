// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native scripts with physical painted-model input refusals.
import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

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
