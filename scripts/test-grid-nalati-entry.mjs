#!/usr/bin/env node
// Run through browser-lane.sh against a complete served build. One page must
// enter Nalati after Driftwood; a standalone Nalati boot misses this ordering.
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';

const base = process.argv[2];
assert.ok(base, 'Pass a served build URL');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage();
  await page.goto(`${base}/?tier=phone&touch=1&mute=1&nolock=1&sw=0`);
  await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')?.getClientRects().length), null, { timeout: 240000 });
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 240000 });
  assert.equal(await page.evaluate(() => window.__wildshard.shard.grid.state().home), 'driftwood-isle');
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.mouse.click(195, 420);
  await page.waitForFunction(() => window.__wsReveal === undefined || window.__wsReveal.endedMs !== null, null, { timeout: 60000 });
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  const result = await page.evaluate(() => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    player.spawn(235, 0, -Math.PI / 2); player.setHover(true);
    return new Promise((resolve, reject) => {
      let stop = () => { /* The frame subscription installs below. */ };
      const timer = setTimeout(() => finish(new Error(`Nalati admission timed out: ${JSON.stringify(api.shard.grid.state().live)}`)), 120000);
      function finish(error) {
        input.clear(); stop(); clearTimeout(timer);
        if (error instanceof Error) reject(error); else resolve(api.shard.grid.state().live.live);
      }
      stop = world.game.watchFrames(() => {
        try {
          const state = api.shard.grid.state().live.live;
          if (Object.keys(state.issues).length > 0) throw new Error(JSON.stringify(state.issues));
          if (state.worldFeet.y < -0.25) throw new Error('Traveller fell through the entry');
          if (state.current === 'nalati-grasslands' && state.worldFeet.x >= 320) { finish(); return; }
          player.yaw = -Math.PI / 2; input.setHeld('move.forward', true);
        } catch (error) { finish(error); }
      });
    });
  });
  assert.equal(navigations, 0, 'Admission reloaded the page');
  assert.equal(result.current, 'nalati-grasslands');
  console.log(JSON.stringify({ pass: true, from: 'driftwood-isle', to: result.current, navigations,
    build: await (await page.request.get(`${base}/version.json`)).json() }));
} finally { await browser.close(); }
