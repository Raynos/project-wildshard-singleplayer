// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their immutable source/archive and outputs.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep source fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture-owned paths.
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { hydrateCheapGuardData } from '../scripts/hydrate-cheap-guard.mjs';

it('hydrates cheap JSON through its complete source producer and refuses missing outputs',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cheap-guard-fixture-'));
  const put=(file:string,text:string):void=>{mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),text);};
  const entry='src/shards/sample/generators/bake-behaviour.mjs', output='src/shards/sample/behaviour/script.json', binary='src/shards/sample/assets/script.bin';
  try {
    put('package.json','{"name":"fixture"}');put('source.txt','{"source":"immutable recipe"}');
    put(entry,`import{readFileSync,writeFileSync}from'node:fs';writeFileSync('${output}',readFileSync('source.txt'));writeFileSync('${binary}','compiled');`);
    const job={id:'sample',shard:'sample',entry,command:[entry],inputRoots:['package.json','source.txt',entry],outputs:[output,binary],platform:'portable',buildTimeOutputs:[output,binary]};
    put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
    await hydrateCheapGuardData(root);
    expect(JSON.parse(readFileSync(join(root,output),'utf8'))).toEqual({source:'immutable recipe'});
    rmSync(join(root,output));
    put(entry,"throw Error('producer refused');");
    await expect(hydrateCheapGuardData(root)).rejects.toThrow('Generator exited');
    put(entry,'// A no-op is not a complete producer.');
    await expect(hydrateCheapGuardData(root)).rejects.toThrow();
  } finally {rmSync(root,{recursive:true,force:true});}
});
