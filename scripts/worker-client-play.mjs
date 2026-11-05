// J130: the row played through, as the flip's real checklist. Each step stands alone: one that fails is listed and the next still runs.
// Driftwood's opening quest, a fight and its coins, a chest; a ride on Nalati; a grapple; a crossing; save, reload, resume.
import { saveFixture } from './debug-settings.mjs';
import { floorGridBenchmarkUrl, FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';

/** Open one page with the row on. */
async function open(browser, phone, base, path) {
  const context = await browser.newContext(phone), page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(error.message.slice(0, 300)); });
  page.on('console', line => { if (line.type() === 'error') errors.push(line.text().slice(0, 300)); });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'device', key: 'debug.workerClient', data: 'on' });
  await page.goto(new URL(path, base).href, { waitUntil: 'load' });
  return { context, page, errors };
}
const started = page => page.evaluate(() => typeof window.__workerClient === 'function');
async function entered(page) {
  await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 120_000 });
  await page.waitForFunction(() => typeof window.__workerClient === 'function', undefined, { timeout: 60_000 });
  await page.evaluate(FLOOR_GRID_ENTER);
  await page.waitForFunction(() => window.__workerClient().frames > 30, undefined, { timeout: 60_000 });
}
const report = page => page.evaluate(() => window.__workerClient());
/** Walk at a point, stepping aside when stuck. True when within `near` metres. */
async function walk(page, x, z, near, seconds) {
  const until = Date.now() + seconds * 1000;
  let last = null, stuck = 0, turn = 0;
  while (Date.now() < until) {
    const at = await page.evaluate(([tx, tz, side]) => {
      const { player } = window.__wildshard.world, dx = tx - player.position.x, dz = tz - player.position.z;
      player.yaw = Math.atan2(-dx, -dz) + side; player.touchMove.y = 1; player.touchSprint = true;
      return { x: player.position.x, z: player.position.z, away: Math.hypot(dx, dz) };
    }, [x, z, turn]);
    if (at.away < near) { await page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 0; player.touchSprint = false; }); return true; }
    stuck = last !== null && Math.hypot(at.x - last.x, at.z - last.z) < 0.5 ? stuck + 1 : 0; last = at;
    turn = stuck >= 3 ? (stuck % 6 < 3 ? 1.2 : -1.2) : 0;
    if (stuck === 3) await page.keyboard.press('Space');
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 0; player.touchSprint = false; });
  return false;
}
/** The nearest living row body, by kind if named. */
const nearestBody = (page, kinds) => page.evaluate(wanted => {
  const { world } = window.__wildshard, { player } = world, list = world.animals?.animals ?? [];
  const live = list.filter(body => body.alive && body.rowDriven && (wanted.length === 0 || wanted.includes(body.kind)));
  live.sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position));
  const body = live[0];
  return body === undefined ? null : { kind: body.kind, x: body.position.x, z: body.position.z, away: body.position.distanceTo(player.position), count: list.length };
}, kinds);

