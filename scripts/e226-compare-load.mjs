#!/usr/bin/env node
// E226: matched cold phone loads across Chromium and WebKit. Each run owns a new browser context and
// blocks the service worker so network size means transferred response bytes, not a previous cache.
import { chromium, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4176';
const out = process.argv[3] ?? '/tmp/e226-compare-load.json';
const onlyEngine = process.argv[4];
const onlyShard = process.argv[5];
const textureMode = process.argv[6];
const results = [];
for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  if (onlyEngine !== undefined && engine !== onlyEngine) continue;
  const browser = await browserType.launch(engine === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] } : {});
  try {
    for (const shard of ['driftwood-isle', 'nine-dragon-stack']) {
      if (onlyShard !== undefined && shard !== onlyShard) continue;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
      if (textureMode === 'ktx2' || textureMode === 'img') await context.addInitScript((tex) => { localStorage.setItem('ws.settings.v1', JSON.stringify({ tex })); }, textureMode);
      await context.addInitScript(() => {
        window.__e226 = { gaps: [], heaps: [] };
        let last = performance.now();
        let lastStage = 'document';
        const tick = () => {
          const now = performance.now();
          if (now - last > 100) window.__e226.gaps.push({ at: Math.round(now), ms: Math.round(now - last), stage: lastStage });
          last = now;
          const loader = document.querySelector('.ws-load');
          if (loader) lastStage = `${loader.dataset.step ?? ''} ${loader.querySelector('[data-el="suFact"]')?.textContent ?? ''}`.trim();
          else lastStage = 'play';
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setInterval(() => {
          const mem = performance.memory;
          if (mem?.usedJSHeapSize) window.__e226.heaps.push({ at: Math.round(performance.now()), mb: Math.round(mem.usedJSHeapSize / 1048576), stage: lastStage });
        }, 250);
      });
      const page = await context.newPage();
      let transferred = 0, requests = 0, crash = false;
      const urlCounts = new Map();
      const errors = [];
      page.on('crash', () => { crash = true; });
      page.on('pageerror', (error) => { errors.push(error.message.slice(0, 300)); });
      page.on('requestfinished', async (request) => {
        try {
          const sizes = await request.sizes();
          transferred += sizes.responseBodySize + sizes.responseHeadersSize;
          requests++;
          const path = new URL(request.url()).pathname;
          urlCounts.set(path, (urlCounts.get(path) ?? 0) + 1);
        } catch { /* navigation ended first */ }
      });
      const start = Date.now();
      let failure = '';
      try {
        await page.goto(`${base}/?chunk=${shard}&skipintro=1&nolock=1&mute=1&touch=1&tier=phone&sw=0`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => Boolean(window.__world?.game) && document.querySelector('.ws-load') === null, undefined, { timeout: 120000, polling: 250 });
        await page.waitForTimeout(3000);
      } catch (error) { failure = String(error).slice(0, 500); }
      let metrics = {};
      if (!crash) try {
        metrics = await page.evaluate(() => {
          const w = window.__world, g = w?.game, m = window.__e226;
          const info = g?.renderer.info;
          const gaps = m.gaps.sort((a, b) => b.ms - a.ms);
          return {
            steps: window.__shardHost?.timings?.[0]?.steps ?? null,
            sceneTextureMB: window.__shardHost?.memory(0).shards[0]?.textureMB ?? null,
            jsHeapMB: performance.memory?.usedJSHeapSize ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
            peakSampledJsHeapMB: m.heaps.length ? Math.max(...m.heaps.map((h) => h.mb)) : null,
            peakHeapSample: m.heaps.slice().sort((a, b) => b.mb - a.mb)[0] ?? null,
            renderer: info ? { textures: info.memory.textures, geometries: info.memory.geometries, programs: info.programs?.length ?? 0 } : null,
            frame: g?.lastFrame ?? null,
            largestRafGaps: gaps.slice(0, 8),
            slowKits: (window.__ndKitProfile ?? []).slice().sort((a, b) => b.ms - a.ms).slice(0, 10),
            phases: window.__ndPhaseProfile ?? null,
            loader: document.querySelector('.ws-load')?.dataset.step ?? null,
          };
        });
      } catch (error) { failure ||= String(error).slice(0, 500); }
      const duplicates = [...urlCounts].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
      const row = { engine, shard, seconds: Math.round((Date.now() - start) / 100) / 10, transferredMB: Math.round(transferred / 104857.6) / 10, requests, uniqueUrls: urlCounts.size, duplicateUrls: duplicates.length, topDuplicates: duplicates.slice(0, 8), crash, failure, errors, ...metrics };
      results.push(row);
      console.log(JSON.stringify(row));
      await context.close();
    }
  } finally { await browser.close(); }
}
writeFileSync(out, JSON.stringify(results, null, 2));
console.error(`saved ${out}`);
