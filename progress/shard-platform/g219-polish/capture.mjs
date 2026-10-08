// G219 polish (E435): every open plot from the road at its four entries, a demo corner and a billboard close up, and its
// centrepiece from across the grid (~530 m, on the boulevard). iPhone 16 Pro portrait, muted, Developer ON.
// scripts/browser-lane.sh node progress/shard-platform/g219-polish/capture.mjs --url=<preview> --out=<dir> --tag=<before|after>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), only = arg('only').split(',').filter(Boolean); if (!base || !out || !tag) throw new Error('Pass --url, --out and --tag');
mkdirSync(out, { recursive: true });
const PITCH = 555, HALF = 250;
const PLOTS = [{ name: 'nw', cell: [-1, 1] }, { name: 'sw', cell: [-1, -1] }, { name: 'se', cell: [1, -1] }];
const OUT = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
// an entry's frame (openPlotLayout.entryFrame): depth s inward from the plot edge, lateral t to the right looking in
const at = (o, side, s, t) => { const [ox, oz] = OUT[side], fx = -ox, fz = -oz, rx = -fz, rz = fx; return { x: o.x + ox * HALF + fx * s + rx * t, z: o.z + oz * HALF + fz * s + rz * t }; };
// three's yaw: forward = (−sin yaw, −cos yaw)
const look = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const POSES = [];
for (const plot of PLOTS) {
  const o = { x: plot.cell[0] * PITCH, z: plot.cell[1] * PITCH };
  for (const side of ['north', 'east', 'south', 'west']) {
    const p = at(o, side, -24, 0); POSES.push({ name: `${plot.name}-${side}-road`, ...p, yaw: look(p, at(o, side, 40, 0)), pitch: -0.08 });
  }
  const side = plot.name === 'nw' ? 'south' : plot.name === 'sw' ? 'east' : 'west';
  { const p = at(o, side, 8, 16); POSES.push({ name: `${plot.name}-${side}-demo`, ...p, yaw: look(p, at(o, side, 40, 24)), pitch: -0.12 }); }
  { const p = at(o, side, 10, -14); POSES.push({ name: `${plot.name}-${side}-billboard`, ...p, yaw: look(p, at(o, side, 44, -22)), pitch: -0.2 }); }
  { const p = at(o, 'south', 175, 8); POSES.push({ name: `${plot.name}-centre`, ...p, yaw: look(p, o), pitch: 0.18 }); }
  // across the grid: on the boulevard between the plot's row and the middle row, ~530 m from its centre
  { const p = { x: o.x - Math.sign(plot.cell[0]) * 450, z: o.z - Math.sign(plot.cell[1]) * PITCH / 2 };
    POSES.push({ name: `${plot.name}-centre-far`, ...p, yaw: look(p, o), pitch: -0.1 }); }
}
const report = { base, tag, shots: [], errors: [] }, browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage(); page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  for (const pose of POSES) {
    if (only.length && !only.some(o => pose.name.includes(o))) continue;
    await page.evaluate(p => window.__wildshard.pose({ ...p, y: 0.02 }), pose);
    await page.waitForTimeout(3500);
    const data = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { plots: s.plots, playingMB: s.live?.memory?.playingMB ?? null }; });
    await page.screenshot({ path: join(out, `${pose.name}-${tag}.jpg`), type: 'jpeg', quality: 66 });
    report.shots.push({ pose, pictures: data.plots?.pictures, draws: data.plots?.draws, triangles: data.plots?.triangles, playingMB: data.playingMB });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `capture-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors }));
if (report.failure || report.errors.length) process.exitCode = 1;
