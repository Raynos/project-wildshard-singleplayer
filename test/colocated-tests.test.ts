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

const units=readdirSync('src/engine',{recursive:true,encoding:'utf8'})
 .filter(file=>file.endsWith('.test.ts')).map(file=>`src/engine/${file}`);

test('the actual engine composite project includes its colocated unit tests',()=>{
 const project=ts.getParsedCommandLineOfConfigFile(resolve('tsconfig.engine.json'),{},
  {...ts.sys,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));}});
 expect(project).toBeDefined();expect(units.length).toBeGreaterThanOrEqual(5);
 for(const file of units)expect(project?.fileNames).toContain(resolve(file));
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
