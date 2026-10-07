#!/usr/bin/env node
// SF22a E435: cold Auto, real play/capture/Explorer coverage, matching sim-memory --locations=on.
// Caller holds browser-lane; fresh iPhone 16 Pro contexts, muted Metal, renderer scale 2.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('location-gl.mjs <preview-url> <out>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const records = [];
try {
  for (let round = 1; round <= 3; round++) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    try {
      const version = await (await context.request.get(new URL('version.json', base).href)).json();
      await context.addInitScript(GL_INIT);
      await context.addInitScript([
        saveFixtureCode({ scope: 'global', key: 'settings', data: { tex: 'auto' }, merge: true }),
        saveFixtureCode({ scope: 'device', key: 'debug.plugin.pine-hollow.pineMemoryTrim', data: 'on' }),
        saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
        saveFixtureCode({ scope: 'session', key: 'titleArrival', data: { slug: 'pine-hollow', mode: 'enter', at: Date.now() } }),
        saveFixtureCode({ scope: 'device', key: 'titleArrival.once', data: { slug: 'pine-hollow', mode: 'enter', at: Date.now() } }),
      ].join(';'));
      await context.addInitScript((build) => {
        window.__wildshardHarness = { seed: 1, capture: null, lane: 'sf22a-g187-locations', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
      }, version.build);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => { errors.push(error.stack ?? error.message); });
      // Match the existing GL census transport: do not attempt a registration which
      // Playwright's serviceWorkers:block deliberately answers without a worker.
      await page.goto(`${base}?chunk=pine-hollow&mute=1&sw=0`);
      await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
      const identity = await page.evaluate(() => ({ build: window.__wildshard.boot.build, shard: window.__wildshard.world.game.level.id,
        settings: JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}').keys?.settings?.data,
        trim: JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.['debug.plugin.pine-hollow.pineMemoryTrim']?.data,
        fingerprint: window.__wildshard.fingerprint(), prefetch: window.__ws_prefetch?.state ?? null,
        compressedRequests: performance.getEntriesByType('resource').map((row) => row.name).filter((name) => /\.ktx2(?:\?|$)/.test(name)) }));
      if (identity.build !== version.build || identity.shard !== 'pine-hollow' || identity.settings?.tex !== 'auto' || identity.trim !== 'on') throw new Error('wrong build/shard/settings');
      if (identity.fingerprint.tier !== 'phone' || identity.compressedRequests.length < 3) throw new Error('cold Auto did not load the phone KTX2 policy');
      const samples = [];
      const ledgers = {};
      const census = async (phase) => {
        const record = await page.evaluate(() => {
          const contexts = window.__sc_gl().map(({ gl, ...row }) => row);
          return { totalBytes: contexts.reduce((sum, row) => sum + row.totalBytes, 0), reconciled: contexts.every((row) => row.reconciled),
            unlabelled: contexts.reduce((sum, row) => sum + row.unlabelled, 0), contexts };
        });
        if (!record.reconciled) throw new Error('unreconciled GL census');
        ledgers[phase] = record.contexts;
        samples.push({ phase, totalBytes: record.totalBytes, reconciled: record.reconciled, unlabelled: record.unlabelled });
        return record;
      };
      const work = async (phase, seconds, each) => {
        const totals = [];
        for (let i = 0; i < seconds; i++) {
          await each(i);
          await page.waitForTimeout(1000);
          const record = await census(phase);
          totals.push(record.totalBytes);
        }
        return totals;
      };
      if (await page.evaluate(() => document.querySelector('#hud')?.classList.contains('intro') === true)) await page.evaluate(() => { document.querySelector('.ws-menu-play')?.click(); });
      await work('play', 30, () => page.evaluate(() => { window.__wildshard.world.player.yaw += 2 * Math.PI / 30; }));
      const original = await page.evaluate(() => { const p = window.__wildshard.world.player; return { ...p.position, yaw: p.yaw, pitch: p.pitch }; });
      const poses = await page.evaluate(async () => Object.entries(await window.__wildshard.world.game.level.capturePoses?.() ?? {}).flatMap(([name, camera]) => camera.probe ? [{ ...camera.probe, name }] : camera.feet ? [{ name, x: camera.feet[0], y: camera.feet[1], z: camera.feet[2], yaw: -camera.yaw * Math.PI / 180, pitch: camera.pitch * Math.PI / 180 }] : []));
      if (poses.length === 0) throw new Error('no capture locations');
      for (const pose of [...poses, { ...original, name: 'return' }]) {
        await page.evaluate((p) => window.__wildshard.pose(p), pose);
        await page.evaluate(async () => {
          window.__wsLocationGL = [];
          const end = window.__wildshard.world.game.frameCount + 120;
          await new Promise((resolve) => {
            const tick = () => {
              const frame = window.__wildshard.world.game.frameCount;
              if (frame % 10 === 0) window.__wsLocationGL.push({ frame, bytes: window.__sc_gl().reduce((sum, row) => sum + row.totalBytes, 0) });
              if (frame >= end) resolve(undefined); else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        });
        const transient = await page.evaluate(() => window.__wsLocationGL);
        samples.push({ phase: `location:${pose.name}`, frameSamples: transient });
        await work(`location:${pose.name}`, 3, async () => {});
        if (round === 1 && pose.name !== 'return') await page.screenshot({ path: join(out, `${pose.name}.jpg`), type: 'jpeg', quality: 65 });
      }
      await page.evaluate(() => { document.dispatchEvent(new Event('ws:pause')); document.querySelector('.ws-gmenu-exit')?.click(); });
      await page.waitForTimeout(3000);
      await page.evaluate(() => { document.querySelector('.ws-menu-explore')?.click(); });
      await page.waitForSelector('.ws-x-card[data-m="world"]', { timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.locator('.ws-x-card[data-m="world"]').click();
      await page.waitForTimeout(2000);
      const legs = [['KeyW'], ['KeyD'], ['KeyS']];
      let held = [];
      await work('explorer', 30, async (i) => {
        if (i % 10 === 0) {
          const next = legs[i / 10];
          await page.evaluate(({ prior, next }) => {
            for (const code of prior) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
            for (const code of next) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
          }, { prior: held, next });
          held = next;
        }
        await page.evaluate(() => {
          const c = window.__wildshard.world.game.canvas, y = innerHeight * 0.4, x = innerWidth * 0.5;
          const ev = (type, clientX, target) => target.dispatchEvent(new PointerEvent(type, { pointerId: 71, pointerType: 'touch', isPrimary: true, clientX, clientY: y, bubbles: true, cancelable: true }));
          ev('pointerdown', x, c); for (let k = 1; k <= 6; k++) ev('pointermove', x + k * 10, window); ev('pointerup', x + 60, window);
        });
      });
      await page.evaluate((keys) => { for (const code of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); }, held);
      await work('explorer', 3, async () => {});
      const record = { round, version, identity, poses, errors, samples, ledgers };
      writeFileSync(join(out, `r${round}.json`), `${JSON.stringify(record, null, 2)}\n`);
      records.push(record);
      console.log(`GL round ${round}: ${Math.max(...samples.flatMap((sample) => sample.totalBytes === undefined ? sample.frameSamples.map((row) => row.bytes) : [sample.totalBytes])) / 1e6} MB, errors ${errors.length}`);
      if (errors.length > 0) throw new Error(JSON.stringify(errors));
    } finally { await context.close(); }
  }
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify(records.map(({ round, version, poses, errors, samples }) => ({ round, version, poses, errors,
    phases: [...new Set(samples.map((sample) => sample.phase))].map((phase) => {
      const bytes = samples.filter((sample) => sample.phase === phase).flatMap((sample) => sample.totalBytes === undefined ? sample.frameSamples.map((row) => row.bytes) : [sample.totalBytes]);
      return { phase, minBytes: Math.min(...bytes), maxBytes: Math.max(...bytes), samples: bytes.length };
    }) })), null, 2)}\n`);
} finally { await browser.close(); }
