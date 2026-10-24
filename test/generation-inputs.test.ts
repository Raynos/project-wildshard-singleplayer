// oxlint-disable-next-line import/no-nodejs-modules -- Owned source/cache fixtures.
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,unlinkSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bounded fixture paths.
import {dirname,resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Reseal old/malformed owned observations to exercise version validation.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {afterEach,expect,it} from 'vitest';
import {generateShardJob,prepareGeneration,verifiedPreparedGeneration} from '../scripts/generate.mjs';
import {runObservedGeneration,generationReadReceipt,generationWorkspaceIdentity} from '../scripts/generation-inputs.mjs';
import {generationDependencies} from '../scripts/generation-dependencies.mjs';
import type {GenerationPreparation,ShardGenerationJob} from '../scripts/generate.d.mts';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function put(root:string,file:string,text:string):void {mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);}
function fixture(source?:string,catalogPath='scripts/generation-jobs.json') {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-inputs-'));owned.push(root);
  const entry='src/shards/alpha/generators/bake-reader.mjs',output='src/shards/alpha/data/output.txt';
  put(root,entry,source??`import {value} from '../../../sdk/used.mjs';import fs from 'node:fs';fs.writeFileSync('${output}',String(value));`);
  put(root,'package.json',JSON.stringify({type:'module'}));
  put(root,'src/sdk/used.mjs','export const value=1;');put(root,'src/sdk/unread.ts','// unrelated source');
  for(const name of ['generation-recorder.mjs','shardfile-inputs.mjs','shardfile-cache.mjs','compiler-code.mjs','function-source.mjs','bake-input-hashes.mjs']) {
    mkdirSync(resolve(root,'scripts'),{recursive:true});copyFileSync(resolve('scripts',name),resolve(root,'scripts',name));
  }
  mkdirSync(resolve(root,'node_modules'));symlinkSync(realpathSync(resolve('node_modules/valibot')),resolve(root,'node_modules/valibot'));
  const job:ShardGenerationJob={id:'fixture-reader',shard:'alpha',entry,command:[entry],inputRoots:['src/shards/alpha','src/sdk'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  put(root,catalogPath,JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  const cacheDir=resolve(root,'cache');
  const run=async(forceCompare=false,preparation?:GenerationPreparation)=>{
    const result=await generateShardJob(root,job,{cacheDir,forceCompare,catalogPath,...(preparation===undefined?{}:{preparation})});
    try {return {hit:result.hit,key:result.key,text:readFileSync(resolve(result.directory,output),'utf8')};}
    finally {result.release();}
  };
  return {root,entry,output,cacheDir,job,run};
}
function packageFixture(source?:string) {
  const row=fixture(source??`import {value} from '@wildshard/sdk/used';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  put(row.root,'src/sdk/other.mjs','export const value=2;');
  const write=(exports:Record<string,unknown>,metadata:Record<string,unknown>={}):void=>put(row.root,'src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',type:'module',...metadata,exports}));
  write({'./used':'./used.mjs','./unused':'./other.mjs'});
  mkdirSync(resolve(row.root,'node_modules/@wildshard'),{recursive:true});
  symlinkSync('../../src/sdk',resolve(row.root,'node_modules/@wildshard/sdk'),'dir');
  return {...row,write};
}
/** Upstream outputs exist only in their immutable producer loan, never in the
 * reader checkout. Its private source data is outside the reader's roots. */
function upstreamFixture(source?:string,workspace=false) {
  const row=workspace?packageFixture(source):fixture(source),entry='src/shards/alpha/generators/bake-upstream.mjs',values='src/commons/upstream.json';
  put(row.root,entry,`import fs from 'node:fs';for(const [name,value]of Object.entries(JSON.parse(fs.readFileSync('${values}','utf8'))))fs.writeFileSync('src/shards/alpha/data/'+name,value);`);
  const run=async(contents:Record<string,string>)=>{
    put(row.root,values,JSON.stringify(contents));
    const outputs=Object.keys(contents).map(name=>`src/shards/alpha/data/${name}`);
    const producer:ShardGenerationJob={id:'fixture-upstream',shard:'alpha',entry,command:[entry],inputRoots:[entry,values],outputs,buildTimeOutputs:outputs,platform:'portable'};
    put(row.root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[producer,row.job]}));
    const loan=await generateShardJob(row.root,producer,{cacheDir:row.cacheDir});
    try {
      return await row.run(false,{outputs:[...outputs,...row.job.outputs],upstream:new Map([[producer.id,loan]])});
    } finally {loan.release();}
  };
  return {...row,upstream:run};
}
function thirdPartyFixture() {
  const f=upstreamFixture("import {value} from 'fixture-dep';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  const sri=(value:string)=>`sha512-${createHash('sha512').update(value).digest('base64')}`;
  const lock=`lockfileVersion: '9.0'\n\npackages:\n\n  fixture-dep@1.0.0:\n    resolution: {integrity: ${sri('first registry archive')}}\n\n  fixture-dep@2.0.0:\n    resolution: {integrity: ${sri('second registry archive')}}\n\nsnapshots:\n`;
  put(f.root,'pnpm-lock.yaml',lock);put(f.root,'node_modules/.pnpm/lock.yaml',lock);
  const target=(version:string)=>`node_modules/.pnpm/fixture-dep@${version}/node_modules/fixture-dep`;
  for(const[version,value]of [['1.0.0',7],['2.0.0',9]]) {
    const pkg=target(String(version));
    put(f.root,`${pkg}/package.json`,JSON.stringify({name:'fixture-dep',version,type:'module',exports:'./module.mjs'}));
    put(f.root,`${pkg}/module.mjs`,`export const value=${String(value)};`);
  }
  const link=resolve(f.root,'node_modules/fixture-dep');symlinkSync(resolve(f.root,target('1.0.0')),link,'dir');
  return {...f,link,target};
}
it('models verified third-party probes without unrelated source filename fences',async()=>{
  const f=thirdPartyFixture(),first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('7');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
});
it('models verified third-party relative imports independently of the staging depth',async()=>{
  const f=thirdPartyFixture();
  put(f.root,`${f.target('1.0.0')}/module.mjs`,"import {value} from './other.mjs';export {value};");
  put(f.root,`${f.target('1.0.0')}/other.mjs`,'export const value=7;');
  const first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('7');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,`${f.target('1.0.0')}/other.mjs`,'export const value=11;');
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'11'});
});
it('models only physical store roots already verified by an installed package alias',()=>{
  const f=thirdPartyFixture(),lock=createHash('sha256').update(readFileSync(resolve(f.root,'pnpm-lock.yaml'))).digest('hex');
  const dependencies=generationDependencies(f.root,lock);
  expect(dependencies.probe(`${f.target('1.0.0')}/module.mjs`)).toBeDefined();
  expect(dependencies.probe(`${f.target('2.0.0')}/module.mjs`)).toBeUndefined();
  const physical=resolve(f.root,f.target('1.0.0'));rmSync(physical,{recursive:true});symlinkSync(resolve(f.root,f.target('2.0.0')),physical,'dir');
  expect(generationDependencies(f.root,lock).probe(`${f.target('1.0.0')}/module.mjs`)).toBeUndefined();
});
it('models a verified dependency installed under a workspace package',async()=>{
  const f=thirdPartyFixture();
  put(f.root,f.entry,`import {value} from '../../../sdk/used.mjs';import fs from 'node:fs';fs.writeFileSync('${f.output}',String(value));`);
  put(f.root,'src/sdk/used.mjs',"import {value} from 'fixture-dep';export {value};");
  mkdirSync(resolve(f.root,'src/sdk/node_modules'),{recursive:true});symlinkSync(resolve(f.root,f.target('1.0.0')),resolve(f.root,'src/sdk/node_modules/fixture-dep'),'dir');unlinkSync(f.link);
  const first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('7');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
});
it('verifies scoped package names and store paths without a scope-wide exemption',()=>{
  const f=thirdPartyFixture(),lock=readFileSync(resolve(f.root,'pnpm-lock.yaml'),'utf8').replaceAll('fixture-dep@',"'@fixture/dep@").replaceAll(':\n    resolution',"':\n    resolution");
  put(f.root,'pnpm-lock.yaml',lock);put(f.root,'node_modules/.pnpm/lock.yaml',lock);
  const pkg='node_modules/.pnpm/@fixture+dep@1.0.0/node_modules/@fixture/dep';
  put(f.root,`${pkg}/package.json`,JSON.stringify({name:'@fixture/dep',version:'1.0.0'}));put(f.root,`${pkg}/module.mjs`,'export const value=7;');
  mkdirSync(resolve(f.root,'node_modules/@fixture'));symlinkSync(resolve(f.root,pkg),resolve(f.root,'node_modules/@fixture/dep'),'dir');
  const dependencies=generationDependencies(f.root,createHash('sha256').update(lock).digest('hex'));
  expect(dependencies.probe('node_modules/@fixture/dep/module.mjs')).toContain('"name":"@fixture/dep"');
  expect(dependencies.probe('node_modules/@fixture/unregistered/module.mjs')).toBeUndefined();
  mkdirSync(resolve(f.root,'installed-scope'));symlinkSync(resolve(f.root,pkg),resolve(f.root,'installed-scope/dep'),'dir');
  rmSync(resolve(f.root,'node_modules/@fixture'),{recursive:true});symlinkSync(resolve(f.root,'installed-scope'),resolve(f.root,'node_modules/@fixture'),'dir');
  expect(generationDependencies(f.root,createHash('sha256').update(lock).digest('hex')).probe('node_modules/@fixture/dep/module.mjs')).toContain('"name":"@fixture/dep"');
});
it('invalidates a retargeted third-party alias before returning full cache bytes',async()=>{
  const f=thirdPartyFixture();expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'7'});
  unlinkSync(f.link);symlinkSync(resolve(f.root,f.target('2.0.0')),f.link,'dir');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'9'});
});
it('invalidates changed installed file bytes even when the version and integrity are unchanged',async()=>{
  const f=thirdPartyFixture();expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'7'});
  put(f.root,`${f.target('1.0.0')}/module.mjs`,'export const value=11;');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'11'});
});
it('does not resurrect full cache bytes when an installed file link escapes its package',async()=>{
  const f=thirdPartyFixture();expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'7'});
  const module=resolve(f.root,f.target('1.0.0'),'module.mjs');unlinkSync(module);symlinkSync(resolve(f.root,f.target('2.0.0'),'module.mjs'),module);
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'9'});
  put(f.root,`${f.target('2.0.0')}/module.mjs`,'export const value=13;');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'13'});
});
it.each(['missing-lock','integrity','name','version','outside-store'])('keeps unverified third-party %s behind the complete fence',async kind=>{
  const f=thirdPartyFixture();
  if(kind==='missing-lock')rmSync(resolve(f.root,'pnpm-lock.yaml'));
  else if(kind==='integrity')put(f.root,'node_modules/.pnpm/lock.yaml',readFileSync(resolve(f.root,'pnpm-lock.yaml'),'utf8').replace('sha512-','sha256-'));
  else if(kind==='outside-store') {
    put(f.root,'node_modules/loose-dep/package.json',JSON.stringify({name:'fixture-dep',version:'1.0.0',type:'module',exports:'./module.mjs'}));
    put(f.root,'node_modules/loose-dep/module.mjs','export const value=7;');unlinkSync(f.link);symlinkSync(resolve(f.root,'node_modules/loose-dep'),f.link,'dir');
  }else put(f.root,`${f.target('1.0.0')}/package.json`,JSON.stringify({name:kind==='name'?'other-dep':'fixture-dep',version:kind==='version'?'9.0.0':'1.0.0',type:'module',exports:'./module.mjs'}));
  const first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('7');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'7'});
});
it('does not trust duplicated or unsupported package resolution records',()=>{
  const f=thirdPartyFixture(),lock=readFileSync(resolve(f.root,'pnpm-lock.yaml'),'utf8');
  const probe=()=>generationDependencies(f.root,createHash('sha256').update(readFileSync(resolve(f.root,'pnpm-lock.yaml'))).digest('hex')).probe('node_modules/fixture-dep/module.mjs');
  expect(probe()).toBeDefined();
  put(f.root,'pnpm-lock.yaml',lock.replace('snapshots:',`  fixture-dep@1.0.0:\n    resolution: {tarball: https://invalid.example/dependency.tgz}\n\nsnapshots:`));
  expect(probe()).toBeUndefined();
  put(f.root,'pnpm-lock.yaml',lock.replace('lockfileVersion: \'9.0\'','lockfileVersion: \'10.0\''));
  expect(probe()).toBeUndefined();
});
it('binds missing package files and refuses escaping package symlinks',()=>{
  const f=thirdPartyFixture(),lock=createHash('sha256').update(readFileSync(resolve(f.root,'pnpm-lock.yaml'))).digest('hex');
  const before=generationDependencies(f.root,lock);expect(before.probe('node_modules/fixture-dep/optional.mjs')).toContain('absent');
  put(f.root,`${f.target('1.0.0')}/optional.mjs`,'export const value=1;');
  expect(()=>before.verify()).toThrow('Generation installed package probe changed');
  symlinkSync(resolve(f.root,'src/sdk/used.mjs'),resolve(f.root,f.target('1.0.0'),'escape.mjs'));
  expect(generationDependencies(f.root,lock).probe('node_modules/fixture-dep/escape.mjs')).toBeUndefined();
});
it('refuses publication when a producer retargets an installed third-party alias',async()=>{
  const f=thirdPartyFixture();
  put(f.root,f.entry,`import fs from 'node:fs';fs.unlinkSync(${JSON.stringify(f.link)});fs.symlinkSync(${JSON.stringify(resolve(f.root,f.target('2.0.0')))},${JSON.stringify(f.link)},'dir');fs.writeFileSync('${f.output}','changed');`);
  await expect(f.upstream({'unread.bin':'old'})).rejects.toThrow('Generation installed packages changed');
  expect(readdirSync(resolve(f.cacheDir,f.job.id)).filter(name=>/^[a-f0-9]{64}$/u.test(name))).toEqual([]);
});
it('invalidates a completed phase when an installed third-party alias changes',async()=>{
  const f=thirdPartyFixture();
  await prepareGeneration(f.root,{cacheDir:f.cacheDir});expect(verifiedPreparedGeneration(f.root)).toBe(true);
  unlinkSync(f.link);symlinkSync(resolve(f.root,f.target('2.0.0')),f.link,'dir');
  expect(verifiedPreparedGeneration(f.root)).toBe(false);
});
function optionalTablesFixture() {
  const f=upstreamFixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify({identity:globalThis.fixtureIdentity,tables:globalThis.fixtureTables,shards:globalThis.fixtureShards??[]}));");
  put(f.root,'scripts/bake-loader.mjs',readFileSync('scripts/bake-loader.mjs','utf8'));
  put(f.root,'src/engine/app/identity.ts','export const installAppIdentity=value=>{globalThis.fixtureIdentity=value;};');
  put(f.root,'src/game/identity.ts',"export const WILDSHARD_IDENTITY={name:'fixture'};");
  put(f.root,'src/engine/boot/tables.ts','export const installAssetTables=value=>{globalThis.fixtureTables=value;};');
  put(f.root,'src/game/shard/list.ts','export const installShards=value=>{globalThis.fixtureShards=value;};');
  f.job.inputRoots=['src','scripts/bake-loader.mjs'];
  f.job.command=['--import','./scripts/bake-loader.mjs',f.entry];
  return f;
}
it('keeps absent optional boot tables off unrelated directory and upstream keys',async()=>{
  const f=optionalTablesFixture(),first=await f.upstream({'unread.bin':'old'});
  expect(JSON.parse(first.text)).toEqual({identity:{name:'fixture'},tables:{bytes:{},versions:{},music:{},sfx:{},packs:{}},shards:[]});
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
});
it('installs newly present optional tables and keeps their consumed bytes exact',async()=>{
  const f=optionalTablesFixture();await f.upstream({'unread.bin':'old'});
  put(f.root,'src/game/boot/bytes.generated.ts','export const PUBLIC_BYTES={asset:12};');
  put(f.root,'src/game/boot/versions.generated.ts',"export const ASSET_VERSIONS={asset:'first'};");
  put(f.root,'src/game/boot/audio.generated.ts',"export const MUSIC_MANIFESTS={theme:'music'},SFX_MANIFESTS={bell:'sound'};");
  put(f.root,'src/game/boot/packs.generated.ts',"export const PACKS={main:'pack'};");
  put(f.root,'src/shards.generated.ts',"export const SHARDS=['alpha'],LEGACY_SHARDS=['old'];");
  const present=await f.upstream({'unread.bin':'old'});expect(present.hit).toBe(false);
  expect(JSON.parse(present.text)).toEqual({identity:{name:'fixture'},tables:{bytes:{asset:12},versions:{asset:'first'},music:{theme:'music'},sfx:{bell:'sound'},packs:{main:'pack'}},shards:['alpha','old']});
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...present,hit:true});
  put(f.root,'src/game/boot/bytes.generated.ts','export const PUBLIC_BYTES={asset:13};');
  const changed=await f.upstream({'unread.bin':'new'});expect(changed.hit).toBe(false);
  expect(changed.text).toBe(present.text.replace('"asset":12','"asset":13'));
});
it('preserves stale optional table fallback and refuses unrelated evaluation errors',async()=>{
  const f=optionalTablesFixture();
  put(f.root,'src/game/boot/bytes.generated.ts',"import './stale.generated.ts';export const PUBLIC_BYTES={asset:12};");
  const stale=await f.upstream({'unread.bin':'old'});
  expect(stale.text).toContain('"bytes":{}');
  put(f.root,'src/game/boot/bytes.generated.ts',"throw new Error('fixture evaluation refused');export const PUBLIC_BYTES={asset:12};");
  await expect(f.upstream({'unread.bin':'old'})).rejects.toThrow('Generator exited 1');
});
it('keeps JSON driver path confinement off unrelated source and upstream keys',async()=>{
  const f=upstreamFixture('export function render(){return {value:1};}');
  put(f.root,'lint/no-binary-json.json',JSON.stringify({schema:'no-binary-json/1',source:'a'.repeat(40),files:{}}));
  for(const file of ['src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs','scripts/json-output-guard.mjs','scripts/no-binary-json.mjs','scripts/generated-source.mjs'])put(f.root,file,readFileSync(file,'utf8'));
  f.job.inputRoots.push('scripts/json-output-guard.mjs','scripts/no-binary-json.mjs','scripts/generated-source.mjs');
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',f.entry,'render',f.output];
  const first=await f.upstream({'unread.bin':'old'});expect(first).toMatchObject({hit:false,text:'{"value":1}\n'});
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,'src/sdk/new-unread.test.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,f.entry,'export function render(){return {value:2};}');
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'{"value":2}\n'});
});
it('reuses unread upstream bytes behind authoring dependency probes',async()=>{
  const f=upstreamFixture(undefined,true);
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  put(f.root,'src/sdk/used.mjs',"import {value} from './other.mjs';export {value};");
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  const first=await f.upstream({'unread.bin':'old'});expect(first).toMatchObject({hit:false,text:'2'});
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,'src/sdk/other.mjs','export const value=3;');
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'3'});
  put(f.root,'src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',type:'module',exports:{'./used':'./other.mjs','./unused':'./other.mjs'}}));
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'3'});
});
it('models verified workspace probes without unrelated source filename fences',async()=>{
  const f=upstreamFixture(undefined,true);
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  put(f.root,'src/sdk/used.mjs',"import {value} from './other.mjs';export {value};");
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  const first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('2');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  put(f.root,'src/sdk/other.mjs','export const value=3;');
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'3'});
});
it.each(['format','engine'])('invalidates a workspace link retargeted to %s before returning cached bytes',async layer=>{
  const f=upstreamFixture(undefined,true),target=`src/${layer}`;
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  put(f.root,`${target}/package.json`,readFileSync(resolve(f.root,'src/sdk/package.json'),'utf8'));
  put(f.root,`${target}/used.mjs`,'export const value=9;');f.job.inputRoots.push(target);
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'1'});
  const link=resolve(f.root,'node_modules/@wildshard/sdk');unlinkSync(link);symlinkSync(`../../${target}`,link,'dir');
  if(layer==='engine')await expect(f.upstream({'unread.bin':'old'})).rejects.toThrow('Generator exited 1');
  else expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'9'});
});
it('keeps an unverified workspace alias behind the complete filename fence',async()=>{
  const f=upstreamFixture("import {value} from '@wildshard/sdk/used.mjs';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));",true);
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  rmSync(resolve(f.root,'src/sdk/package.json'));
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  const first=await f.upstream({'unread.bin':'old'});expect(first.text).toBe('1');
  put(f.root,'src/sdk/new-unread.ts','export const unused=1;');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'1'});
});
it('normalizes equivalent workspace links across roots and relative or absolute spellings',()=>{
  const a=packageFixture(),b=packageFixture(),before=generationWorkspaceIdentity(a.root);
  expect(generationWorkspaceIdentity(b.root)).toBe(before);
  const link=resolve(b.root,'node_modules/@wildshard/sdk');unlinkSync(link);symlinkSync(resolve(b.root,'src/sdk'),link,'dir');
  expect(generationWorkspaceIdentity(b.root)).toBe(before);
  put(b.root,'src/format/keep.txt','new workspace target');unlinkSync(link);symlinkSync('../../src/format',link,'dir');
  expect(generationWorkspaceIdentity(b.root)).not.toBe(before);
});
it.each(['dangling','loop'])('binds an unused %s workspace link and notices its repair',kind=>{
  const f=packageFixture(),link=resolve(f.root,'node_modules/@wildshard/retired');
  symlinkSync(kind==='loop'?'retired':'../../src/retired',link,'dir');
  const before=generationWorkspaceIdentity(f.root);
  unlinkSync(link);symlinkSync('../../src/sdk',link,'dir');
  expect(generationWorkspaceIdentity(f.root)).not.toBe(before);
});
it('refuses publication when a producer retargets an installed workspace link',async()=>{
  const f=upstreamFixture(undefined,true),link=resolve(f.root,'node_modules/@wildshard/sdk');
  put(f.root,'src/format/keep.txt','replacement workspace');
  put(f.root,f.entry,`import fs from 'node:fs';fs.unlinkSync(${JSON.stringify(link)});fs.symlinkSync('../../src/format',${JSON.stringify(link)},'dir');fs.writeFileSync('${f.output}','changed');`);
  await expect(f.upstream({'unread.bin':'old'})).rejects.toThrow('Generation workspace links changed');
  expect(readdirSync(resolve(f.cacheDir,f.job.id)).filter(name=>/^[a-f0-9]{64}$/u.test(name))).toEqual([]);
});
it('invalidates a completed generation phase when a mirrored workspace link changes',async()=>{
  const f=packageFixture();
  put(f.root,'src/format/package.json',readFileSync(resolve(f.root,'src/sdk/package.json'),'utf8'));
  put(f.root,'src/format/used.mjs','export const value=9;');
  await prepareGeneration(f.root,{cacheDir:f.cacheDir});expect(verifiedPreparedGeneration(f.root)).toBe(true);
  const link=resolve(f.root,'node_modules/@wildshard/sdk');unlinkSync(link);symlinkSync('../../src/format',link,'dir');
  expect(verifiedPreparedGeneration(f.root)).toBe(false);
});
it.each(['missing','directory'])('preserves explicit authoring extension fallback for %s paths',async kind=>{
  const f=upstreamFixture(undefined,true);
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  put(f.root,'src/sdk/used.mjs',"import {value} from './fallback.js';export {value};");
  put(f.root,'src/sdk/fallback.js.ts','export const value=7;');
  if(kind==='directory')put(f.root,'src/sdk/fallback.js/keep.txt','directory input');
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'7'});
  put(f.root,'src/sdk/fallback.js.ts','export const value=8;');
  expect(await f.upstream({'unread.bin':'old'})).toMatchObject({hit:false,text:'8'});
});
it.each([
  ['../runtime/refused.mjs','src/shards/alpha/runtime/refused.mjs'],
  ['../../beta/generators/refused.mjs','src/shards/beta/generators/refused.mjs'],
  ['../../../engine/refused.mjs','src/engine/refused.mjs'],
])('refuses explicit non-authoring import %s even when the source exists',async(specifier,file)=>{
  const f=upstreamFixture(`import {value} from '${specifier}';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  put(f.root,'src/sdk/bake/source-loader.mjs',readFileSync('src/sdk/bake/source-loader.mjs','utf8'));
  put(f.root,file,'export const value=3;');f.job.inputRoots.push(file);
  f.job.command=['--import','./src/sdk/bake/source-loader.mjs',f.entry];
  await expect(f.upstream({'unread.bin':'old'})).rejects.toThrow('Generator exited 1');
});
it('keeps the complete filename fence behind dependency probes',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const f=upstreamFixture(`import fs from'node:fs';fs.writeFileSync('${output}',String(fs.existsSync('node_modules/fixture-absent')));`);
  const first=await f.upstream({'unread.bin':'old'});expect(first).toMatchObject({hit:false,text:'false'});
  expect(await f.upstream({'unread.bin':'new'})).toEqual({...first,hit:true});
  expect(await f.upstream({'unread.bin':'new','added.bin':'not read'})).toMatchObject({hit:false,text:'false'});
});
it('keeps consumed upstream bytes and resolution metadata behind dependency probes',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const f=upstreamFixture(`import fs from'node:fs';fs.existsSync('node_modules/valibot');fs.writeFileSync('${output}',fs.readFileSync('src/shards/alpha/data/used.bin'));`);
  const first=await f.upstream({'used.bin':'first','unread.bin':'old','package.json':'{"type":"module"}'});
  expect(first).toMatchObject({hit:false,text:'first'});
  expect(await f.upstream({'used.bin':'first','unread.bin':'new','package.json':'{"type":"module"}'})).toEqual({...first,hit:true});
  expect(await f.upstream({'used.bin':'second','unread.bin':'new','package.json':'{"type":"module"}'})).toMatchObject({hit:false,text:'second'});
  expect(await f.upstream({'used.bin':'second','unread.bin':'new','package.json':'{"type":"module","private":true}'})).toMatchObject({hit:false,text:'second'});
});
it('keeps all upstream bytes when dependency probes also invoke CommonJS resolution',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const f=upstreamFixture(`import fs from'node:fs';import{createRequire}from'node:module';fs.existsSync('node_modules/valibot');try{createRequire(import.meta.url).resolve('fixture-absent');}catch{}fs.writeFileSync('${output}','same');`);
  const first=await f.upstream({'unread.bin':'old'});expect(first).toMatchObject({hit:false,text:'same'});
  expect(await f.upstream({'unread.bin':'new'})).toMatchObject({hit:false,text:'same'});
});
it('keeps dependency-probe upstream hashes when the staged inventory is unavailable',async()=>{
  const f=fixture(),hash=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');
  const trace={schema:'generation-reads/4',files:[],execution:[f.entry],packages:{},inventory:['P node_modules/fixture-absent'],opaque:[]};
  const run=async(contents:string)=>{
    const result=await runObservedGeneration(f.root,{id:f.job.id,command:f.job.command,outputs:f.job.outputs,platform:f.job.platform,
      inputs:{[f.entry]:hash(readFileSync(resolve(f.root,f.entry)))},tools:{upstream:JSON.stringify({'src/shards/alpha/data/unread.bin':hash(contents)})}},
    {cacheDir:f.cacheDir,generate:directory=>{
      put(directory,f.output,'same');
      put(directory,generationReadReceipt,JSON.stringify({...trace,seal:hash(JSON.stringify(trace))}));
      return Promise.resolve();
    }},f.entry);
    try{return {hit:result.hit,key:result.key};}finally{result.release();}
  };
  const first=await run('old');expect(first.hit).toBe(false);
  expect(await run('old')).toEqual({...first,hit:true});
  expect((await run('new')).hit).toBe(false);
});
it('reuses only unused workspace export edits and keeps other package fields exact',async()=>{
  const {write,run}=packageFixture();const first=await run();expect(first).toMatchObject({hit:false,text:'1'});
  write({'./used':'./used.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'});
  expect(await run()).toEqual({...first,hit:true});
  write({'./used':'./other.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'});
  expect(await run()).toMatchObject({hit:false,text:'2'});
  write({'./used':'./other.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'},{private:true});
  expect((await run()).hit).toBe(false);
});
it('keeps attempted missing exports so an added matching key invalidates',async()=>{
  const {write,run}=packageFixture(`import fs from 'node:fs';let value=0;try{value=(await import('@wildshard/sdk/optional')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  await run();expect(await run()).toMatchObject({hit:true,text:'0'});
  write({'./used':'./used.mjs','./optional':'./other.mjs'});
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps wildcard export rows and raw package reads exact',async()=>{
  const {write,run}=packageFixture();await run();
  write({'./used':'./used.mjs','./unused':'./other.mjs','./*':'./other.mjs'});
  expect((await run()).hit).toBe(false);
  const raw=packageFixture(`import {value} from '@wildshard/sdk/used';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value)+fs.readFileSync('src/sdk/package.json','utf8'));`);
  await raw.run();raw.write({'./used':'./used.mjs','./unused':'./used.mjs'});
  expect((await raw.run()).hit).toBe(false);
});
it('keeps unsupported conditional-root package exports conservative',async()=>{
  const {write,run}=packageFixture(`import {value} from '@wildshard/sdk';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  write({import:'./used.mjs',default:'./used.mjs'});await run();
  write({import:'./used.mjs',default:'./other.mjs'});
  expect((await run()).hit).toBe(false);
});
it('reuses unread SDK edits but rebuilds imported code and newly read branches',async()=>{
  const {root,entry,output,run}=fixture();const first=await run();expect(first.hit).toBe(false);
  put(root,'src/sdk/unread.ts','// edited unrelated source');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/used.mjs','/** executed docs changed */ export const value=1;');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/used.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'2'});
  // An old read set misses on the changed entry. The new branch executes with
  // the full closure, then records its previously unread source dependency.
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('src/sdk/unread.ts'));`);
  expect(await run()).toMatchObject({hit:false,text:'// edited unrelated source'});
  put(root,'src/sdk/unread.ts','// newly observed bytes');
  expect(await run()).toMatchObject({hit:false,text:'// newly observed bytes'});
  expect((await run()).hit).toBe(true);
});
it.each(['json','bin'])('reuses unread %s content and records newly consumed bytes',async extension=>{
  const {root,entry,output,run}=fixture();
  const file=`src/sdk/unread.${extension}`;put(root,file,'first bytes');
  const first=await run();put(root,file,'changed unread bytes');
  expect(await run()).toEqual({...first,hit:true});
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${file}'));`);
  expect(await run()).toMatchObject({hit:false,text:'changed unread bytes'});
  put(root,file,'changed consumed bytes');
  expect(await run()).toMatchObject({hit:false,text:'changed consumed bytes'});
});
it('records JSON module bytes even when the native loader bypasses public fs reads',async()=>{
  const file='src/sdk/rows.json';
  const {root,run}=fixture(`import rows from '../../../sdk/rows.json' with {type:'json'};import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(rows.value));`);
  put(root,file,JSON.stringify({value:1}));expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,file,JSON.stringify({value:2}));expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps unobserved content bytes conservative when a child process consumes them',async()=>{
  const file='src/sdk/unread.json';
  const {root,run}=fixture(`import fs from 'node:fs';import {execFileSync} from 'node:child_process';fs.writeFileSync('src/shards/alpha/data/output.txt',execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('${file}'))"]));`);
  put(root,file,'first bytes');expect(await run()).toMatchObject({hit:false,text:'first bytes'});
  put(root,file,'changed opaque bytes');expect(await run()).toMatchObject({hit:false,text:'changed opaque bytes'});
});
it('retains unconsumed root build policy metadata',async()=>{
  const {root,run}=fixture();put(root,'pnpm-lock.yaml','first lock identity');
  await run();expect((await run()).hit).toBe(true);
  put(root,'pnpm-lock.yaml','changed lock identity');
  expect((await run()).hit).toBe(false);
});
it.each(['scripts/generation-jobs.json','scripts/custom-jobs.json'])('reuses unread %s bytes and unrelated source additions',async file=>{
  const {root,run}=fixture(undefined,file);const first=await run();expect(first.hit).toBe(false);
  const catalogue=readFileSync(resolve(root,file),'utf8');
  put(root,file,catalogue.replace('DO NOT EDIT fixture','DO NOT EDIT changed unrelated catalogue metadata'));
  expect(await run()).toEqual({...first,hit:true});
  // Fully positive ESM reads do not depend on unrelated source names.
  put(root,'src/sdk/new-module.ts','export const unused=1;');
  expect(await run()).toEqual({...first,hit:true});
  rmSync(resolve(root,'src/sdk/unread.ts'));
  expect(await run()).toEqual({...first,hit:true});
});
it.each(['scripts/generation-jobs.json','scripts/custom-jobs.json'])('keeps actually read %s bytes exact',async file=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${file}'));`,file);
  const first=await run();expect(first.hit).toBe(false);expect((await run()).hit).toBe(true);
  const text=readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT changed catalogue metadata');
  put(root,file,text);
  expect(await run()).toMatchObject({hit:false,text});
});
it('projects output-only catalogue readers without losing shared or orphan-protected paths',async()=>{
  const source="import fs from 'node:fs';const {jobs}=JSON.parse(fs.readFileSync('scripts/generation-jobs.json','utf8'));fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(jobs.map(({id,outputs,buildOutputs,buildTimeOutputs})=>({id,outputs,buildOutputs,buildTimeOutputs}))));";
  const {root,job,run}=fixture(source);job.catalogueOutputsOnly=true;
  const other:ShardGenerationJob={id:'fixture-other',shard:'beta',entry:'src/shards/beta/generators/bake-other.mjs',command:['src/shards/beta/generators/bake-other.mjs'],inputRoots:['src/shards/beta'],outputs:['public/assets/shared/retained.bin','public/assets/beta/runtime.bin'],buildOutputs:{'public/assets/shared/retained.bin':'a'.repeat(64)},buildTimeOutputs:['public/assets/beta/runtime.bin'],platform:'portable'};
  const write=():void=>put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[other,job]}));
  write();const first=await run();expect(first.hit).toBe(false);
  expect(first.text).toContain('public/assets/shared/retained.bin');
  expect(first.text).toContain('public/assets/beta/runtime.bin');
  other.command.push('--different-authoring-mode');other.inputRoots.push('src/format');
  write();expect(await run()).toEqual({...first,hit:true});
  other.outputs.push('public/assets/beta/orphan-protected.glb');
  write();expect(await run()).toMatchObject({hit:false});
  expect((await run()).text).toContain('orphan-protected.glb');
  other.buildOutputs={'public/assets/shared/retained.bin':'b'.repeat(64)};
  write();expect((await run()).hit).toBe(false);
  other.buildTimeOutputs?.push('public/assets/beta/new-runtime.bin');
  write();expect((await run()).hit).toBe(false);
});
it('keeps full-catalogue readers byte-exact unless they explicitly opt in',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',fs.readFileSync('scripts/generation-jobs.json'));");
  await run();expect((await run()).hit).toBe(true);
  const file='scripts/generation-jobs.json';
  put(root,file,readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT another notice'));
  expect((await run()).hit).toBe(false);
});
it('keeps the conservative key when no raw input would remain',async()=>{
  const {root,run}=fixture();rmSync(resolve(root,'package.json'));
  await run();expect((await run()).hit).toBe(true);
  const file='scripts/generation-jobs.json';
  put(root,file,readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT changed metadata'));
  expect((await run()).hit).toBe(false);
});
it.each(['raw','function-text'])('keeps %s self-source reads byte-exact',async mode=>{
  const {root,entry,output,run}=fixture();
  const source=`/** first docs */ import fs from 'node:fs';export function compile(){return 1;}fs.writeFileSync('${output}',String(${mode==='raw'?`fs.readFileSync('${entry}','utf8').length`:'compile.toString().length'}));`;
  put(root,entry,source);await run();expect((await run()).hit).toBe(true);
  put(root,entry,source.replace('first docs','longer changed docs'));
  expect((await run()).hit).toBe(false);
});
it('invalidates negative probes when the declared input inventory gains a file',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',String(fs.existsSync('src/sdk/optional.ts')));`);
  expect(await run()).toMatchObject({hit:false,text:'false'});expect((await run()).hit).toBe(true);
  put(root,'src/sdk/unrelated-new.ts','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'false'});
  put(root,'src/sdk/optional.ts','// newly resolvable module');
  expect(await run()).toMatchObject({hit:false,text:'true'});
});
it.each([
  ["import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.readdirSync('src/sdk').sort()));",'directory'],
  ["import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.globSync('src/sdk/*.mjs').sort()));",'glob'],
  ["import fs from 'node:fs';let value='absent';try{value=fs.realpathSync.native('src/sdk/optional.mjs').split('/').at(-1);}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',value);",'native-realpath'],
  ["import fs from 'node:fs';let value='absent';try{value=fs.readFileSync('src/sdk/optional.mjs','utf8');}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',value);",'failed-read'],
  ["import fs from 'node:fs';let value=0;try{value=(await import('../../../sdk/optional.mjs')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));",'failed-import'],
])('invalidates %s observations when a previously absent source appears',async(source,kind)=>{
  const {root,run}=fixture(source);const first=await run();expect((await run()).hit).toBe(true);
  if(['native-realpath','failed-read'].includes(kind)) {
    put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
    expect((await run()).hit,kind).toBe(true);
  }
  put(root,'src/sdk/optional.mjs','export const value=2;');
  const changed=await run();expect(changed.hit,kind).toBe(false);expect(changed.text).not.toBe(first.text);
});
it('models only staged paths instead of loose working-tree files',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('src/not-in-stage/optional.mjs')));");
  put(root,'src/not-in-stage/optional.mjs','export const loose=1;');
  expect(await run()).toMatchObject({hit:false,text:'false'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'false'});
  rmSync(resolve(root,'src/not-in-stage/optional.mjs'));
  expect(await run()).toMatchObject({hit:true,text:'false'});
});
it('includes the catalogue and initially created output directories in probes',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify([fs.existsSync('scripts/generation-jobs.json'),fs.existsSync('src/shards/alpha/data')]));");
  expect(await run()).toMatchObject({hit:false,text:'[true,true]'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'[true,true]'});
});
it('includes immutable upstream stage files even when absent from the checkout',async()=>{
  const upstream='src/shards/alpha/data/upstream.mjs';
  const {root,cacheDir,job,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('${upstream}')));`);
  const entry='src/shards/alpha/generators/bake-upstream.mjs';
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${upstream}','export const value=1;');`);
  const producer:ShardGenerationJob={id:'fixture-upstream',shard:'alpha',entry,command:[entry],inputRoots:[entry],outputs:[upstream],buildTimeOutputs:[upstream],platform:'portable'};
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[producer,job]}));
  const loan=await generateShardJob(root,producer,{cacheDir});
  try {
    const preparation:GenerationPreparation={outputs:[upstream,...job.outputs],upstream:new Map([[producer.id,loan]])};
    expect(await run(false,preparation)).toMatchObject({hit:false,text:'true'});
    put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
    expect(await run(false,preparation)).toMatchObject({hit:true,text:'true'});
    // No raw working-tree output was published; dropping the immutable loan
    // changes the actual initial stage and must invalidate its presence probe.
    preparation.upstream.clear();
    expect(await run(false,preparation)).toMatchObject({hit:false,text:'false'});
  } finally {loan.release();}
});
it('reuses unread upstream bytes without losing newly consumed branches',async()=>{
  const f=upstreamFixture(),first=await f.upstream({'unused.bin':'first bytes'});
  expect(first).toMatchObject({hit:false,text:'1'});
  expect(await f.upstream({'unused.bin':'changed unread bytes'})).toEqual({...first,hit:true});
  expect(()=>readFileSync(resolve(f.root,'src/shards/alpha/data/unused.bin'))).toThrow();
  put(f.root,f.entry,`import fs from 'node:fs';fs.writeFileSync('${f.output}',fs.readFileSync('src/shards/alpha/data/unused.bin'));`);
  expect(await f.upstream({'unused.bin':'changed unread bytes'})).toMatchObject({hit:false,text:'changed unread bytes'});
  expect(await f.upstream({'unused.bin':'changed consumed bytes'})).toMatchObject({hit:false,text:'changed consumed bytes'});
});
it.each(['file','module','json'])('keeps consumed immutable upstream %s bytes exact',async kind=>{
  const output='src/shards/alpha/data/output.txt',file=`src/shards/alpha/data/used.${kind==='module'?'mjs':kind==='json'?'json':'bin'}`;
  const source=kind==='file'?`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${file}'));`
    :`import rows from '../data/${file.split('/').at(-1)}' ${kind==='json'?"with {type:'json'}":''};import fs from 'node:fs';fs.writeFileSync('${output}',String(rows.value));`;
  const f=upstreamFixture(source),name=file.split('/').at(-1);
  if(name===undefined)throw new Error('Missing upstream fixture name');
  const bytes=kind==='file'?'first':kind==='module'?'export default {value:1};':'{"value":1}';
  const first=await f.upstream({[name]:bytes,'unused.bin':'old'});
  expect(await f.upstream({[name]:bytes,'unused.bin':'new'})).toEqual({...first,hit:true});
  const changed=kind==='file'?'second':kind==='module'?'/* changed raw module */ export default {value:2};':'{"value":2}';
  expect(await f.upstream({[name]:changed,'unused.bin':'new'})).toMatchObject({hit:false,text:kind==='file'?'second':'2'});
});
it('keeps upstream negative existence probes and directory membership',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const presence=upstreamFixture(`import fs from 'node:fs';fs.writeFileSync('${output}',String(fs.existsSync('src/shards/alpha/data/optional.bin')));`);
  expect(await presence.upstream({'unused.bin':'old'})).toMatchObject({hit:false,text:'false'});
  expect(await presence.upstream({'unused.bin':'new'})).toMatchObject({hit:true,text:'false'});
  expect(await presence.upstream({'unused.bin':'new','optional.bin':'present'})).toMatchObject({hit:false,text:'true'});
  const directory=upstreamFixture(`import fs from 'node:fs';fs.writeFileSync('${output}',JSON.stringify(fs.readdirSync('src/shards/alpha/data').sort()));`);
  const first=await directory.upstream({'first.bin':'old'});
  expect(await directory.upstream({'first.bin':'new'})).toEqual({...first,hit:true});
  const added=await directory.upstream({'first.bin':'new','second.bin':'added'});
  expect(added.hit).toBe(false);expect(v.parse(v.array(v.string()),JSON.parse(added.text))).toContain('second.bin');
});
it('retains all upstream hashes behind unmodeled probes and opaque child work',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const probe=upstreamFixture(`import fs from 'node:fs';fs.writeFileSync('${output}',String(fs.existsSync('.')));`);
  await probe.upstream({'unread.bin':'old'});
  expect((await probe.upstream({'unread.bin':'new'})).hit).toBe(false);
  const child=upstreamFixture(`import fs from 'node:fs';import {execFileSync}from'node:child_process';fs.writeFileSync('${output}',execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('src/shards/alpha/data/used.bin'))"]));`);
  expect(await child.upstream({'used.bin':'first','unused.bin':'old'})).toMatchObject({hit:false,text:'first'});
  expect((await child.upstream({'used.bin':'first','unused.bin':'new'})).hit).toBe(false);
  expect(await child.upstream({'used.bin':'second','unused.bin':'new'})).toMatchObject({hit:false,text:'second'});
});
it.each(['fs','node:fs'])('does not re-key builtin %s for unread upstream bytes',async name=>{
  const output='src/shards/alpha/data/output.txt';
  const reader=upstreamFixture(`import{createRequire}from'node:module';const require=createRequire(import.meta.url);require(${JSON.stringify(name)}).writeFileSync('${output}',require.resolve(${JSON.stringify(name)}));`);
  const first=await reader.upstream({'unread.bin':'first'});
  expect(first).toMatchObject({hit:false,text:name});
  expect(await reader.upstream({'unread.bin':'changed'})).toEqual({...first,hit:true});
  put(reader.root,'src/sdk/new-unread.ts','// A builtin cannot resolve this file.');
  expect(await reader.upstream({'unread.bin':'changed'})).toEqual({...first,hit:true});
});
it.each([
  "fs.readdirSync('src')",
  "fs.readdirSync('src','utf8')",
  "await fs.promises.readdir('src')",
  "await new Promise((resolve,reject)=>fs.readdir('src',(error,names)=>error?reject(error):resolve(names)))",
])('does not re-key a shallow directory read for nested additions: %s',async list=>{
  const {root,job,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify((${list}).sort()));`);
  job.inputRoots=['src'];
  const first=await run();expect(first.hit).toBe(false);
  put(root,'src/sdk/nested/unread.mjs','export const unused=1;');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/new-package/unused.mjs','export const unused=2;');
  const changed=await run();expect(changed.hit).toBe(false);expect(changed.text).toContain('new-package');
});
it('keeps shallow opendir entry types exact without reading descendants',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';const dir=fs.opendirSync('src/sdk/list'),rows=[];for(let entry;(entry=dir.readSync())!==null;)rows.push([entry.name,entry.isDirectory()]);dir.closeSync();fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(rows));");
  put(root,'src/sdk/list/child','first');
  expect(await run()).toMatchObject({hit:false,text:'[["child",false]]'});
  rmSync(resolve(root,'src/sdk/list/child'));
  put(root,'src/sdk/list/child/first.mjs','export const unused=1;');
  const directory=await run();expect(directory).toMatchObject({hit:false,text:'[["child",true]]'});
  put(root,'src/sdk/list/child/second.mjs','export const unused=2;');
  expect(await run()).toEqual({...directory,hit:true});
});
it('fences recursive directory reads by their staged subtree',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.readdirSync('src/sdk/list',{recursive:true}).sort()));");
  put(root,'src/sdk/list/first.mjs','export const first=1;');
  const first=await run();expect(first.hit).toBe(false);
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/list/nested/second.mjs','export const second=2;');
  const changed=await run();expect(changed.hit).toBe(false);expect(changed.text).toContain('second.mjs');
});
it('includes ancestor types in failed path identities',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';let value='present';try{fs.realpathSync.native('src/sdk/parent.mjs/optional.mjs');}catch(error){value=error.code;}fs.writeFileSync('src/shards/alpha/data/output.txt',value);");
  expect(await run()).toMatchObject({hit:false,text:'ENOENT'});
  put(root,'src/sdk/parent.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:false,text:'ENOTDIR'});
});
it('binds failed file resolution to nearby candidates instead of unrelated trees',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';let value=0;try{value=(await import('../../../sdk/optional/target.mjs')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  expect(await run()).toMatchObject({hit:false,text:'0'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'0'});
  put(root,'src/sdk/optional/nearby.mjs','export const other=1;');
  expect(await run()).toMatchObject({hit:false,text:'0'});
  put(root,'src/sdk/optional/target.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it.each([
  "import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('node_modules/valibot')));",
  "import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.readdirSync('src/sdk')));",
  "import fs from 'node:fs';try{await import('fixture-absent-package');}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt','absent');",
])('keeps dependency-link and bare-resolution probes conservative: %s',async source=>{
  const {root,run}=fixture(source);await run();expect((await run()).hit).toBe(true);
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect((await run()).hit).toBe(false);
});
it('keeps higher-priority CommonJS candidates on the complete key',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'package.json',JSON.stringify({type:'commonjs'}));put(root,'src/sdk/chosen.json',JSON.stringify({value:1}));
  expect(await run()).toMatchObject({hit:false,text:'1'});expect((await run()).hit).toBe(true);
  put(root,'src/sdk/chosen.js','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps CommonJS resolution inventory without treating it as module execution',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const name=createRequire(import.meta.url).resolve('../../../sdk/chosen').split('/').at(-1);fs.writeFileSync('src/shards/alpha/data/output.txt',name);");
  put(root,'src/sdk/chosen.json',JSON.stringify({value:1}));
  const first=await run();expect(first).toMatchObject({hit:false,text:'chosen.json'});
  put(root,'src/sdk/chosen.json',JSON.stringify({value:2}));
  put(root,'src/sdk/unread.ts','// changed code cannot affect path resolution');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/chosen.js','export const value=3;');
  expect(await run()).toMatchObject({hit:false,text:'chosen.js'});
});
it('keeps package main metadata exact for CommonJS resolution-only calls',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const name=createRequire(import.meta.url).resolve('../../../sdk/chosen').split('/').at(-1);fs.writeFileSync('src/shards/alpha/data/output.txt',name);");
  put(root,'src/sdk/chosen/package.json',JSON.stringify({main:'first.mjs'}));
  put(root,'src/sdk/chosen/first.mjs','export const value=1;');
  put(root,'src/sdk/chosen/second.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'first.mjs'});
  put(root,'src/sdk/chosen/package.json',JSON.stringify({main:'second.mjs'}));
  expect(await run()).toMatchObject({hit:false,text:'second.mjs'});
});
it('keeps actual CommonJS source byte-exact while omitting unread code',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'src/sdk/chosen.cjs','module.exports={value:1};');
  expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,'src/sdk/unread.ts','// not read by the CommonJS module');
  expect(await run()).toMatchObject({hit:true,text:'1'});
  put(root,'src/sdk/chosen.cjs','// changed raw CommonJS bytes\nmodule.exports={value:1};');
  expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,'src/sdk/chosen.cjs','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('captures nested CommonJS modules, required JSON and late getter reads',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'src/sdk/chosen.cjs',"const fs=require('node:fs');const nested=require('./nested.cjs');const rows=require('./rows.json');module.exports={get value(){return nested.value+rows.value+Number(fs.readFileSync('src/sdk/late.txt','utf8'));}};");
  put(root,'src/sdk/nested.cjs','module.exports={value:1};');
  put(root,'src/sdk/rows.json',JSON.stringify({value:2}));put(root,'src/sdk/late.txt','3');
  expect(await run()).toMatchObject({hit:false,text:'6'});
  put(root,'src/sdk/nested.cjs','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'7'});
  put(root,'src/sdk/rows.json',JSON.stringify({value:3}));
  expect(await run()).toMatchObject({hit:false,text:'8'});
  put(root,'src/sdk/late.txt','4');
  expect(await run()).toMatchObject({hit:false,text:'9'});
});
it('keeps a CommonJS child process on the full conservative closure',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',value);");
  put(root,'src/sdk/chosen.cjs',"const {execFileSync}=require('node:child_process');module.exports={value:execFileSync(process.execPath,['-e',\"process.stdout.write('opaque child')\"])};");
  expect(await run()).toMatchObject({hit:false,text:'opaque child'});
  put(root,'src/sdk/unread.ts','// a child process can inspect this file without a trace');
  expect(await run()).toMatchObject({hit:false,text:'opaque child'});
});
it('keeps opaque subprocess reads on the conservative closure',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';import {execFileSync} from 'node:child_process';fs.writeFileSync('${output}',execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('src/sdk/unread.ts'))"]));`);
  expect(await run()).toMatchObject({hit:false,text:'// unrelated source'});
  expect((await run()).hit).toBe(true);put(root,'src/sdk/unread.ts','// hidden child read changed');
  expect(await run()).toMatchObject({hit:false,text:'// hidden child read changed'});
});
it('falls back to the complete key when read profiles are corrupt',async()=>{
  const {root,cacheDir,run}=fixture();await run();
  const jobDir=resolve(cacheDir,'.reads-v1/fixture-reader');
  const recipes=readdirSync(jobDir);expect(recipes).toHaveLength(1);
  for(const recipe of recipes)for(const file of readdirSync(resolve(jobDir,recipe)))writeFileSync(resolve(jobDir,recipe,file),'{}');
  put(root,'src/sdk/unread.ts','// cannot trust the corrupted hint');
  expect((await run()).hit).toBe(false);
});
it.each(['old-schema','missing-probes'])('rejects resealed %s observations',async mode=>{
  const {root,cacheDir,run}=fixture();await run();
  const jobDir=resolve(cacheDir,'.reads-v1/fixture-reader');
  for(const recipe of readdirSync(jobDir))for(const file of readdirSync(resolve(jobDir,recipe))) {
    const path=resolve(jobDir,recipe,file),trace=v.parse(v.record(v.string(),v.unknown()),JSON.parse(readFileSync(path,'utf8')));
    delete trace['seal'];delete trace['inventory'];
    if(mode==='old-schema')trace['schema']='generation-reads/3';
    const seal=createHash('sha256').update(JSON.stringify(trace)).digest('hex');
    writeFileSync(path,JSON.stringify({...trace,seal}));
  }
  put(root,'src/sdk/unread.ts','// old or incomplete observations grant no narrower key');
  expect((await run()).hit).toBe(false);
});
it('runs strict regeneration even when an observed key is warm',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',crypto.randomUUID());`);
  await run();expect((await run()).hit).toBe(true);
  await expect(run(true)).rejects.toThrow('Regenerate-and-compare failed');
});
it('coalesces concurrent observed misses without sharing a probe failure with publication',async()=>{
  const {root,run}=fixture();await run();put(root,'src/sdk/used.mjs','export const value=2;');
  const results=await Promise.all([run(),run()]);
  expect(results.map(row=>row.text)).toEqual(['2','2']);expect(results.every(row=>!row.hit)).toBe(true);
  expect((await run()).hit).toBe(true);
});
