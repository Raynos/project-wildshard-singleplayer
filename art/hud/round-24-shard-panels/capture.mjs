#!/usr/bin/env node
// SHARD-PLATFORM SF28 part 2: Pine Hollow's trader and a Nalati camp on the platform panels, before / after, Classic and
// Big cards — Chromium as an iPhone 16 Pro portrait, muted, pause ▸ Settings ▸ Debug ▸ Look ▸ Item cards saved before load.
//
//   scripts/serve-build.sh --rev <sha> --name sf28-panels       → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 30 node art/hud/round-24-shard-panels/capture.mjs --url=http://127.0.0.1:<port> --tag=before|after
//
// Pine: stands at Mott's hatch with a few hides and resin in the pack and opens his swaps (the quest's debug handle). Nalati:
// stands at Baqyt Ata and talks to him (the camp's dialogue). Each shot is a full portrait frame (JPEG) plus, for the
// pixel proof, a PNG of the panel alone with the 3D canvas hidden (written to --png=<dir>, never committed).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { debugSettings } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const url = arg('url'), tag = arg('tag', 'after'), pngDir = arg('png');
if (url === '') { console.error('usage: capture.mjs --url=<build> --tag=before|after [--png=<dir>]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, tag, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function open(slug, cards) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await debugSettings(ctx, { itemCards: cards });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?chunk=${slug}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await sleep(5000);
  return { ctx, page, errors };
}

/** the panel alone over a flat page (canvas hidden): a deterministic PNG for the Classic before / after pixel diff */
async function panelPng(page, selector, name) {
  if (pngDir === '') return;
  mkdirSync(pngDir, { recursive: true });
  await page.evaluate(() => { for (const c of document.querySelectorAll('canvas')) c.style.visibility = 'hidden'; });
  await sleep(400);
  const el = await page.$(selector);
  if (el) writeFileSync(join(pngDir, name), await el.screenshot({ animations: 'disabled' }));
  await page.evaluate(() => { for (const c of document.querySelectorAll('canvas')) c.style.visibility = ''; });
}

try {
  for (const cards of ['classic', 'big']) {
    // ── Pine Hollow: Mott's swaps ──
    {
      const { ctx, page, errors } = await open('pine-hollow', cards);
      const stand = await page.evaluate(() => {
        const q = window.__wildshard.shard['pine.quest'], mott = q.people.find((p) => p.kind === 'trader');
        q.give('deer-hide', 3); q.give('amber-resin', 4); q.give('boar-hide', 1); q.give('venison', 1);
        const at = mott.prompt.position, him = mott.fig.group.position;
        const dx = at.x - him.x, dz = at.z - him.z, d = Math.hypot(dx, dz) || 1;
        const x = him.x + (dx / d) * 2.6, z = him.z + (dz / d) * 2.6;
        return { x, z, yaw: Math.atan2(-(him.x - x), -(him.z - z)) };
      });
      await page.evaluate((p) => window.__wildshard.pose({ name: 'trader', x: p.x, z: p.z, yaw: p.yaw, pitch: -0.12 }), stand);
      await sleep(1500);
      await page.evaluate(() => { window.__wildshard.shard['pine.quest'].openTrade(); });
      await sleep(1200);
      const read = await page.evaluate(() => {
        const t = (s) => [...document.querySelectorAll(s)].map((e) => e.textContent);
        return { slate: t('.ws-ph-trade.show .ws-ph-swap-label, .ws-slate.show .ws-slate-swap-label'), buttons: t('.ws-ph-swap-btn, .ws-slate-swap-btn'),
          tiles: t('.ws-shop.show .ws-icard-tile .ws-icard-name'), feet: t('.ws-shop.show .ws-icard-tile .ws-icard-foot'),
          bar: document.querySelector('.ws-shop.show .ws-shop-bigbuy')?.textContent ?? null, accent: document.querySelector('.ws-shop')?.style.getPropertyValue('--ws-accent') ?? null };
      });
      out[`pine-trader-${cards}`] = { ...read, errors }; console.log('pine', cards, JSON.stringify(read));
      toJpeg(await page.screenshot(), `pine-trader-${cards}-${tag}.jpg`);
      if (cards === 'big' && read.tiles.length > 0) {   // → to the next swap (the first is a full quiver here): a tradeable one framed
        await page.keyboard.press('ArrowRight'); await sleep(400);
        out['pine-trader-big-2'] = await page.evaluate(() => document.querySelector('.ws-shop.show .ws-shop-bigbuy')?.textContent ?? null);
        toJpeg(await page.screenshot(), `pine-trader-big-2-${tag}.jpg`);
      }
      if (cards === 'classic') await panelPng(page, '.ws-ph-trade.show .ws-ph-frame, .ws-slate.show .ws-slate-frame', `pine-trader-classic-${tag}.png`);
      await ctx.close();
    }
    // ── Nalati: the camp, Baqyt Ata's dialogue ──
    {
      const { ctx, page, errors } = await open('nalati-grasslands', cards);
      const stand = await page.evaluate(() => {
        const a = window.__wildshard.shard['nalati.quest'], head = a.people.fig.elder.headWorld;
        const x = head.x + 2.4, z = head.z + 1.2;
        return { x, z, yaw: Math.atan2(-(head.x - x), -(head.z - z)) };
      });
      await page.evaluate((p) => window.__wildshard.pose({ name: 'camp', x: p.x, z: p.z, yaw: p.yaw, pitch: -0.05 }), stand);
      await sleep(1500);
      await page.evaluate(() => { window.__wildshard.shard['nalati.quest'].talk('elder'); });
      await sleep(1500);
      const read = await page.evaluate(() => ({ dialogue: document.querySelector('.ws-quest-talk')?.textContent?.slice(0, 160) ?? null,
        chip: document.querySelector('.ws-quest-obj')?.textContent ?? null, talkClass: document.querySelector('.ws-quest-talk')?.className ?? null }));
      out[`nalati-camp-${cards}`] = { ...read, errors }; console.log('nalati', cards, JSON.stringify(read));
      toJpeg(await page.screenshot(), `nalati-camp-${cards}-${tag}.jpg`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, `capture-${tag}.json`), `${JSON.stringify(out, null, 2)}\n`);
}
