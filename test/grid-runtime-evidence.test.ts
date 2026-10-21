import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned small evidence fixtures, never repository copies.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {resolve} from 'node:path';
import {runtimeGridEvidence} from '../scripts/grid-runtime-evidence.mjs';

const sha='a'.repeat(40),caps={explorerMB:1200,loadingMB:1800};
it('uses only completed exact-SHA Safari grid windows and keeps unmeasured memory unknown',()=>{
 const root=mkdtempSync(resolve('tmp','grid-witness-'));
 try{
  const receipt=(when:string,pass:boolean,source=sha):unknown=>({schema:1,source,protocol:{profiler:false,glObserver:'off'},runs:[{sha:source,when,surface:'sim',cohort:'grid',complete:true,glObserver:'off',
   cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],
    rows:[{name:'grid-pine-entry-drive',frames:120,pass,contextLost:false,maxMs:pass?100:250,p95Ms:33.3,medianFps:30}]}]}]});
  writeFileSync(resolve(root,'old.json'),JSON.stringify(receipt('2026-10-16T01:00:00Z',true)));
  writeFileSync(resolve(root,'new.json'),JSON.stringify(receipt('2026-10-16T02:00:00Z',false)));
  writeFileSync(resolve(root,'other.json'),JSON.stringify(receipt('2026-10-16T03:00:00Z',true,'b'.repeat(40))));
  const first=runtimeGridEvidence(root,'pine-hollow',sha,['old.json','other.json'],caps);
  expect(first.oneFrameLooks?.verdict).toBe('pass');expect(first.memory).toBeUndefined();
  const latest=runtimeGridEvidence(root,'pine-hollow',sha,['new.json','old.json','other.json'],caps);
  expect(latest.oneFrameLooks?.verdict).toBe('fail');expect(latest.oneFrameLooks?.evidence).toContain('new.json sha256:');
  expect(runtimeGridEvidence(root,'driftwood-isle',sha,['old.json'],caps)).toEqual({});
  expect(runtimeGridEvidence(root,'pine-hollow',null,['old.json'],caps)).toEqual({});
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('grades qualified native soak peaks against the current cap without substituting a model',()=>{
 const root=mkdtempSync(resolve('tmp','grid-memory-witness-'));
 try{
  const receipt={schema:3,sha,driveStarted:'2026-10-16T01:00:00Z',surface:'portrait iPhone Simulator Safari',functionalPass:true,seconds:1800,circuits:2,errors:[],
   grade:{sampling:true,missingGlSamples:0,rehearsal:false,calibration:true,leakZero:true,requiredSeconds:1800,admitted:['pine-hollow'],peakBytes:1_100_000_000,loadingPeakBytes:1_500_000_000}};
  writeFileSync(resolve(root,'soak.json'),JSON.stringify(receipt));
  expect(runtimeGridEvidence(root,'pine-hollow',sha,['soak.json'],caps).memory?.verdict).toBe('pass');
  expect(runtimeGridEvidence(root,'pine-hollow',sha,['soak.json'],{...caps,explorerMB:1000}).memory?.verdict).toBe('fail');
  writeFileSync(resolve(root,'soak.json'),JSON.stringify({...receipt,grade:{...receipt.grade,loadingPeakBytes:0}}));
  expect(runtimeGridEvidence(root,'pine-hollow',sha,['soak.json'],caps)).toEqual({});
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('accepts non-quiet native memory without promoting its frame windows', () => {
 const root=mkdtempSync(resolve('tmp','grid-nonquiet-witness-'));
 const receipt=(quiet:boolean,when:string)=>({schema:1,source:sha,protocol:{profiler:false,glObserver:'off',quiet},runs:[{
  sha,when,surface:'sim',cohort:'grid',complete:true,glObserver:'off',
  memory:{measurement:'native-footprint+gpu',samples:3,playingPeakBytes:1_100_000_000,loadingPeakBytes:1_500_000_000},
  cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],
   rows:[{name:'grid-pine-entry-drive',frames:120,pass:quiet,contextLost:false,maxMs:100,p95Ms:33.3,medianFps:30}]}],
 }]});
 try{
  writeFileSync(resolve(root,'quiet.json'),JSON.stringify(receipt(true,'2026-10-16T01:00:00Z')));
  writeFileSync(resolve(root,'memory.json'),JSON.stringify(receipt(false,'2026-10-16T02:00:00Z')));
  const only=runtimeGridEvidence(root,'pine-hollow',sha,['memory.json'],caps);
  expect(only.memory?.verdict).toBe('pass');expect(only.oneFrameLooks).toBeUndefined();expect(only.frameFloor).toBeUndefined();
  const mixed=runtimeGridEvidence(root,'pine-hollow',sha,['quiet.json','memory.json'],caps);
  expect(mixed.memory?.evidence).toContain('memory.json sha256:');
  expect(mixed.oneFrameLooks?.verdict).toBe('pass');expect(mixed.oneFrameLooks?.evidence).toContain('quiet.json sha256:');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('separates visual stalls from frame floor and refuses unmeasured timing',()=>{
 const root=mkdtempSync(resolve('tmp','grid-split-witness-'));
 const source={schema:1,source:sha,protocol:{profiler:false,glObserver:'off',quiet:true},runs:[{
  sha,when:'2026-10-20T01:00:00Z',surface:'sim',cohort:'grid',complete:true,glObserver:'off',
  cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],
   rows:[{name:'grid-pine-entry-drive',frames:120,pass:false,contextLost:false,maxMs:150,p95Ms:50,medianFps:20}]}],
 }]};
 const evidence=()=>runtimeGridEvidence(root,'pine-hollow',sha,['receipt.json'],caps);
 const write=()=>{writeFileSync(resolve(root,'receipt.json'),JSON.stringify(source));};
 try{
  write();expect(evidence().oneFrameLooks?.verdict).toBe('pass');expect(evidence().frameFloor?.verdict).toBe('fail');
  const row=source.runs[0]?.cases[0]?.rows[0];if(row===undefined)throw new Error('Missing fixture row');
  row.maxMs=201;write();expect(evidence().oneFrameLooks?.verdict).toBe('fail');
  row.maxMs=200;row.p95Ms=35;row.medianFps=30;write();
  expect(evidence().oneFrameLooks?.verdict).toBe('pass');expect(evidence().frameFloor?.verdict).toBe('pass');
  row.contextLost=true;write();expect(evidence().oneFrameLooks?.verdict).toBe('fail');
  row.contextLost=false;
  const run=source.runs[0];if(run===undefined)throw new Error('Missing fixture run');
  run.surface='desktop';row.p95Ms=17.5;row.medianFps=60;write();
  expect(evidence().oneFrameLooks).toBeUndefined();expect(evidence().frameFloor?.verdict).toBe('pass');
  row.medianFps=59;write();expect(evidence().frameFloor?.verdict).toBe('fail');
  run.surface='sim';row.p95Ms=34;row.medianFps=30;
  const scene=run.cases[0];if(scene===undefined)throw new Error('Missing fixture case');
  scene.rows.push({...row,name:'grid-pine-entry',p95Ms:36});write();
  expect(evidence().oneFrameLooks?.verdict).toBe('pass');expect(evidence().frameFloor?.verdict).toBe('fail');
  const missing={...source,runs:[{...run,surface:'sim',cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],rows:[{name:row.name,frames:120,pass:true,contextLost:false}]}]}]};
  writeFileSync(resolve(root,'receipt.json'),JSON.stringify(missing));
  expect(evidence().oneFrameLooks?.verdict).toBe('unknown');expect(evidence().frameFloor?.verdict).toBe('unknown');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('carries unchanged B1/runtime bindings and refuses either changed key', () => {
 const root=mkdtempSync(resolve('tmp','grid-key-witness-'));
 const measured='b'.repeat(40),product='c'.repeat(64),runtime='d'.repeat(64);
 const receipt={schema:1,source:measured,contentKeys:{schema:'grid-runtime-keys/1',source:measured,runtime,products:{'pine-hollow':product}},
  protocol:{profiler:false,glObserver:'off'},runs:[{sha:measured,when:'2026-10-21T01:00:00Z',surface:'sim',cohort:'grid',complete:true,glObserver:'off',
   cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],
    rows:[{name:'grid-pine-entry-drive',frames:120,pass:true,contextLost:false,maxMs:100,p95Ms:33,medianFps:30}]}]}]};
 try {
  writeFileSync(resolve(root,'receipt.json'),JSON.stringify(receipt));
  const read=(productKey=product,runtimeKey=runtime)=>runtimeGridEvidence(root,'pine-hollow',sha,['receipt.json'],caps,{productKey,runtimeKey});
  expect(read().oneFrameLooks?.verdict).toBe('pass');
  expect(read().oneFrameLooks?.evidence).toContain(`source ${measured}; carried to ${sha}`);
  expect(read().oneFrameLooks?.evidence).toContain(`unchanged B1 product ${product} and grid runtime ${runtime}`);
  expect(read('e'.repeat(64))).toEqual({});
  expect(read(product,'f'.repeat(64))).toEqual({});
  receipt.contentKeys.source=sha;
  writeFileSync(resolve(root,'receipt.json'),JSON.stringify(receipt));
  expect(read()).toEqual({});
 } finally {rmSync(root,{recursive:true,force:true});}
});

