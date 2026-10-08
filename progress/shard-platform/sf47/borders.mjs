// SF47-g (E435): the allocator's playing total at Pine Hollow's borders, both grid layouts, one muted Chromium/Metal
// iPhone 16 Pro portrait context per layout (phone tier, 2x). Diagnostic poses (player.spawn), not a crossing or physics
// verdict. Per pose: the grid's state (playing / accounted / rings / live), the allocator table and the labelled GL census.
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/sf47/borders.mjs <preview> <out.json> [dev|shipped|both] [pose count]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';

const [base, out, which = 'both', limit = '99'] = process.argv.slice(2);
const P = 555; // grid pitch: world x = cell[0] * P, z = cell[1] * P; Pine (Developer) is cell [0, 1], Driftwood [0, 0], template-2 [1, 1]
const POSES = [
  ['home-settled', null],
  ['road-driftwood-pine', [0, P / 2]],
  ['pine-south-edge', [0, P - 235]],
  ['pine-centre', [0, P]],
  ['pine-east-edge', [235, P]],
  ['road-pine-template2', [P / 2, P]],
  ['template2-west-edge', [P - 235, P]],
  ['back-pine-centre', [0, P]],
  ['back-road-driftwood-pine', [0, P / 2]],
  ['back-driftwood-north-edge', [0, 235]],
];
const version = await (await fetch(new URL('version.json', base))).json();
const report = { version, layouts: {} };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const layout of which === 'both' ? ['dev', 'shipped'] : [which]) {
    const rec = { snapshots: [], errors: [], console: [] }; report.layouts[layout] = rec;
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' }, merge: true });
    await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: layout === 'dev' });
    await context.addInitScript(GL_INIT);
    const page = await context.newPage();
    page.on('pageerror', (error) => { rec.errors.push(error.message); });
    page.on('console', (m) => { if (['warn', 'error'].includes(m.type())) rec.console.push(m.text().slice(0, 600)); });
    try {
      await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 });
      await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
      rec.developer = await page.evaluate(() => document.documentElement.hasAttribute('data-dev'));
      if (rec.developer !== (layout === 'dev')) throw new Error(`Developer fixture mismatch: ${String(rec.developer)}`);
      await page.locator('.ws-main-grid').click();
      await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
      const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
      await page.evaluate(() => window.__wildshard.world.hud.enterNow());
      await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
      for (const [label, at] of POSES.slice(0, Number(limit))) {
        // the player's frame is the live render origin's (it moves to each entered cell): world -> local before spawning
        if (at !== null) await page.evaluate(([x, z]) => { const w = window.__wildshard.world, o = window.__wildshard.shard.grid.state().live?.renderOrigin ?? { x: 0, z: 0 }; w.player.spawn(x - o.x, z - o.z, 0); w.player.setHover(true); }, at);
        await page.waitForTimeout(at === null ? 15000 : 20000);
        const v = await page.evaluate(() => {
          const g = window.__wildshard.shard.grid, s = g.state(), p = window.__wildshard.world.player.position;
          const r = g.residency(), byOwner = {};
          for (const e of r.claims) { const k = `${e.owner}:${e.category}`; byOwner[k] = (byOwner[k] ?? 0) + e.accountedBytes; }
          const o = s.live?.renderOrigin ?? { x: 0, z: 0 };
          return { pos: { x: p.x + o.x, y: p.y, z: p.z + o.z }, renderOrigin: o, playingMB: s.playingMB, residentMB: s.residentMB, accountedBytes: s.accountedBytes, rings: s.rings, live: s.live, cost: r.cost, byOwner, gl: window.__sc_gl() };
        });
        rec.snapshots.push({ label, at, ...v }); save();
        console.log(layout, label, v.playingMB, 'MB playing', Object.keys(v.byOwner).length, 'owners');
        if (label === 'pine-centre') await page.screenshot({ path: `${out}.${layout}.pine-centre.jpg`, type: 'jpeg', quality: 60 });
      }
    } catch (error) { rec.failure = String(error); console.log(layout, 'FAIL', rec.failure); await page.screenshot({ path: `${out}.${layout}.failed.jpg`, type: 'jpeg', quality: 60 }).catch(() => {}); }
    finally { await context.close(); save(); }
  }
} finally { await browser.close(); save(); }
console.log('CLOSED');
