#!/usr/bin/env node
// N1, N2, N5, N6, N7: what a page says and shows of a fight the server runs. A tape wraps the audio layer and the HUD, so a step reads what the
// game asked to play and show (`--mute-audio` and a headless page can't hear it), and `window.__audioLog` adds the score's scenes and phases.
//   scripts/browser-lane.sh node scripts/worker-client-moments.mjs --base=http://127.0.0.1:4401/ [--only=practice,pine,race,captain,god]
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';
import { FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';

const arg = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = arg('base', ''), only = arg('only', 'practice,pine,race,captain,god').split(',');
if (base === '') throw new Error('Requires --base');
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let failed = 0;
const note = (name, ok, out) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(out).slice(0, 1400)}`); };

async function open(slug, query = '') {
  const context = await browser.newContext(phone), page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(error.message.slice(0, 300)); });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'device', key: 'debug.workerClient', data: 'on' });
  await page.goto(new URL(`/?chunk=${slug}&mute=1&nolock=1${query}`, base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
  await page.waitForFunction(() => typeof window.__workerClient === 'function', undefined, { timeout: 150_000 });
  await page.evaluate(FLOOR_GRID_ENTER);
  await page.waitForFunction(() => window.__workerClient().frames > 30, undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    const { world } = window.__wildshard, tape = window.__tape = [];
    const record = (owner, name) => {
      const real = owner[name].bind(owner);
      owner[name] = (...args) => { tape.push(`${name} ${args.join(' ')}`); return real(...args); };
    };
    for (const name of ['combat', 'sting']) record(world.music, name);
    for (const name of ['killFeed', 'toast']) record(world.hud, name);
  });
  return { context, page, errors };
}
const report = page => page.evaluate(() => window.__workerClient());
const fight = (page, id) => page.evaluate(want => window.__workerClientFights().find(row => row.id === want) ?? null, id);
const tape = page => page.evaluate(() => window.__tape);
const score = page => page.evaluate(() => (window.__audioLog ?? []).filter(row => row.kind === 'music' && /^(?:scene|phase|sting):/u.test(row.name)).map(row => row.name));
const place = (page, x, y, z) => page.evaluate(([px, py, pz]) => { window.__wildshard.world.player.link.place(px, py, pz, 0); }, [x, y, z]);
const groundAt = (page, x, z) => page.evaluate(([gx, gz]) => window.__hf.heightAt(gx, gz), [x, z]);
async function until(page, read, seconds, every = 250) {
  const end = Date.now() + seconds * 1000;
  let last = await read();
  while (!last && Date.now() < end) { await page.waitForTimeout(every); last = await read(); }
  return last;
}
const faceAt = (page, at) => page.evaluate(({ x, y, z }) => {
  const { player } = window.__wildshard.world, dx = x - player.position.x, dz = z - player.position.z;
  player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(y - player.position.y - 1.68, Math.hypot(dx, dz));
}, at);
const mid = at => ({ x: at.x, y: at.y + 1, z: at.z });
const close = async ({ context }) => { await context.close(); };

if (only.includes('practice')) {
  const shard = await open('driftwood-isle'), { page } = shard;
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => { const { player } = window.__wildshard.world; return [player.position.x, player.position.y, player.position.z]; });
  await page.evaluate(() => { window.__wildshard.world.hud.onArena(); });
  const entered = await until(page, () => page.evaluate(() => window.__wildshard.world.arena?.active === true), 30);
  const read = () => page.evaluate(() => { const { player } = window.__wildshard.world, r = window.__workerClient(); return { y: Math.round(player.position.y), x: Math.round(player.position.x), z: Math.round(player.position.z), corrections: r.corrections }; });
  const inside = []; for (let at = 0; at < 8; at++) { await page.waitForTimeout(1000); inside.push(await read()); }
  // Walk in the room: on a page that keeps its link, the server's body answers and the walk snaps back.
  await page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 1; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 0; });
  const walked = await read();
  const ticksInside = await page.evaluate(() => window.__wildshard.world.arena.active && window.__workerClient().lastTick);
  await page.waitForTimeout(1200);
  const stopped = await page.evaluate(ticks => window.__workerClient().lastTick === ticks, ticksInside);
  await page.evaluate(() => { const { world } = window.__wildshard; world.arena.exit(); });
  const back = await until(page, async () => (await read()).y < 300, 8);
  const after = await read(), frames = await report(page), moved = Math.hypot(walked.z - inside[0].z, walked.x - inside[0].x);
  await page.waitForTimeout(1000);
  const ticking = (await report(page)).frames > frames.frames;
  note('N5 a practice room stays up, answers a walk, holds the world, and hands the player back', entered === true && inside.every(row => row.y > 500) && walked.y > 500 && moved > 1 && back === true && ticking, { entered, before, inside: inside.slice(-1), walked, moved, stopped, back, after, ticking, errors: shard.errors.slice(0, 3) });
  await close(shard);
}

if (only.includes('pine')) {
  // ?bossGod: a King who keeps killing the proof would keep the score going round its death sting.
  const shard = await open('pine-hollow', '&bossGod=1'), { page } = shard, [x, z] = [150, -30];
  await page.evaluate(() => { window.__workerClientHits(120); window.__workerClientTime('night'); });
  await page.waitForTimeout(2500);
  await place(page, x, await groundAt(page, x, z) + 1, z + 2);
  const id = await until(page, () => page.evaluate(() => window.__workerClientFights().find(row => /king/u.test(row.id))?.id ?? null), 20);
  const armed = await until(page, async () => { const row = await fight(page, id); return row?.state === 'intro' || row?.state === 'fight' ? row.state : null; }, 40);
  const steered = await page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 1; return [player.position.x, player.position.z]; });
  await page.waitForTimeout(700);
  const held = await page.evaluate(([fromX, fromZ]) => { const { player } = window.__wildshard.world; player.touchMove.y = 0; return Math.hypot(player.position.x - fromX, player.position.z - fromZ); }, steered);
  const end = Date.now() + 120_000;
  let row = await fight(page, id);
  while (row?.state !== 'victory' && Date.now() < end) {
    if (row?.at !== null && row?.at !== undefined) {
      await place(page, row.at.x + 2, row.at.y + 0.4, row.at.z + 2); await page.waitForTimeout(300);
      await faceAt(page, mid(row.at)); await page.evaluate(() => { window.__wildshard.world.game.app.input.press('attack'); }); await page.waitForTimeout(450);
    } else await page.waitForTimeout(400);
    row = await fight(page, id);
  }
  await page.waitForTimeout(1200);
  const heard = await tape(page), music = await score(page), ok = row?.state === 'victory' && music.includes('scene:boss') && heard.includes('sting chunk') && music.filter(line => line.startsWith('scene:')).length >= 2;
  note('N2 the Antler King\'s scene, phases, sting and ambient back', ok, { id, armed, walkedInIntro: Number(held.toFixed(2)), state: row?.state, music: music.slice(-10), heard: heard.slice(-10), errors: shard.errors.slice(0, 3) });
  // Old Ironhide, who waits for no dusk: a lair's banner, second phase, trophy line and kill sting.
  await page.evaluate(() => { window.__tape.length = 0; });
  const [ix, iz] = [-44, -76], lair = 'ironhide';
  await place(page, ix, await groundAt(page, ix, iz) + 1, iz);
  await until(page, async () => (await fight(page, lair))?.at !== null, 15);
  const hunt = Date.now() + 60_000;
  const seen = [];
  let beast = await fight(page, lair);
  while (beast?.state !== 'dead' && Date.now() < hunt) {
    if (seen.at(-1) !== beast?.state) seen.push(beast?.state);
    if (beast?.at !== null && beast?.at !== undefined) {
      await place(page, beast.at.x + 2, beast.at.y + 0.4, beast.at.z + 2); await page.waitForTimeout(350);
      await faceAt(page, mid(beast.at)); await page.evaluate(() => { window.__wildshard.world.game.app.input.press('attack'); }); await page.waitForTimeout(450);
    } else await page.waitForTimeout(400);
    beast = await fight(page, lair);
  }
  await page.waitForTimeout(800);
  const said = await tape(page);
  note('N2 Ironhide\'s banner, phase, trophy line and kill sting', beast?.state === 'dead' && said.some(line => line.startsWith('killFeed') && line.includes('Ironhide')) && said.some(line => line === 'combat 0.8' || line.startsWith('combat .')) && said.includes('sting chunk'), { state: beast?.state, seen, phase: beast?.phase, banners: beast?.banners, said: said.slice(-12) });
  await close(shard);
}

if (only.includes('race')) {
  const shard = await open('pine-hollow', '&bossGod=1'), { page } = shard, [x, z] = [-181, -144];
  await page.evaluate(() => { window.__workerClientHits(1000); window.__workerClientFlag('errand:asked'); window.__workerClientTime('night'); });
  await page.waitForTimeout(3000);
  await place(page, x, await groundAt(page, x, z) + 1, z);
  const thralls = () => page.evaluate(([cx, cz]) => [...window.__wildshard.world.animals.animals].filter(body => body.variant === 'thrall' && body.alive && Math.hypot(body.position.x - cx, body.position.z - cz) < 140).map(body => ({ x: body.position.x, y: body.position.y, z: body.position.z })), [x, z]);
  const woke = await until(page, async () => (await thralls()).length >= 3, 30);
  const end = Date.now() + 150_000;
  while (Date.now() < end && !(await report(page)).flags.includes('errand:done')) {
    const [body] = await thralls();
    if (body === undefined) { await page.waitForTimeout(500); continue; }
    await place(page, body.x + 2, body.y + 0.4, body.z + 2); await page.waitForTimeout(500);
    await faceAt(page, mid(body)); await page.evaluate(() => { window.__wildshard.world.game.app.input.press('attack'); }); await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
  const heard = await tape(page), done = (await report(page)).flags.includes('errand:done'), bank = await page.evaluate(() => (window.__audioLog ?? []).filter(row => row.kind === 'sfx' && /thrall/u.test(row.name)).map(row => row.name).slice(-6));
  note('N1 the millrace ends on its toast and sting, and thralls speak', done && heard.some(line => line.includes('goes down in the race')) && heard.includes('sting chunk'), { woke, done, heard: heard.slice(-8), bank, errors: shard.errors.slice(0, 3) });
  await close(shard);
}

if (only.includes('god')) {
  const shard = await open('pine-hollow', '&bossGod=1'), { page } = shard, [x, z] = [-44, -76];
  await place(page, x, await groundAt(page, x, z) + 1, z);
  const start = await page.evaluate(() => window.__wildshard.world.game.app.player.attributes.health);
  await page.waitForTimeout(20_000);
  const r = await report(page), end = await page.evaluate(() => window.__wildshard.world.game.app.player.attributes.health), ironhide = await fight(page, 'ironhide');
  note('N6 ?bossGod stands Ironhide down', r.falls === 0 && end >= start, { start, end, falls: r.falls, state: ironhide?.state, errors: shard.errors.slice(0, 2) });
  await close(shard);
}

if (only.includes('captain')) {
  // Before the fix a body's `burst-x` never came over the wire, so the page's splash read 0 and fell at the captain's feet.
  const shard = await open('driftwood-isle', '&bossGod=1'), { page } = shard, [x, z] = [-91.5, 99.1];
  await page.evaluate(() => { window.__workerClientFlag('used:altar'); });
  await page.waitForTimeout(2000);
  await place(page, x + 8, await groundAt(page, x + 8, z + 8) + 1, z + 8);
  const read = () => page.evaluate(() => { for (const body of window.__wildshard.world.animals.animals) { const burst = body.mem?.['burst-x'] ?? 0; if (burst !== 0) return { x: burst, z: body.mem['burst-z'], st: body.mem.st, at: [body.position.x, body.position.z] }; } return null; });
  const seen = await until(page, async () => { const row = await read(); if (row === null) await page.evaluate(([px, pz]) => { const { player } = window.__wildshard.world; player.yaw = Math.atan2(-(px - player.position.x), -(pz - player.position.z)); }, [x, z]); return row; }, 90, 100), row = await fight(page, 'boss.captain'), named = await page.evaluate(() => [...window.__wildshard.world.animals.animals].filter(body => body.mem?.st !== undefined).map(body => [body.kind, body.mem.st, body.mem.awake]).slice(0, 4));
  note('N7 the captain\'s splash reads burst-x off the wire', seen !== null, { seen, state: row?.state, named, errors: shard.errors.slice(0, 2) });
  await close(shard);
}

await browser.close();
console.log(JSON.stringify({ gate: 'worker-client-moments', failed }));
process.exit(failed === 0 ? 0 : 1);
