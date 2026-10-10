// SHARD-PLATFORM op-sky36 (E435, the coordinator's pick for Jake): Sky Reach's island shapes draw from the session's
// cosmetic random stream (world/build.ts → world/isle.ts islandMesh), so every live session builds a different set. This
// shoots SHARD SELECT (?chunk=far-reach) at two poses for three live sessions (no harness seed: each page draws its own
// crypto salt, as a player's does) and for one fixed draw (harness seed 357, the seed the witness and captures replay),
// muted, iPhone 16 Pro portrait, phone tier, 2x, Developer on. Writes <out>/isles-<session>-<pose>.png and isles.json.
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/sky36/isles.mjs <preview-url> <out-dir>
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: isles.mjs <preview-url> <out-dir>');
mkdirSync(out, { recursive: true });
const SESSIONS = [{ name: 'live-1', seed: null }, { name: 'live-2', seed: null }, { name: 'live-3', seed: null }, { name: 'fixed', seed: 357 }];
// the spawn view (the windmill isle and the sky isles past it) and a turn to the right (the roost and grove isles)
const POSES = [{ name: 'spawn', turn: 0, pitch: -0.05 }, { name: 'right', turn: -Math.PI / 2, pitch: 0.02 }];
const report = { sessions: {} };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const session of SESSIONS) {
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0 }, merge: true });
    await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
    await ctx.addInitScript((seed) => { window.__wildshardHarness = seed === null ? { capture: null } : { seed, capture: null }; }, session.seed);
    await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage(); page.setDefaultTimeout(240000);
    const row = { errors: [], shots: [] }; report.sessions[session.name] = row;
    page.on('pageerror', (error) => { row.errors.push(String(error).slice(0, 300)); });
    try {
      await page.goto(new URL('?chunk=far-reach&mute=1&skipintro=1&nolock=1&sw=0', base).href, { waitUntil: 'commit' });
      await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load')));
      await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
      await page.waitForTimeout(6000);
      row.seed = await page.evaluate(() => { const w = window.__wildshard.world, app = w.app ?? w.game?.app ?? window.__wildshard.app; return app?.rng?.seedValue ?? null; });
      const spawn = await page.evaluate(() => { const w = window.__wildshard.world, p = w.player.position; return { x: p.x, y: p.y, z: p.z, yaw: w.player.yaw ?? 0 }; });
      for (const pose of POSES) {
        await page.evaluate(async ({ s, pose }) => {
          await window.__wildshard.pose({ x: s.x, y: s.y, z: s.z, yaw: s.yaw + pose.turn, pitch: pose.pitch });
        }, { s: spawn, pose });
        await page.evaluate(() => { const w = window.__wildshard.world, at = w.player.position.clone(); const tick = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick(); });
        await page.waitForTimeout(3000);
        const path = join(out, `isles-${session.name}-${pose.name}.png`);
        await page.screenshot({ path });
        row.shots.push(path);
      }
    } finally { await ctx.close(); }
    writeFileSync(join(out, 'isles.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
} finally { await browser.close(); }
console.log(JSON.stringify(report));
