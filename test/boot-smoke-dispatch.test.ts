// oxlint-disable-next-line import/no-nodejs-modules -- Parse the actual native bootstrap without browser or network.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate only the actual workflow's concurrency-key expressions.
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { watchPhoneEntry } from '../scripts/parity/phone-route-page.mjs';
import { phoneBootstrap } from '../scripts/parity/phone-route-browser.mjs';
import { deadlineRecoverySource, readySource, recoverySource, waveSource } from '../scripts/deploy-pin.mjs';
import deploy from '../.github/workflows/deploy.yml?raw';

const sha = 'a'.repeat(40);
const jobs = ['prepare','typecheck-lint','derived-docs','behaviour','native-escape','journeys','boot-verdict'];
const needs = Object.fromEntries(jobs.map(name => [name,{result:'success'}]));
const current = {mode:'newest-ci-green',event:'push',ref:'refs/heads/main',repository:'Raynos/project-wildshard-singleplayer',
  sha,run:'123',head:sha,needs};

test('the current main wave ships its own exact producer without waiting for its ship aggregate', () => {
  expect(waveSource(current)).toEqual({skip:false,sha,run:'123'});
  for (const name of jobs) for (const result of ['failure','cancelled','skipped','in_progress'])
    expect(() => waveSource({...current,needs:{...needs,[name]:{result}}})).toThrow('Wave prerequisite');
  const {prepare:_prepare,...missing}=needs;
  expect(() => waveSource({...current,needs:missing})).toThrow('inventory');
  expect(() => waveSource({...current,needs:{...needs,foreign:{result:'success'}}})).toThrow('inventory');
  for (const invalid of [null,[],true]) expect(() => waveSource({...current,needs:invalid})).toThrow('verdicts');
});

test('foreign, stale, pull-request and malformed producer identities cannot deploy', () => {
  for (const change of [{event:'pull_request'},{ref:'refs/heads/other'},{repository:'foreign/repo'},
    {sha:'short'},{head:'b'.repeat(40)},{run:'foreign'},{run:'0'}])
    expect(() => waveSource({...current,...change})).toThrow('exact main push');
  for (const mode of ['pinned','newest-green']) expect(waveSource({...current,mode}).skip).toBe(true);
});

test('one push wave keeps all six browser guards and serialized exact-artifact shipping', () => {
  const ship=deploy.split('\n  build-and-deploy:\n')[1]?.split('\n  typecheck-lint:\n')[0];
  const journeys=deploy.split('\n  journeys:\n')[1]?.split('\n  boot-verdict:\n')[0];
  if(ship===undefined||journeys===undefined)throw new Error('Missing push-wave proof or ship');
  expect(ship).toContain('needs: [prepare, typecheck-lint, derived-docs, behaviour, native-escape, journeys, boot-verdict]');
  expect(ship).toContain("needs.native-escape.result == 'success'");
  expect(ship).toContain('CI_WAVE_NEEDS:');expect(ship).toContain('read-wave');
  expect(ship).toContain('group: production-release');expect(ship).toContain('check-live-floor');
  expect(ship).toContain('vercel deploy --prebuilt');
  const restore=ship.split('- name: Restore the exact successful push artifact')[1]?.split('# Explicit recovery')[0];
  const recovery=ship.split('- name: Build proven recovery source')[1]?.split('# Hidden maps')[0];
  if(restore===undefined||recovery===undefined)throw new Error('Missing shipping branches');
  expect(restore).toContain("steps.pin.outputs.recovery != 'true'");
  expect(restore).not.toContain('vercel build');
  expect(recovery).toContain("steps.pin.outputs.recovery == 'true'");
  expect(recovery).toContain('vercel build --prod');
  expect(recovery).toContain('check-live-floor');
  expect(recovery).toContain(`VERCEL_GIT_COMMIT_SHA: \${{ steps.pin.outputs.sha }}`);
  expect(ship).toContain('run: pnpm install --frozen-lockfile');
  expect(ship).toContain('read-recovery "$RECOVERY_SOURCE_RUN"');
  expect(ship).toContain(`production-source-maps-\${{ steps.pin.outputs.sha }}`);
  expect(deploy).not.toContain('dispatch-boot-smoke:');expect(deploy).not.toContain('gh workflow run boot-smoke');
  expect(journeys).toContain('needs: prepare');expect(journeys).toContain('fail-fast: false');
  expect(journeys).toContain('max-parallel: 5');
  const parts=/part: \[([^\]]+)\]/u.exec(journeys)?.[1]?.split(',').map(part=>part.trim());
  const core=['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'];
  expect(parts).toHaveLength(core.length);expect(new Set(parts)).toEqual(new Set(core));
  expect(journeys).not.toContain('run watch');expect(journeys).not.toContain('vercel build');
});

