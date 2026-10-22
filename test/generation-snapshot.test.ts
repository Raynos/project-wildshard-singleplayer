// oxlint-disable-next-line import/no-nodejs-modules -- Owned local source/output fixtures.
import {mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,utimesSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture paths.
import {resolve} from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {InputHashMemo} from '../scripts/bake-input-hashes.mjs';
import {generateShardJob,generationInputs,prepareGeneration,verifiedPreparedGeneration} from '../scripts/generate.mjs';
import {linkNodeModules} from '../scripts/link-node-modules.mjs';
import {createDataMapPreparation} from '../scripts/bake-data-maps.mjs';
import {generationSnapshotIdentity,publishGenerationSnapshot,verifiedGenerationSnapshot} from '../scripts/generation-snapshot.mjs';

const owned:string[]=[];
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture() {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-snapshot-'));owned.push(root);
  mkdirSync(resolve(root,'source'));writeFileSync(resolve(root,'source/input.txt'),'input');writeFileSync(resolve(root,'source/output.txt'),'output');
  const memo=new InputHashMemo(root);memo.enableSnapshot(file=>file==='source/output.txt');generationInputs(root,['source'],memo);
  const receipt=resolve(root,'.cache/phase.json'),identity=generationSnapshotIdentity({runtime:'fixture',recipe:['producer']});
  publishGenerationSnapshot(receipt,identity,memo,{'source/output.txt':memo.hash('source/output.txt',true)});
  const valid=()=>{const current=new InputHashMemo(root);current.enableSnapshot(file=>file==='source/output.txt');return verifiedGenerationSnapshot(receipt,identity,current,['source/output.txt']);};
  return {root,receipt,identity,valid};
}
it('checks current source bytes, broad-root additions, output bytes and negative output evidence',()=>{
  const {root,valid}=fixture();expect(valid()).toBe(true);
  writeFileSync(resolve(root,'source/added.txt'),'new');expect(valid()).toBe(false);rmSync(resolve(root,'source/added.txt'));expect(valid()).toBe(true);
  const input=resolve(root,'source/input.txt'),before=statSync(input);writeFileSync(input,'other');utimesSync(input,before.atime,before.mtime);expect(valid()).toBe(false);
  writeFileSync(input,'input');expect(valid()).toBe(true);
  writeFileSync(resolve(root,'source/output.txt'),'edited');expect(valid()).toBe(false);
  rmSync(resolve(root,'source/output.txt'));expect(valid()).toBe(false);
  writeFileSync(resolve(root,'source/output.txt'),'output');expect(valid()).toBe(true);
});
it('refuses crossed roots, recipe changes, incomplete receipts and modified seals',()=>{
  const {root,receipt,identity,valid}=fixture(),other=fixture();
  expect(verifiedGenerationSnapshot(receipt,identity,new InputHashMemo(other.root),['source/output.txt'])).toBe(false);
  expect(verifiedGenerationSnapshot(receipt,identity,new InputHashMemo(root),['source/output.txt','missing.txt'])).toBe(false);
  expect(verifiedGenerationSnapshot(receipt,generationSnapshotIdentity({runtime:'changed'}),new InputHashMemo(root),['source/output.txt'])).toBe(false);
  const bytes=readFileSync(receipt,'utf8');writeFileSync(receipt,bytes.replace('output.txt','changed.txt'));expect(valid()).toBe(false);
  writeFileSync(receipt,'{}');expect(valid()).toBe(false);rmSync(receipt);expect(valid()).toBe(false);
});
it('refuses to publish changed source bytes or an unverified local output',()=>{
  const {root,receipt,identity}=fixture(),memo=new InputHashMemo(root);memo.enableSnapshot(file=>file==='source/output.txt');generationInputs(root,['source'],memo);
  const output=memo.hash('source/output.txt',true);writeFileSync(resolve(root,'source/input.txt'),'other');
  expect(()=>publishGenerationSnapshot(receipt,identity,memo,{'source/output.txt':output})).toThrow('Generation input changed');
  const fresh=new InputHashMemo(root);fresh.enableSnapshot(()=>false);
  expect(()=>publishGenerationSnapshot(receipt,identity,fresh,{'source/output.txt':'0'.repeat(64)})).toThrow('Generation input changed');
});
it('uses independently verified local outputs after cache eviction and regenerates altered outputs',async()=>{
  const {root}=fixture(),entry='src/shards/alpha/generators/bake-fixture.mjs',output='source/output.txt';
  mkdirSync(resolve(root,'scripts'));mkdirSync(resolve(root,'src/shards/alpha/generators'),{recursive:true});
  mkdirSync(resolve(root,'src/shards/alpha/look'));
  writeFileSync(resolve(root,'src/shards/alpha/shard.config.ts'),'export default {};');
  writeFileSync(resolve(root,'src/shards/alpha/look/map.json'),JSON.stringify({painter:{version:1,job:'fixture-local'}}));
  writeFileSync(resolve(root,entry),`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('source/input.txt'));`);
  const job={id:'fixture-local',shard:'alpha',entry,command:[entry],inputRoots:['source','src/shards/alpha'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  writeFileSync(resolve(root,'scripts/generation-jobs.json'),JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  writeFileSync(resolve(root,'scripts/source-generation-outputs.json'),JSON.stringify({producers:{'scripts/gen-shards.mjs':['src/shards/alpha/discovery.generated.ts']}}));
  const cacheDir=resolve(root,'cache'),log=vi.spyOn(console,'info').mockImplementation(()=>{ /* Observe actual phase path. */ });
  await prepareGeneration(root,{cacheDir});rmSync(cacheDir,{recursive:true});
  log.mockClear();await prepareGeneration(root,{cacheDir});
  expect(log.mock.calls.some(row=>String(row[0]).includes('verified snapshot'))).toBe(true);
  expect(readFileSync(resolve(root,output),'utf8')).toBe('input');
  writeFileSync(resolve(root,'src/shards/alpha/discovery.generated.ts'),'later generated discovery');
  vi.stubEnv('WILDSHARD_GENERATE_CACHE',cacheDir);
  const generate=vi.spyOn(await import('../scripts/generate.mjs'),'generateShardJob'),prepareMaps=createDataMapPreparation(root);
  await prepareMaps(['alpha']);await prepareMaps(['alpha']);expect(generate).not.toHaveBeenCalled();
  writeFileSync(resolve(root,output),'wrong');
  await createDataMapPreparation(root)(['alpha']);expect(generate).toHaveBeenCalledOnce();
  expect(readFileSync(resolve(root,output),'utf8')).toBe('input');
  generate.mockClear();
  rmSync(cacheDir,{recursive:true});
  writeFileSync(resolve(root,output),'wrong');log.mockClear();await prepareGeneration(root,{cacheDir});
  expect(log.mock.calls.some(row=>String(row[0]).includes(', generated,'))).toBe(true);
  expect(readFileSync(resolve(root,output),'utf8')).toBe('input');
});
it('stages the snapshot helper for cold producers importing generation infrastructure',async()=>{
  const {root}=fixture(),entry='src/shards/alpha/generators/bake-import.mjs',output='source/output.txt';
  mkdirSync(resolve(root,'scripts'));mkdirSync(resolve(root,'src/shards/alpha/generators'),{recursive:true});
  writeFileSync(resolve(root,'scripts/generation-snapshot.mjs'),readFileSync('scripts/generation-snapshot.mjs'));
  writeFileSync(resolve(root,entry),`import fs from 'node:fs';import {generationSnapshotIdentity} from '../../../../scripts/generation-snapshot.mjs';fs.writeFileSync('${output}',generationSnapshotIdentity('staged'));`);
  writeFileSync(resolve(root,'scripts/generation-jobs.json'),'{}');linkNodeModules(resolve('.'),root);
  const result=await generateShardJob(root,{id:'fixture-import',shard:'alpha',entry,command:[entry],inputRoots:['src/shards/alpha'],outputs:[output],buildTimeOutputs:[output],platform:'portable'},{cacheDir:resolve(root,'cache'),restore:true});
  try {expect(readFileSync(resolve(root,output),'utf8')).toBe(generationSnapshotIdentity('staged'));}
  finally {result.release();}
});


it('keeps cold-phase discovery out of negative inventories but retains ordinary and explicit source inputs',async()=>{
  const {root}=fixture(),entry='src/shards/alpha/generators/bake-fixture.mjs',output='source/output.txt';
  const discovery='src/shards/alpha/discovery.generated.ts',other='src/shards/alpha/retained.generated.ts';
  mkdirSync(resolve(root,'scripts'));mkdirSync(resolve(root,'src/shards/alpha/generators'),{recursive:true});
  writeFileSync(resolve(root,entry),`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('source/input.txt'));`);
  writeFileSync(resolve(root,other),'original retained producer');
  writeFileSync(resolve(root,'scripts/source-generation-outputs.json'),JSON.stringify({producers:{
    'scripts/gen-shards.mjs':[discovery],'other-producer.mjs':[other]}}));
  const job={id:'fixture-discovery',shard:'alpha',entry,command:[entry],inputRoots:['source','src/shards/alpha'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  const catalogue=resolve(root,'scripts/generation-jobs.json');
  writeFileSync(catalogue,JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  const cacheDir=resolve(root,'cache');await prepareGeneration(root,{cacheDir});
  expect(verifiedPreparedGeneration(root)).toBe(true);
  writeFileSync(resolve(root,discovery),'later discovery module');
  expect(verifiedPreparedGeneration(root)).toBe(true);
  writeFileSync(resolve(root,other),'changed retained producer');
  expect(verifiedPreparedGeneration(root)).toBe(false);
  writeFileSync(resolve(root,other),'original retained producer');
  writeFileSync(resolve(root,'src/shards/alpha/ordinary.ts'),'new real source');
  expect(verifiedPreparedGeneration(root)).toBe(false);
  rmSync(resolve(root,'src/shards/alpha/ordinary.ts'));
  // A separate producer that explicitly declares discovery keeps exact bytes.
  const explicit=fixture().root;
  mkdirSync(resolve(explicit,'scripts'));mkdirSync(resolve(explicit,'src/shards/alpha/generators'),{recursive:true});
  writeFileSync(resolve(explicit,entry),readFileSync(resolve(root,entry)));
  writeFileSync(resolve(explicit,discovery),'explicit source');
  writeFileSync(resolve(explicit,'scripts/source-generation-outputs.json'),JSON.stringify({producers:{'scripts/gen-shards.mjs':[discovery]}}));
  writeFileSync(resolve(explicit,'scripts/generation-jobs.json'),JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[{...job,inputRoots:[...job.inputRoots,discovery]}]}));
  await prepareGeneration(explicit,{cacheDir});expect(verifiedPreparedGeneration(explicit)).toBe(true);
  writeFileSync(resolve(explicit,discovery),'changed explicit source');
  expect(verifiedPreparedGeneration(explicit)).toBe(false);
});
