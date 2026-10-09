// Real page input-phase corroboration. Mount setup uses the declared camp's actual prompt callback;
// keyboard and touch values then enter the normal Player -> Mount -> native motor pipeline.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
const url = process.argv.find(v => v.startsWith('--url='))?.slice(6);
const output = process.argv.find(v => v.startsWith('--output='))?.slice(9);
if (!url || !output) throw new Error('Use --url=<pinned preview> --output=<receipt.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
const errors = [];
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => { window.__wildshardHarness = { seed: 0x4a1a, capture: null }; });
  await page.goto(new URL('/?chunk=nalati-grasslands&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.debug?.snapshot()['nalati.ride'] && !document.querySelector('.ws-load'), null, { timeout: 300000 });
  const boot = await page.evaluate(() => {
    const w = window.__wildshard.requireWorld(), ride = w.game.app.debug.snapshot()['nalati.ride'], m = ride.mount;
    const prompt = m.interactables[0]; if (!prompt) throw new Error('Missing actual camp mount prompt');
    prompt.onInteract(); if (!m.mounted) throw new Error('Camp mount refused');
    const tape = []; window.__mountedSampleTape = tape; window.__mountedSampleStage = 'keyboard';
    window.__mountedSampleStop = w.game.watchFrames(dt => {
      if (tape.length >= 360) return;
      const sample = w.player.sampleCommand(1), consumed = m.sampleCommand();
      tape.push({ dt, stage: window.__mountedSampleStage, sample: JSON.parse(JSON.stringify(sample)), consumed: JSON.parse(JSON.stringify(consumed)),
        feet: [m.feet.x, m.feet.y, m.feet.z], clock: m.clock, mounted: m.mounted });
    });
    return { horse: m.horse.entityId, feet: [m.feet.x, m.feet.y, m.feet.z] };
  });
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  await page.evaluate(() => { const p = window.__wildshard.requireWorld().player; p.touchMove.x = -0.3; p.touchMove.y = 0.65; p.touchJump = true; window.__mountedSampleStage = 'touch'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__mountedSampleStage = 'keyboard-jump'; });
  await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space');
  const tape = await page.evaluate(() => {
    const p = window.__wildshard.requireWorld().player; p.touchMove.x = 0; p.touchMove.y = 0;
    window.__mountedSampleStop(); const rows = window.__mountedSampleTape; delete window.__mountedSampleTape; delete window.__mountedSampleStop; delete window.__mountedSampleStage;
    return rows;
  });
  const keyboard = tape.filter(r => r.sample.steer?.keyY === 1 && r.sample.steer?.keyX === 1 && r.sample.sprint === true);
  const touch = tape.filter(r => r.sample.steer?.stickX === -0.3 && r.sample.steer?.stickY === 0.65);
  const jump = touch.filter(r => r.sample.jump === true), touchJump = jump.filter(r => r.stage === 'touch');
  if (errors.length || keyboard.length < 3 || touch.length < 3 || jump.length < 1 || touchJump.length < 1 || tape.some(r => !r.mounted ||
    JSON.stringify(r.sample.steer) !== JSON.stringify(r.consumed.steer) || r.sample.sprint !== r.consumed.sprint || r.sample.jump !== r.consumed.jump)) {
    throw new Error(`Mounted command mismatch: ${JSON.stringify({ errors, keyboard: keyboard.length, touch: touch.length, jump: jump.length, touchJump: touchJump.length, tape })}`);
  }
  const last = tape.at(-1); if (!last) throw new Error('Missing real movement');
  const distance = Math.hypot(last.feet[0] - boot.feet[0], last.feet[2] - boot.feet[2]);
  if (distance < 0.5) throw new Error(`Mounted native motion absent: ${distance}`);
  writeFileSync(output, JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / muted Chromium',
    setup: 'actual first camp prompt callback; native motor and ordinary input pipeline', boot,
    keyboardFrames: keyboard.length, touchFrames: touch.length, capturedJumpFrames: jump.length, capturedTouchJumpFrames: touchJump.length, observedFrames: tape.length,
    movementMetres: distance, inputFrameSeconds: [...new Set(tape.map(r => r.dt))], errors,
    caveat: 'Proves page consumed-input capture, collected touch/keyboard jump and native movement. Does not establish page/native input cadence or tap-only rhythm-spur equivalence.' }, null, 2) + '\n');
  await context.close();
} finally { await browser.close(); }
