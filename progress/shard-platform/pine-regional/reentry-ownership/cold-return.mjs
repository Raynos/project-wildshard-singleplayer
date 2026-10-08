// E435 / SF47-g: borrowed-home Pine cold unload, native rebuild, exact HP restore and final unload census.
// Run through scripts/browser-lane.sh against a pinned serve-build; Developer is toggled after the public boot.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
import { installResources } from '../../../../scripts/parity/resources.mjs';

const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
const base = flag('url'), sha = flag('sha'), output = flag('out');
if (!base || !sha || !output) throw new Error('Supply url, sha and out');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const started = Date.now(), result = { sha, surface: 'Chromium Metal, iPhone 16 Pro portrait', phases: [], errors: [], navigations: [], documents: [], caught: [], failedResponses: [], reports: [], warnings: [] };
const progress = phase => { result.phase = phase; const value = { phase, seconds: (Date.now() - started) / 1000, errors: result.errors, navigations: result.navigations.length }; writeFileSync(output.replace(/\.json$/u, '-progress.json'), JSON.stringify(value)); console.log(JSON.stringify(value)); };
let page, monitor;
try {
  const version = await (await fetch(new URL('version.json', base))).json();
  result.version = version;
  if (!version.build?.startsWith(sha.slice(0, 7))) throw new Error('Preview revision differs from requested pin');
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: devices['iPhone 16 Pro'].screen });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  // The E451 borrowed path is selected at boot with Developer off. Its existing in-page switch
  // then enables the honest G216 warning for the over-cap re-entry diagnostic (no composition reload).
  await context.addInitScript(() => {
    const prior = sessionStorage.getItem('p0.initial-title'); sessionStorage.setItem('p0.initial-title', '1');
    if (prior !== null) {
      const key = 'wildshard.save.v2.device', doc = JSON.parse(localStorage.getItem(key) ?? '{"keys":{}}');
      doc.keys.devMode = {v:1,data:false}; localStorage.setItem(key,JSON.stringify(doc));
    }
  });
  await context.route('**/api/errors', route => route.fulfill({status:204,body:''}));
  const previousFile = flag('previous');
  if (previousFile) {
    const previous = JSON.parse(readFileSync(previousFile, 'utf8'));
    result.previousDamage = previous.damage;
    await saveFixture(context, { scope: 'pine-hollow', key: 'platform.runtime-logical', data: previous.saved, once: 'pine.fresh.restore' });
  }
  await context.addInitScript(installResources);
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() };
    window.__recoveryDocument = `${Date.now()}:${Math.random()}`;
  });
  page = await context.newPage();
  monitor = setInterval(async () => { const live = await page.evaluate(() => ({live:window.__wildshard?.shard?.grid?.state()?.live?.live,app:window.__wildshard?.world?.game?.app?.state,gate:window.__wildshard?.world?.game?.frameGate(),paused:window.__wildshard?.world?.hud?.paused,entered:window.__wildshard?.world?.hud?.entered,reveal:window.__wsReveal})).catch(() => null); console.log(JSON.stringify({sample:Date.now()-started,live,errors:result.errors})); }, 10000);
  const debuggerSession = await context.newCDPSession(page);
  await debuggerSession.send('Debugger.enable');
  await debuggerSession.send('Debugger.setPauseOnExceptions', { state: 'all' });
  debuggerSession.on('Debugger.paused', async event => {
    result.caught.push({ reason: event.reason, exception: event.data?.description ?? event.data?.value,
      frames: event.callFrames.slice(0, 8).map(frame => ({ name: frame.functionName, url: frame.url, location: frame.location })) });
    const caller = event.callFrames[1];
    if (caller !== undefined) {
      const source = await debuggerSession.send('Debugger.getScriptSource', {scriptId:caller.location.scriptId}).catch(()=>null);
      const line = source?.scriptSource?.split('\n')[caller.location.lineNumber];
      if(line) result.caught.at(-1).callerSource = line.slice(Math.max(0,caller.location.columnNumber-350),caller.location.columnNumber+350);
    }
    if (event.callFrames[0]?.functionName === 'restore') {
      const inspection = await debuggerSession.send('Debugger.evaluateOnCallFrame', { callFrameId: event.callFrames[0].callFrameId,
        expression: 'JSON.stringify({saved:e,rebuilt:{id:t.entityId,kind:t.kind,variant:t.variant,maxHp:t.maxHp},roster:[...o.values()].map(a=>({id:a.entityId,kind:a.kind,variant:a.variant,maxHp:a.maxHp}))})', returnByValue: true }).catch(() => null);
      result.caught.at(-1).inspection = inspection?.result?.value;
    }
    writeFileSync(output.replace(/\.json$/u, '-caught.json'), JSON.stringify(result.caught, null, 2));
    await debuggerSession.send('Debugger.resume').catch(() => undefined);
  });
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/errors') result.reports.push({at:Date.now()-started,method:request.method(),body:request.postData()}); if (request.isNavigationRequest() && request.frame() === page.mainFrame()) result.documents.push({ at: Date.now(), url: request.url() }); });
  page.on('response', response => { if (response.status() >= 400) result.failedResponses.push({ status: response.status(), url: response.url() }); });
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); if (message.type() === 'warning') result.warnings.push(message.text()); });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) result.navigations.push({ at: Date.now(), url: frame.url() }); });
  const ready = () => page.waitForFunction(() => window.__wildshard?.shard?.grid?.simulation !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const state = () => page.evaluate(() => ({ document: window.__recoveryDocument, grid: window.__wildshard.shard.grid.state(),
    yaw: window.__wildshard.world.player.yaw, paused: window.__wildshard.world.hud.menu.isOpen }));
  const funds = id => page.evaluate(instance => {
    const local = JSON.parse(localStorage.getItem(`wildshard.save.v2.${instance}`) ?? '{"keys":{}}');
    const profile = JSON.parse(localStorage.getItem('wildshard.save.v2.profile') ?? '{"keys":{}}');
    return { coins: local.keys.purse?.data ?? 0, complete: local.keys['platform.region']?.data?.logical?.flags?.includes('template.complete') ?? false,
      facts: Object.values(profile.keys['platform.ledger']?.data?.facts ?? {}).filter(fact => fact.instance === instance).length };
  }, id);
  const drive = points => page.evaluate(async waypoints => {
    const probe = window.__wildshard, world = probe.world, player = world.player, game = world.game;
    world.hud.enterNow(); world.hud.setPaused(false); game.hold = false; player.setHover(true);
    let index = 0;
    try {
      await new Promise((resolve, reject) => {
        let stop = () => undefined;
        const timer = setTimeout(() => { stop(); reject(new Error(`Recovery drive stalled: ${index}`)); }, 120000);
        stop = game.watchFrames(() => {
          const target = waypoints[index];
          if (target === undefined) { clearTimeout(timer); stop(); resolve(); return; }
          const feet = probe.shard.grid.state().live.live.worldFeet, dx = target.x - feet.x, dz = target.z - feet.z;
          if (Math.hypot(dx, dz) < 1.2) { index++; game.app.input.clear(); return; }
          player.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
        });
      });
    } finally { game.app.input.clear(); player.setHover(false); }
    return { reached: index, state: probe.shard.grid.state().live };
  }, points);
  const target = new URL(base); target.searchParams.set('mute','1'); target.searchParams.set('sw','0'); target.searchParams.set('nolock','1');
  await page.goto(target.href,{waitUntil:'domcontentloaded'}); progress('title');
  await page.waitForSelector('.ws-main-grid',{timeout:120000}); await page.click('.ws-main-grid'); await ready(); progress('initial-ready');
  result.boot = await state();
  await page.evaluate(()=>{const world=window.__wildshard.world;world.hud.enterNow();world.hud.setPaused(false);world.game.hold=false;});
  await page.waitForFunction(()=>window.__wildshard.world.game.app.state==='play' && window.__wsReveal?.endedMs!==null && window.__wsReveal?.endedMs!==undefined,null,{timeout:120000});
  result.revealCompletedBeforeSettings=await page.evaluate(()=>window.__wsReveal);
  result.selectedLevel = await page.evaluate(()=>window.__wildshard.world.game.level.id);
  if(result.selectedLevel !== 'driftwood-isle') throw new Error('Expected the public borrowed home, not the owned shell');
  await page.evaluate(()=>{const hud=window.__wildshard.world.hud;hud.enterNow();hud.setPaused(true);});
  await page.locator('.ws-gmenu-switch').filter({hasText:'Developer mode'}).click();
  if(!await page.evaluate(()=>document.documentElement.hasAttribute('data-dev'))) throw new Error('Existing Developer switch did not enable');
  await page.evaluate(()=>window.__wildshard.world.hud.setPaused(false));
  result.developerEnabledAfterBorrowedBoot = true;
  await page.evaluate(()=>window.__wildshard.pose({name:'pine.entry.start',x:0,z:235,yaw:Math.PI}));
  progress('road-to-pine');
  result.phases.push({reason:'enter-pine',drive:await drive([{x:0,z:277.5},{x:0,z:325},{x:0,z:345}])});
  await page.waitForFunction(()=>window.__wildshard.shard.grid.state().live.live.gameplayReady,{timeout:240000});
  result.entered=await page.evaluate(()=>({state:window.__wildshard.shard.grid.state(),systems:window.__wildshard.world.game.app.systemsByPhase().update.map(system=>system.id),residency:window.__wildshard.shard.grid.residency(),targets:window.__wildshard.world.game.app.combat.targets().length}));
  result.firstCameraUpdaters=result.entered.systems.filter(id=>id.endsWith('engine.player.for'));
  if(result.firstCameraUpdaters.length!==1) throw new Error('Camera updater duplicated on first entry: '+result.firstCameraUpdaters.join(','));
  progress('pine-entered');
  if(result.previousDamage) {
    result.freshHP=await page.evaluate(id=>window.__wildshard.world.game.app.combat.targets().find(target=>target.target.entityId===id)?.target.hp,result.previousDamage.id);
    if(result.freshHP!==result.previousDamage.after) throw new Error('Fresh world did not restore durable creature HP');
  }
  result.damage=await page.evaluate(()=>{
    const app=window.__wildshard.world.game.app;
    for(const target of [...app.combat.targets()].reverse()) {
      if(!target.hittable || target.target.kind!=='boar' || target.target.maxHp!==100 || !(target.target.hp>10)) continue;
      const before=target.target.hp;
      const hit=app.combat.hit({source:app.player,sourceTags:['dmg.melee','cover.checked'],target:target.actor,amount:1,point:target.position,from:window.__wildshard.world.player.position,dir:target.position.clone().set(0,0,1)});
      if(hit!==null && hit.dealt>0) return {id:target.target.entityId,before,after:target.target.hp,dealt:hit.dealt};
    }
    throw new Error('No real regional combat target accepts damage');
  });
  await page.waitForTimeout(3000);
  result.phases.push({reason:'return-road',drive:await drive([{x:0,z:277.5}])});
  result.road=await state(); progress('road');
  result.phases.push({reason:'cold-road-away',drive:await drive([{x:277.5,z:277.5},{x:277.5,z:-555}])});
  await page.waitForFunction(()=>!window.__wildshard.shard.grid.state().live.live.residents.includes('pine-hollow'),null,{timeout:120000});
  result.cold=await state(); progress('pine-confirmed-unloaded');
  result.phases.push({reason:'cold-road-return',drive:await drive([{x:277.5,z:277.5},{x:0,z:277.5}])});

  result.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('wildshard.save.v2.pine-hollow')??'{}').keys?.['platform.runtime-logical']?.data);
  if(!result.saved?.actors?.some(actor=>actor.id===result.damage.id && actor.hp===result.damage.after)) throw new Error('Regional damage did not checkpoint');
  result.phases.push({reason:'reenter-pine',drive:await drive([{x:0,z:325},{x:0,z:345}])});
  result.reentered=await state();
  result.returnCameraUpdaters=await page.evaluate(()=>window.__wildshard.world.game.app.systemsByPhase().update.filter(system=>system.id.endsWith('engine.player.for')).map(system=>system.id));
  if(result.returnCameraUpdaters.length!==1) throw new Error('Camera updater duplicated on cold return: '+result.returnCameraUpdaters.join(','));
  result.restoredHP=await page.evaluate(id=>window.__wildshard.world.game.app.combat.targets().find(target=>target.target.entityId===id && target.actor.attributes.health<target.actor.attributes.maxHealth)?.target.hp,result.damage.id);
  if(result.restoredHP!==result.damage.after) throw new Error('Regional damage did not survive the return trip');
  result.phases.push({reason:'return-road-again',drive:await drive([{x:0,z:277.5}])});
  result.phases.push({reason:'return-home',drive:await drive([{x:0,z:235}])});
  await page.waitForFunction(()=>window.__wildshard.shard.grid.state().live.live.gameplayReady,{timeout:240000});
  result.homeReturned=await state();
  result.leak=await page.evaluate(()=>window.__wildshard.leak());
  result.storage = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) }));
  result.expectedAdmissionRefusals=result.caught.filter(row=>row.exception?.startsWith('Error: Live sim admission deferred by the shared budget\n') && row.exception.includes('.claim (') && row.exception.includes('.admitRegion ('));
  result.unexpectedCaught=result.caught.filter(row=>!result.expectedAdmissionRefusals.includes(row));
  result.pass=result.unexpectedCaught.length===0 && result.errors.length===0 && result.leak.disposalErrors.length===0 && result.leak.scope.bodies===0 && result.leak.scope.colliders===0 && result.leak.after.bodies===0 && result.leak.after.colliders===0;
} catch (error) {
  result.pass = false; result.failure = String(error.stack ?? error);
  if (page) {
    result.storage = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) })).catch(() => null);
    result.lastState = await page.evaluate(() => window.__wildshard?.shard?.grid?.state()).catch(() => null);
    await page.screenshot({ path: output.replace(/\.json$/u, '-failure.jpg'), type: 'jpeg', quality: 60 }).catch(() => undefined);
    result.failedLeak=await page.evaluate(()=>window.__wildshard?.leak()).catch(error=>String(error));
  }
} finally { clearInterval(monitor); await browser.close(); }
result.seconds = (Date.now() - started) / 1000;
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ sha, pass: result.pass, seconds: result.seconds, failure: result.failure }));
if (!result.pass) process.exitCode = 1;