test('only pending producer and native admission coalesce while running waves and releases keep their keys',()=>{
  const top=deploy.split('\njobs:\n')[0]??'';
  const section=(name:string)=>deploy.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[a-z][\w-]*:\n/u)[0]??'';
  const group=(source:string,github:{event_name:string;run_id:string;sha:string;ref:string})=>{
    const template=/^\s+group: (.+)$/mu.exec(source)?.[1];
    if(template===undefined)throw new Error('Missing real concurrency key');
    return template.replaceAll(/\$\{\{(.*?)\}\}/gu,(_match:string,expression:string)=>{
      const value:unknown=runInNewContext(expression,{github,format:(pattern:string,argument:string)=>pattern.replace('{0}',argument)});
      if(typeof value!=='string')throw new Error('Invalid concurrency key expression');
      return value;
    });
  };
  const old={event_name:'push',run_id:'1',sha:'a'.repeat(40),ref:'refs/heads/main'};
  const next={...old,run_id:'2',sha:'b'.repeat(40)};
  expect(group(top,old)).not.toBe(group(top,next));
  for(const name of ['prepare','phone-route']) {
    const job=section(name);
    expect(group(job,old)).toBe(group(job,next));
    expect(group(job,old)).not.toBe(group(job,{...next,ref:'refs/heads/other'}));
    expect(job).toContain('cancel-in-progress: false');
  }
  const manual={...old,event_name:'workflow_dispatch'};
  expect(group(top,manual)).toBe(group(top,{...manual,run_id:'2'}));
  expect(group(top,manual)).not.toBe(group(top,old));
  expect(section('build-and-deploy')).toContain('group: production-release');
  expect(section('build-and-deploy')).toContain('cancel-in-progress: false');
  expect(section('phone-route')).not.toContain('needs:');
  for(const name of ['behaviour','native-escape','journeys'])expect(section(name)).not.toContain('concurrency:');
});

