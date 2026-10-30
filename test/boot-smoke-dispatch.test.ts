// oxlint-disable-next-line import/no-nodejs-modules -- Parse the actual native bootstrap without browser or network.
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { watchPhoneEntry } from '../scripts/parity/phone-route-page.mjs';
import { phoneBootstrap } from '../scripts/parity/phone-route-browser.mjs';
import { recoverySource, waveSource } from '../scripts/deploy-pin.mjs';
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
  expect(journeys).toContain('part: [boot-public, boot-developer, boot-grid, hover-chromium, hover-webkit, explorer, phone-route]');
  expect(journeys).not.toContain('run watch');expect(journeys).not.toContain('vercel build');
});

function recoveryFixture(native=false) {
  const repo='Raynos/project-wildshard-singleplayer',runId='123';
  const run={id:123,workflow_id:456,event:'push',head_branch:'main',head_sha:sha,status:'completed',conclusion:'failure',
    path:'.github/workflows/deploy.yml',head_repository:{full_name:repo}};
  const rows=['prepare','typecheck-lint','derived-docs','boot-verdict',
    ...Array.from({length:12},(_,i)=>`behaviour (${i+1})`),
    ...['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'].map(name=>`journeys (${name})`),
    ...(native?['native-escape']:[])].map(name=>[name,'completed','success']);
  rows.push(['build-and-deploy','completed','failure'],['journeys (phone-route)','completed','failure']);
  const ancestry={base_commit:{sha},status:'ahead'};
  const fixture={run,rows,ancestry,source:`continue-on-error: \${{ matrix.part == 'phone-route' }}${native?'\n  native-escape:\n':''}`,
    boot:`success\thttps://github.com/${repo}/actions/runs/${runId}`,
    query:(args:string[]):string=>{
      const path=args[0]??'';
      if(path.endsWith('/actions/runs/123'))return JSON.stringify(fixture.run);
      if(path.includes('/actions/workflows?'))return '.github/workflows/deploy.yml\t456';
      if(path.includes('/compare/'))return JSON.stringify(fixture.ancestry);
      if(path.includes('/contents/'))return fixture.source;
      if(path.includes('/jobs?'))return fixture.rows.map(row=>row.join('\t')).join('\n');
      if(path.endsWith('/status'))return fixture.boot;
      throw new Error(`Unexpected recovery query: ${path}`);
    }};
  return fixture;
}

test('explicit recovery accepts original complete source proofs on both sides of native-job separation',()=>{
  for(const native of [false,true]) {
    const f=recoveryFixture(native);
    expect(recoverySource('123',f.query)).toEqual({sha,run:'123'});
    for(const name of f.rows.map(row=>row[0]).filter(gateName=>gateName!=='build-and-deploy'&&gateName!=='journeys (phone-route)'))
      for(const state of ['failure','skipped','cancelled','in_progress']) {
        const broken=recoveryFixture(native),row=broken.rows.find(candidate=>candidate[0]===name);
        if(row===undefined)throw new Error('Missing source gate');
        row[2]=state;
        expect(()=>recoverySource('123',broken.query)).toThrow('source gate');
      }
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
  for(const change of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{GITHUB_REPOSITORY:'foreign/repo'}]) {
    const result=spawnSync(process.execPath,['scripts/deploy-pin.mjs','read-recovery','123'],{encoding:'utf8',timeout:5000,
      env:{...process.env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'Raynos/project-wildshard-singleplayer',...change}});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Recovery requires an explicit main dispatch');
  }
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
