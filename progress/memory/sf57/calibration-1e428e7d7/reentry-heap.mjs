// SF57 re-entry witness: boot the public grid page on the borrowed Driftwood home, leave to the road and come back
// twice, and count the per-entry installs each time (they must appear exactly once and still work); diff colliders.
import { writeFileSync } from 'node:fs';
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { publicGridIntentCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/public-grid.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4401';
const VISITS = Number(process.argv[3] ?? 2);
const OUT = '/private/tmp/claude-501/sp-builders/sf57-qualify2';
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--mute-audio', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
await context.addInitScript({ content: 'window.__wildshardHarness={seed:357,capture:null};' });
await context.addInitScript(publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 120000 });

const ready = (want) => page.waitForFunction((w) => {
  const g = window.__wildshard?.shard?.grid; if (!g) return false;
  const s = g.state(), live = s.live?.live; if (!live) return false;
  return w === null ? (live.current !== 'driftwood-isle' && s.inside === null) : (live.current === w && live.gameplayReady === true && s.inside === w && s.rings?.inFlight === 0);
}, want, { timeout: 60000, polling: 250 }).catch(async (e) => { throw new Error('ready ' + want + ' ' + JSON.stringify(await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { feet: s.live.live.worldFeet, cur: s.live.live.current, inside: s.inside, ready: s.live.live.gameplayReady, rings: s.rings, crossing: s.live.crossing }; }))); });

const count = () => page.evaluate(async () => {
  for (let i = 0; i < 3; i++) { window.gc?.(); await new Promise((r) => setTimeout(r, 200)); }
  const heapMB = Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e4) / 100;
  const api = window.__wildshard, world = api.world, scene = world.game.scene;
  const names = { zipline: 0, castaway: 0, interactLit: 0, interactGlow: 0, smoke: 0 };
  scene.traverse((o) => {
    if (o.name === 'zipline') names.zipline++;
    if (o.name === 'npc-castaway') names.castaway++;
    if (o.name === 'interact-lit') names.interactLit++;
    if (o.name === 'interact-glow') names.interactGlow++;
    if (o.isPoints && o.parent?.name === 'npc-castaway') names.smoke++;
  });
  const pieces = world.registry.pieces.map((p) => p.id);
  const piece = (id) => pieces.filter((x) => x === id).length;
  const prompts = (api.interactables ?? world.interactables ?? []).map?.((p) => p.label) ?? null;
  const cols = [];
  world.physics.world.colliders.forEach((c) => {
    const t = c.translation(), p = c.parent();
    cols.push(`${c.shapeType()}@${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)}${p && !p.isFixed() ? (p.isKinematic() ? ':k' : ':d') : ''}`);
  });
  return { heapMB, names, pieces: { total: pieces.length, zipline: piece('zipline'), chime: piece('sea-glass-chime'), plaques: piece('trophy-plaques'), castaway: piece('npc-castaway') },
    colliders: world.physics.world.colliders.len(), bodies: world.physics.world.bodies.len(), cols,
    zipPrompts: Array.isArray(prompts) ? prompts.filter((l) => l === 'Ride the zipline').length : null,
    wendellPrompts: Array.isArray(prompts) ? prompts.filter((l) => l === 'Talk to Wendell').length : null };
});

const pose = (x, z) => page.evaluate(async ({ x, z }) => {
  const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.world.player;
  const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
  await api.pose({ x: x - origin.x, y: 0.55, z: z - origin.z, yaw: 0, pitch: -0.08 });
}, { x, z });

const walkTo = async (x, z, hover) => {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const r = await page.evaluate(({ x, z, hover }) => {
      const api = window.__wildshard, s = api.shard.grid.state(), live = s.live.live, player = api.world.player, input = api.world.game.app.input;
      const dx = x - live.worldFeet.x, dz = z - live.worldFeet.z, d = Math.hypot(dx, dz);
      if (d < 1.5) { input.clear(); player.setHover(false); return { done: true, cur: live.current, inside: s.inside, feet: live.worldFeet }; }
      player.setHover(hover); player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
      return { done: false, cur: live.current, inside: s.inside, feet: live.worldFeet, crossing: s.live.crossing.phase };
    }, { x, z, hover });
    if (r.done) return r;
    await page.waitForTimeout(100);
  }
  throw new Error('walk stalled ' + JSON.stringify(await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { feet: s.live.live.worldFeet, cur: s.live.live.current, inside: s.inside, crossing: s.live.crossing }; })));
};
const out = [];
await ready('driftwood-isle');
await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
await page.mouse.click(200, 430).catch(() => undefined);
await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
await page.waitForTimeout(4000);
out.push({ at: 'boot', ...(await count()) });
for (let visit = 1; visit <= VISITS; visit++) {
  await pose(0, 230); await page.waitForTimeout(1500); await walkTo(0, 300, true);
  await ready(null); await page.waitForTimeout(2000);
  out.push({ at: `road-${visit}`, ...(await count()) });
  await walkTo(0, 230, false); await ready('driftwood-isle'); await page.waitForTimeout(5000);
  out.push({ at: `home-${visit}`, ...(await count()) });
}
const bag = (list) => { const m = new Map(); for (const k of list) m.set(k, (m.get(k) ?? 0) + 1); return m; };
const diff = (a, b) => { const A = bag(a), B = bag(b), plus = [], minus = []; for (const [k, n] of B) { const d = n - (A.get(k) ?? 0); if (d > 0) plus.push(`${k} x${d}`); } for (const [k, n] of A) { const d = n - (B.get(k) ?? 0); if (d > 0) minus.push(`${k} x${d}`); } return { plus, minus }; };
const homes = out.filter((r) => r.at !== 'boot' && r.at.startsWith('home'));
const colDiffs = homes.slice(1).map((h, i) => ({ from: homes[i].at, to: h.at, ...diff(homes[i].cols, h.cols) }));
const firstDiff = homes.length > 0 ? { from: 'boot', to: homes[0].at, ...diff(out[0].cols, homes[0].cols) } : null;
for (const r of out) delete r.cols;
writeFileSync(`${OUT}/reentry.json`, JSON.stringify({ out, firstDiff, colDiffs, errors: errors.slice(0, 20) }, null, 1));
console.log(JSON.stringify({ out, firstDiff, colDiffs, errors: errors.slice(0, 20) }));
await page.screenshot({ path: `${OUT}/reentry.png` });
await browser.close();
