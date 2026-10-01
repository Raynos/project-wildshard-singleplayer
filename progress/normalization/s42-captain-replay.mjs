import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { exportTree, serve } from '../../scripts/parity/serve.mjs';
import { installInit } from '../../scripts/parity/init.mjs';
import { debugSettings } from '../../scripts/debug-settings.mjs';
import { advance } from '../../scripts/parity/frames.mjs';
const root = new URL('../../', import.meta.url).pathname;
const sha = process.argv[2], out = process.argv.slice(3).find((arg) => !arg.startsWith('--')) ?? '/private/tmp/e357-sol-s42';
if (!sha || (process.argv.includes('--clock=fast'))) throw new Error('Provide SHA; this proof uses --clock=raf');
mkdirSync(out, { recursive: true });
const tree = exportTree(root, sha); let server, browser;
const result = { sha, clock: 'raf', seed: 0x2545f491, inputs: [], trace: [] };
try {
  execFileSync('pnpm', ['gen'], { cwd: tree.tree, stdio: 'pipe' });
  server = await serve(tree.tree, sha);
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
  const context = await browser.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 30, accelerated: false });
  await debugSettings(context, { time: 'midday', weather: 'clear' });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  await page.goto(`${server.url}/?chunk=driftwood-isle&tier=phone&skipintro=1&nolock=1&mute=1&sw=0`);
  await page.waitForFunction(() => Boolean(window.__wildshard) && Boolean(window.__adventure) && !document.querySelector('.ws-load') && !document.getElementById('hud')?.classList.contains('intro'));
  await page.evaluate(() => {
    const w = window.__wildshard.world, adv = window.__adventure;
    adv.flags.set('used:altar');
    const captain = adv.finale.captain(); if (!captain) throw new Error('Captain absent after altar');
    for (const a of w.animals.animals) a.harnessHold = a !== captain;
    captain.harnessHold = false;
    const pool = adv.place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
    window.__wildshard.pose({ x: pool.x, y: adv.floorAt(pool.x, pool.z + 2), z: pool.z + 2, yaw: 0, pitch: 0 });
    w.weapons.unlock('sword'); window.__wildshard.combat.equip('sword');
    w.player.carried = true;
    window.__captainTrace = [];
    let frame = 0;
    w.game.onUpdate(() => {
      const a = adv.finale.captain(), round = (v) => Number(v.toFixed(6));
      window.__captainTrace.push({ frame: frame++, hp: a.hp, phase: a.mem.phase ?? 1, st: a.mem.st ?? 0,
        position: a.position.toArray().map(round), rise: round(a.mem.rise ?? 0), attack: round(a.attackPhase), alive: a.alive });
    }, 'proof.captain');
  });
  // Fixed inputs: one primary press every1.5s; two scripted damage contacts guarantee both phase boundaries.
  // Contacts exercise applyDamage (including stagger), not HP assignment. All positions and decisions run live.
  for (let frame = 0; frame < 600; frame += 3) {
    if (frame % 45 === 0) { await page.mouse.move(450, 350); await page.mouse.down(); result.inputs.push({ frame, input: 'primary.down' }); }
    if (frame % 45 === 3) { await page.mouse.up(); result.inputs.push({ frame, input: 'primary.up' }); }
    if (frame === 180 || frame === 360) {
      await page.evaluate(() => { const a = window.__adventure.finale.captain(), p = window.__wildshard.world.player; a.applyDamage(110, a.position.clone(), p.position.clone().sub(a.position).normalize()); });
      result.inputs.push({ frame, input: 'contact', damage: 110 });
    }
    await advance(page, 3);
    if (frame % 90 === 0) console.log('frame', frame);
  }
  result.trace = await page.evaluate(() => window.__captainTrace);
  result.errors = await page.evaluate(() => window.__wildshardHarness.errors);
  result.phases = [...new Set(result.trace.map((row) => row.phase))];
  console.log(JSON.stringify({ sha, frames: result.trace.length, phases: result.phases, errors: result.errors }));
} finally {
  writeFileSync(`${out}/captain-${sha}.json`, JSON.stringify(result, null, 2));
  await browser?.close(); server?.close(); tree.cleanup();
}
