// G222 / SF23 (E435): road captures of the far proxies' border faces at sp-x3's poses (SF48-g) and north of Pine Hollow.
// scripts/browser-lane.sh node progress/shard-platform/g222-far-skirt/capture.mjs --url=<preview> --out=<dir> --tag=<before|after>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'); if (!base || !out || !tag) throw new Error('Pass --url, --out and --tag');
mkdirSync(out, { recursive: true });
const POSES = [
  { name: 'nalati-south', x: 705, z: -277.5, yaw: -Math.PI / 2, pitch: 0.12 },
  { name: 'nalati-west', x: 277.5, z: -150, yaw: Math.PI, pitch: 0.12 },
  { name: 'pine-north', x: -150, z: 832.5, yaw: -Math.PI / 2, pitch: 0.12 },
  { name: 'pine-north-face', x: 0, z: 836, yaw: 0, pitch: 0.18 },
];
const report = { base, tag, poses: [], errors: [] }, browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
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
    await page.evaluate(p => window.__wildshard.pose({ ...p, y: 0.02 }), pose);
    await page.waitForTimeout(6000);
    const data = await page.evaluate(() => {
      const scene = window.__wildshard.world.game.rootScene, objects = [];
      scene.traverse(o => { if (o.isMesh && o.name === 'far-proxy') {
        const g = o.geometry, p = g.attributes.position, uv = g.attributes.uv;
        let cliff = 0, borderTop = -Infinity;
        for (let i = 0; i < p.count; i++) { if (uv.getY(i) > 0.5) cliff++; if (Math.abs(p.getX(i)) >= 249.9 || Math.abs(p.getZ(i)) >= 249.9) borderTop = Math.max(borderTop, p.getY(i)); }
        objects.push({ cell: o.parent?.name, visible: o.visible, triangles: (g.index?.count ?? 0) / 3, cliffVertices: cliff, borderTop: Math.round(borderTop * 10) / 10 });
      } });
      return objects;
    });
    await page.screenshot({ path: join(out, `${pose.name}-${tag}.jpg`), type: 'jpeg', quality: 72 });
    report.poses.push({ pose, data });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `capture-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors }));
if (report.failure || report.errors.length) process.exitCode = 1;
