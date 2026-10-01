// Controlled live-game before/after reproduction; run through scripts/browser-lane.sh.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { installInit } from '../../../scripts/parity/init.mjs';
import { cachedTree, serve } from '../../../scripts/parity/serve.mjs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [url, captureLabel, captureOutput, requested] = process.argv.slice(2);
mkdirSync(captureOutput, { recursive: true });
const exported = url.startsWith('rev:') ? await cachedTree(resolve('.'), url.slice(4)) : null;
const preview = exported ? await serve(exported.tree, url.slice(4), true) : null;
const origin = preview?.url ?? url;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  for (const scenarioName of requested ? [requested] : ['buffer', 'coyote']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', recordVideo: { dir: captureOutput, size: { width: 390, height: 844 } } });
    await installInit(context, { lane: 'm5', sha: captureLabel, browser: browser.version(), capture: 30, tier: 'phone' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const shard = 'driftwood-isle';
    page.on('pageerror', (error) => console.error(error.message));
    await page.goto(origin + '/?chunk=' + shard + '&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0');
    await page.waitForFunction(() => window.__wildshard && !document.querySelector('.ws-load'));
    await page.evaluate(() => window.__parity.advance(30));
    if (scenarioName === 'roof' || scenarioName === 'dodge') {
      await captureVisible(page, scenarioName, captureLabel, captureOutput, url);
      await context.close();
      continue;
    }
    const result = await page.evaluate(async ({ scenario, label }) => {
      const w = window.__wildshard, p = w.world.player, input = w.world.game.app.input, control = window.__parity;
      const after = typeof p.coyoteMs === 'number';
      if (label === 'before-coyote0') p.coyoteMs = 0;
      const caption = document.createElement('div');
      caption.dataset.wsShell = 'true';
      Object.assign(caption.style, { position: 'fixed', top: '95px', left: '12px', right: '12px', background: '#0d1b26ee', border: '1px solid #8fe3ff', color: '#fff', padding: '14px', font: '13px monospace', zIndex: '1000' });
      document.body.append(caption);
      let jumps = 0, launch = null, beforeRelease = null, crouched = null;
      const previous = p.onJump;
      p.onJump = () => { jumps++; launch = p.velocity.y; previous?.(); };
      const hold = (on) => { if (after) input.setHeld('crouch.hold', on); else if (on) p.keys.add('ControlLeft'); else p.keys.delete('ControlLeft'); };
      const jump = () => { if (after) input.press('jump'); else p.touchJump = true; };
      caption.textContent = label + ' · ' + scenario.toUpperCase() + ' · controlled reproduction';
      await control.advance(15);
      if (scenario === 'buffer') {
        hold(true); await control.advance(3); jump(); await control.advance(2);
        beforeRelease = jumps; crouched = p.crouching; caption.textContent = 'JUMP pressed while crouched. Release after67ms.';
        hold(false); await control.advance(1);
      } else if (scenario === 'coyote') {
        await control.advance(2);
        p.position.y += 5; p.onGround = false; p.velocity.set(0, 0, 0);
        // Controlled floor removal: only ground grace changes; the original airborne jump remains available.
        await control.advance(1); jump(); await control.advance(1);
      }
      const measured = { scenario, label, after, jumps, launch, beforeRelease, crouched, coyoteMs: p.coyoteMs ?? 0, bufferMs: after ? input.buffer.ms : 0 };
      caption.textContent = scenario === 'dodge' ? label + ' · ' + beforeRelease + ' dodges (one starting, one buffered)' : label + ' · ' + jumps + ' jump · launch ' + (launch === null ? 'none' : launch.toFixed(1)) + 'm/s';
      await control.advance(60);
      p.onJump = previous;
      return measured;
    }, { scenario: scenarioName, label: captureLabel });
    await page.screenshot({ path: captureOutput + '/' + scenarioName + '-' + captureLabel + '.jpg', type: 'jpeg', quality: 85 });
    const video = page.video();
    await context.close();
    await video.saveAs(captureOutput + '/' + scenarioName + '-' + captureLabel + '.webm');
    writeFileSync(captureOutput + '/' + scenarioName + '-' + captureLabel + '.json', JSON.stringify(result, null, 2));
    console.log(result);
  }
} finally { await browser.close(); preview?.close(); exported?.cleanup(); }


// Same HEAD runtime and inputs in both takes. Only the reviewed timing parameter changes.
async function captureVisible(page, caseName, takeName, destination, source) {
  const isBefore = takeName.startsWith('before');
  const frames = destination + '/' + caseName + '-' + takeName + '-frames';
  mkdirSync(frames, { recursive: true });
  await page.evaluate(async ({ scenario, before }) => {
    const w = window.__wildshard, p = w.world.player, input = w.world.game.app.input;
    const state = { scenario, before, frame: 0, trace: [], jumps: [], dodges: [], presses: [], edge: null,
      originalJump: p.onJump, originalDodge: p.dodge, originalPreUpdate: p.preUpdate, pending: [], coyoteMs: p.coyoteMs, bufferMs: input.buffer.ms };
    window.__x1Board = state;
    if (scenario === 'roof') p.coyoteMs = before ? 0 : 100;
    else input.buffer.ms = before ? 0 : 120;
    input.setHeld('move.forward', false); input.setHeld('sprint', false);
    await w.pose(scenario === 'roof' ? { x: -.7, z: -218, y: 2, yaw: 2.85, pitch: -.65 }
      : { x: 0, z: -230, y: 2, yaw: Math.PI, pitch: -.32 });
    await window.__parity.advance(30);
    state.start = { ...p.position };
    state.colliderCount = w.world.physics.world.colliders.len();
    if (scenario === 'dodge') p.preUpdate = (dt) => {
      state.originalPreUpdate?.(dt);
      for (const action of state.pending.splice(0)) input.press(action);
    };
    p.onJump = () => { state.jumps.push({ frame: state.frame, ...p.position, launch: p.velocity.y }); state.originalJump?.(); };
    p.dodge = function () { const ok = state.originalDodge.call(this); if (ok) state.dodges.push({ frame: state.frame, ...p.position }); return ok; };
    const caption = document.createElement('div');
    caption.dataset.wsShell = 'true';
    Object.assign(caption.style, { position: 'fixed', top: '165px', left: '12px', right: '12px', background: '#0d1b26ee',
      border: '1px solid #8fe3ff', color: '#fff', padding: '9px', font: '12px monospace', zIndex: '1000' });
    document.body.append(caption); state.caption = caption;
    caption.textContent = (before ? 'BEFORE' : 'AFTER') + (scenario === 'roof' ? ' · coyote ' + p.coyoteMs + 'ms · pier → boat' : ' · dodge buffer ' + input.buffer.ms + 'ms');
  }, { scenario: caseName, before: isBefore });
  for (let frameNo = 0; frameNo < 180; frameNo++) {
    await page.evaluate(async (frame) => {
      const state = window.__x1Board, p = window.__wildshard.world.player,
        input = window.__wildshard.world.game.app.input, control = window.__parity;
      state.frame = frame;
      const press = (action) => { if (state.scenario === 'dodge') state.pending.push(action); else input.press(action); state.presses.push({ frame, action }); };
      if (state.scenario === 'roof') {
        if (frame === 24) { input.setHeld('move.forward', true); input.setHeld('sprint', true); }
        if (frame > 24 && state.edge === null && !p.onGround) state.edge = { frame, ...p.position };
        if (state.edge && frame === state.edge.frame + 1) { press('jump'); state.caption.textContent = 'JUMP · 33ms past the visible pier edge'; }
        if (state.edge && frame === state.edge.frame + 11) { press('jump'); state.caption.textContent = 'Same second JUMP · 333ms after first'; }
        if (state.edge && p.position.x < -4.2) p.yaw = Math.PI;
        if (state.edge && frame > state.edge.frame + 12 && p.onGround && p.position.y > .9) {
          input.setHeld('move.forward', false); input.setHeld('sprint', false);
          state.caption.textContent = 'AFTER · ground grace + air jump · landed aboard'; state.landed = true;
        }
        if (state.edge && frame === state.edge.frame + 57) {
          input.setHeld('move.forward', false); input.setHeld('sprint', false);
          if (!state.landed) state.caption.textContent = 'BEFORE · air jump spent · missed the boat';
        }
      } else {
        if (frame === 24) { input.setHeld('move.forward', true); press('dodge'); }
        if (frame === 25) input.setHeld('move.forward', false);
        if (frame > 24 && !state.queued && p.dodgeCooldown <= .09 && p.dodgeCooldown > 0) {
          input.setHeld('move.forward', true); press('attack'); press('dodge'); state.queued = true; state.queuedFrame = frame;
          state.caption.textContent = 'Second DODGE pressed during the swing / cooldown';
        }
        if (state.queued && frame === state.queuedFrame + 4) input.setHeld('move.forward', false);
        if (frame === 75) { input.setHeld('move.forward', false); state.caption.textContent =
          (state.before ? 'BEFORE' : 'AFTER') + ' · ' + state.dodges.length + ' visible dodges'; }
      }
      await control.advance(1);
      state.trace.push({ frame, ...p.position, grounded: p.onGround, swimming: p.swimming, velocityY: p.velocity.y });
    }, frameNo);
    await page.screenshot({ path: frames + '/' + String(frameNo).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 80 });
    if (frameNo === 100) await page.screenshot({ path: destination + '/' + caseName + '-' + takeName + '.jpg', type: 'jpeg', quality: 85 });
  }
  const observation = await page.evaluate(() => {
    const s = window.__x1Board, p = window.__wildshard.world.player, input = window.__wildshard.world.game.app.input;
    const result = { scenario: s.scenario, before: s.before, start: s.start,
      end: { ...p.position }, coyoteMs: p.coyoteMs, bufferMs: input.buffer.ms, edge: s.edge,
      jumpDelayMs: 1000 / 30, jumps: s.jumps, dodges: s.dodges, presses: s.presses,
      landed: s.landed ?? false, collidersBefore: s.colliderCount, collidersAfter: window.__wildshard.world.physics.world.colliders.len(),
      fixture: 'Initial camera pose only; no collider, jump allowance, velocity or movement tuning changes', trace: s.trace };
    p.onJump = s.originalJump; p.dodge = s.originalDodge; p.preUpdate = s.originalPreUpdate; p.coyoteMs = s.coyoteMs; input.buffer.ms = s.bufferMs;
    input.setHeld('move.forward', false); input.setHeld('sprint', false); s.caption.remove(); delete window.__x1Board;
    return result;
  });
  observation.source = source.startsWith('rev:') ? execFileSync('git', ['rev-parse', source.slice(4)], { encoding: 'utf8' }).trim() : source;
  writeFileSync(destination + '/' + caseName + '-' + takeName + '.json', JSON.stringify(observation, null, 2));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', frames + '/%04d.jpg', '-c:v', 'libx264',
    '-preset', 'fast', '-crf', '33', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', destination + '/' + caseName + '-' + takeName + '.mp4']);
  console.log(JSON.stringify({ scenario: caseName, label: takeName, edge: observation.edge, jumps: observation.jumps, dodges: observation.dodges, start: observation.start, end: observation.end, landed: observation.landed }));
}
