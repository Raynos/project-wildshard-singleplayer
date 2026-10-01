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
const result = { sha, clock: 'raf', seed: 4242, capture: 60, swingAfter: 6, swingEvery: 54, dodgeAfter: 6, inputs: [], trace: [] };
try {
  execFileSync('pnpm', ['gen'], { cwd: tree.tree, stdio: 'pipe' });
  server = await serve(tree.tree, sha);
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
  const context = await browser.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 60, accelerated: false });
  await debugSettings(context, { time: 'midday', weather: 'clear' });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  await page.goto(`${server.url}/?chunk=driftwood-isle&tier=phone&skipintro=1&nolock=1&mute=1&sw=0`);
  await page.waitForFunction(() => Boolean(window.__wildshard) && Boolean(window.__adventure) && !document.querySelector('.ws-load') && !document.getElementById('hud')?.classList.contains('intro'));
  await page.evaluate(() => {
    const w = window.__wildshard.world, adv = window.__adventure, app = w.game.app;
    app.rng.seed(4242); app.clock.setCapture(60);
    adv.flags.set('used:altar');
    const captain = adv.finale.captain(); if (!captain) throw new Error('Captain absent after altar');
    for (const a of w.animals.animals) a.harnessHold = a !== captain;
    captain.harnessHold = false;
    const pool = adv.place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
    window.__wildshard.pose({ x: pool.x, y: adv.floorAt(pool.x, pool.z + 3), z: pool.z + 3, yaw: 0, pitch: 0 });
    w.weapons.unlock('sword'); window.__wildshard.combat.equip('sword');
    window.__captainTrace = []; window.__captainInputs = []; window.__captainEvents = [];
    const scope = app.levelScope;
    if (scope) {
      app.events.on('boss.attempt', (event) => window.__captainEvents.push({ frame, ...event }), scope);
      app.events.on('damage.dealt', ({ req, dealt }) => {
        if (req.target === app.player || req.target.id === captain.combatActor().id)
          window.__captainEvents.push({ frame, damage: dealt, target: req.target.id, move: req.moveId ?? null });
      }, scope);
    }
    let frame = 0, opening = -1, lastPhase = 1, previousState = '', telegraph = -1;
    const moves = w.weapons.current.profile.moves?.combo ?? w.weapons.current.mv.combo;
    const swingHitS = Math.max(...moves.map((move) => move.windup)) * w.weapons.current.swingScale;
    w.game.onUpdate(() => {
      const a = adv.finale.captain(), round = (v) => Number(v.toFixed(6)), phase = a.mem.phase ?? 1;
      const state = a.state, surfaced = (a.mem.rise ?? 0) >= 1, hittable = surfaced && (state === 'stalk' || state === 'attack');
      if (!hittable || (lastPhase === 1 && phase !== 1)) opening = -1;
      if (opening < 0 && surfaced && state === 'stalk') opening = frame;
      if (state === 'attack' && previousState !== state || a.mem.st === 5 && previousState !== 'under') telegraph = frame;
      const input = (name) => window.__captainInputs.push({ frame, input: name });
      if (telegraph >= 0 && frame - telegraph === 6) { w.player.dodge(); input('dodge'); }
      const sinkEvery = phase === 1 ? 0 : phase === 2 ? 7 : 5;
      const safe = sinkEvery === 0 || (a.mem.subT ?? 0) + swingHitS <= sinkEvery - 0.12;
      if (opening >= 0 && frame - opening >= 6 && (frame - opening - 6) % 54 === 0 && safe) {
        const dx = w.player.position.x - a.position.x, dz = w.player.position.z - a.position.z;
        w.player.yaw = Math.atan2(dx, dz);
        const bodyY = a.position.y + a.dims.bodyY * a.scale;
        w.player.pitch = Math.atan2(bodyY - w.player.position.y - 1.68, Math.hypot(dx, dz));
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', bubbles: true }));
        input('primary');
      }
      window.__captainTrace.push({ frame: frame++, hp: a.hp, phase, st: a.mem.st ?? 0,
        position: a.position.toArray().map(round), rise: round(a.mem.rise ?? 0), attack: round(a.attackPhase), alive: a.alive,
        player: w.player.position.toArray().map(round), playerHp: app.player.attributes.health });
      lastPhase = phase; previousState = a.mem.st === 5 ? 'under' : state;
    }, 'proof.captain');
  });
  // Fixed state-keyed inputs run on the same 60Hz capture steps in both exports.
  for (let batch = 0; batch < 40; batch++) {
    await advance(page, 180);
    const state = await page.evaluate(() => ({ alive: window.__adventure.finale.captain().alive,
      trace: window.__captainTrace, inputs: window.__captainInputs, events: window.__captainEvents }));
    result.trace = state.trace; result.inputs = state.inputs; result.events = state.events;
    writeFileSync(`${out}/captain-${sha}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ sha, frames: result.trace.length, hp: result.trace.at(-1)?.hp, alive: state.alive }));
    if (!state.alive) break;
  }
  result.errors = await page.evaluate(() => window.__wildshardHarness.errors);
  result.phases = [...new Set(result.trace.map((row) => row.phase))];
  result.killed = result.trace.at(-1)?.alive === false;
  console.log(JSON.stringify({ sha, frames: result.trace.length, phases: result.phases, killed: result.killed, errors: result.errors }));
  if (!result.killed || result.phases.length !== 3 || result.errors.length !== 0) throw new Error('Captain replay incomplete; inspect raw trace');
} finally {
  writeFileSync(`${out}/captain-${sha}.json`, JSON.stringify(result, null, 2));
  await browser?.close(); server?.close(); tree.cleanup();
}