it('accepts a qualified Chromium phone witness and separately observed CDP memory', () => {
 const root=mkdtempSync(resolve('tmp','grid-chromium-witness-'));
 const reading={measurement:'chromium-residency+cdp',owner:'pine-hollow',samples:4,playingPeakBytes:100_000_000,loadingPeakBytes:200_000_000,
  cdp:'memory-infra',browserProcessPeakBytes:2_000_000_000,rendererProcessPeakBytes:3_000_000_000,gpuProcessPeakBytes:500_000_000};
 const receipt={schema:1,source:sha,protocol:{profiler:false,glObserver:'off'},runs:[{sha,when:'2026-10-21T01:00:00Z',surface:'chromium',cohort:'grid',complete:true,glObserver:'off',
  profile:{device:'iPhone 16 Pro',tier:'phone',cpu:4,muted:true},memory:reading,
  cases:[{shard:'grid',complete:true,errors:[],routes:[{name:'pine-entry',after:{current:'pine-hollow'}}],
   rows:[{name:'grid-pine-entry-drive',frames:120,pass:true,contextLost:false,maxMs:100,p95Ms:33,medianFps:30}]}]}]};
 const read=()=>{writeFileSync(resolve(root,'receipt.json'),JSON.stringify(receipt));return runtimeGridEvidence(root,'pine-hollow',sha,['receipt.json'],caps);};
 try {
  expect(read().oneFrameLooks?.verdict).toBe('pass');expect(read().memory?.verdict).toBe('pass');
  reading.playingPeakBytes=1_200_000_001;expect(read().memory?.verdict).toBe('fail');
  reading.playingPeakBytes=100_000_000;reading.owner='other';expect(read().memory).toBeUndefined();
  reading.owner='pine-hollow';const first=receipt.runs[0];if(first===undefined)throw new Error('Missing Chromium run');
  first.profile.cpu=1;expect(read()).toEqual({});
 } finally {rmSync(root,{recursive:true,force:true});}
});
