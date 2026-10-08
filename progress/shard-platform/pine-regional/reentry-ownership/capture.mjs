// E435 / SF47-g: three Pine visits, two full road re-entries, draw-time GL census and same-document final unload.
// Run through scripts/browser-lane.sh against a pinned scripts/serve-build.sh preview; muted iPhone portrait.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../../scripts/debug-settings.mjs';
import { installResources } from '../../../../scripts/parity/resources.mjs';
import { GL_INIT } from '../../../../scripts/parity/glbytes.mjs';

const flag = (name, fallback) => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), mode = flag('mode', 'grid'), sky = flag('sky', 'shared'), output = flag('out', `${mode}.json`), shots = flag('shots', '.'), prefix = flag('prefix', `${mode}-${sky}`), dev = flag('dev', '1') === '1';
if (base === '') throw new Error('Pass --url=<pinned preview>');
// cell-local poses (Pine's own level coordinates); the grid walk enters at the east socket (x = +250, z = 0)
const POSES = [
  { label: 'east-inside', x: 231, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep', x: 180, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep-up', x: 180, z: 0, yaw: Math.PI / 2 + 0.7, pitch: 0.35 },
];
const ROAD = { label: 'road', x: 277.5, z: 0, yaw: Math.PI / 2, pitch: 0.05 };
const result = { diagnostic: true, base, mode, sky, dev, started: new Date().toISOString(), errors: [], consoleErrors: [], stops: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let page;
// what the frame draws and what lights it (runs in the browser)
const census = () => {
  const api = window.__wildshard, game = api.world.game, scene = game.rootScene, player = api.world.player;
  const r6 = n => Math.round(n * 1e6) / 1e6;
  const col = c => (c ? [r6(c.r), r6(c.g), r6(c.b)] : null);
  // the shared sky state a layered backdrop moves (key light, fill, fog, environment): exact values, so leave / re-enter can be compared
  const lights = [];
  // sky lights only (key, fill, ambient): a region's lamps are its world, not its sky; the key's direction, not its follow-the-player position
  scene.traverse(o => { if ((o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight) && o.visible) lights.push({ type: o.type, name: o.name, intensity: r6(o.intensity), color: col(o.color), ...(o.groundColor ? { ground: col(o.groundColor) } : {}), ...(o.isDirectionalLight ? { dir: (() => { const v = o.position.clone().sub(o.target.position).normalize(); return v.toArray().map(n => Math.round(n * 1e4) / 1e4); })() } : {}) }); });
  const fog = scene.fog ? { color: col(scene.fog.color), near: scene.fog.near ?? null, far: scene.fog.far ?? null, density: scene.fog.density ?? null } : null;
  const shared = { lights, fog, environment: scene.environment?.uuid ?? null, environmentIntensity: r6(scene.environmentIntensity ?? 1), background: scene.background?.isColor ? col(scene.background) : (scene.background?.uuid ?? null) };
  const gl = typeof window.__sc_gl === 'function' ? window.__sc_gl().map(({ gl: _gl, resources, ...c }) => ({ totalBytes: c.totalBytes, texBytes: c.texBytes, bufBytes: c.bufBytes, rbBytes: c.rbBytes, textures: c.textures, buffers: c.buffers, resources })) : [];
  const grid = api.shard?.grid?.state();
  const live = grid?.live?.live ?? null;
  return { level: game.level?.id, feet: player.position.toArray().map(n => Math.round(n * 100) / 100), world: live?.worldFeet ?? null, current: live?.current ?? null,
    residents: live?.residents, issues: live?.issues, ready: live?.gameplayReady ?? null, info: game.renderer?.info?.render ? { calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles } : null,
    glMB: Math.round(gl.reduce((s, c) => s + c.totalBytes, 0) / 1e4) / 100, gl, shared,
    screens: grid?.screens ? JSON.parse(JSON.stringify(grid.screens)) : null, frame: grid?.frame ? { roadSky: grid.frame.roadSky ?? null, skies: grid.frame.skies ?? null, owner: grid.frame.owner ?? null } : null };
};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  context.setDefaultTimeout(300_000);
  await context.addInitScript(installResources);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
  await context.addInitScript(GL_INIT);
  await context.addInitScript(() => {
    const labels = new WeakMap(), source = window.__sc_label_source;
    window.__sc_label_source = (object, owner, asset) => { labels.set(object, {owner,asset}); source(object,owner,asset); };
    window.__textureDiagnosticLabel = object => labels.get(object);
  });
  if (dev) await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await debugSettings(context, { regionSky: sky });
  await context.route('**/api/errors', route => route.fulfill({status:204,body:''}));
  page = await context.newPage();
  page.on('pageerror', error => { result.errors.push(error.message); console.log('pageerror:', error.message); });
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  const cdp = await context.newCDPSession(page); await cdp.send('Debugger.enable'); await cdp.send('Debugger.setPauseOnExceptions',{state:'all'});
  result.caught = [];
  cdp.on('Debugger.paused', async event => {
    try {
      if (event.reason !== 'exception') return;
      const description=event.data?.description ?? '';
      if (!/width|texture|mipmap/u.test(description)) return;
      const frame=event.callFrames[0];
      const textures = [];
      for(const scope of frame?.scopeChain ?? []) {
        if(scope.type!=='local') continue;
        const props=await cdp.send('Runtime.getProperties',{objectId:scope.object.objectId,ownProperties:true});
        for(const prop of props.result) if(prop.value?.objectId) {
          const detail=await cdp.send('Runtime.callFunctionOn',{objectId:prop.value.objectId,functionDeclaration:`function(){if(!this.isTexture)return null;return {uuid:this.uuid,name:this.name,type:this.type,format:this.format,compressed:this.isCompressedTexture,array:this.isCompressedArrayTexture,mips:this.mipmaps?.length,version:this.version,sourceVersion:this.source?.version,image:this.image ? {width:this.image.width,height:this.image.height,depth:this.image.depth}:null,label:window.__textureDiagnosticLabel(this.source),disposed:window.__textureRetired?.has(this)??null}}`,returnByValue:true}).catch(()=>null);
          if(detail?.result.value)textures.push({variable:prop.name,...detail.result.value});
        }
      }
      result.caught.push({description,frames:event.callFrames.slice(0,10).map(f=>({function:f.functionName,url:f.url,line:f.location.lineNumber,column:f.location.columnNumber})),textures});
      writeFileSync(output,JSON.stringify(result));
    } finally {await cdp.send('Debugger.resume').catch(()=>{});}
  });
  const settle = () => Promise.race([page.evaluate(async () => { for (let i = 0; i < 90; i++) await new Promise(resolve => { requestAnimationFrame(resolve); }); }), new Promise((_,reject)=>{ const timer=setTimeout(()=>reject(new Error('No 90-frame settlement in 30 seconds')),30_000); timer.unref(); })]);
  const hold = pose => page.evaluate(p => { const w = window.__wildshard.world, pl = w.player; w.game.app.input.clear(); pl.yaw = p.yaw; pl.pitch = p.pitch; const clock = w.game.app.dayCycle; if (clock) clock.paused = true; }, pose);
  const stop = async (pose, extra = {}, label = pose.label) => {
    await hold(pose); await settle();
    const c = await page.evaluate(census);
    result.stops.push({ ...pose, label, ...extra, census: c }); writeFileSync(output, JSON.stringify(result));
    await page.screenshot({ path: join(shots, `${prefix}.${label}.jpg`), type: 'jpeg', quality: 70 });
    return c;
  };
  if (mode === 'standalone') {
    for (const pose of POSES) {
      await page.goto(`${base}/?chunk=pine-hollow&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1&x=${pose.x}&z=${pose.z}&yaw=${pose.yaw}&pitch=${pose.pitch}`, { waitUntil: 'commit', timeout: 300_000 });
      await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.state === 'play' && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
      await stop(pose);
    }
  } else {
    await page.goto(`${base}/?tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
    result.version = await page.evaluate(async () => (await fetch('/version.json')).json());
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
    result.setting = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /settings/u.test(k)) ?? '') ?? 'null')?.regionSky ?? null).catch(() => null);
    console.log('grid booted');
    await page.evaluate(()=>{
      const renderer=window.__wildshard.world.game.renderer,get=renderer.properties.get.bind(renderer.properties),seen=new WeakSet(),retired=new WeakSet(); window.__textureRetired=retired;
      renderer.properties.get=object=>{if(object?.isTexture&&!seen.has(object)){seen.add(object);object.addEventListener('dispose',()=>retired.add(object));}return get(object);};
    });
    // walk to a cell-local target with real input; `inside` = finish inside Pine (true) or back on the road (false)
    const walk = (target, label, inside) => page.evaluate(async ({ target, label, inside }) => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input, read = () => api.shard.grid.state();
      const pine = read().cells.find(cell => cell.slug === 'pine-hollow');
      const origin = pine.origin ?? { x: pine.cell[0] * 555, z: pine.cell[1] * 555 };
      const goal = { x: origin.x + target.x, z: origin.z + target.z };
      if (label === 'spawn') {
        const initial = read().live.live, frameOrigin = { x: initial.worldFeet.x - player.position.x, z: initial.worldFeet.z - player.position.z };
        input.clear(); player.velocity.set(0, 0, 0); player.setHover(false);
        player.spawn(goal.x - frameOrigin.x, goal.z - frameOrigin.z, Math.PI / 2); player.position.y = 0.5; player.prevFeet.copy(player.position);
        const until = performance.now() + 60_000;
        while (!(read().live.live.current === null && player.onGround)) { if (performance.now() > until) throw new Error('road spawn timed out'); await new Promise(r => { setTimeout(r, 100); }); }
        return { ok: true };
      }
      return await new Promise(resolve => {
        const deadline=setTimeout(()=>{ input.clear(); clearTimeout(deadline); stop(); resolve({ok:false,why:'wall timeout',state:read().live.live}); },240_000);
        let elapsed = 0, best = Infinity, lastAdvance = 0;
        const stop = world.game.watchFrames(dt => {
          elapsed += dt;
          const s = read().live.live, f = s.worldFeet, dx = goal.x - f.x, dz = goal.z - f.z, d = Math.hypot(dx, dz);
          const there = inside ? (s.current === 'pine-hollow' && s.gameplayReady) : s.current === null;
          if (d < 0.8 && there) { input.clear(); clearTimeout(deadline); stop(); resolve({ ok: true, elapsed, feet: f }); return; }
          if (inside && !s.gameplayReady) { input.clear(); lastAdvance = elapsed; if (elapsed > 240) { clearTimeout(deadline); stop(); resolve({ ok: false, why: 'not ready', feet: f, issues: s.issues }); } return; }
          if (d < best - 0.2) { best = d; lastAdvance = elapsed; } else if (elapsed - lastAdvance > 4) { input.clear(); clearTimeout(deadline); stop(); resolve({ ok: false, why: 'stuck', feet: f, current: s.current }); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
    }, { target, label, inside });
    result.spawn = await walk(ROAD, 'spawn', false);
    await settle();
    // Pine's readiness on the road (a waiting / refused cell explains a stuck walk)
    result.pineOnRoad = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(), live = s.live?.live; const cell = s.cells.find(c => c.slug === 'pine-hollow');
      return JSON.parse(JSON.stringify({ cell, issues: live?.issues ?? null, ready: live?.ready ?? null }, (k, v) => (typeof v === 'function' ? undefined : v))); }).catch(error => String(error));
    const before = await stop(ROAD, {}, 'road-before');
    // every GL resource on the road before entry (an A / B difference here is not the region's sky, which is not built yet)
    result.roadResources = await page.evaluate(() => window.__sc_gl().flatMap(c => c.resources.map(r => [r.kind, r.bytes, r.owner, r.asset].join('|'))));
    const roads = [];
    for (let visit = 1; visit <= 3; visit++) {
      for (const pose of POSES) {
        const label = `visit-${visit}.${pose.label}`, leg = await walk(pose, label, true);
        console.log(label, JSON.stringify(leg));
        if (!leg.ok) throw new Error(`Failed ${label}: ${JSON.stringify(leg)}`);
        await stop(pose, { leg }, label);
        if (result.caught.length > 0 || result.errors.length > 0) throw new Error('Render exception on entry');
      }
      const out = await walk(ROAD, `leave-${visit}`, false);
      if (!out.ok) throw new Error(`Failed leave ${visit}: ${JSON.stringify(out)}`);
      roads.push(await stop(ROAD, {leg:out}, `road-after-${visit}`));
    }
    const after = roads[0], after2 = roads[1];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    result.roadSky = { exactAfterEveryLeave: roads.every(road => same(before.shared, road.shared)), exactAfterLeave: same(before.shared, after.shared), exactAfterReEnter: same(before.shared, after2.shared),
      skiesOnRoad: [before.frame?.skies, after.frame?.skies, after2.frame?.skies], glMB: [before.glMB, after.glMB, after2.glMB] };
  }
  result.leak = await page.evaluate(()=>window.__wildshard.leak());
  result.finalGL=await page.evaluate(()=>window.__sc_gl().map(({gl,...row})=>row));
  result.checks = {
    textureErrors: result.caught.length === 0,
    pageErrors: result.errors.length === 0,
    consoleErrors: result.consoleErrors.length === 0,
    cleanDisposal: result.leak.disposalErrors.length === 0,
    finalNativeZero: result.leak.after.bodies === 0 && result.leak.after.colliders === 0,
    finalLevelGPUZero: result.leak.after.geometries === 0 && result.leak.after.textures === 0 && result.leak.after.programs === 0,
    scopeZero: Object.values(result.leak.scope).every(value => value === 0),
    roadSkyRestored: result.roadSky?.exactAfterEveryLeave === true,
  };
  result.pass = Object.values(result.checks).every(Boolean);
  if (!result.pass) throw new Error(`Failed final census: ${JSON.stringify(result.checks)}`);
  await context.close();
} catch (error) {
  result.failure = String(error?.stack ?? error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(shots, `${prefix}.failure.jpg`), type: 'jpeg', quality: 70 }).catch(() => undefined);
} finally { await browser.close(); writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); }
console.log(JSON.stringify({ failure: result.failure ?? null, errors: result.errors, roadSky: result.roadSky ?? null, stops: result.stops.map(s => ({ label: s.label, ok: s.leg?.ok ?? true, current: s.census.current, glMB: s.census.glMB, skies: s.census.frame?.skies })) }));
if (result.failure) process.exitCode = 1;
