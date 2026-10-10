#!/usr/bin/env node
// SHARD-PLATFORM SF28: shard panels moved onto the platform's declared panels, before / after — Chromium as an iPhone 16
// Pro portrait, muted. Pine Hollow's contract board (closed, open) and Nalati's stealth layer + phone status rows
// (DETECTED, NOTICED, frozen through the shard's debug handle so both builds paint the same state).
//
//   scripts/serve-build.sh --rev <sha> --name sf28-before|after     → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 30 node art/hud/round-25-declared-panels/capture.mjs --url=http://127.0.0.1:<port> --tag=before|after --png=<dir>
//   python3 art/hud/round-25-declared-panels/compare.py <png dir>       → compare.json beside this file
//
// Each shot is a full portrait frame (JPEG, committed) plus, for the pixel proof, a PNG of the whole page with the 3D
// canvas hidden (written to --png=<dir>, never committed): the HUD alone, so the two builds compare pixel for pixel.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const url = arg('url'), tag = arg('tag', 'after'), pngDir = arg('png');
if (url === '' || pngDir === '') { console.error('usage: capture.mjs --url=<build> --tag=before|after --png=<dir>'); process.exit(2); }
mkdirSync(pngDir, { recursive: true });
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, tag, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function open(slug) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?chunk=${slug}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await sleep(5000);
  return { ctx, page, errors };
}
/** a full frame (JPEG) and the HUD alone over a flat page (PNG, canvas hidden, animations settled) */
async function shoot(page, name, parts = {}) {
  toJpeg(await page.screenshot(), `${name}-${tag}.jpg`);
  await page.evaluate(() => { for (const c of document.querySelectorAll('canvas')) c.style.visibility = 'hidden'; });
  await sleep(600);
  writeFileSync(join(pngDir, `${name}-${tag}.png`), await page.screenshot({ animations: 'disabled' }));
  for (const [part, selector] of Object.entries(parts)) {
    const el = await page.$(selector);
    if (el !== null && await el.isVisible()) writeFileSync(join(pngDir, `${name}.${part}-${tag}.png`), await el.screenshot({ animations: 'disabled', timeout: 5000 }));
  }
  await page.evaluate(() => { for (const c of document.querySelectorAll('canvas')) c.style.visibility = ''; });
}

try {
  // ── Pine Hollow: the lodge's contract board ──
  {
    const { ctx, page, errors } = await open('pine-hollow');
    await shoot(page, 'pine-board-closed');
    await page.evaluate(() => { window.__wildshard.shard['pine.quest'].openBoard(); });
    await sleep(1200);
    const read = await page.evaluate(() => ({ board: document.querySelector('.ws-ph-board.show')?.textContent?.slice(0, 400) ?? null }));
    await shoot(page, 'pine-board-open', { frame: '.ws-ph-board.show' });
    out['pine-board'] = { ...read, errors }; console.log('pine', JSON.stringify(read));
    await ctx.close();
  }
  // ── Nalati: the stealth layer, frozen in DETECTED then NOTICED ──
  {
    const { ctx, page, errors } = await open('nalati-grasslands');
    const states = {};
    for (const state of ['detected', 'noticed']) {
      await page.evaluate((s) => {
        const st = window.__wildshard.shard['nalati.stealth'], p = st.player.position;
        st.update = () => { /* frozen for the capture */ };
        st.state = s; st.threat = s === 'detected' ? 1 : 0.5; st.threatX = p.x + 12; st.threatZ = p.z + 4; st.canCrouch = true;
        st.render(0);
      }, state);
      await sleep(900);
      states[state] = await page.evaluate(() => ({ layer: document.querySelector('.ws-stealth')?.outerHTML.length ?? null,
        state: document.querySelector('.ws-stealth')?.getAttribute('data-state') ?? null, label: document.querySelector('.ws-stealth-pip .ws-stealth-label')?.textContent ?? null }));
      await shoot(page, `nalati-stealth-${state}`, { pip: '.ws-stealth-pip', row: '.ws-stealth-row', hint: '.ws-stealth-hint' });
    }
    out['nalati-stealth'] = { states, errors }; console.log('nalati', JSON.stringify(states));
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, `capture-${tag}.json`), `${JSON.stringify(out, null, 2)}\n`);
}