function recoveryFixture(native=false,splitPhone=false,shards=12) {
  const repo='Raynos/project-wildshard-singleplayer',runId='123';
  const run={id:123,workflow_id:456,event:'push',head_branch:'main',head_sha:sha,status:'completed',conclusion:'failure',
    path:'.github/workflows/deploy.yml',head_repository:{full_name:repo}};
  const rows=['prepare','typecheck-lint','derived-docs','boot-verdict',
    ...Array.from({length:shards},(_,i)=>`behaviour (${i+1})`),
    ...['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'].map(name=>`journeys (${name})`),
    ...(native?['native-escape']:[])].map(name=>[name,'completed','success']);
  rows.push(['build-and-deploy','completed','failure'],[splitPhone?'phone-route':'journeys (phone-route)','completed','failure']);
  const ancestry={base_commit:{sha},status:'ahead'};
  const topology = `
  prepare:
    steps:
      - run: node scripts/vitest-plan.ts --shards ${shards} --workers 2
  behaviour:
    strategy:
      matrix:
        shard: [${Array.from({length:shards},(_,i)=>i+1).join(', ')}]
    steps:
      - run: pnpm exec vitest run --config scripts/vitest-ci.config.ts --shard=\${{ matrix.shard }}/${shards} --bail=0
`;
  const fixture={run,rows,ancestry,source:`${topology}${splitPhone?'\n  phone-route:\n    continue-on-error: true\n':`continue-on-error: \${{ matrix.part == 'phone-route' }}`}${native?'\n  native-escape:\n':''}`,
    green:[] as typeof run[],
    boot:`success\thttps://github.com/${repo}/actions/runs/${runId}`,
    query:(args:string[]):string=>{
      const path=args[0]??'';
      if(path.endsWith('/actions/runs/123'))return JSON.stringify(fixture.run);
      if(path.includes('/actions/workflows?'))return '.github/workflows/deploy.yml\t456';
      if(path.includes('/actions/workflows/456/runs?'))return JSON.stringify({workflow_runs:fixture.green});
      if(path.includes('/compare/'))return JSON.stringify(fixture.ancestry);
      if(path.includes('/contents/'))return fixture.source;
      if(path.includes('/jobs?'))return fixture.rows.map(row=>row.join('\t')).join('\n');
      if(path.endsWith('/status'))return fixture.boot;
      throw new Error(`Unexpected recovery query: ${path}`);
    }};
  return fixture;
}

test('explicit recovery accepts original complete source proofs on both sides of native-job separation',()=>{
  for(const native of [false,true]) for(const splitPhone of [false,true]) {
    const f=recoveryFixture(native,splitPhone);
    expect(recoverySource('123',f.query)).toEqual({sha,run:'123'});
    for(const name of f.rows.map(row=>row[0]).filter(gateName=>!['build-and-deploy','journeys (phone-route)','phone-route'].includes(gateName??'')))
      for(const state of ['failure','skipped','cancelled','in_progress']) {
        const broken=recoveryFixture(native,splitPhone),row=broken.rows.find(candidate=>candidate[0]===name);
        if(row===undefined)throw new Error('Missing source gate');
        row[2]=state;
        expect(()=>recoverySource('123',broken.query)).toThrow('source gate');
      }
  }
});

test('recovery keeps historical twelve and current twenty-four source jobs exhaustive',()=>{
  for(const count of [12,24]) {
    const f=recoveryFixture(true,true,count);
    expect(recoverySource('123',f.query)).toEqual({sha,run:'123'});
    f.rows=f.rows.filter(row=>row[0]!==`behaviour (${count})`);
    expect(()=>recoverySource('123',f.query)).toThrow();
  }
  for(const mutate of [
    (f:ReturnType<typeof recoveryFixture>)=>{f.source=f.source.replace('--shards 24','--shards 12');},
    (f:ReturnType<typeof recoveryFixture>)=>{f.source=f.source.replace('/24 --bail=0','/12 --bail=0');},
    (f:ReturnType<typeof recoveryFixture>)=>{f.source=f.source.replace('shard: [1, 2,','shard: [1, 1,');},
  ]) {
    const f=recoveryFixture(true,true,24);mutate(f);
    expect(()=>recoverySource('123',f.query)).toThrow('topology');
  }
  expect(()=>recoverySource('123',recoveryFixture(true,true,1).query)).toThrow('topology');
});

function splitNativeRecoveryFixture() {
  const fixture=recoveryFixture(true,true,24);
  fixture.source=fixture.source.replace('\n  native-escape:\n',
    '\n  native-escape:\n    strategy:\n      matrix:\n        group: [escape-titan, stories-qara]\n');
  fixture.rows=fixture.rows.filter(row=>row[0]!=='native-escape');
  fixture.rows.push(['native-escape (escape-titan)','completed','success'],
    ['native-escape (stories-qara)','completed','success']);
  return fixture;
}

