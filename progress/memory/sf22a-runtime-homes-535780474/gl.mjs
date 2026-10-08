#!/usr/bin/env node
// SF22a E435: cold Auto play/Explorer coverage, matching the Simulator 30 s phases.
// Caller holds browser-lane; fresh iPhone 16 Pro contexts, muted Metal, renderer scale 2.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [base, out, shards = 'nine-dragon-stack,far-reach', memorySaver] = process.argv.slice(2);
if (!base || !out) throw new Error('gl.mjs <preview-url> <out> [comma-separated-shards] [on|off]');
const slugs = shards.split(',');
if (slugs.some(slug => !/^_?[a-z0-9-]+$/.test(slug)) || new Set(slugs).size !== slugs.length) throw new Error('Invalid shard list');
if (memorySaver !== undefined && !['on', 'off'].includes(memorySaver)) throw new Error('Invalid Memory saver setting');
const settings = { tex: 'auto', ...(memorySaver === undefined ? {} : { memorySaver }) };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const records = [];
try {
  for (let round = 1; round <= 3; round++) for (const slug of slugs) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    try {
      const version = await (await context.request.get(new URL('version.json', base).href)).json();
      await context.addInitScript(GL_INIT);
      await context.addInitScript([
        saveFixtureCode({ scope: 'global', key: 'settings', data: settings, merge: true }),
        saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
        saveFixtureCode({ scope: 'session', key: 'titleArrival', data: { slug, mode: 'enter', at: Date.now() } }),
        saveFixtureCode({ scope: 'device', key: 'titleArrival.once', data: { slug, mode: 'enter', at: Date.now() } }),
      ].join(';'));
      await context.addInitScript((build) => {
        window.__wildshardHarness = { seed: 1, capture: null, lane: 'sf22a-g187-locations', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
      }, version.build);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => { errors.push(error.stack ?? error.message); });
      // Match the existing GL census transport: do not attempt a registration which
      // Playwright's serviceWorkers:block deliberately answers without a worker.
      await page.goto(`${base}?chunk=${slug}&mute=1&sw=0`);
      await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
      const identity = await page.evaluate(() => ({ build: window.__wildshard.boot.build, shard: window.__wildshard.world.game.level.id,
        settings: JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}').keys?.settings?.data,
        fingerprint: window.__wildshard.fingerprint(), prefetch: window.__ws_prefetch?.state ?? null,
        compressedRequests: performance.getEntriesByType('resource').map((row) => row.name).filter((name) => /\.ktx2(?:\?|$)/.test(name)) }));
      if (identity.build !== version.build || identity.shard !== slug || Object.entries(settings).some(([key, value]) => identity.settings?.[key] !== value)) throw new Error('wrong build/shard/settings');
      if (identity.fingerprint.tier !== 'phone') throw new Error('wrong renderer tier');
      const samples = [];
      const ledgers = {};
      const census = async (phase) => {
        const record = await page.evaluate(() => {
          const contexts = window.__sc_gl().map(({ gl, ...row }) => row);
          return { totalBytes: contexts.reduce((sum, row) => sum + row.totalBytes, 0), reconciled: contexts.every((row) => row.reconciled),
            unlabelled: contexts.reduce((sum, row) => sum + row.unlabelled, 0), contexts };
        });
        const unlabelledBytes = record.contexts.flatMap((row) => row.resources).filter((row) => !row.labelled).reduce((sum, row) => sum + row.bytes, 0);
        if (!record.reconciled || unlabelledBytes !== 0) {
          writeFileSync(join(out, `${slug}-r${round}-census-refusal.json`), JSON.stringify(record, null, 2));
          throw new Error(`incomplete labelled GL census: ${unlabelledBytes} unlabelled bytes`);
        }
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
      const poses = []; // This receipt matches the 30 s play / Explorer Simulator phases.
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
      const record = { slug, round, version, identity, poses, errors, samples, ledgers };
      writeFileSync(join(out, `${slug}-r${round}.json`), `${JSON.stringify(record, null, 2)}\n`);
      records.push(record);
      console.log(`GL ${slug} round ${round}: ${Math.max(...samples.flatMap((sample) => sample.totalBytes === undefined ? sample.frameSamples.map((row) => row.bytes) : [sample.totalBytes])) / 1e6} MB, errors ${errors.length}`);
      if (errors.length > 0) throw new Error(JSON.stringify(errors));
    } finally { await context.close(); }
  }
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify(records.map(({ slug, round, version, poses, errors, samples }) => ({ slug, round, version, poses, errors,
    phases: [...new Set(samples.map((sample) => sample.phase))].map((phase) => {
      const bytes = samples.filter((sample) => sample.phase === phase).flatMap((sample) => sample.totalBytes === undefined ? sample.frameSamples.map((row) => row.bytes) : [sample.totalBytes]);
      return { phase, minBytes: Math.min(...bytes), maxBytes: Math.max(...bytes), samples: bytes.length };
    }) })), null, 2)}\n`);
} finally { await browser.close(); }
