// @vitest-environment node
import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe actual atomic job receipts and native directory notification.
import {mkdtempSync,mkdirSync,writeFileSync,renameSync,rmSync,readFileSync,existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the workflow's actual Bash pipeline with an owned fake producer.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The preparation protocol is a Node job boundary.
import {join} from 'node:path';
import {preparePhoneSimulator,waitPhonePreparation,waitPhoneProducer} from '../scripts/parity/phone-route-preparation.mjs';

function fixture() {
  mkdirSync('tmp',{recursive:true});const directory=mkdtempSync('tmp/phone-preparation-');
  const path=join(directory,'preparation.json');
  const publish=(status:string,code:number|null)=>{
    writeFileSync(`${path}.next`,JSON.stringify({engine:'simulator',status,code,wallMs:42,udid:'12345678-1234-1234-1234-123456789ABC'}));
    renameSync(`${path}.next`,path);
  };
  return {path,publish,close:()=>{rmSync(directory,{recursive:true,force:true});}};
}

test('route waits for native preparation completion, not merely a started boot',async()=>{
  const f=fixture();try {
    f.publish('pending',null);const done=waitPhonePreparation(f.path);
    let complete=false;void done.then(()=>{complete=true;return undefined;});
    await Promise.resolve();expect(complete).toBe(false);
    f.publish('ready',0);expect(await done).toMatchObject({engine:'simulator',status:'ready',wallMs:42});
  }finally{f.close();}
});

test('failed native boot refuses instead of retrying or silently selecting WebKit',async()=>{
  const f=fixture();try {
    f.publish('failed',124);await expect(waitPhonePreparation(f.path)).rejects.toThrow('preparation failed (124)');
    f.publish('ready',1);await expect(waitPhonePreparation(f.path)).rejects.toThrow('preparation failed (1)');
  }finally{f.close();}
});

test('runner without iOS publishes its explicit WebKit preparation without simctl',async()=>{
  const f=fixture();try {
    preparePhoneSimulator(f.path,'webkit');expect(await waitPhonePreparation(f.path)).toMatchObject({engine:'webkit',status:'ready',code:0,udid:null});
  }finally{f.close();}
});

function producerFixture() {
  const started=Date.parse('2026-10-30T00:00:00Z');
  return {started,self:{name:'phone-route',status:'in_progress',conclusion:null,started_at:new Date(started).toISOString(),run_id:123},
    producer:{name:'prepare',status:'queued',conclusion:'success',run_id:123,started_at:null}};
}

test('early native job waits for only its exact producer, not its own aggregate or failed siblings',async()=>{
  const f=producerFixture(),paths:string[]=[],waits:number[]=[];let clock=f.started;
  await waitPhoneProducer('fixture/repo','123',{
    now:()=>clock,
    read:path=>{
      paths.push(path);f.producer.status=paths.length===1?'queued':paths.length===2?'in_progress':'completed';
      return Promise.resolve([f.self,f.producer,{name:'unrelated',status:'completed',conclusion:'failure',run_id:123,started_at:null}]);
    },
    wait:ms=>{waits.push(ms);clock+=ms;return Promise.resolve();},
  });
  expect(paths).toHaveLength(3);expect(waits).toEqual([5000,5000]);
  expect(paths.every(path=>path==='repos/fixture/repo/actions/runs/123/jobs?per_page=100&filter=latest')).toBe(true);
});

test('failed, duplicated or foreign producers cannot trigger transfer or another native preparation',async()=>{
  for(const conclusion of ['failure','cancelled','skipped']) {
    const f=producerFixture();f.producer.status='completed';f.producer.conclusion=conclusion;
    await expect(waitPhoneProducer('fixture/repo','123',{now:()=>f.started,
      read:()=>Promise.resolve([f.self,f.producer]),wait:()=>{throw new Error('Unexpected retry');}})).rejects.toThrow('producer failed');
  }
  const f=producerFixture();
  for(const rows of [[f.self,f.producer,f.producer],[{...f.self,run_id:999},f.producer],
    [f.self,{...f.producer,run_id:999}],[f.producer]])
    await expect(waitPhoneProducer('fixture/repo','123',{now:()=>f.started,read:()=>Promise.resolve(rows)})).rejects.toThrow();
  await expect(waitPhoneProducer('fixture/repo','123',{read:()=>Promise.reject(new Error('API unavailable')),
    wait:()=>{throw new Error('Unexpected retry');}})).rejects.toThrow('API unavailable');
});

test('producer condition waiting spends the existing job deadline and never starts a new budget',async()=>{
  const f=producerFixture();let clock=f.started;
  await expect(waitPhoneProducer('fixture/repo','123',{now:()=>clock,read:()=>Promise.resolve([f.self,f.producer]),
    wait:()=>{clock=f.started+20*60*1000;return Promise.resolve();}})).rejects.toThrow('original job deadline');
  for(const run of ['0','123\ninjected','not-a-run'])
    await expect(waitPhoneProducer('fixture/repo',run)).rejects.toThrow('identity');
});

test('the actual preparation pipeline propagates failure before installs or transfer',()=>{
  const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
  const step=workflow.split('      - name: Prepare isolated Safari while the build runs\n')[1]?.split('\n      - ')[0];
  if(step===undefined)throw new Error('Missing native preparation step');
  const run=step.split('        run: |\n')[1];if(run===undefined)throw new Error('Missing native preparation command');
  const body=run.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  // GitHub's implicit bash uses -e; an explicit bash step adds pipefail.
  const args=step.includes('        shell: bash\n')?['--noprofile','--norc','-e','-o','pipefail']:['-e'];
  const f=fixture();const bin=join(f.path,'..','bin');mkdirSync(bin);
  writeFileSync(join(bin,'node'),'#!/bin/sh\nprintf "native refused\\n"\nexit 124\n',{mode:0o755});
  try {
    const continued=join(f.path,'..','continued');
    const result=spawnSync('/bin/bash',[...args,'-c',`${body}\nprintf continued > "$FOLLOWUP"`],{
      encoding:'utf8',timeout:5000,env:{...process.env,PATH:`${bin}:${process.env['PATH']??''}`,RUNNER_TEMP:join(f.path,'..'),
        GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_ENV:join(f.path,'..','env'),FOLLOWUP:continued}});
    expect(result.status,result.stderr).toBe(124);expect(existsSync(continued)).toBe(false);
    expect(readFileSync(join(f.path,'..','phone-preparation/native.log'),'utf8')).toContain('native refused');
  }finally{f.close();}
});