const readyNow=Date.parse('2026-10-30T22:00:00Z'),liveBuild=`${'b'.repeat(7)}-live`;
function readyFixture(runId='123') {
  const base=splitNativeRecoveryFixture();
  const state={
    run:{...base.run,id:Number(runId),status:'in_progress',conclusion:null as string|null},
    details:base.rows.map(([name='',status='',conclusion=''])=>({name,status,conclusion:conclusion as string|null,
      created_at:new Date(readyNow-30*60*1000).toISOString(),started_at:null,completed_at:null})),
    source:base.source,boot:`success\thttps://github.com/Raynos/project-wildshard-singleplayer/actions/runs/${runId}`,
    liveSha:'b'.repeat(40),floorStatus:'ahead',released:false,
    runs:[{id:Number(runId),status:'in_progress'}],
    query:(args:string[]):string=>{
      const path=args[0]??'';
      if(path.endsWith(`/actions/runs/${runId}`))return JSON.stringify(state.run);
      if(path.includes('/actions/workflows/456/runs?'))return JSON.stringify({workflow_runs:state.runs});
      if(path.includes(`/runs/${runId}/jobs?`))return JSON.stringify(state.details);
      if(path.includes('/contents/'))return state.source;
      if(path.endsWith('/status'))return args.includes('[.statuses[] | select(.context == "production-live")][0].state // ""')
        ?state.released?'success':'':state.boot;
      if(path.includes('/compare/bbbbbbb...'))return JSON.stringify({status:state.floorStatus,base_commit:{sha:state.liveSha}});
      if(path.includes(`/compare/${state.run.head_sha}...main`))return JSON.stringify({status:'ahead',base_commit:{sha:state.run.head_sha}});
      return base.query(args);
    },
  };
  const ship=state.details.find(job=>job.name==='build-and-deploy');
  if(ship===undefined)throw new Error('Missing shipping fixture');
  ship.status='queued';ship.conclusion=null;
  return {state,ship};
}

test('manual prebuilt backstop retains actual aggregate and requires thirty queued minutes or terminal shipping',()=>{
  const {state,ship}=readyFixture();
  const proof=readySource('123',liveBuild,state.query,readyNow);
  expect(proof).toMatchObject({sha,run:'123',authority:'ready-source',reason:'queued-30m',aggregate:{status:'in_progress',conclusion:null}});
  expect(proof.jobs).toContainEqual({name:'build-and-deploy',status:'queued',conclusion:''});
  expect(proof).not.toHaveProperty('ciGreen');
  for(const status of ['queued','pending']) {
    state.run.status=status;
    expect(readySource('123',liveBuild,state.query,readyNow).aggregate).toEqual({status,conclusion:null});
  }
  expect(()=>readySource('123',liveBuild,state.query,readyNow-1)).toThrow('30 minutes');
  for(const conclusion of ['failure','cancelled']) {
    ship.status='completed';ship.conclusion=conclusion;state.run.status='completed';state.run.conclusion=conclusion;
    expect(readySource('123',liveBuild,state.query,readyNow).reason).toBe('terminal-ship');
  }
  for(const status of ['queued','in_progress','completed']) {
    ship.status=status;ship.conclusion=status==='completed'?'success':null;
    ship.created_at=new Date(readyNow+1).toISOString();
    expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('30 minutes');
  }
});

