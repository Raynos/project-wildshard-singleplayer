// oxlint-disable-next-line import/no-nodejs-modules -- exercise the CLI without intercepting its linter process
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- own a tiny config and executable fixture
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- resolve the exact repository CLI and its fixture
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- invoke the current runtime and preserve the executable path
import { env, execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- assert the CLI's real available-core bound
import { availableParallelism } from 'node:os';
import { expect, test } from 'vitest';
import { fastCommitLintConfig } from '../scripts/precommit-checks.mjs';

const lintThreads = `--threads=${Math.min(8, availableParallelism())}`;

test('fast lint shares staged rules, propagates refusals and cleans each private config',()=>{
 mkdirSync('tmp',{recursive:true});const fixture=mkdtempSync(resolve('tmp/lint-fast-'));
 try{
  mkdirSync(resolve(fixture,'node_modules/.bin'),{recursive:true});
  writeFileSync(resolve(fixture,'.oxlintrc.json'),JSON.stringify({options:{typeAware:true},
   rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-branch':'error'},
   overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}}]}));
  writeFileSync(resolve(fixture,'node_modules/.bin/oxlint'),`#!/usr/bin/env node\nconst fs=require('node:fs'),args=process.argv.slice(2);if(args.includes('--debug')){console.log('src/one.ts\\nsrc/two.ts');process.exit(0);}fs.writeFileSync('called.json',JSON.stringify({args,config:JSON.parse(fs.readFileSync(args[args.indexOf('-c')+1],'utf8'))}));process.exit(Number(process.env.LINTER_STATUS??0));\n`,{mode:0o755});
  const guard=resolve(fixture,'no-typescript.mjs');
  writeFileSync(guard,`import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='@typescript/typescript6'||specifier==='typescript')throw new Error('Fast lint loaded TypeScript');
 return nextResolve(specifier,context);
}});\n`);
  const run=(args:string[],status='0')=>spawnSync(execPath,[resolve('scripts/lint-fast.mjs'),...args],
   {cwd:fixture,encoding:'utf8',env:{PATH:env['PATH']??'',LINTER_STATUS:status,NODE_OPTIONS:`--import=${guard}`}});
  expect(run(['src/one.ts','src/two.ts']).status).toBe(0);
  const called:unknown=JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'));
  expect(called).toEqual({args:[lintThreads,'-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u),'src/one.ts','src/two.ts'],
   config:{options:{typeAware:false,reportUnusedDisableDirectives:'off'},
    rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-branch':'error'},
    overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}}]}});
  expect(run([]).status).toBe(0);
  const whole:unknown=JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'));
  expect(whole).toMatchObject({args:['--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u),expect.stringMatching(/^src\/(one|two)\.ts$/u)]});
  expect(run(['src/one.ts'],'1').status).toBe(1);
  writeFileSync(resolve(fixture,'.push-tracked.json'),JSON.stringify(['src/unchanged.ts','public/image.bin']));
  expect(run([]).status).toBe(0);
  expect(JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'))).toMatchObject({args:[
   '--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u),'src/unchanged.ts']});
  writeFileSync(resolve(fixture,'.push-tracked.json'),'["../foreign.ts"]');
  expect(run([]).status).toBe(1);
  expect(run(['--type-aware']).status).toBe(2);
  expect(readdirSync(fixture).some(name=>name.startsWith('.commit-fast-lint-'))).toBe(false);
 }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('fast syntax rules refuse unsafe HTML and shard callbacks',()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/fast-syntax-'));
 try{
  mkdirSync(resolve(root,'src/game'),{recursive:true});
  mkdirSync(resolve(root,'src/shards/sample/runtime'),{recursive:true});
  writeFileSync(resolve(root,'src/game/host.ts'),'export function host(value:unknown){return value;}');
  const file='src/shards/sample/runtime/play.ts';
  writeFileSync(resolve(root,file),`import {host} from '../../../game/host';
declare const untrusted:string;document.body.innerHTML=untrusted;host({tick(){}});`);
  writeFileSync(resolve(root,'lint.json'),JSON.stringify(fastCommitLintConfig({options:{typeAware:true},
   jsPlugins:[resolve('lint/wildshard-plugin.js')],categories:{correctness:'off'},
   rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-host-callback':'error'}})));
  const run=()=>spawnSync(execPath,[resolve('node_modules/oxlint/bin/oxlint'),'-c','lint.json','-f','json',file],
   {cwd:root,encoding:'utf8',env});
  const bad=run();expect(bad.status,bad.stderr).toBe(1);
  expect(bad.stdout).toContain('no-authored-html');
  expect(bad.stdout).toContain('no-shard-host-callback');
  mkdirSync(resolve(root,'node_modules/.bin'),{recursive:true});
  writeFileSync(resolve(root,'node_modules/.bin/oxlint'),`#!/bin/sh
exec "${execPath}" "${resolve('node_modules/oxlint/bin/oxlint')}" "$@"
`,{mode:0o755});
  writeFileSync(resolve(root,'.oxlintrc.json'),readFileSync(resolve(root,'lint.json')));
  writeFileSync(resolve(root,'.push-tracked.json'),JSON.stringify([file,'src/game/host.ts']));
  const partitioned=spawnSync(execPath,[resolve('scripts/lint-fast.mjs')],{cwd:root,encoding:'utf8',env});
  expect(partitioned.status).toBe(1);
  expect(partitioned.stdout).toContain('no-authored-html');
  expect(partitioned.stdout).toContain('no-shard-host-callback');
  writeFileSync(resolve(root,file),`import {host} from '../../../game/host';
document.body.textContent='plain';host({amount:1});`);
  const good=run();expect(good.status,good.stderr).toBe(0);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('whole fast lint partitions the exact snapshot and drains every refusal',()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/fast-partitions-'));
 try{
  mkdirSync(resolve(root,'node_modules/.bin'),{recursive:true});
  writeFileSync(resolve(root,'.oxlintrc.json'),JSON.stringify({options:{typeAware:true},ignorePatterns:['src/generated/**'],rules:{}}));
  const sources=Array.from({length:19},(_,i)=>`src/file-${i}.ts`);
  writeFileSync(resolve(root,'.push-tracked.json'),JSON.stringify([...sources,'src/generated/skip.ts','public/image.bin']));
  writeFileSync(resolve(root,'node_modules/.bin/oxlint'),`#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2),paths=args.slice(3);
setTimeout(()=>{
 fs.writeFileSync('worker-'+process.pid+'.json',JSON.stringify({args,config:JSON.parse(fs.readFileSync(args[2],'utf8'))}));
 for(const path of paths)console.log('diagnostic:'+path);
 process.exit(paths.includes('src/file-0.ts')?1:0);
},paths.includes('src/file-0.ts')?1:35);
`,{mode:0o755});
  const run=spawnSync(execPath,[resolve('scripts/lint-fast.mjs')],{cwd:root,encoding:'utf8',env});
  expect(run.status).toBe(1);
  const calls=readdirSync(root).filter(name=>name.startsWith('worker-')).map(name=>JSON.parse(readFileSync(resolve(root,name),'utf8')) as {args:string[];config:{options:{typeAware:boolean}}});
  expect(calls).toHaveLength(4);
  expect(calls.flatMap(call=>call.args.slice(3)).sort()).toEqual([...sources].sort());
  expect(calls.every(call=>call.args[0]==='--threads=2' && !call.config.options.typeAware)).toBe(true);
  expect(run.stdout.trim().split('\n').sort()).toEqual(sources.map(path=>`diagnostic:${path}`).sort());
  expect(readdirSync(root).some(name=>name.startsWith('.commit-fast-lint-'))).toBe(false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
