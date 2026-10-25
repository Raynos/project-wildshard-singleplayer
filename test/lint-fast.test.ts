// oxlint-disable-next-line import/no-nodejs-modules -- exercise the CLI without intercepting its linter process
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- own a tiny config and executable fixture
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- resolve the exact repository CLI and its fixture
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- invoke the current runtime and preserve the executable path
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';
import { fastCommitLintConfig } from '../scripts/precommit-checks.mjs';

test('fast lint shares staged rules, propagates refusals and cleans each private config',()=>{
 mkdirSync('tmp',{recursive:true});const fixture=mkdtempSync(resolve('tmp/lint-fast-'));
 try{
  mkdirSync(resolve(fixture,'node_modules/.bin'),{recursive:true});
  writeFileSync(resolve(fixture,'.oxlintrc.json'),JSON.stringify({options:{typeAware:true},
   rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-branch':'error'},
   overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}}]}));
  writeFileSync(resolve(fixture,'node_modules/.bin/oxlint'),`#!/usr/bin/env node\nconst fs=require('node:fs'),args=process.argv.slice(2);fs.writeFileSync('called.json',JSON.stringify({args,config:JSON.parse(fs.readFileSync(args[args.indexOf('-c')+1],'utf8'))}));process.exit(Number(process.env.LINTER_STATUS??0));\n`,{mode:0o755});
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
  expect(called).toEqual({args:['--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u),'src/one.ts','src/two.ts'],
   config:{options:{typeAware:false,reportUnusedDisableDirectives:'off'},
    rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-branch':'error'},
    overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}}]}});
  expect(run([]).status).toBe(0);
  const whole:unknown=JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'));
  expect(whole).toMatchObject({args:['--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u)]});
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
  writeFileSync(resolve(root,file),`import {host} from '../../../game/host';
document.body.textContent='plain';host({amount:1});`);
  const good=run();expect(good.status,good.stderr).toBe(0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
