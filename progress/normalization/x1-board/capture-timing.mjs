// Controlled live-game before/after reproduction; run through scripts/browser-lane.sh.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { installInit } from '../../../scripts/parity/init.mjs';
import { cachedTree, serve } from '../../../scripts/parity/serve.mjs';
import { resolve } from 'node:path';

const [url, label, output, requested] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const exported = url.startsWith('rev:') ? await cachedTree(resolve('.'), url.slice(4)) : null;
const preview = exported ? await serve(exported.tree, url.slice(4), true) : null;
const origin = preview?.url ?? url;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  for (const scenario of requested ? [requested] : ['buffer', 'coyote']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', recordVideo: { dir: output, size: { width: 390, height: 844 } } });
    await installInit(context, { lane: 'm5', sha: label, browser: browser.version(), capture: 30, tier: 'phone' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const shard = requested === 'roof' ? 'nine-dragon-stack' : 'driftwood-isle';
    page.on('pageerror', (error) => console.error(error.message));
    await page.goto(origin + '/?chunk=' + shard + '&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0');
    await page.waitForFunction(() => window.__wildshard && !document.querySelector('.ws-load'));
    await page.evaluate(() => window.__parity.advance(30));
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
      } else if (scenario === 'roof') {
        await w.pose({ x: 24, z: -10, y: 165, yaw: -Math.PI / 2 });
        await control.advance(20);
        const forward = (on) => { if (after) input.setHeld('move.forward', on); else if (on) p.keys.add('KeyW'); else p.keys.delete('KeyW'); };
        forward(true);
        let steps = 0;
        while (p.onGround && steps++ < 140) await control.advance(1);
        if (p.onGround) throw new Error('Roof edge reproduction never left the collider');
        caption.textContent = 'JUMP33ms after leaving the Nine Dragon roof edge';
        await control.advance(1); jump(); await control.advance(1); forward(false);
      } else if (scenario === 'dodge') {
        let dodges = 0;
        const originalDodge = p.dodge.bind(p);
        p.dodge = () => { const ok = originalDodge(); if (ok) dodges++; return ok; };
        const dodge = () => { if (after) input.press('dodge'); else p.touchDodge = true; };
        dodge(); await control.advance(1);
        while (p.dodgeCooldown > 0.09) await control.advance(1);
        const canvas = w.world.game.canvas;
        canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
        await control.advance(1);
        canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
        caption.textContent = 'DODGE mid-swing · pressed within72ms of cooldown end';
        dodge(); await control.advance(8);
        beforeRelease = dodges;
        p.dodge = originalDodge;
      }
      const result = { scenario, label, after, jumps, launch, beforeRelease, crouched, coyoteMs: p.coyoteMs ?? 0, bufferMs: after ? input.buffer.ms : 0 };
      caption.textContent = scenario === 'dodge' ? label + ' · ' + beforeRelease + ' dodges (one starting, one buffered)' : label + ' · ' + jumps + ' jump · launch ' + (launch === null ? 'none' : launch.toFixed(1)) + 'm/s';
      await control.advance(60);
      p.onJump = previous;
      return result;
    }, { scenario, label });
    await page.screenshot({ path: output + '/' + scenario + '-' + label + '.jpg', type: 'jpeg', quality: 85 });
    const video = page.video();
    await context.close();
    await video.saveAs(output + '/' + scenario + '-' + label + '.webm');
    writeFileSync(output + '/' + scenario + '-' + label + '.json', JSON.stringify(result, null, 2));
    console.log(result);
  }
} finally { await browser.close(); preview?.close(); exported?.cleanup(); }
