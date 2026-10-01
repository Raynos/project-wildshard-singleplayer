import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { exportTree, serve } from '../../scripts/parity/serve.mjs';
import { installInit } from '../../scripts/parity/init.mjs';
import { debugSettings } from '../../scripts/debug-settings.mjs';
import { advance } from '../../scripts/parity/frames.mjs';
import { combat, STEPS } from '../../scripts/parity/combat.mjs';
const root = new URL('../../', import.meta.url).pathname;
const sha = process.argv[2] ?? '89001f56';
const combatOnly = process.argv.includes('--combat-only');
mkdirSync('/private/tmp/e357-s22b', { recursive: true });
const tree = exportTree(root, sha); let server, browser;
const result = { sha };
try {
  execFileSync('pnpm', ['gen'], { cwd: tree.tree, stdio: 'pipe' });
  server = await serve(tree.tree, sha);
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 30 });
  await debugSettings(context, { time: 'midday', weather: 'clear' });
  const page = await context.newPage(); page.setDefaultTimeout(180000);
  await page.goto(`${server.url}/?chunk=pine-hollow&tier=phone&skipintro=1&nolock=1&mute=1&weather=clear&touch=1&sw=0`);
  await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load') && !document.getElementById('hud')?.classList.contains('intro'));
  await advance(page, 2);
  if (!combatOnly) {
  result.pickup = await page.evaluate(() => {
    const w = window.__wildshard.world, app = w.game.app, loadout = app.debug.snapshot().loadout;
    const before = { rifle: w.weapons.has('rifle'), bow: w.weapons.has('bow') };
    const pickup = w.interactables.find((i) => i.label === 'Take the lever-action');
    if (!pickup) throw new Error('Cabin lever pickup missing');
    pickup.onInteract();
    return { before, rifle: { unlocked: w.weapons.has('rifle') } };
  });
  await advance(page, 30);
  result.pickup.rifle.selected = await page.evaluate(() => window.__wildshard.world.weapons.current.id);
  await page.evaluate(() => window.__wildshard.world.game.app.debug.snapshot().loadout.grantLongbow());
  await advance(page, 30);
  result.pickup.bow = await page.evaluate(() => {
    const w = window.__wildshard.world;
    return { unlocked: w.weapons.has('bow'), selected: w.weapons.current.id, row: w.weapons.current.row.id };
  });
  assert.deepEqual(result.pickup.before, { rifle: false, bow: false });
  assert.deepEqual(result.pickup.rifle, { unlocked: true, selected: 'rifle' });
  assert.deepEqual(result.pickup.bow, { unlocked: true, selected: 'bow', row: 'weapon.longbow' });
  console.log('pickup and grant pass');
  }
  STEPS['pine-hollow'].push({ step: 'shot3', weapon: 'rifle', target: 'boar', near: { x: 0, z: -200 }, distance: 12, hit: 20, kill: 20 });
  result.combat = await combat(page, { shard: 'pine-hollow', tier: 'phone', lane: 'm5' });
  for (const key of ['shot', 'shot2', 'shot3']) assert.equal(result.combat[key].killed, true, key);
  console.log('all three shot-to-kill pass', JSON.stringify(result.combat.hitsToKill));
  if (!combatOnly) {
  result.drop = await page.evaluate(() => {
    const w = window.__wildshard.world, p = w.player.position;
    const a = w.animals.spawn('deer', p.x + 4, p.z, 0, 'ghost');
    const killed = a.applyDamage(100000, a.position.clone(), p.clone().sub(a.position).normalize());
    return { killed, before: w.interactables.filter((i) => i.label === 'Take the Ghost Stag crossbow').length };
  });
  await advance(page, 2);
  result.drop.after = await page.evaluate(() => {
    const w = window.__wildshard.world, rows = w.interactables.filter((i) => i.label === 'Take the Ghost Stag crossbow');
    if (rows.length !== 1) throw new Error(`Expected Ghost Stag finish drop, got ${rows.length}`);
    rows[0].onInteract();
    return { count: rows.length, skin: Object.fromEntries(Object.keys(localStorage).filter((key) => key.includes('pine-hollow')).map((key) => [key, JSON.parse(localStorage.getItem(key))])) };
  });
  console.log('scoped legendary drop pass', JSON.stringify(result.drop));
  const saved = result.drop.after.skin['wildshard.save.v2.pine-hollow'].keys.skins.data;
  assert.deepEqual(saved, { owned: ['ghost-stag'], worn: { crossbow: 'ghost-stag' } });
  result.death = await page.evaluate(() => {
    const w = window.__wildshard.world, app = w.game.app, loadout = app.debug.snapshot().loadout;
    loadout.addAmmo('pitch', 6); loadout.selectBolt('pitch');
    w.weapons.get('crossbow').state.bolts = 4;
    const before = { bolt: loadout.bolt, pitch: loadout.count('pitch'), broadhead: loadout.count('broadhead') };
    app.player.attributes.health = 0; app.player.lastHurt = performance.now();
    return { before };
  });
  await advance(page, 3);
  result.death.after = await page.evaluate(() => {
    const w = window.__wildshard.world, loadout = w.game.app.debug.snapshot().loadout;
    return { bolt: loadout.bolt, iron: loadout.count('iron'), pitch: loadout.count('pitch'), broadhead: loadout.count('broadhead') };
  });
  assert.deepEqual(result.death.after, { bolt: 'iron', iron: 30, pitch: 4, broadhead: result.death.before.broadhead });
  console.log('player death reset and refill pass');
  }
  result.errors = await page.evaluate(() => window.__wildshardHarness.errors);
  assert.deepEqual(result.errors, []);
  result.pass = true;
} finally {
  writeFileSync(`/private/tmp/e357-s22b/loadout-smoke-${sha}.json`, JSON.stringify(result, null, 2));
  await browser?.close(); server?.close(); tree.cleanup();
}