test('ready source keeps every source gate, native group, SIX and latest same-run boot mandatory',()=>{
  const original=readyFixture();
  for(const job of original.state.details.filter(row=>!['build-and-deploy','phone-route'].includes(row.name))) {
    for(const failure of ['failure','cancelled','skipped','pending']) {
      const {state}=readyFixture(),row=state.details.find(candidate=>candidate.name===job.name);
      if(row===undefined)throw new Error('Missing original source gate');
      row.status=failure==='pending'?'in_progress':'completed';row.conclusion=failure==='pending'?null:failure;
      expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow();
    }
  }
  for(const boot of ['pending\turl','failure\turl','success\thttps://github.com/foreign/actions/runs/123']) {
    const {state}=readyFixture();state.boot=boot;
    expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('same-run boot');
  }
  const missing=readyFixture();missing.state.details.pop();
  expect(()=>readySource('123',liveBuild,missing.state.query,readyNow)).toThrow('inventory');
  const duplicate=readyFixture();duplicate.state.details.push({...duplicate.state.details[0],name:'prepare',status:'completed',conclusion:'success',created_at:'',started_at:null,completed_at:null});
  expect(()=>readySource('123',liveBuild,duplicate.state.query,readyNow)).toThrow('inventory');
});

test('ready source preserves optional fixture fallback only when the selected ship permits it',()=>{
  const {state}=readyFixture();
  state.source+='\n  build-and-deploy:\n    needs: [prepare, behaviour]\n  fixtures:\n';
  state.details.push({name:'fixtures',status:'completed',conclusion:'failure',created_at:'',started_at:null,completed_at:null});
  expect(readySource('123',liveBuild,state.query,readyNow).failures).toContainEqual({name:'fixtures',status:'completed',conclusion:'failure'});
  state.source=state.source.replace('needs: [prepare, behaviour]','needs: [prepare, behaviour, fixtures]');
  expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('source gate');
});

test('only a source-declared report-only draw job may fail without replacing source proof',()=>{
  const {state}=readyFixture();
  state.source+='\n  draw-budget:\n    continue-on-error: true\n';
  state.details.push({name:'draw-budget',status:'completed',conclusion:'failure',created_at:'',started_at:null,completed_at:null});
  expect(readySource('123',liveBuild,state.query,readyNow).failures).toContainEqual({name:'draw-budget',status:'completed',conclusion:'failure'});
  const row=state.details.find(job=>job.name==='draw-budget');
  if(row===undefined)throw new Error('Missing diagnostic fixture');
  row.status='queued';row.conclusion=null;
  expect(readySource('123',liveBuild,state.query,readyNow).sha).toBe(sha);
  state.source=state.source.replace('draw-budget:\n    continue-on-error: true','draw-budget:\n    continue-on-error: false');
  expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('draw-budget');
});

test('reviewed diagnostic inventory remains exhaustive and duplicated or undeclared readers refuse',()=>{
  const {state}=readyFixture();
  state.source+='\n  draw-budget:\n    continue-on-error: true\n';
  expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('inventory');
  state.details.push({name:'draw-budget',status:'completed',conclusion:'failure',created_at:'',started_at:null,completed_at:null});
  state.details.push({name:'draw-budget',status:'completed',conclusion:'success',created_at:'',started_at:null,completed_at:null});
  expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow('inventory');
  const undeclared=recoveryFixture(true,true);
  undeclared.rows.push(['draw-budget','completed','success']);
  expect(()=>recoverySource('123',undeclared.query)).toThrow('inventory');
});

test('ready source refuses duplicate releases, a regressing floor, and unreadable or newer proven waves',()=>{
  for(const kind of ['already-live','released','behind']) {
    const {state}=readyFixture();
    if(kind==='already-live')state.liveSha=sha;
    if(kind==='released')state.released=true;
    if(kind==='behind')state.floorStatus='behind';
    expect(()=>readySource('123',liveBuild,state.query,readyNow)).toThrow();
  }
  const {state}=readyFixture(),newer=readyFixture('124');
  newer.state.run.head_sha='c'.repeat(40);
  state.runs.unshift({id:124,status:'in_progress'});
  const query=(args:string[]):string=>(args[0]?.includes('/runs/124')||args[0]?.includes('c'.repeat(40))?newer.state.query:state.query)(args);
  expect(()=>readySource('123',liveBuild,query,readyNow)).toThrow('newer proven');
  newer.state.run.status='queued';state.runs[0]={id:124,status:'queued'};
  expect(()=>readySource('123',liveBuild,query,readyNow)).toThrow('newer proven');
  const gate=newer.state.details.find(job=>job.name==='prepare');
  if(gate===undefined)throw new Error('Missing newer gate');
  gate.status='in_progress';gate.conclusion=null;
  expect(readySource('123',liveBuild,query,readyNow).sha).toBe(sha);
  const unavailable=(args:string[]):string=>{
    if(args[0]?.includes('/runs/124'))throw new Error('API unavailable');
    return state.query(args);
  };
  expect(()=>readySource('123',liveBuild,unavailable,readyNow)).toThrow('API unavailable');
});

