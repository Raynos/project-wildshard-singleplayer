// oxlint-disable-next-line import/no-nodejs-modules -- exercise the CLI without intercepting its linter process
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- own a tiny config and executable fixture
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- resolve the exact repository CLI and its fixture
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- invoke the current runtime and preserve the executable path
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';

test('fast lint shares staged rules, propagates refusals and cleans each private config',()=>{
 mkdirSync('tmp',{recursive:true});const fixture=mkdtempSync(resolve('tmp/lint-fast-'));
 try{
  mkdirSync(resolve(fixture,'node_modules/.bin'),{recursive:true});
  writeFileSync(resolve(fixture,'.oxlintrc.json'),JSON.stringify({options:{typeAware:true},
   rules:{'wildshard/no-authored-html':'error','wildshard/no-shard-branch':'error'},
   overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}}]}));
  writeFileSync(resolve(fixture,'node_modules/.bin/oxlint'),`#!/usr/bin/env node\nconst fs=require('node:fs'),args=process.argv.slice(2);fs.writeFileSync('called.json',JSON.stringify({args,config:JSON.parse(fs.readFileSync(args[args.indexOf('-c')+1],'utf8'))}));process.exit(Number(process.env.LINTER_STATUS??0));\n`,{mode:0o755});
  const run=(args:string[],status='0')=>spawnSync(execPath,[resolve('scripts/lint-fast.mjs'),...args],
   {cwd:fixture,encoding:'utf8',env:{PATH:env['PATH']??'',LINTER_STATUS:status}});
  expect(run(['src/one.ts','src/two.ts']).status).toBe(0);
  const called:unknown=JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'));
  expect(called).toEqual({args:['--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u),'src/one.ts','src/two.ts'],
   config:{options:{typeAware:false,reportUnusedDisableDirectives:'off'},
    rules:{'wildshard/no-authored-html':'off','wildshard/no-shard-host-callback':'off','wildshard/no-shard-branch':'error'},
    overrides:[{files:['src/**'],rules:{'wildshard/no-shard-host-callback':'error'}},
     {files:['**/*'],rules:{'wildshard/no-authored-html':'off','wildshard/no-shard-host-callback':'off'}}]}});
  expect(run([]).status).toBe(0);
  const whole:unknown=JSON.parse(readFileSync(resolve(fixture,'called.json'),'utf8'));
  expect(whole).toMatchObject({args:['--threads=2','-c',expect.stringMatching(/^\.commit-fast-lint-\d+\.json$/u)]});
  expect(run(['src/one.ts'],'1').status).toBe(1);
  expect(run(['--type-aware']).status).toBe(2);
  expect(readdirSync(fixture).some(name=>name.startsWith('.commit-fast-lint-'))).toBe(false);
 }finally{rmSync(fixture,{recursive:true,force:true});}
});
