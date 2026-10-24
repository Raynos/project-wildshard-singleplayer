// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real Git history in a tiny owned fixture.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns and removes only its tiny scratch tree.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths without a checkout or application build.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply the explicit GitHub identity to the pure API selection fixture.
import { env } from 'node:process';
import { expect, test } from 'vitest';
import { culpritReport, priorGreen } from '../scripts/ci-culprits.mjs';

test('culprits follow committed imports and exports, prioritize the failing file and cap the report', () => {
  mkdirSync('tmp', { recursive: true });
  const root=mkdtempSync(resolve('tmp/ci-culprits-'));
  const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const write=(path:string,source:string):void=>{mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),source);};
  const commit=(subject:string):string=>{
    git('add','.');git('-c','core.hooksPath=/dev/null','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm',`${subject}\n\nAssisted-by: fixture:recorded`);
    return git('rev-parse','HEAD');
  };
  try {
    git('init','-q','-b','main');
    write('src/engine/package.json',JSON.stringify({exports:{'./value':'./value.ts'}}));
    write('src/engine/value.ts',"export {value} from './dependency.js';");
    write('src/engine/dependency.ts','export const value=0;');
    write('test/failure.test.ts',"import {value} from '@wildshard/engine/value'; console.log(value);");
    const base=commit('base');
    write('test/failure.test.ts',"import {value} from '@wildshard/engine/value'; console.log(value+1);");
    const direct=commit('change failing file');
    const related:string[]=[];
    for(let i=1;i<=4;i++){write('src/engine/dependency.ts',`export const value=${i};`);related.push(commit(`change dependency ${i}`));}
    write('src/unrelated.ts','export const unrelated=1;');const sha=commit('unrelated');
    // A peer's loose edit must never change the immutable failure graph.
    write('test/failure.test.ts',"import '../src/unrelated';");
    const report=culpritReport(root,base,sha,['test/failure.test.ts']);
    expect(report.candidates.map(row=>row.sha)).toEqual([direct,related[3],related[2]]);
    expect(report.candidates[0]).toMatchObject({match:'failing file',assistedBy:'fixture:recorded'});
    expect(report.candidates[1]?.match).toBe('literal import');
    expect(report.missingImports).toEqual([]);
    expect(()=>culpritReport(root,base,sha,['src/../outside.ts'])).toThrow('invalid');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('a deleted import remains attributable through the previous immutable tree', () => {
  mkdirSync('tmp', { recursive: true });const root=mkdtempSync(resolve('tmp/ci-culprits-delete-'));
  const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const commit=():string=>{git('add','.');git('-c','core.hooksPath=/dev/null','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD');};
  try {
    git('init','-q','-b','main');mkdirSync(resolve(root,'src'));mkdirSync(resolve(root,'test'));
    writeFileSync(resolve(root,'src/old.ts'),'export const old=1;');
    writeFileSync(resolve(root,'test/failure.test.ts'),"import '../src/old';");const base=commit();
    rmSync(resolve(root,'src/old.ts'));const sha=commit();
    const report=culpritReport(root,base,sha,['test/failure.test.ts']);
    expect(report.candidates.map(row=>row.sha)).toEqual([sha]);
    expect(report.missingImports).toContain('src/old');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('prior green excludes release-only, future and wrong-source runs', () => {
  const sha='a'.repeat(40),base='b'.repeat(40);
  const previous={event:'push',head_branch:'main',head_sha:base,status:'completed',conclusion:'success',created_at:'2026-10-24T10:00:00Z',path:'.github/workflows/deploy.yml'};
  const oldRepo=env['GITHUB_REPOSITORY'],oldRun=env['GITHUB_RUN_ID'];
  env['GITHUB_REPOSITORY']='owner/repo';env['GITHUB_RUN_ID']='42';
  try {
    const query=(path:string):unknown=>path.endsWith('/42')?{...previous,head_sha:sha,created_at:'2026-10-24T11:00:00Z'}:
      {workflow_runs:[{...previous,event:'workflow_dispatch',created_at:'2026-10-24T10:59:00Z'},
        {...previous,head_sha:'c'.repeat(40),created_at:'2026-10-24T12:00:00Z'},previous]};
    expect(priorGreen(sha,query)).toBe(base);
    expect(()=>priorGreen(sha,()=>({}))).toThrow();
    expect(()=>priorGreen('d'.repeat(40),query)).toThrow('not the exact main push');
  } finally {
    if(oldRepo===undefined)delete env['GITHUB_REPOSITORY'];else env['GITHUB_REPOSITORY']=oldRepo;
    if(oldRun===undefined)delete env['GITHUB_RUN_ID'];else env['GITHUB_RUN_ID']=oldRun;
  }
});