test('manual ready input selects the existing prebuilt branch without replacing automatic or emergency authorities',()=>{
  const ship=deploy.split('\n  build-and-deploy:\n')[1]?.split('\n  typecheck-lint:\n')[0];
  if(ship===undefined)throw new Error('Missing release job');
  expect(deploy).toContain('ready_source_run:');
  expect(ship).toContain('read-ready-source "$READY_SOURCE_RUN"');
  expect(ship).toContain('if [ "$authorities" -gt 1 ]');
  expect(ship).toContain('name: ready-source');
  expect(ship).toContain('read-wave');expect(ship).toContain('read-recovery');
  expect(ship).toContain("steps.pin.outputs.recovery != 'true'");
});

test('ready-source CLI refuses nonmanual, foreign and nonmain callers before any proof or live request',()=>{
  for(const change of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{GITHUB_REPOSITORY:'foreign/repo'}]) {
    const result=spawnSync(process.execPath,['scripts/deploy-pin.mjs','read-ready-source','123'],{encoding:'utf8',timeout:5000,
      env:{...process.env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'Raynos/project-wildshard-singleplayer',...change}});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Ready source requires an explicit main dispatch');
  }
});

test('recovery requires both exact-source native groups and preserves historical singleton proof',()=>{
  const original=recoveryFixture(true,true);
  expect(recoverySource('123',original.query)).toEqual({sha,run:'123'});
  const split=splitNativeRecoveryFixture();
  expect(recoverySource('123',split.query)).toEqual({sha,run:'123'});
  for(const name of ['native-escape (escape-titan)','native-escape (stories-qara)']) {
    for(const result of ['failure','skipped','cancelled','timed_out']) {
      const broken=splitNativeRecoveryFixture(),row=broken.rows.find(candidate=>candidate[0]===name);
      if(row===undefined)throw new Error('Missing native group fixture');
      row[2]=result;expect(()=>recoverySource('123',broken.query)).toThrow();
    }
    const missing=splitNativeRecoveryFixture();missing.rows=missing.rows.filter(row=>row[0]!==name);
    expect(()=>recoverySource('123',missing.query)).toThrow();
  }
  const duplicate=splitNativeRecoveryFixture();duplicate.rows.push(['native-escape (escape-titan)','completed','success']);
  expect(()=>recoverySource('123',duplicate.query)).toThrow();
  for(const matrix of ['escape-titan','escape-titan, escape-titan','escape-titan, foreign']) {
    const malformed=splitNativeRecoveryFixture();malformed.source=malformed.source.replace('escape-titan, stories-qara',matrix);
    expect(()=>recoverySource('123',malformed.query)).toThrow('native topology');
  }
});

