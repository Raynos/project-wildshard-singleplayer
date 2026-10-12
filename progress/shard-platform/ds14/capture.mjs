// SHARD-PLATFORM sp-o4 DS1.4 look parity: each shard standalone (?chunk=<slug>) with Settings ▸ Debug ▸ Look ▸
// "Graph materials" on, time fixed at midday, at its spawn pose and a quarter turn from it. One muted context per shot:
// iPhone 16 Pro portrait (phone tier) and a 1440 × 900 desktop context at DPR 2 (desktop tier). Run once on the A build
// (the shipped rock.graph.json) and once on the B build (the same tree with the SDK-compiled graphs), then sheet.py.
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/ds14/capture.mjs <preview-url> <out-dir> <tag>
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out, tag] = process.argv.slice(2);
if (!base || !out || !tag) throw new Error('usage: capture.mjs <preview-url> <out-dir> <tag>');
mkdirSync(out, { recursive: true });
const slugs = ['ink-cel-valley', 'pastel-plain'];
const report = { tag, base, shots: {} };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

for (const slug of slugs) for (const desktop of [false, true]) {
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } : { ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: desktop ? 'desktop' : 'phone', fps: 'auto', tex: 'auto', volume: 0, time: 'midday', graphMaterials: 'on' }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  const name = `${slug}-${desktop ? 'desktop' : 'phone'}`;
  try {
    await page.goto(new URL(`?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`, base).href, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load')));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
    await page.waitForTimeout(8000);
    const pose = await page.evaluate(() => {
      const w = window.__wildshard.world, p = w.player.position, cam = w.game.camera, v = cam.getWorldDirection(cam.position.clone());
      return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(v.x, v.z) };
    });
    const shots = [];
    for (const [label, turn] of [['spawn', 0], ['quarter', Math.PI / 2]]) {
      await page.evaluate(async ({ pose, turn }) => {
        const api = window.__wildshard, w = api.world;
        await api.pose({ x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw + turn, pitch: -0.08 });
        const at = w.player.position.clone(); const hold = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); if (window.__dsHold === hold) requestAnimationFrame(hold); };
        window.__dsHold = hold; hold();
      }, { pose, turn });
      await page.waitForTimeout(4000);
      const file = `${name}-${label}-${tag}.png`;
      await page.screenshot({ path: join(out, file) });
      shots.push(file);
    }
    // what drew: node (graph) materials in the scene and the post stack's passes
    const drew = await page.evaluate(() => {
      const w = window.__wildshard.world; let node = 0, meshes = 0;
      w.game.rootScene.traverse((o) => { if (o.isMesh) { meshes++; if (o.material?.isNodeMaterial) node++; } });
      return { meshes, nodeMaterials: node, passes: (w.game.composer?.passes ?? []).map((p) => p.name ?? p.constructor?.name) };
    });
    report.shots[name] = { pose, shots, drew, errors };
  } catch (error) { report.shots[name] = { failed: String(error).slice(0, 400), errors }; }
  await ctx.close();
}
await browser.close();
writeFileSync(join(out, `capture-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 1).slice(0, 3000));
