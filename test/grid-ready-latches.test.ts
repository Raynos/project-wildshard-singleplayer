import * as v from 'valibot';
import {expect,it,vi} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Small isolated Git fixture, no repository copy.
import {execFileSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture files and cleanup.
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {resolve,dirname} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate fixture Git configuration from the user's configuration.
import process from 'node:process';
import {GRID_READY_LATCHES,GridReadyLatchesSchema,latchedGridEvidence} from '../scripts/grid-ready-latches.mjs';
import {runtimeGridEvidence} from '../scripts/grid-runtime-evidence.mjs';
import {latchGridEvidence} from '../scripts/latch-grid-evidence.mjs';

it('reads pinned latches from Git when the fenced mirror omits progress',()=>{
 const root=mkdtempSync(resolve('tmp','grid-latch-git-'));
 const env:NodeJS.ProcessEnv={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_CEILING_DIRECTORIES:''};
 delete env['GIT_DIR'];delete env['GIT_WORK_TREE'];delete env['GIT_INDEX_FILE'];
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
 const path=resolve(root,GRID_READY_LATCHES);
 const latch={shard:'_template',criterion:'oneFrameLooks',source:'a'.repeat(40),receiptCommit:'b'.repeat(40),receipt:'old/receipt.json',latchedAt:'2026-10-21T13:00:00Z',quiet:false};
 const write=(entries:unknown[])=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({schema:'grid-ready-latches/1',entries}));};
 try {
  git('init','-q','-b','main');git('config','user.name','fixture');git('config','user.email','fixture@example.invalid');
  git('config','core.hooksPath','/dev/null');git('config','commit.gpgSign','false');
  writeFileSync(resolve(root,'runtime.txt'),'before');const before=commit();
  write([latch]);const measured=commit();
  writeFileSync(resolve(root,'runtime.txt'),'later runtime');const carried=commit();
  const mirror=resolve(root,'mirror','tree');mkdirSync(mirror,{recursive:true});
  vi.stubEnv('GIT_CEILING_DIRECTORIES',resolve(root,'mirror'));
  expect(latchedGridEvidence(mirror,'_template',before)).toEqual({});
  expect(latchedGridEvidence(mirror,'_template',measured).oneFrameLooks?.verdict).toBe('pass');
  expect(runtimeGridEvidence(mirror,'_template',carried,[],{explorerMB:1200,loadingMB:1800}).oneFrameLooks?.verdict).toBe('pass');
  write([]); // An uncommitted working copy cannot remove a pass from the pinned revision.
  expect(latchedGridEvidence(root,'_template',carried).oneFrameLooks?.verdict).toBe('pass');
  writeFileSync(resolve(root,'failure.json'),JSON.stringify({schema:1,source:carried,protocol:{profiler:false,glObserver:'off',quiet:true},runs:[{
   sha:carried,when:'2026-10-22T01:00:00Z',surface:'sim',cohort:'grid',complete:true,glObserver:'off',
   cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'template-entry',after:{current:'_template'}}],
    rows:[{name:'grid-template-entry-drive',frames:120,pass:false,contextLost:false,maxMs:900,p95Ms:40,medianFps:25}]}]}]}));
  const evidence=runtimeGridEvidence(root,'_template',carried,['failure.json'],{explorerMB:1200,loadingMB:1800});
  expect(evidence.oneFrameLooks?.verdict).toBe('pass');expect(evidence.frameFloor?.verdict).toBe('fail');
  expect(runtimeGridEvidence(root,'_template',carried,['failure.json'],{explorerMB:1200,loadingMB:1800},false).oneFrameLooks?.verdict).toBe('fail');
  const removed=commit();
  expect(latchedGridEvidence(mirror,'_template',removed)).toEqual({});
  expect(latchedGridEvidence(mirror,'_template',carried).oneFrameLooks?.verdict).toBe('pass');
  write([latch]);
  expect(latchedGridEvidence(root,'_template',before)).toEqual({});
 } finally {vi.unstubAllEnvs();rmSync(root,{recursive:true,force:true});}
});

it('carries inline measurement numbers without a receipt folder',()=>{
 const root=mkdtempSync(resolve('tmp','grid-inline-latch-'));
 const row={shard:'_template',criterion:'oneFrameLooks',source:'a'.repeat(40),latchedAt:'2026-10-21T16:00:00Z',quiet:true,
  measurement:{when:'2026-10-21T15:00:00Z',surface:'chromium',metrics:{entryMaxMs:166.7,lookMaxMs:50,leaveMaxMs:116.7}}};
 try {
  const path=resolve(root,GRID_READY_LATCHES);mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify({schema:'grid-ready-latches/1',entries:[row]}));
  expect(latchedGridEvidence(root,'_template').oneFrameLooks?.verdict).toBe('pass');
  expect(latchedGridEvidence(root,'_template').oneFrameLooks?.evidence).toContain('166.7');
  const parse=(entry:unknown)=>v.parse(GridReadyLatchesSchema,{schema:'grid-ready-latches/1',entries:[entry]});
  expect(()=>parse({...row,measurement:undefined})).toThrow('requires inline');
  expect(()=>parse({...row,receipt:'missing-commit'})).toThrow('paired');
  expect(()=>parse({...row,measurement:{...row.measurement,metrics:{bad:Infinity}}})).toThrow();
 } finally {rmSync(root,{recursive:true,force:true});}
});

it('writes qualified numbers inline from scratch observations without committing receipts',()=>{
 const root=mkdtempSync(resolve('tmp','grid-latch-writer-')),source='a'.repeat(40);
 try {
  mkdirSync(resolve(root,'src/format'),{recursive:true});
  writeFileSync(resolve(root,'src/format/memoryGates.json'),JSON.stringify({explorerMB:1200,loadingMB:1800}));
  const row={name:'grid-entry-drive',frames:120,pass:true,contextLost:false,maxMs:166.7,p95Ms:50,medianFps:30};
  const observation={schema:1,source,protocol:{profiler:false,glObserver:'off',quiet:true},runs:[{
   sha:source,when:'2026-10-21T15:00:00Z',surface:'chromium',cohort:'grid',complete:true,glObserver:'off',
   profile:{device:'iPhone 16 Pro',tier:'phone',cpu:4,muted:true},
   cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'entry',after:{current:'_template'}}],rows:[row]}]}]};
  writeFileSync(resolve(root,'run.json'),JSON.stringify(observation));
  expect(latchGridEvidence(root,'run.json','',['_template'])).toBe(1);
  const result=v.parse(GridReadyLatchesSchema,JSON.parse(readFileSync(resolve(root,GRID_READY_LATCHES),'utf8')));
  expect(result.entries[0]?.measurement?.metrics['grid-entry-drive.maxMs']).toBe(166.7);
  expect(result.entries[0]?.receipt).toBeUndefined();expect(result.entries[0]?.receiptCommit).toBeUndefined();
  // The writer never treats an existing pass as evidence for a new observation.
  row.maxMs=300;writeFileSync(resolve(root,'run.json'),JSON.stringify(observation));
  expect(latchGridEvidence(root,'run.json','',['_template'])).toBe(0);
  expect(runtimeGridEvidence(root,'_template',source,['run.json'],{explorerMB:1200,loadingMB:1800},false).oneFrameLooks?.verdict).toBe('fail');
  expect(latchedGridEvidence(root,'_template').oneFrameLooks?.verdict).toBe('pass');
 } finally {rmSync(root,{recursive:true,force:true});}
});
