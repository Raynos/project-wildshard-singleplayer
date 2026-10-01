#!/usr/bin/env node
// explore-view-taps.mjs — E323 / E342: does VIEW IN WORLD show the model it opened? For each model drawn into a shared
// object (a kit, a batch: its tap target has a `claim`), open its Model Explorer card, press VIEW IN WORLD, let the
// flight land, clear the landing's selection and tap the centre of the screen, where the camera looks. The tap must
// select that same model; a wall, a pipe or a neighbour in front of it selects something else (or nothing).
// Phone portrait (402 × 874, phone tier), muted, on Metal.
//
//   scripts/serve-build.sh --head --hours 2 --name taps          # prints the URL
//   scripts/browser-lane.sh --max 40 node scripts/explore-view-taps.mjs --url=http://127.0.0.1:4400/ --out=<report.json>
//     [--shards=driftwood-isle,nalati-grasslands,pine-hollow,nine-dragon-stack] [--max=20]
//     [--shots=<dir>] [--shot-shards=nine-dragon-stack]   # a JPEG of each landed frame (the selection box drawn)
//
// Prints one line per model and a "<shard>: <ok> / <n>" total; the report JSON has every row: the model, what the tap
// selected, where the camera landed. Exit 0 whatever the score (it measures, it doesn't gate).
// The cost (E345): `land` ms from VIEW IN WORLD to the model selected (the 1.1 s flight, the landing's check, any search
// and hop), the landing's worst frame (`frame`, ms: a frame that ran the check's pick or a search's), and `tap` ms — one
// tap's pick (pointerdown / up on the canvas, the median of three) where the camera landed.
import { readShards } from './shards.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a === undefined ? d : a.slice(n.length + 3); };
const BASE = flag('url', 'http://127.0.0.1:4400/');
const manifests = await readShards();
const SHARDS = flag('shards', manifests.filter((m) => m.status !== 'hidden').map((m) => m.slug).join(',')).split(',');
const OUT = resolvePath(flag('out', 'explore-view-taps.json'));
const MAX = Number(flag('max', '20'));
const SHOTS = flag('shots', '');
const SHOT_SHARDS = new Set(flag('shot-shards', 'nine-dragon-stack').split(','));
if (SHOTS !== '') mkdirSync(resolvePath(SHOTS), { recursive: true });

