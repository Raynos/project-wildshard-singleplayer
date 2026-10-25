// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real lint policy with an owned engine test fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Create and remove only the temporary policy fixture.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact engine project members and the current lint CLI.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the lint subprocess on the current runtime.
import { execPath } from 'node:process';
import ts from '@typescript/typescript6';
import { expect,test } from 'vitest';
import { fastCommitLintConfig } from '../scripts/precommit-checks.mjs';
import { readLintConfig } from '../scripts/guard-counts.mjs';

for(const layer of ['engine','format','game','sdk','commons','shards','app']){
 test(`the actual ${layer} test project owns units outside production`,()=>{
  const directory=layer==='app'?'src':`src/${layer}`;
  const units=readdirSync(directory,{recursive:layer!=='app',encoding:'utf8'})
   .filter(file=>file.endsWith('.test.ts')&&!file.split('/').includes('node_modules')).map(file=>`${directory}/${file}`);
  const config=layer==='app'?'src/tsconfig.test.json':`${directory}/tsconfig.test.json`;
  const project=ts.getParsedCommandLineOfConfigFile(resolve(config),{},
   {...ts.sys,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));}});
  expect(project).toBeDefined();if(layer!=='commons')expect(units.length).toBeGreaterThan(0);
  for(const file of units)expect(project?.fileNames).toContain(resolve(file));
  const production=ts.getParsedCommandLineOfConfigFile(resolve(`tsconfig.${layer}.json`),{},
   {...ts.sys,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));}});
  for(const file of units)expect(production?.fileNames).not.toContain(resolve(file));
 });
}

test('every colocated source suite has exactly one owning test project',()=>{
 const suites=ts.sys.readDirectory(resolve('src'),['.ts'],['**/node_modules/**'],['**/*.test.ts']);
 const owners=new Map<string,string[]>();
 for(const layer of ['engine','format','game','sdk','commons','shards','app']){
  const file=layer==='app'?'src/tsconfig.test.json':`src/${layer}/tsconfig.test.json`;
  const parsed=ts.getParsedCommandLineOfConfigFile(resolve(file),{},
   {...ts.sys,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));}});
  if(parsed===undefined)throw new Error(`Missing test project ${file}`);
  for(const suite of parsed.fileNames.filter(path=>path.endsWith('.test.ts'))){
   const projects=owners.get(suite)??[];projects.push(file);owners.set(suite,projects);
  }
 }
 expect([...owners.keys()].sort()).toEqual([...suites].sort());
 for(const suite of suites)expect(owners.get(suite),suite).toHaveLength(1);
});

test('colocated tests retain the hard refusal of module replacement',()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/unit-policy-'));
 const target=resolve(root,'src/engine/example.test.ts'),config=resolve(root,'lint.json');
 try{
  mkdirSync(resolve(target,'..'),{recursive:true});
  const fast=fastCommitLintConfig(readLintConfig('.oxlintrc.json'));
  fast['jsPlugins']=[resolve('lint/wildshard-plugin.js')];writeFileSync(config,JSON.stringify(fast));
  writeFileSync(target,"import {vi} from 'vitest'; vi.mock('virtual-package');\n");
  const result=spawnSync(execPath,[resolve('node_modules/oxlint/bin/oxlint'),'-c',config,'--no-ignore',target],{cwd:root,encoding:'utf8'});
  expect(result.status,result.stdout+result.stderr).toBe(1);
  expect(result.stdout+result.stderr).toContain('no-module-mock');
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('format runner imports are test-only and do not open higher layers',()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/unit-policy-'));
 try{
  const config=resolve(root,'lint.json');
  const fast=fastCommitLintConfig(readLintConfig('.oxlintrc.json'));
  fast['jsPlugins']=[resolve('lint/wildshard-plugin.js')];writeFileSync(config,JSON.stringify(fast));
  const run=(file:string,source:string)=>{
   const target=resolve(root,`src/format/${file}`);mkdirSync(resolve(target,'..'),{recursive:true});
   writeFileSync(target,source);
   return spawnSync(execPath,[resolve('node_modules/oxlint/bin/oxlint'),'-c',config,'--no-ignore',target],{cwd:root,encoding:'utf8'});
  };
  const unit=run('example.test.ts',"import {expect,test} from 'vitest';\n\ntest('unit',()=>{expect(1).toBe(1);});\n");
  expect(unit.status,unit.stdout+unit.stderr).toBe(0);
  const production=run('example.ts',"import {expect} from 'vitest';\n\nexport const value=expect;\n");
  expect(production.status).toBe(1);expect(production.stdout+production.stderr).toContain('Format imports only');
  const higher=run('example.test.ts',"import {value} from '../game/example';\n\nexport const result=value;\n");
  expect(higher.status).toBe(1);expect(higher.stdout+higher.stderr).toContain('Format imports only');
 }finally{rmSync(root,{recursive:true,force:true});}
});
