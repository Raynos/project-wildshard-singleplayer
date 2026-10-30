// oxlint-disable-next-line import/no-nodejs-modules -- Parse the actual native bootstrap without browser or network.
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { watchPhoneEntry } from '../scripts/parity/phone-route-page.mjs';
import { phoneBootstrap } from '../scripts/parity/phone-route-browser.mjs';
import { waveSource } from '../scripts/deploy-pin.mjs';
import deploy from '../.github/workflows/deploy.yml?raw';

const sha = 'a'.repeat(40);
const jobs = ['prepare','typecheck-lint','derived-docs','behaviour','journeys','boot-verdict'];
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
  expect(ship).toContain('needs: [prepare, typecheck-lint, derived-docs, behaviour, journeys, boot-verdict]');
  expect(ship).toContain('CI_WAVE_NEEDS:');expect(ship).toContain('read-wave');
  expect(ship).toContain('group: production-release');expect(ship).toContain('check-live-floor');
  expect(ship).toContain('vercel deploy --prebuilt');expect(ship).not.toContain('vercel build');
  expect(deploy).not.toContain('dispatch-boot-smoke:');expect(deploy).not.toContain('gh workflow run boot-smoke');
  expect(journeys).toContain('needs: prepare');expect(journeys).toContain('fail-fast: false');
  expect(journeys).toContain('max-parallel: 5');
  expect(journeys).toContain('part: [boot-public, boot-developer, boot-grid, hover-chromium, hover-webkit, explorer, phone-route]');
  expect(journeys).not.toContain('run watch');expect(journeys).not.toContain('vercel build');
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
