// Real CLI + HTTP boundaries: refused remote evidence leaves the pin intact.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'), old='a'.repeat(40), next='b'.repeat(40), tip='c'.repeat(40);
test('scheduled selector commits no refused, foreign, red or different-epoch bytes',async()=>{
  const cwd=mkdtempSync(join(root,'tmp/train-boundary-'));mkdirSync(join(cwd,'.github'));
  const pin=JSON.parse(readFileSync(join(root,'engine.pin.json'),'utf8'));pin.engine.commit=old;
  const original=JSON.stringify(pin)+'\n';
  let mode='green', requests=0;
  const server=createServer((req,res)=>{
    requests++;const path=new URL(req.url,'http://fixture').pathname;
    res.setHeader('Content-Type','application/json');
    let body;
    if(path==='/version.json')body={build:'d'.repeat(7)+'-live',saveEpoch:1};
    else if(path.includes('workflows/deploy.yml/runs'))body={workflow_runs:mode==='active'?[{event:'push',head_branch:'main',status:'in_progress'}]:[]};
    else if(path.endsWith('/branches/main'))body={commit:{sha:tip}};
    else if(path.includes('/jobs')){
      const ancestor=path.includes('/runs/5/'),docs=mode.startsWith('docs-after-')&&!ancestor;
      body={jobs:['plan','tests (1)','tests (2)','e2e'].filter(name=>mode!=='missing-e2e'||name!=='e2e').map(name=>({name,head_sha:mode==='foreign-jobs'?tip:ancestor?old:next,status:'completed',
        conclusion:docs||mode==='docs-skip'||mode==='e2e-skip'&&name==='e2e'||mode==='shard-skip'&&name==='tests (2)'?'skipped':mode==='tests-red'&&name==='tests (2)'?'failure':'success'}))};
    }
    else if(path.includes('/actions/runs')){
      body={workflow_runs:['ci','ring-1'].map((name,id)=>({id:id+1,name,head_sha:next,head_branch:'main',event:mode==='foreign'?'pull_request':'push',status:'completed',conclusion:mode==='red'&&name==='ring-1'?'failure':'success'}))};
      if(mode.startsWith('docs-after-'))body.workflow_runs.push(...['ci','ring-1'].map((name,id)=>({id:id+3,name,head_sha:'e'.repeat(40),head_branch:'main',event:'push',status:'completed',conclusion:name==='ci'?(mode==='docs-after-red'?'failure':'cancelled'):'success'})),...['ci','ring-1'].map((name,id)=>({id:id+5,name,head_sha:old,head_branch:'main',event:'push',status:'completed',conclusion:'success'})));
    }
    else if(path.includes('/compare/')){const [base]=path.split('/compare/')[1].split('...');body={status:mode==='diverged'?'diverged':'ahead',base_commit:{sha:base}};}
    else if(path.endsWith('/contents/save-epoch.json'))body={saveEpoch:mode==='wipe'?2:mode==='downgrade'?0:1};
    else{res.writeHead(404);res.end('{}');return;}
    res.end(JSON.stringify(body));
  });
  const invoke=origin=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[join(root,'scripts/release-train.mjs'),'--apply'],{cwd,env:{...process.env,GITHUB_API_URL:origin,WS_RELEASE_ORIGIN:origin,GITHUB_OUTPUT:''},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',code=>resolve({code,output}));
  });
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
    for(mode of ['held','active','foreign','red','diverged','wipe','downgrade','docs-skip','e2e-skip','shard-skip','tests-red','foreign-jobs','missing-e2e','docs-after-red','docs-after-cancel','green']){
      writeFileSync(join(cwd,'engine.pin.json'),original);writeFileSync(join(cwd,'.github/deploy-pin.json'),JSON.stringify({mode:mode==='held'?'pinned':'newest-ci-green'}));
      const result=await invoke(origin);
      if(mode==='green'){
        assert.equal(result.code,0,result.output);const selected=JSON.parse(readFileSync(join(cwd,'engine.pin.json'),'utf8'));
        assert.equal(selected.schema,2);assert.deepEqual(selected.engine,{repo:'engine',source:'main',commit:next});assert.equal(selected.saveEpoch,1);assert.deepEqual(selected.shards,pin.shards);
      }else{
        assert.equal(readFileSync(join(cwd,'engine.pin.json'),'utf8'),original,mode);
        if(['wipe','downgrade'].includes(mode))assert.notEqual(result.code,0,mode);
        else assert.equal(result.code,0,result.output);
      }
    }
    assert(requests>0);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(cwd,{recursive:true,force:true});}
});
test('promotion CLI refuses foreign or incomplete same-run proof before any write',()=>{
  const cwd=mkdtempSync(join(root,'tmp/promote-boundary-')), bin=join(cwd,'bin');mkdirSync(bin);mkdirSync(join(cwd,'.github'));
  writeFileSync(join(cwd,'.github/deploy-pin.json'),'{"mode":"newest-ci-green"}');
  writeFileSync(join(bin,'git'),`#!/usr/bin/env node
if(process.argv.slice(2).join(' ')!=='rev-parse HEAD')throw new Error('Unexpected Git operation');console.log('a'.repeat(40));
`);
  writeFileSync(join(bin,'gh'),`#!/usr/bin/env node
const sha='a'.repeat(40),mode=process.env.PROOF_CASE;
if(process.argv.some(a=>a.includes('/jobs?'))){let jobs=['build-pinned','stage-pinned','staged-Chromium','staged-WebKit'].map(name=>({name,status:'completed',conclusion:'success',head_sha:sha}));if(mode==='missing')jobs.pop();if(mode==='red')jobs[3].conclusion='failure';if(mode==='foreign-job')jobs[3].head_sha='b'.repeat(40);if(mode==='duplicate')jobs.push(jobs[3]);if(mode==='other-red')jobs.push({name:'new-required-proof',status:'completed',conclusion:'failure',head_sha:sha});console.log(JSON.stringify({jobs}));}
else console.log(JSON.stringify({head_sha:mode==='foreign-source'?'b'.repeat(40):sha,head_branch:'main',event:'push',path:'.github/workflows/deploy.yml',run_attempt:1}));
`);
  writeFileSync(join(bin,'vercel'),`#!/usr/bin/env node
require('fs').writeFileSync('unexpected-write','bad');process.exit(99);
`);
  for(const name of ['git','gh','vercel'])chmodSync(join(bin,name),0o755);
  try{for(const mode of ['foreign-source','missing','red','foreign-job','duplicate','other-red']){
    const result=spawnSync(process.execPath,[join(root,'scripts/promote-release.mjs'),'https://wildshard-singleplayer-fixture-raynos-projects.vercel.app','aaaaaaa-build','c'.repeat(64)],{cwd,encoding:'utf8',timeout:4000,env:{...process.env,PATH:bin+':'+process.env.PATH,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',PROOF_CASE:mode}});
    assert.notEqual(result.status,0,mode);assert.match(result.stderr,/Foreign release workflow|Missing same-source successful release job|Unfinished or red release gate/u);assert.equal(existsSync(join(cwd,'unexpected-write')),false);
  }}finally{rmSync(cwd,{recursive:true,force:true});}
});