test('recovery refuses partial, duplicated, foreign, divergent and stale proofs',()=>{
  for(const change of [{head_sha:'short'},{event:'workflow_dispatch'},{head_branch:'other'},{workflow_id:999},
    {status:'in_progress'},{conclusion:'cancelled'},{path:'.github/workflows/other.yml'},
    {id:456},{head_repository:{full_name:'foreign/repo'}}]) {
    const f=recoveryFixture();Object.assign(f.run,change);
    expect(()=>recoverySource('123',f.query)).toThrow('completed exact main push');
  }
  for(const status of ['behind','diverged']) {
    const f=recoveryFixture();f.ancestry.status=status;
    expect(()=>recoverySource('123',f.query)).toThrow('ancestry');
  }
  for(const alter of [(f:ReturnType<typeof recoveryFixture>)=>{f.rows.pop();},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows.push(['prepare','completed','success']);},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows.push(['foreign','completed','success']);},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows=f.rows.filter(row=>row[0]!=='native-escape');},
    (f:ReturnType<typeof recoveryFixture>)=>{f.source='no report-only exception';}]) {
    const f=recoveryFixture(true);alter(f);expect(()=>recoverySource('123',f.query)).toThrow();
  }
  for(const boot of ['pending\turl','failure\turl',`success\thttps://github.com/Raynos/project-wildshard-singleplayer/actions/runs/999`]) {
    const f=recoveryFixture();f.boot=boot;expect(()=>recoverySource('123',f.query)).toThrow('same-run boot');
  }
  expect(()=>recoverySource('123\ninjected',recoveryFixture().query)).toThrow('numeric');
});

test('recovery CLI refuses non-manual or non-main contexts before reading proofs',()=>{
  for(const command of ['read-recovery','read-deadline-recovery']) for(const change of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{GITHUB_REPOSITORY:'foreign/repo'}]) {
    const result=spawnSync(process.execPath,['scripts/deploy-pin.mjs',command,'123'],{encoding:'utf8',timeout:5000,
      env:{...process.env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'Raynos/project-wildshard-singleplayer',...change}});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Recovery requires an explicit main dispatch');
  }
});

const deadline = Date.parse('2026-10-30T10:30:00Z');
test('G917 cannot run early and retains actual reds without manufacturing CI green',()=>{
  const f=recoveryFixture(true,true);
  const behaviour=f.rows.find(row=>row[0]==='behaviour (4)'),ship=f.rows.find(row=>row[0]==='build-and-deploy');
  if(behaviour===undefined||ship===undefined)throw new Error('Missing deadline proof fixture');
  behaviour[2]='failure';ship[2]='skipped';
  expect(()=>deadlineRecoverySource('123',()=>{throw new Error('Must not query early');},deadline-1)).toThrow('unavailable before');
  const selected=deadlineRecoverySource('123',f.query,deadline);
  expect(selected.sha).toBe(sha);expect(selected.run).toBe('123');
  expect(selected.jobs).toHaveLength(f.rows.length);
  expect(selected.failures).toContainEqual({name:'behaviour (4)',status:'completed',conclusion:'failure'});
  expect(selected.jobs).toContainEqual({name:'build-and-deploy',status:'completed',conclusion:'skipped'});
  expect(()=>recoverySource('123',f.query)).toThrow();
});

test('G917 keeps prepare, every SIX leg, latest boot and exhaustive terminal inventory mandatory',()=>{
  const essential=['prepare','boot-verdict',...['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'].map(name=>`journeys (${name})`)];
  for(const name of essential)for(const verdict of ['failure','skipped','cancelled','timed_out']){
    const f=recoveryFixture(true,true),row=f.rows.find(candidate=>candidate[0]===name);
    if(row===undefined)throw new Error('Missing essential deadline gate');
    row[2]=verdict;expect(()=>deadlineRecoverySource('123',f.query,deadline)).toThrow();
  }
  for(const mutate of [(f:ReturnType<typeof recoveryFixture>)=>{f.rows.pop();},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows.push(['prepare','completed','success']);},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows.push(['foreign','completed','success']);},
    (f:ReturnType<typeof recoveryFixture>)=>{f.rows[1]=['typecheck-lint','in_progress','failure'];},
    (f:ReturnType<typeof recoveryFixture>)=>{f.boot='failure\turl';},
    (f:ReturnType<typeof recoveryFixture>)=>{f.run.event='workflow_dispatch';},
    (f:ReturnType<typeof recoveryFixture>)=>{f.ancestry.status='diverged';}]){
    const f=recoveryFixture(true,true);mutate(f);expect(()=>deadlineRecoverySource('123',f.query,deadline)).toThrow();
  }
  const newer=recoveryFixture(true,true);
  newer.green.push({...newer.run,id:124,conclusion:'success'});
  expect(()=>deadlineRecoverySource('123',newer.query,deadline)).toThrow('newer fully green');
});

