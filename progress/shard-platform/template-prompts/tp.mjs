// template-prompts probe (E435): the public grid (Developer saved OFF, the pre-release grid intent), iPhone 16 Pro, muted.
// Walk Driftwood → template-1 (real held input), stand at the grey hut's door, read the prompt, tap USE, walk into the hut,
// read the copy's quest and door state from its own regional simulation, then walk back out onto the road.
//   node tp.mjs --url=http://127.0.0.1:4401 --out=<dir> (served build; through scripts/browser-lane.sh) --tag=before --engine=webkit|chromium
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { webkit, chromium, devices } from 'playwright';
import { saveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
import { publicGridIntentCode, readPublicGridWitness, publicGridWitnessFailures } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/public-grid.mjs';
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url').replace(/\/$/, ''), out = arg('out'), tag = arg('tag'), engine = arg('engine', 'webkit');
mkdirSync(out, { recursive: true });
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { tag, engine, errors: [], steps: [] };
const CELL = 'template-1';
try {
  const { defaultBrowserType: _e, ...phone } = devices['iPhone 16 Pro'];
  const context = await browser.newContext({ ...phone, serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: false });
  await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); window.__wildshardHarness = { seed: 357, capture: null }; });
  await context.addInitScript(publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }));
  const page = await context.newPage();
  page.on('pageerror', (e) => { report.errors.push(e.message.slice(0, 300)); });
  await page.goto(`${base}/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(2000);
  const witness = await page.evaluate(`(${readPublicGridWitness.toString()})()`);
  report.publicFailures = publicGridWitnessFailures(witness, false);
  report.developer = witness.developer; report.savedDeveloper = witness.savedDeveloper;
  report.cells = witness.state.cells.map((c) => `${c.instance}:${c.slug}@${c.cell.join(',')}`);

  /** a snapshot of what the page shows and what template-1's own simulation holds */
  const snap = (name) => page.evaluate(({ name, CELL }) => {
    const api = window.__wildshard, grid = api.shard.grid, s = grid.state(), live = s.live.live, sim = grid.simulation?.(CELL);
    const lane = sim?.lane, view = lane === undefined ? null : lane.world.view(sim.host.player.id);
    const quest = sim?.quest.quests[0];
    const door = sim?.colliders.get('template.door');
    const menu = document.querySelector('.ws-gmenu-mapmeta')?.textContent ?? null;
    return { name, current: live.current, inside: s.inside, feet: { x: +live.worldFeet.x.toFixed(2), y: +live.worldFeet.y.toFixed(2), z: +live.worldFeet.z.toFixed(2) },
      prompt: api.world.hud.promptText ?? '', use: document.querySelector('.ws-touch-use.show')?.textContent?.trim() ?? null,
      minimapLabels: api.shard.gridHud?.minimap?.().labels ?? null, menuName: menu,
      region: sim === undefined ? null : { shared: view?.shared ?? null, flags: [...(sim.host.flags.all ?? [])].map(String).filter((f) => f.startsWith('template')),
        quest: quest === undefined ? null : { started: quest.isStarted, index: quest.index, step: quest.current?.id ?? null, complete: quest.isComplete },
        doorCollider: door === undefined ? null : door.active() } };
  }, { name, CELL });

  /** walk through world-metre waypoints with held input; `face` turns to a point at the end */
  const walk = (name, waypoints, face = null) => page.evaluate(async ({ waypoints, face }) => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    player.setHover?.(false); input.clear();
    const prompts = new Set(); let i = 0; const started = performance.now();
    return await new Promise((resolve) => {
      let stop = () => undefined, done = false, best = Infinity, bestAt = performance.now();
      const finish = (why) => { if (done) return; done = true; stop(); input.clear();
        const live = api.shard.grid.state().live.live, feet = live.worldFeet;
        if (face !== null) player.yaw = Math.atan2(-(face.x - feet.x), -(face.z - feet.z));
        resolve({ why, seconds: +((performance.now() - started) / 1000).toFixed(1), reached: i, feet: { x: +feet.x.toFixed(2), z: +feet.z.toFixed(2) }, current: live.current, prompts: [...prompts] }); };
      const timer = setTimeout(() => finish('timeout'), 150_000);
      stop = world.game.watchFrames(() => {
        const live = api.shard.grid.state().live.live, feet = live.worldFeet, target = waypoints[i];
        const pr = world.hud.promptText; if (pr) prompts.add(`${pr}@${live.current}`);
        const d = Math.hypot(target.x - feet.x, target.z - feet.z);
        if (d < 0.6) { i++; best = Infinity; bestAt = performance.now(); if (i >= waypoints.length) { clearTimeout(timer); finish('arrived'); return; } return; }
        if (d < best - 0.05) { best = d; bestAt = performance.now(); }
        if (!live.gameplayReady) { input.clear(); bestAt = performance.now(); return; }
        if (performance.now() - bestAt > 4000) { clearTimeout(timer); finish('stopped'); return; }
        player.yaw = Math.atan2(-(target.x - feet.x), -(target.z - feet.z)); input.setHeld('move.forward', true);
      });
    });
  }, { waypoints, face }).then((r) => { report.steps.push({ walk: name, ...r }); return r; });
  const shot = (name) => page.screenshot({ path: join(out, `${tag}-${engine}-${name}.jpg`), type: 'jpeg', quality: 60 });

  report.steps.push(await snap('home'));
  // the frame floor's template route: seed once inside Driftwood (home frame = grid metres), then real input only
  await page.evaluate(async () => { await window.__wildshard.pose({ x: 0, y: 1.6, z: 230, yaw: Math.PI, pitch: 0 }); });
  await page.waitForTimeout(3000);
  await walk('to-road', [{ x: 0, z: 280 }]);
  report.steps.push(await snap('road'));
  await walk('copy-entry', [{ x: 0, z: 325 }]);
  report.steps.push(await snap('copy-south-edge'));
  await page.screenshot({ path: join(out, `${tag}-${engine}-0b-minimap-south-edge.jpg`), type: 'jpeg', quality: 70, clip: { x: 240, y: 0, width: 153, height: 140 } });
  await walk('copy-mid', [{ x: -8, z: 400 }]);
  report.steps.push(await snap('copy-mid'));
  await page.screenshot({ path: join(out, `${tag}-${engine}-0a-minimap-mid.jpg`), type: 'jpeg', quality: 70, clip: { x: 240, y: 0, width: 153, height: 140 } });
  await walk('into-copy', [{ x: -8, z: 530 }, { x: -8, z: 555 }, { x: 0, z: 548.3 }], { x: 0, z: 546 });
  await page.waitForTimeout(1500);
  report.steps.push(await snap('at-door'));
  await shot('1-door-prompt');
  await page.evaluate(() => { window.__wildshard.world.game.app.input.press('use'); });
  await page.waitForTimeout(1500);
  report.steps.push(await snap('after-use'));
  await shot('2-door-open');
  await walk('into-hut', [{ x: 0, z: 543 }]);
  await page.waitForTimeout(800);
  report.steps.push(await snap('in-hut'));
  await shot('3-in-hut');
  await walk('leave', [{ x: 0, z: 549.6 }, { x: -8, z: 555 }, { x: -8, z: 530 }, { x: 0, z: 325 }, { x: 0, z: 280 }]);
  await page.waitForTimeout(1500);
  report.steps.push(await snap('left-to-road'));
  await shot('4-road');
} catch (error) { report.failure = String(error?.stack ?? error).slice(0, 600); }
finally { await browser.close(); }
writeFileSync(join(out, `tp-${tag}-${engine}.json`), `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify(report, null, 1));
