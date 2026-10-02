import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installInit } from '../../../scripts/parity/init.mjs';
import { debugSettings } from '../../../scripts/debug-settings.mjs';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
if (!url) throw new Error('Pass --url=BUILD_URL; run through scripts/browser-lane.sh');
const out = new URL('.', import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), 'lock-flyers-'));
const init = [], session = 'lock-flyers-capture';
const collector = { addInitScript: async (input, arg) => { init.push(typeof input === 'string' ? input : `(${input.toString()})(${JSON.stringify(arg)});`); } };
await installInit(collector, { lane: 'm5', sha: 'lock-flyers', browser: 'Chrome', capture: 30, accelerated: false, tier: 'phone' });
await debugSettings(collector, { time: 'midday', weather: 'clear', touch: 'on' });
const initPath = join(scratch, 'init.js'); writeFileSync(initPath, init.join('\n'));
const command = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 90000 });
const evaluate = (source) => command('eval', source);
try {
  command('--init-script', initPath, 'set', 'viewport', '390', '844');
  for (const [slug, kind, filename] of [['far-reach', 'driftRay', 'drift-ray'], ['sunscar-dunes', 'duneRay', 'dune-ray']]) {
    command('open', `${url}/?chunk=${slug}&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0`);
    command('wait', '--fn', 'Boolean(window.__wildshard) && !document.querySelector(".ws-load")');
    evaluate(`(async()=>{
      const h=window.__wildshard,w=h.world,a=w.animals.animals.find(a=>a.kind===${JSON.stringify(kind)});
      if(!a)throw new Error('ray absent');
      const x=${slug === 'far-reach' ? '1' : 'a.position.x'},z=${slug === 'far-reach' ? '-24' : 'a.position.z+16'};
      const ray=new w.physics.R.Ray({x,y:200,z},{x:0,y:-1,z:0}),hit=w.physics.world.castRay(ray,300,true);
      await h.pose({x,z,y:hit?200-hit.timeOfImpact+0.1:0,yaw:0,pitch:0});await window.__parity.advance(3);
      const d=a.position.clone().add({x:0,y:a.dims.bodyY*a.scale,z:0}).sub(w.player.camera.position);
      w.player.yaw=Math.atan2(-d.x,-d.z);w.player.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));await window.__parity.advance(3);
      if(!w.lockSys.hasTarget())throw new Error('ray is not available');return true;
    })()`);
    command('click', '.ws-touch-disc.lock');
    const result = evaluate(`(async()=>{await window.__parity.advance(30);const w=window.__wildshard.world;
      if(w.lockState.state!=='locked'||w.lockState.target?.kind!==${JSON.stringify(kind)})throw new Error('LOCK did not acquire ray');
      return {state:w.lockState.state,kind:w.lockState.target.kind,position:w.player.position.toArray(),target:w.lockState.target.position.toArray(),pitch:w.player.pitch,errors:window.__wildshardHarness.errors};})()`);
    writeFileSync(join(out, `${filename}-capture.json`), result);
    command('screenshot', join(out, `${filename}-locked.jpg`));
  }
} finally { command('close'); }