test('deadline recovery remains explicit and uses the exact tested prebuilt release path',()=>{
  expect(deploy).toContain('deadline_recovery_source_run:');
  expect(deploy).toContain('read-deadline-recovery "$DEADLINE_RECOVERY_SOURCE_RUN"');
  expect(deploy).toContain('Select exactly one explicit recovery authority');
  expect(deploy).toContain('name: deadline-recovery-source');
  expect(deploy).toContain('prebuilt-output.py" restore --sha "$DEPLOY_SHA" --run "$SOURCE_RUN"');
  expect(deploy).toContain('read-wave');
});

test('recovery projects ancestry before the bounded GitHub stdout boundary',()=>{
  const f=recoveryFixture();let compared=false;
  const query=(args:string[]):string=>{
    if(args[0]?.includes('/compare/')) {
      compared=true;
      const option=args.indexOf('--jq'),projection=option===-1?undefined:args[option+1];
      if(projection===undefined)throw new Error('Unbounded comparison includes every changed file');
      // The consumer needs neither the file list nor commit bodies. The API
      // projection occurs in gh, before execFileSync's original stdout bound.
      expect(projection).toBe('{status,base_commit:{sha:.base_commit.sha}}');
    }
    return f.query(args);
  };
  expect(recoverySource('123',query)).toEqual({sha,run:'123'});expect(compared).toBe(true);
});

test('the exact native save/harness/paint bootstrap parses as separate source statements',()=>{
  const source=phoneBootstrap('window.__paint=true');
  const parse=(input:string)=>spawnSync(process.execPath,['--check','--input-type=module'],{input,encoding:'utf8',timeout:5000});
  expect(parse(source).status).toBe(0);
  const oldMissingSeparator=source.replace(';\nwindow.__wildshardHarness','window.__wildshardHarness');
  expect(parse(oldMissingSeparator).status).toBe(1);
  expect(parse(oldMissingSeparator).stderr).toContain('Unexpected identifier');
});


test('first-entry observation never takes the maintained driver slot or rewrites late tiles as on-time',()=>{
  const script=`const callbacks=[];globalThis.requestAnimationFrame=fn=>callbacks.push(fn);let inside=null,reads=0;const cell={instance:'market',slug:'open-plot-night-market',cell:[-1,1],shows:'loading',drawn:{far:true,near:false,l0:0,l1:0}};const game={frameCount:0,watchFrames(){throw new Error('occupied maintained driver slot')}};globalThis.window={__wildshard:{world:{game},requireWorld(){return this.world},shard:{grid:{travelState:()=>({inside}),state:()=>{reads++;return{inside,live:{live:{current:inside,gameplayReady:true}},cells:[cell],frame:{chain:{fx:{grain:0}}}}}}}}};(${watchPhoneEntry.toString()})('market');game.frameCount=1;callbacks.shift()();callbacks.shift()();if(reads!==0)throw new Error('Full census before entry');inside='market';game.frameCount=2;callbacks.shift()();cell.drawn.far=false;cell.drawn.l0=15;if(window.__phoneRouteEntry.entry.cell.drawn.far!==true||window.__phoneRouteEntry.entry.cell.drawn.l0!==0)throw new Error('Late tiles rewrote first-entry evidence');callbacks.shift()();if(reads!==1||callbacks.length!==0)throw new Error('Observer not retired');console.log('first-entry retained');`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toContain('first-entry retained');
});
