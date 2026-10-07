// SHARD-PLATFORM G200: the standalone arrival caps, captured standalone and in the grid (iPhone 16 Pro portrait, muted).
// Sky Reach: from the north gate isle down the chains to the resting islet and the sky dock, and on the dock looking out.
// Nine Dragon (nineDragonEntries ON): on the north lift deck looking out at its open end. Each page also probes the cap's
// collision with a downward ray (the rail / balustrade top standalone, the road or nothing in the grid) and, on Sky Reach,
// whether the dock's object is in the scene. Writes <shard>-<mode>-<view>.jpg and capture-<shard>-<mode>.json here.
// Run: scripts/browser-lane.sh node progress/shard-platform/g200/capture.mjs --url=<served build> --shard=far-reach|nine-dragon-stack --grid=0|1
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const URL0 = arg('url', 'http://127.0.0.1:4401/').replace(/\/$/u, ''), SLUG = arg('shard', 'far-reach'), GRID = arg('grid', '0') === '1', OUT = import.meta.dirname;
const MODE = GRID ? 'grid' : 'standalone', TAG = SLUG === 'far-reach' ? 'skyreach' : 'ninedragon';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = { url: URL0, shard: SLUG, mode: MODE, date: new Date().toISOString(), probes: {}, shots: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { report.errors.push(String(e).slice(0, 300)); });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  if (SLUG === 'nine-dragon-stack') await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.nine-dragon-stack.nineDragonEntries', data: 'on' });
  if (GRID) {
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(ctx, { scope: 'device', key: 'debug.global.gridOneFrame', data: 'on' });
    await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
    page.on('console', (m) => { if (/grid|refus|admit|error/iu.test(m.text())) console.log('console:', m.text().slice(0, 300)); });
    await ctx.addInitScript((slug) => {
      if (sessionStorage.getItem('g200.intent')) return; sessionStorage.setItem('g200.intent', '1');
      const key = 'wildshard.save.v2.device', doc = JSON.parse(localStorage.getItem(key) ?? '{"keys":{}}'); doc.keys ??= {};
      doc.keys['gridIntent.once'] = { v: 1, data: { instance: slug, slug, at: Date.now() } };
      doc.keys['titleArrival.once'] = { v: 1, data: { slug, mode: 'enter', at: Date.now() } };
      localStorage.setItem(key, JSON.stringify(doc));
    }, SLUG);
  }
  await page.goto(`${URL0}/?chunk=${SLUG}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  try { await page.waitForFunction((grid) => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined && (!grid || Boolean(window.__wildshard?.shard?.grid?.state?.().live?.live)), GRID, { timeout: 240000, polling: 250 }); }
  catch (error) { console.log('not live:', await page.evaluate(() => JSON.stringify({ href: location.href, load: document.querySelector('.ws-load')?.textContent?.slice(0, 200) ?? null, world: window.__wildshard?.world !== undefined, state: window.__wildshard?.shard?.grid?.state?.() ?? null }).slice(0, 1500))); throw error; }
  if (GRID) {
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow?.(); });
    report.grid = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { home: s.home, cells: s.cells.map((c) => `${c.slug}@${c.cell.join(',')}`) }; });
  }
  await sleep(6000);
  report.build = await page.evaluate(() => window.__wildshard.version ?? null);
  // the highest static surface under (x, z), cast down from `top` (under the cell's own ceilings: 4 m on the Nine Dragon deck)
  const ray = (x, z, top = 12) => page.evaluate(([px, pz, py]) => {
    const ph = window.__wildshard.world.physics, R = ph.R, hit = ph.world.castRay(new R.Ray({ x: px, y: py, z: pz }, { x: 0, y: -1, z: 0 }), 60, true, R.QueryFilterFlags.EXCLUDE_SENSORS);
    return hit === null ? null : Number((py - hit.timeOfImpact).toFixed(3));
  }, [x, z, top]);
  const face = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
  const shot = async (view, at, yaw, pitch) => {
    await page.evaluate(([p, y, pi]) => { const pl = window.__wildshard.world.player; pl.spawn(p.x, p.z, y, p.y); pl.yaw = y; pl.pitch = pi; }, [at, yaw, pitch]);
    await sleep(2500);
    await page.evaluate(([y, pi]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = pi; }, [yaw, pitch]);
    await sleep(400);
    const path = join(OUT, `${TAG}-${MODE}-${view}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: 70 }); report.shots.push(path.slice(ROOT.length + 1));
  };
  if (SLUG === 'far-reach') {
    report.probes.dockInScene = await page.evaluate(() => {
      const w = window.__wildshard.world, r = w.game?.app?.render, scene = r?.scene ?? r?.look?.scene ?? w.scene ?? w.sky?.scene; let found = false;
      scene?.traverse?.((o) => { if (o.name === 'far.docks') found = true; }); return scene === undefined ? 'no scene handle' : found;
    });
    // north entry (+z): the dock's far-end rail (u 4.9 → z 245.1), its side rail (t 2.7), the deck (u 10 → z 240)
    report.probes.farEndRail = await ray(0, 245.1); report.probes.sideRail = await ray(2.7, 240); report.probes.deck = await ray(0, 240);
    // wait for the north islet to rest at the lip, so the frame shows it against the lip and the dock
    for (let t0 = Date.now(), seen = false; Date.now() - t0 < 90000; await sleep(200)) {
      const p = await page.evaluate(() => window.__wildshard.shard.farReach.isletAt('north')); if (p.y > 0.5) seen = true; if (seen && p.y < 0.001) break;
    }
    await shot('1-from-gate', { x: 0.8, y: 25.3, z: 206.8 }, face({ x: 0.8, z: 206.8 }, { x: 0, z: 245 }), -0.62);
    await shot('2-on-dock', { x: -1.2, y: 0.3, z: 236.5 }, face({ x: -1.2, z: 236.5 }, { x: 0.6, z: 250 }), -0.08);
  } else {
    // north lift deck (z −250 … −234): the deck. (A ray over the balustrade reads its own origin (it starts inside a solid at the cell edge, likely the bounds
    // collider); the balustrade's collision is test/shards/nine-dragon-stack/deck-cap.test.ts's walk.)
    report.probes.deck = await ray(0, -240, 4);
    await shot('1-deck', { x: 1.4, y: 0.3, z: -236.5 }, face({ x: 1.4, z: -236.5 }, { x: 0, z: -250 }), 0.04);
    await shot('2-close', { x: -2.6, y: 0.3, z: -244.5 }, face({ x: -2.6, z: -244.5 }, { x: 0.5, z: -250 }), 0.12);
  }
  console.log(JSON.stringify({ shard: SLUG, mode: MODE, grid: report.grid, probes: report.probes, errors: report.errors.length }));
  writeFileSync(join(OUT, `capture-${TAG}-${MODE}.json`), `${JSON.stringify(report, null, 1)}\n`);
  await ctx.close();
} finally { await browser.close(); }