/** Run every step; prints one line each. */
export async function play(browser, phone, base) {
  const steps = [];
  const step = async (name, run) => {
    let ok = false, note = '';
    const at = Date.now();
    try { const out = await run(); ok = out === true || out?.ok === true; note = typeof out === 'object' && out !== null ? JSON.stringify(out) : String(out); }
    catch (error) { note = `threw: ${String(error).slice(0, 300)}`; }
    steps.push({ name, ok, note });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${Math.round((Date.now() - at) / 1000)} s)  ${note.slice(0, 400)}`);
    return ok;
  };

  // Driftwood, one shard: the opening quest
  const drift = await open(browser, phone, base, '/?chunk=driftwood-isle&mute=1');
  await step('driftwood boots on the row', async () => { await entered(drift.page); return started(drift.page); });
  await step('the page draws the server creatures', async () => { const r = await report(drift.page); return { ok: r.rows > 0, rows: r.rows, closed: r.closed }; });
  await step('walk to Wendell', () => walk(drift.page, -22, -71.5, 2.5, 90));
  await step('talk to Wendell: the server starts the quest', async () => {
    for (let i = 0; i < 14; i++) { await drift.page.keyboard.press('KeyE'); await drift.page.waitForTimeout(700); const r = await report(drift.page); if (r.quests['sealed-ring'] !== undefined && r.quests['sealed-ring'] !== 'unstarted') return { ok: true, quests: r.quests }; }
    const r = await report(drift.page); return { ok: false, quests: r.quests, flags: r.flags.slice(0, 12), x: r.x, z: r.z };
  });
  await step('the chip shows the server step', async () => {
    await drift.page.waitForTimeout(1500);
    const text = await drift.page.evaluate(() => document.body.textContent);
    return { ok: /glyph shards/iu.test(text), text: text.slice(0, 160) };
  });
  await step('a place is discovered and the server keeps it', async () => {
    for (let i = 0; i < 8; i++) { const r = await report(drift.page); const seen = r.flags.filter(flag => flag.startsWith('seen:')); if (seen.length > 0) return { ok: true, seen }; await drift.page.waitForTimeout(1000); }
    return { ok: false };
  });
  await step('open the castaway chest: the server keeps it', async () => {
    const at = await drift.page.evaluate(() => { const live = window.__wildshard.shard['driftwood.adventure'].kit.lives.find(row => row.def.id === 'castaway-chest'); return live === undefined ? null : { x: live.position.x, z: live.position.z }; });
    if (at === null) return { ok: false, why: 'no chest row' };
    await walk(drift.page, at.x, at.z, 1.8, 30);
    for (let i = 0; i < 8; i++) { await drift.page.keyboard.press('KeyE'); await drift.page.waitForTimeout(700); const r = await report(drift.page), held = r.flags.filter(flag => flag.includes('castaway-chest')); if (held.length > 0) return { ok: true, held }; }
    const r = await report(drift.page); return { ok: false, at, x: r.x, z: r.z, flags: r.flags.slice(0, 14) };
  });
  await step('a fight: the server takes a hit', async () => {
    const before = await report(drift.page);
    for (let i = 0; i < 40; i++) {
      const body = await nearestBody(drift.page, []);
      if (body === null) { await drift.page.waitForTimeout(500); continue; }
      if (body.away > 2.2) await walk(drift.page, body.x, body.z, 2, 3);
      await drift.page.evaluate(([x, z]) => { const { player } = window.__wildshard.world; player.yaw = Math.atan2(-(x - player.position.x), -(z - player.position.z)); player.pitch = -0.1; window.__wildshard.world.game.app.input.press('attack'); }, [body.x, body.z]);
      await drift.page.waitForTimeout(600);
      const r = await report(drift.page);
      if (r.hits > before.hits) return { ok: true, hits: r.hits, kills: r.kills, body };
    }
    const r = await report(drift.page); return { ok: false, hits: r.hits, attacks: r.attacks, refused: r.refused, held: r.held };
  });
  await step('a kill pays once', async () => {
    const before = await drift.page.evaluate(() => window.__wildshard.shard['driftwood.loot']?.purse?.coins ?? null);
    for (let i = 0; i < 60; i++) {
      const r = await report(drift.page);
      if (r.paid > 0) { await drift.page.waitForTimeout(2500); const coins = await drift.page.evaluate(() => window.__wildshard.shard['driftwood.loot']?.purse?.coins ?? null), done = await report(drift.page); return { ok: coins !== null && coins - (before ?? 0) <= done.paid + 1, before, coins, paid: done.paid, kills: done.kills }; }
      const body = await nearestBody(drift.page, []);
      if (body !== null) { if (body.away > 2.2) await walk(drift.page, body.x, body.z, 2, 3); await drift.page.evaluate(([x, z]) => { const { player } = window.__wildshard.world; player.yaw = Math.atan2(-(x - player.position.x), -(z - player.position.z)); window.__wildshard.world.game.app.input.press('attack'); }, [body.x, body.z]); }
      await drift.page.waitForTimeout(700);
    }
    const r = await report(drift.page); return { ok: false, paid: r.paid, kills: r.kills, hits: r.hits };
  });
  await step('driftwood saves', async () => { await drift.page.evaluate(() => Promise.race([window.__workerClientSave(), new Promise(resolve => { setTimeout(resolve, 20_000); })])); const r = await report(drift.page); return { ok: r.savedOk, tick: r.savedTick }; });
  await step('driftwood resumes: the quest is where it stood', async () => {
    await drift.page.reload({ waitUntil: 'load' }); await entered(drift.page);
    await drift.page.waitForTimeout(2500);
    const r = await report(drift.page); return { ok: r.restored && r.quests['sealed-ring'] !== undefined && r.quests['sealed-ring'] !== 'unstarted', restored: r.restored, quests: r.quests, x: r.x, z: r.z, serverX: r.serverX, serverZ: r.serverZ };
  });
  await step('driftwood raises no page error', () => ({ ok: drift.errors.length === 0, errors: [...new Set(drift.errors)].slice(0, 6) }));
  await drift.context.close();

  // Nalati: a ride
  const nalati = await open(browser, phone, base, '/?chunk=nalati-grasslands&mute=1');
  await step('nalati boots on the row', async () => { await entered(nalati.page); return started(nalati.page); });
  await step('ride a horse', async () => {
    for (let i = 0; i < 240; i++) {
      const body = await nearestBody(nalati.page, ['horse']);
      if (body === null) { await nalati.page.waitForTimeout(500); continue; }
      if (body.away > 2.2) { await walk(nalati.page, body.x, body.z, 2, 1.5); continue; }
      await nalati.page.keyboard.press('KeyE'); await nalati.page.waitForTimeout(900);
      if (await nalati.page.evaluate(() => window.__wildshard.world.player.ride !== null)) return { ok: true, tries: i };
    }
    return { ok: false, horse: await nearestBody(nalati.page, ['horse']) };
  });
  await step('nalati raises no page error', () => ({ ok: nalati.errors.length === 0, errors: [...new Set(nalati.errors)].slice(0, 6) }));
  await nalati.context.close();

  // The grapple's shard
  const nine = await open(browser, phone, base, '/?chunk=nine-dragon-stack&mute=1');
  await step('nine dragon boots on the row', async () => { await entered(nine.page); return started(nine.page); });
  await step('grapple: the claw is on the wire and answers', async () => {
    const claw = () => nine.page.evaluate(() => { const tool = window.__wildshard.world.game.app.equipment?.tools.find(item => 'guardOpen' in item); return tool === undefined ? null : { sim: tool.sim?.constructor?.name, phase: tool.sim?.phase, hooks: tool.sim?.course?.hooks?.length }; });
    for (let i = 0; i < 40 && (await claw())?.sim === 'GrappleSim'; i++) await nine.page.waitForTimeout(250);
    const held = await claw();
    return { ok: held !== null && held.sim !== 'GrappleSim', held };
  });
  await nine.context.close();

  // The grid: a crossing, a save, a reload
  const grid = await open(browser, phone, base, floorGridBenchmarkUrl(base).replace(base, '/'));
  await step('the grid boots on the row', async () => {
    await grid.page.locator('.ws-main-grid').click({ timeout: 60_000 });
    await grid.page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady, undefined, { timeout: 90_000 });
    await grid.page.evaluate(FLOOR_GRID_ENTER);
    await grid.page.waitForFunction(() => typeof window.__workerClient === 'function' && window.__workerClient().frames > 30, undefined, { timeout: 60_000 });
    return true;
  });
  await step('cross a cell', async () => {
    for (const [x, z] of [[0, -285], [0, -235]]) {
      const until = Date.now() + 70_000;
      while (Date.now() < until) {
        const at = await grid.page.evaluate(([tx, tz]) => { const { live } = window.__wildshard.shard.grid.state().live, { player } = window.__wildshard.world, feet = live.worldFeet; player.yaw = Math.atan2(feet.x - tx, feet.z - tz); player.touchMove.y = 1; player.touchSprint = true; return { away: Math.hypot(feet.x - tx, feet.z - tz), current: live.current }; }, [x, z]);
        if (at.away < 6) break;
        await grid.page.waitForTimeout(1000);
      }
    }
    const r = await report(grid.page); return { ok: r.closed === null, cell: r.cell, serverX: r.serverX, serverZ: r.serverZ, corrections: r.corrections };
  });
  await step('grid saves, reloads and resumes', async () => {
    await grid.page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 0; return Promise.race([window.__workerClientSave(), new Promise(resolve => { setTimeout(resolve, 20_000); })]); });
    const stood = await report(grid.page);
    await grid.page.goto(floorGridBenchmarkUrl(base), { waitUntil: 'load' });
    await grid.page.locator('.ws-main-grid').click({ timeout: 60_000 });
    await grid.page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady, undefined, { timeout: 90_000 });
    await grid.page.evaluate(FLOOR_GRID_ENTER);
    await grid.page.waitForFunction(cell => typeof window.__workerClient === 'function' && window.__workerClient().cell === cell && window.__workerClient().frames > 30, stood.cell, { timeout: 60_000 });
    const back = await report(grid.page);
    return { ok: stood.savedOk && back.restored && Math.hypot(back.serverX - stood.serverX, back.serverZ - stood.serverZ) < 3, cell: back.cell, restored: back.restored };
  });
  await step('the grid raises no page error', () => ({ ok: grid.errors.length === 0, errors: [...new Set(grid.errors)].slice(0, 6) }));
  await grid.context.close();
  return steps;
}