const W = 402, H = 874;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { url: BASE, at: new Date().toISOString(), shards: {} };
try {
  for (const shard of SHARDS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const url = new URL(BASE);
    for (const [k, v] of Object.entries({ chunk: shard, tier: 'phone', mute: '1', nolock: '1', sw: '0', explore: 'model' })) url.searchParams.set(k, v);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.ws-x-grid .ws-x-model').length > 0 && window.__wildshard?.world !== undefined, undefined, { timeout: 480_000, polling: 1000 });
    await sleep(2000);
    // the drawn-into models (a pick with a claim) that have a card, in registration order
    const models = await page.evaluate((max) => {
      const w = window.__wildshard?.world, ids = [...new Set(w.registry.picks.filter((p) => p.claim !== undefined).map((p) => p.entry))];
      const cards = new Map([...document.querySelectorAll('.ws-x-grid .ws-x-model')].map((c) => [c.dataset.id, c.querySelector('b')?.textContent ?? '']));
      return ids.filter((id) => cards.has(id)).slice(0, max).map((id) => ({ id, name: cards.get(id) }));
    }, MAX);
    const rows = [];
    for (const m of models) {
      // back to the catalog, open the card
      await page.evaluate(() => { if (document.querySelector('.ws-x')?.dataset.mode !== 'model') document.querySelector('.ws-x-tabs button[data-m="model"]')?.click(); });
      await sleep(300);
      await page.evaluate(() => { if (document.querySelector('.ws-x-models')?.dataset.view === 'model') document.querySelector('.ws-x-back')?.click(); });
      await page.evaluate((id) => { [...document.querySelectorAll('.ws-x-grid .ws-x-model')].find((c) => c.dataset.id === id)?.click(); }, m.id);
      await sleep(500);
      const can = await page.evaluate(() => { const b = document.querySelector('.ws-x-inworld'); return b !== null && !b.classList.contains('off') && !b.hidden; });
      if (!can) { rows.push({ ...m, sel: 'no VIEW IN WORLD' }); continue; }
      // the last tap's selection card stays up behind the Model Explorer: clear it, so the wait below sees this landing's
      await page.evaluate(() => { document.querySelector('.ws-x-deselect')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      // the landing's frames: every rAF gap until the model is selected
      await page.evaluate(() => {
        const rec = { t0: performance.now(), last: performance.now(), worst: 0, done: 0 };
        window.__landRec = rec;
        const step = () => {
          const t = performance.now();
          rec.worst = Math.max(rec.worst, t - rec.last); rec.last = t;
          if (document.querySelector('.ws-x-select.show') !== null) { rec.done = t - rec.t0; return; }
          if (t - rec.t0 < 12_000) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      await page.locator('.ws-x-inworld').click();
      // the flight (1.1 s) lands with the model selected; after E342 a landing whose centre picks something else first
      // tries the other eyes (a pick a frame) and hops (0.6 s)
      await page.waitForFunction(() => document.querySelector('.ws-x-select.show') !== null, undefined, { timeout: 8000, polling: 100 }).catch(() => undefined);
      await sleep(300);
      const view = await page.evaluate(() => {
        const cam = window.__wildshard.world.game.camera.position, rec = window.__landRec;
        return { cam: [cam.x, cam.y, cam.z].map((v) => Math.round(v * 100) / 100), land: Math.round(rec?.done ?? 0), frame: Math.round((rec?.worst ?? 0) * 10) / 10 };
      });
      if (SHOTS !== '' && SHOT_SHARDS.has(shard)) await page.screenshot({ path: join(resolvePath(SHOTS), `${shard}--${m.id.replaceAll(/[^\w.-]+/g, '_')}.jpg`), type: 'jpeg', quality: 86 });
      await page.evaluate(() => { document.querySelector('.ws-x-deselect')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await sleep(150);
      await page.mouse.click(W / 2, H / 2);
      await sleep(300);
      const sel = await page.evaluate(() => (document.querySelector('.ws-x-select.show') ? document.querySelector('.ws-x-select b')?.textContent ?? '' : null));
      // one tap's pick, timed: the canvas's own pointer handlers (Select.pick), three times at the centre
      const tap = await page.evaluate(([x, y]) => {
        const cv = window.__wildshard.world.game.canvas, ms = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, pointerType: 'mouse', bubbles: true }));
          cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, button: 0, pointerType: 'mouse', bubbles: true }));
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return Math.round((ms[1] ?? 0) * 10) / 10;
      }, [W / 2, H / 2]);
      rows.push({ ...m, sel, cam: view.cam, land: view.land, frame: view.frame, tap });
      console.log(`${shard}: ${m.name} → ${sel ?? '—'}${sel === m.name ? '' : '   ✗'}   (land ${view.land} ms · worst frame ${view.frame} ms · tap ${tap} ms)`);
    }
    const ok = rows.filter((r) => r.sel === r.name).length;
    const med = (k) => { const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length === 0 ? 0 : v[Math.floor(v.length / 2)]; };
    const cost = { land: med('land'), frame: med('frame'), tap: med('tap'), worstFrame: Math.max(0, ...rows.map((r) => r.frame ?? 0)) };
    console.log(`${shard}: ${ok} / ${rows.length} drawn-into models, tapped where VIEW IN WORLD looks, selected themselves · median land ${cost.land} ms, worst frame ${cost.frame} ms (max ${cost.worstFrame}), tap ${cost.tap} ms`);
    report.shards[shard] = { ok, n: rows.length, cost, rows };
    await ctx.close();
  }
} finally {
  writeFileSync(OUT, JSON.stringify(report, null, 1));
  await browser.close();
  console.log(`report → ${OUT}`);
}
