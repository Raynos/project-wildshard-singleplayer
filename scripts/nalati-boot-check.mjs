#!/usr/bin/env node
// nalati-boot-check.mjs — boot each shard headless (muted), wait for the world, report page errors + a screenshot each.
// For the Nalati ⇄ main merges (project/archive/2026-09-24-nalati-merge.md): every shard must still boot clean after a merge.
//
//   node scripts/nalati-boot-check.mjs [--url=http://127.0.0.1:5188] [--out=<dir>] [--shards=nalati-grasslands,driftwood-isle,pine-hollow] [--touch]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const OUT = resolvePath(flag('out', 'progress/nalati-merge'));
const SHARDS = flag('shards', 'nalati-grasslands,driftwood-isle,pine-hollow').split(',');
const TOUCH = argv.includes('--touch');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let failed = 0;
try {
  for (const shard of SHARDS) {
    const ctx = await browser.newContext(TOUCH ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?chunk=${shard}&mute=1&nolock=1&skipintro=1${TOUCH ? '&touch=1&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
    let ok = true;
    try {
      await page.waitForFunction(() => Boolean(window.__world), undefined, { timeout: 240000, polling: 1000 });
    } catch { ok = false; }
    await new Promise((resolve) => { setTimeout(resolve, 8000); });
    writeFileSync(resolvePath(OUT, `boot-${shard}${TOUCH ? '-touch' : ''}.jpg`), await page.screenshot({ type: 'jpeg', quality: 80 }));
    const real = errors.filter((e) => !/favicon|net::ERR_ABORTED/.test(e));
    if (!ok || real.length > 0) failed++;
    console.log(`${shard.padEnd(20)} ${ok ? 'booted' : 'NO WORLD'} in ${((Date.now() - t0) / 1000).toFixed(0)} s · ${real.length} error(s)${real.length > 0 ? `\n  ${real.slice(0, 5).join('\n  ')}` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exit(failed > 0 ? 1 : 0);
