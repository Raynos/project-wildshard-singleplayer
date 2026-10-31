// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the installed linter and real read-only Git inventory.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each diagnostic fixture owns and removes its directory.
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the repository and owned fixtures explicitly.
import {resolve} from 'node:path';
import {expect,test} from 'vitest';
import {precommitGit} from '../scripts/precommit-inputs.mjs';
import {readLintConfig} from '../scripts/guard-counts.mjs';

test('the live Git helper captures the complete real index beyond the default buffer',()=>{
  const root=resolve(import.meta.dirname,'..'),args=['ls-files','--stage','-z'];
  const output=precommitGit(root,args);
  expect(output.endsWith('\0')).toBe(true);
  expect(output).toContain('\tscripts/precommit-inputs.mjs\0');
  const original=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  // Current real index is ~2.95 MB. A future smaller repository should not fail
  // for getting smaller; the linter regression below still refuses omission.
  if(Buffer.byteLength(output)>1024*1024)expect(original.error).toMatchObject({code:'ENOBUFS'});
  else {expect(original.error).toBeUndefined();expect(original.stdout).toBe(output);}
});

test('the real lint rule rejects default captured inventory buffers and retains bounded controls',()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/exec-max-buffer-'));
  const config=resolve(root,'lint.json'),file=resolve(root,'precommit-fixture.mjs');
  writeFileSync(config,JSON.stringify({jsPlugins:[resolve('lint/wildshard-plugin.js')],
    categories:{correctness:'off'},rules:{'wildshard/exec-max-buffer':'error'}}));
  const run=(source:string)=>{
    writeFileSync(file,source);
    return spawnSync(resolve('node_modules/.bin/oxlint'),['-c',config,'--no-ignore','--threads=1',file],
      {encoding:'utf8',timeout:10_000,maxBuffer:8*1024*1024});
  };
  const imports="import {execFileSync as exec,spawnSync,execSync} from 'node:child_process';\n";
  try {
    const missing=[
      "exec('git',['ls-files','--stage','-z'],{encoding:'utf8'});",
      "exec('git',args,{encoding:'utf8'});",
      "spawnSync('git',['diff','--cached','--name-only'],{});",
      "execSync('git ls-tree -r HEAD');",
      "const options={encoding:'utf8'};exec('git',['show','HEAD:file'],options);",
      "exec('git',['log'],{maxBuffer:0});",
      "exec('git',['log'],{maxBuffer:undefined});",
      "exec('git',['log'],{maxBuffer:32*1024*1024,...unknown});",
      "exec('git',['log'],{stdio:['ignore','pipe','inherit']});",
      "import * as cp from 'child_process';cp['execFileSync']('git',args);",
      "const capture=exec;capture('git',args);",
    ];
    for(const source of missing) {
      const result=run(imports+source);expect(result.status,source+result.stdout+result.stderr).toBe(1);
      expect(result.stdout).toContain('exec-max-buffer');
    }
    const allowed=[
      "exec('git',args,{maxBuffer:32*1024*1024});",
      "const options={maxBuffer:8*1024*1024};exec('git',args,{...options,encoding:'utf8'});",
      "exec('git',args,{...unknown,maxBuffer:32*1024*1024});",
      "spawnSync('git',args,{stdio:'inherit'});",
      "exec('git',args,{stdio:['ignore','ignore','inherit']});",
      "exec('git',['rev-parse','--git-common-dir'],{encoding:'utf8'});",
      "exec('git',['merge-base','--is-ancestor','HEAD','main']);",
      "exec('echo',['small']);",
      "import {execFileSync as local} from './ordinary.mjs';local('git',args);",
    ];
    for(const source of allowed) {
      const result=run(imports+source);expect(result.status,source+result.stdout+result.stderr).toBe(0);
    }
    const live=readFileSync('scripts/precommit-inputs.mjs','utf8');
    expect(run(live).status).toBe(0);
    const mutant=live.replace(',maxBuffer:32*1024*1024','');expect(mutant).not.toBe(live);
    const refusal=run(mutant);expect(refusal.status,refusal.stdout+refusal.stderr).toBe(1);
    expect(refusal.stdout).toContain('exec-max-buffer');
    const policy=readLintConfig(resolve('.oxlintrc.json'));
    expect(policy.overrides?.some(row=>row.files?.includes('scripts/precommit*.mjs')&&row.rules?.['wildshard/exec-max-buffer']==='error')).toBe(true);
  } finally {rmSync(root,{recursive:true,force:true});}
});
