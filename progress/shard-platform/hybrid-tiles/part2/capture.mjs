// M3 tiles-swap: Signal Dunes standalone, the groundTiles row off (twice: the noise floor) and on, at the manifest's dev
// poses; cold load, memory at the centre, the ground witness. Muted Chromium, iPhone 16 Pro, Developer on.
//   scripts/browser-lane.sh node capture.mjs <base> <out>
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const D = Math.PI / 180;
// manifest.dev.poses (yaw / pitch in degrees; eye 1.6 m over the ground)
const POSES = [
  { name: 'spawn', x: 0, z: 70, yaw: 0, pitch: 2 },
  { name: 'whip', x: 0, z: 66, yaw: -20, pitch: -4 },
  { name: 'ray', x: 0, z: 70, yaw: -3, pitch: 9 },
  { name: 'quest', x: 4, z: -63, yaw: 15, pitch: 22 },
  { name: 'centre', x: 0, z: 0, yaw: 0, pitch: -6 },
];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { base, device: 'iPhone 16 Pro', runs: [] };
for (const variant of ['off', 'off2', 'on']) {
  const row = variant === 'on' ? 'on' : 'off';
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await ctx.addInitScript({ content: saveFixtureCode({ scope: 'device', key: 'devMode', data: true }) });
  await ctx.addInitScript({ content: saveFixtureCode({ scope: 'device', key: 'debug.plugin.sunscar-dunes.groundTiles', data: row }) });
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('sunscar')) errors.push(`console.${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('response', (r) => { if (r.url().includes('/shardfiles/')) requests.push(`${r.status()} ${r.url().replace(base, '')}`); });
  const run = { variant, row, poses: [] };
  try {
    const t0 = Date.now();
    await page.goto(`${base}/?chunk=sunscar-dunes&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit' });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 100 });
    run.coldLoadMs = Date.now() - t0;
    await sleep(4000);
    for (const p of POSES) {
      const at = await page.evaluate(async ([p, D]) => {
        const w = window.__wildshard.world, pl = w.player;
        pl.velocity.set(0, 0, 0); pl.spawn(p.x, p.z, p.yaw * D); pl.pitch = p.pitch * D;
        await new Promise((r) => { setTimeout(r, 2500); });
        pl.pitch = p.pitch * D;
        return { y: pl.position.y, x: pl.position.x, z: pl.position.z };
      }, [p, D]);
      await page.screenshot({ path: `${out}/${variant}-${p.name}.png` });
      run.poses.push({ ...p, feet: at });
    }
    run.witness = await page.evaluate(() => {
      const w = window.__wildshard.world, group = w.terrain.group, names = [];
      group.traverse((o) => { if (o.isMesh) names.push(o.name || o.type); });
      const info = w.game.renderer.info;
      const mem = window.__wildshard.memory?.();
      return { meshes: names.length, tiles: names.filter((n) => n.startsWith('terrain:')).length, groupChildren: group.children.length,
        gpu: { geometries: info.memory.geometries, textures: info.memory.textures }, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        memory: mem === undefined ? null : JSON.parse(JSON.stringify(mem, (k, v) => (typeof v === 'bigint' ? Number(v) : v))) };
    });
  } catch (error) { run.failure = String(error).slice(0, 600); await page.screenshot({ path: `${out}/${variant}-failure.png` }).catch(() => undefined); }
  run.errors = errors; run.shardfileRequests = requests.length; run.shardfileSample = requests.slice(0, 6);
  result.runs.push(run);
  await ctx.close();
}
writeFileSync(`${out}/capture.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.runs.map((r) => ({ v: r.variant, load: r.coldLoadMs, fail: r.failure, tiles: r.witness?.tiles, meshes: r.witness?.meshes, heap: r.witness?.heapMB, gpu: r.witness?.gpu, req: r.shardfileRequests, errors: r.errors.slice(0, 5), feet: r.poses.map((p) => p.feet.y.toFixed(3)) })), null, 1));
await browser.close();
