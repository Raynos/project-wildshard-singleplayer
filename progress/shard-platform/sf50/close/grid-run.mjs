// SF50-p close: Signal Dunes in the live grid on the served candidate build (muted Chromium, iPhone 16 Pro, Developer on):
// enter from the north road through its midpoint entry (real held input on the hover board), a quest step through the bound
// quest, a whip crack, the bound homes (13 `sunscar.home:<i>` identities), leave by the same road and re-enter; 0 errors.
//   scripts/browser-lane.sh node progress/shard-platform/sf50/close/grid-run.mjs <served url> <out dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const ROOT = new URL('../../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
await ctx.addInitScript({ content: saveFixtureCode({ scope: 'device', key: 'devMode', data: true }) });
const page = await ctx.newPage(), errors = [], consoleErrors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 500)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)); });
const missing = []; page.on('response', (r) => { if (r.status() >= 400) missing.push(`${String(r.status())} ${r.url().replace(base, '/')}`); });
const result = { base, device: 'iPhone 16 Pro', steps: [] };
const shot = (name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 60 });
// Hold forward on the hover board toward a shard-local target in the Dunes cell until `until` holds (real input, no teleport).
const drive = (target, until, timeout) => page.evaluate(async ([target, until, timeout]) => {
  const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
  const read = () => api.shard.grid.state().live?.live;
  const dunes = () => api.shard.grid.state().cells.find((c) => c.slug === 'sunscar-dunes');
  const cell = dunes(), cx = cell.cell[0] * 555, cz = cell.cell[1] * 555;
  const start = performance.now(); player.setHover(true);
  try {
    while (performance.now() - start < timeout * 1000) {
      const state = read(); if (state === undefined) { await new Promise((r) => { setTimeout(r, 100); }); continue; }
      const feet = state.worldFeet, dx = cx + target.x - feet.x, dz = cz + target.z - feet.z;
      const done = until === 'inside' ? state.current === cell.instance && state.gameplayReady === true : until === 'outside' ? state.current !== cell.instance : false;
      if (done || Math.hypot(dx, dz) < 1.5) { input.clear(); return { done, feet: { x: feet.x - cx, z: feet.z - cz }, current: state.current, ready: state.gameplayReady, seconds: (performance.now() - start) / 1000 }; }
      player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
      await new Promise((r) => { setTimeout(r, 50); });
    }
    input.clear(); const state = read();
    return { done: false, timeout: true, current: state?.current ?? null, feet: state ? { x: state.worldFeet.x - cx, z: state.worldFeet.z - cz } : null };
  } finally { input.clear(); }
}, [target, until, timeout]);
try {
  await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(800);
  await page.evaluate(() => { setTimeout(() => document.querySelector('.ws-main-grid')?.click(), 100); });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
  await page.mouse.click(195, 420).catch(() => undefined);
  await sleep(3000);
  result.cells = await page.evaluate(() => window.__wildshard.shard.grid.state().cells.map((c) => ({ slug: c.slug, instance: c.instance, cell: c.cell })));
  // Seed the player on the north road deck outside the Dunes' entry (the only positioned pose), then ride in.
  const seeded = await page.evaluate(() => {
    const api = window.__wildshard, player = api.world.player, live = api.shard.grid.state().live.live, dunes = api.shard.grid.state().cells.find((c) => c.slug === 'sunscar-dunes');
    const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
    player.velocity.set(0, 0, 0); player.spawn(dunes.cell[0] * 555 - origin.x, dunes.cell[1] * 555 + 268 - origin.z, 0);
    return { dunes: dunes.instance, at: dunes.cell };
  });
  result.seeded = seeded; await sleep(2500); await shot('road-north');
  for (let visit = 1; visit <= 2; visit++) {
    const enter = await drive({ x: 0, z: 200 }, 'inside', 90); result.steps.push({ visit, enter });
    await sleep(2500); await shot(`entered-${visit}`);
    const play = await page.evaluate((visit) => {
      const api = window.__wildshard, dunes = api.shard.sunscar ?? null, app = api.world.game.app;
      if (dunes === null) return { error: 'no sunscar debug handle', keys: Object.keys(api.shard) };
      const r = { questIndex0: dunes.quest?.index ?? null, homes: dunes.creatures?.homes.map((h) => h.animal?.entityId ?? null) ?? null,
        matriarch: dunes.matriarch?.state ?? null, whip: dunes.whip?.id ?? null, current: app.equipment?.current?.id ?? null };
      if (visit === 1) { dunes.places.flags.set('sunscar.scout'); app.events.flush('update'); }
      r.questIndex = dunes.quest?.index ?? null;
      const before = dunes.whip?.crackT ?? null; app.input.press('attack'); r.crack = { before, after: dunes.whip?.crackT ?? null };
      return r;
    }, visit);
    result.steps.push({ visit, play }); await sleep(800); await shot(`whip-${visit}`);
    const leave = await drive({ x: 0, z: 285 }, 'outside', 90); result.steps.push({ visit, leave });
    await sleep(3000); await shot(`left-${visit}`);
  }
  result.census = await page.evaluate(() => { const api = window.__wildshard; return { animals: api.world.game.app.animals?.animals?.length ?? null }; }).catch(() => null);
} catch (error) { result.failure = String(error).slice(0, 800); await shot('failure').catch(() => undefined); }
result.errors = errors; result.consoleErrors = consoleErrors; result.missing = missing;
writeFileSync(`${out}/grid-run.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ failure: result.failure, steps: result.steps, errors, consoleErrors: consoleErrors.length }, null, 1));
await browser.close();
