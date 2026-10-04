#!/usr/bin/env node
// SF33b (SHARD-PLATFORM, G83, E439): pause ▸ Settings ▸ SAVES and the New game sheet, proven in a real browser.
//
//   scripts/serve-build.sh --head --name sf33b                 # → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/sf33b/new-game.mjs --url=http://127.0.0.1:<port>
//
// iPhone 16 Pro portrait, muted, Developer on (the template is a developer card). Enters the template, plays its quest
// (reach the hut, beat the blob with the whip), opens pause ▸ Settings and captures SAVES; taps the template card's
// NEW GAME and captures the before → after sheet; taps NEW GAME, waits for the reload, and checks the quest is back at
// its first step with the pack empty while the profile document and the feats ('progress') stay byte-for-byte and
// another shard's save is untouched. Writes new-game.json and three portrait JPEGs next to this script.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
if (!url) { console.error('usage: new-game.mjs --url=<served build>'); process.exit(2); }
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const P = 'wildshard.save.v2.';
const OTHER = { keys: { flags: { v: 1, data: ['pine.someone.elses'] }, inventory: { v: 1, data: { counts: { cone: 2 }, order: ['cone'] } } } };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const result = { url, steps: [] };
const log = (step, data = {}) => { result.steps.push({ step, ...data }); console.error(`sf33b: ${step} ${JSON.stringify(data).slice(0, 300)}`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 1, capture: null, errors: [] }; }); // the probe's pose / combat controls (real time, no frame capture)
  await context.addInitScript(({ name, doc }) => { if (!localStorage.getItem(name)) localStorage.setItem(name, JSON.stringify(doc)); }, { name: `${P}pine-hollow`, doc: OTHER });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); });
  const enter = `${url.replace(/\/$/u, '')}/?chunk=_template&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0`;
  const boot = async () => {
    await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load'), undefined, { timeout: 180000 });
    await page.waitForFunction(() => !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 60000 });
    await sleep(1500);
  };
  const touch = async (selector, hold = 80) => {
    const b = await page.locator(selector).boundingBox(); if (!b) throw new Error(`absent: ${selector}`);
    const at = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 7 }, cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] }); await sleep(hold);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  };
  const docs = () => page.evaluate((p) => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith(p)).map((k) => [k.slice(p.length), localStorage.getItem(k)])), P);
  const quest = () => page.evaluate(() => window.__wildshard.state().quest);
  const template = (all) => { try { return JSON.parse(all['template-solo'] ?? all._template ?? '{"keys":{}}'); } catch { return { keys: {} }; } };

  await page.goto(enter); await boot();
  log('entered', { quest: await quest() });
  // play the quest: the hut region, then the blob with the template's whip (the template gate's own step)
  await page.evaluate(() => window.__wildshard.pose({ x: 0, z: -9, y: 1, yaw: 0 })); await sleep(1500);
  log('hut', { quest: await quest() });
  // the blob lives by (0, -19); walk up to it and give its encounter time to spawn
  await page.evaluate(() => window.__wildshard.pose({ x: 0, z: -14, y: 1, yaw: Math.PI })); await sleep(1000);
  for (let i = 0; i < 20 && !(await page.evaluate(() => window.__wildshard.world.animals.animals.some((a) => a.kind === 'greyBlob' && a.alive !== false))); i++) await sleep(500);
  log('blob', { kinds: await page.evaluate(() => window.__wildshard.world.animals.animals.map((a) => `${a.kind}@${a.position.x.toFixed(1)},${a.position.z.toFixed(1)}`)) });
  for (let round = 0; round < 3; round++) {
    const aim = await page.evaluate(() => {
      const probe = window.__wildshard, p = probe.world.player;
      const whip = probe.world.weapons.list.find((w) => String(w.id).includes('whip')); if (whip) { probe.world.weapons.unlock(whip.id); probe.combat.equip(whip.id); } // held at start (the manifest's loadout)
      const target = probe.combat.target('greyBlob', { x: 0, z: -19 }), at = target.position;
      let dx = p.position.x - at.x, dz = p.position.z - at.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      return { pose: { x: at.x + dx * 2.6, z: at.z + dz * 2.6, y: at.y, yaw: Math.atan2(dx, dz) }, at: { x: at.x, y: at.y + target.dims.bodyY, z: at.z } };
    });
    await page.evaluate((pose) => window.__wildshard.pose(pose), aim.pose); await sleep(600);
    await page.evaluate((a) => { const p = window.__wildshard.world.player; p.pitch = Math.atan2(a.y - (p.position.y + 1.68), Math.hypot(p.position.x - a.x, p.position.z - a.z)); }, aim.at);
    for (let i = 0; i < 40; i++) {
      await touch('.ws-touch-attack', 100); await sleep(450);
      if (await page.evaluate(() => JSON.stringify(window.__wildshard.state().quest).includes('template.blob'))) break;
    }
    if (await page.evaluate(() => JSON.stringify(window.__wildshard.state().quest).includes('template.blob'))) break;
  }
  // the quest completes live at once; its continuation reaches the save at the next checkpoint (the cards read the save)
  const savedFlags = async () => { const doc = template(await docs()); return [...(doc.keys.flags?.data ?? []), ...(doc.keys['platform.continuation']?.data?.flags ?? [])]; };
  for (let i = 0; i < 60 && !(await savedFlags()).includes('template.complete'); i++) await sleep(500);
  const played = await docs(), before = template(played);
  log('played', { kills: await page.evaluate(() => [...window.__wildshard.combat.kills]), quest: await quest(), keys: Object.keys(before.keys).sort() });

  // pause ▸ Settings ▸ SAVES
  await touch('.ws-touch-pause'); await page.locator('.ws-gmenu.show').waitFor(); await sleep(700);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.ws-saves-card')].map((c) => ({ instance: c.getAttribute('data-instance'), text: c.innerText.replace(/\s+/gu, ' ').trim() })));
  log('saves', { cards });
  toJpeg(await page.screenshot(), '1-saves.jpg');
  await page.locator('.ws-saves-card[data-instance="template-solo"] .ws-saves-new').tap();
  await page.locator('.ws-saves-sheet.show').waitFor(); await sleep(500);
  const sheet = await page.evaluate(() => document.querySelector('.ws-saves-panel')?.innerText.replace(/\n+/gu, ' | ') ?? '');
  log('sheet', { sheet });
  toJpeg(await page.screenshot(), '2-sheet.jpg');

  // NEW GAME: the reset applies, the page reloads into the shard
  const nav = page.waitForEvent('framenavigated', { timeout: 30000 });
  await page.locator('.ws-saves-btn.confirm').tap();
  await nav; await boot();
  const after = await docs(), fresh = template(after);
  const replay = await quest();
  log('reloaded', { quest: replay, keys: Object.keys(fresh.keys).sort(), reset: fresh.reset ?? null });
  await touch('.ws-touch-pause'); await page.locator('.ws-gmenu.show').waitFor(); await sleep(700);
  const cardsAfter = await page.evaluate(() => [...document.querySelectorAll('.ws-saves-card')].map((c) => ({ instance: c.getAttribute('data-instance'), text: c.innerText.replace(/\s+/gu, ' ').trim() })));
  log('saves-after', { cards: cardsAfter });
  toJpeg(await page.screenshot(), '3-saves-after.jpg');

  const flags = (doc) => [...new Set([...(doc.keys.flags?.data ?? []), ...(doc.keys['platform.continuation']?.data?.flags ?? [])])].sort();
  result.verdict = {
    questPlayed: flags(before).includes('template.complete') || flags(before).includes('template.blob'),
    playedFlags: flags(before), flagsAfter: flags(fresh),
    questAvailableAgain: !flags(fresh).includes('template.complete') && !flags(fresh).includes('template.hut'),
    packEmpty: Object.keys(fresh.keys.inventory?.data?.counts ?? {}).length === 0 && (fresh.keys.purse?.data ?? 0) === 0,
    profileKept: played.profile === after.profile, profilePresent: played.profile !== undefined,
    featsKept: JSON.stringify(before.keys.progress ?? null) === JSON.stringify(fresh.keys.progress ?? null),
    otherShardKept: played['pine-hollow'] === after['pine-hollow'],
    errors,
  };
  log('verdict', result.verdict);
} finally {
  writeFileSync(join(OUT, 'new-game.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
