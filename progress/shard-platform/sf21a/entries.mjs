#!/usr/bin/env node
// SF21a (SHARD-PLATFORM §3.3, G58, G61, R3-C5): the main menu's two entries, proven in a real browser per mode.
//
//   scripts/serve-build.sh --name sf21a                # production build  → http://127.0.0.1:<a>/
//   scripts/serve-build.sh --name sf21a-dev --devserver # DEVSERVER build  → http://127.0.0.1:<b>/
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/sf21a/entries.mjs --url=http://127.0.0.1:<a> --devserver-url=http://127.0.0.1:<b>
//
// For each build × Settings ▸ Developer (off / on) it opens the cold title (iPhone 16 Pro portrait, muted) and records
// which entries show, which entry has focus and which shards Select a shard enters; it saves a portrait JPEG per mode.
// With Developer on it taps EXPERIMENTAL Wildshard, waits for the grid page (page mode 'grid' in the alive beat, the URL
// dropped to the title's), clears sessionStorage and reloads: the title must come back with Select a shard focused and
// every save document intact. Then it kills the grid page's renderer (the iOS memory kill's stand-in) and reopens: the
// title must carry the one-line note. Writes progress/shard-platform/sf21a/entries.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const BUILDS = [{ name: 'production', url: flag('url') }, { name: 'devserver', url: flag('devserver-url') }].filter((b) => b.url !== '');
if (BUILDS.length === 0) { console.error('usage: entries.mjs --url=<production build> [--devserver-url=<DEVSERVER build>]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });

const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};

/** the cold title's state: entries, focus, the note, and what Select a shard enters (walked through the dots) */
async function titleState(page) {
  await page.waitForSelector('.ws-menu-card', { timeout: 120000 });
  await sleep(1200);
  return page.evaluate(async () => {
    const q = (s) => document.querySelector(s);
    const state = {
      search: location.search, titleFirst: document.documentElement.classList.contains('title-first'),
      entry: q('.ws-menu')?.getAttribute('data-entry') ?? null,
      select: q('.ws-menu-entry-select')?.textContent ?? null, grid: q('.ws-menu-entry-grid')?.textContent ?? null,
      focused: document.activeElement?.className ?? '', note: q('.ws-menu-recovery')?.textContent ?? '', enters: [], locked: [], explore: [],
    };
    const dots = [...document.querySelectorAll('.ws-menu-dots i')];
    for (const [i, dot] of dots.entries()) {
      dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => { setTimeout(r, 60); });
      const card = document.querySelectorAll('.ws-menu-card')[i]?.querySelector('b')?.textContent ?? `#${i}`;
      const play = q('.ws-menu-play');
      const label = play?.querySelector('b')?.textContent ?? '';
      if (label === 'Enter world' && !play.disabled) state.enters.push(card); else if (label === 'Coming soon') state.locked.push(card);
      if (!q('.ws-menu-explore')?.disabled) state.explore.push(card);
    }
    dots[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return state;
  });
}

const saveDocs = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('wildshard.save.v2.')).map((k) => {
  try { return [k, Object.keys(JSON.parse(localStorage.getItem(k) ?? '{}').keys ?? {}).sort()]; } catch { return [k, ['<unparsed>']]; }
})));
const alive = (page) => page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('wildshard.save.v2.session') ?? '{}').keys?.['life.alive']?.data ?? null; } catch { return null; } });

async function gridRound(page, url) {
  const before = await saveDocs(page);
  await page.click('.ws-menu-entry-grid');
  const t0 = Date.now();
  let beat = null;
  while (Date.now() - t0 < 240000) {
    await sleep(1500);
    try { beat = await alive(page); } catch { continue; } // mid-navigation
    if (beat?.mode === 'grid' && String(beat.resident).includes('(playing)')) break;
  }
  const inGrid = { mode: beat?.mode ?? null, slug: beat?.slug ?? null, resident: beat?.resident ?? null, search: await page.evaluate(() => location.search), bootS: Math.round((Date.now() - t0) / 1000) };
  // a reload inside the grid with sessionStorage cleared: the title, Select a shard focused, saves intact
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reload = await titleState(page);
  const after = await saveDocs(page);
  const lost = Object.entries(before).flatMap(([doc, keys]) => (after[doc] === undefined ? [`${doc} (whole document)`] : keys.filter((k) => !after[doc].includes(k)).map((k) => `${doc}:${k}`)))
    .filter((k) => !k.endsWith(':titleArrival.once') && !k.endsWith(':gridIntent.once') && !k.endsWith(':life.lastUnload')); // the one-shots are consumed by design
  // the iOS memory kill's stand-in: the grid page's renderer dies without a pagehide; the next open shows the note
  await page.click('.ws-menu-entry-grid');
  const t1 = Date.now();
  while (Date.now() - t1 < 240000) { await sleep(1500); try { beat = await alive(page); } catch { continue; } if (beat?.mode === 'grid' && String(beat.resident).includes('(playing)')) break; }
  await sleep(3500); // one more alive beat
  // the tab's session survives a WebContent kill on iOS; a crashed Playwright page can't reload, so the reopened tab
  // gets the dead page's session document back before its first script (no pagehide ran, so the alive beat is stale)
  const sessionDoc = await page.evaluate(() => sessionStorage.getItem('wildshard.save.v2.session'));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.crash').catch(() => undefined);
  await sleep(500);
  let killed = null, reopened = page;
  try {
    reopened = await page.context().newPage();
    await reopened.addInitScript((doc) => { if (doc !== null && !sessionStorage.getItem('sf21a.restored')) { sessionStorage.setItem('wildshard.save.v2.session', doc); sessionStorage.setItem('sf21a.restored', '1'); } }, sessionDoc);
    await reopened.goto(`${url}/`, { waitUntil: 'domcontentloaded' });
    killed = await titleState(reopened);
  } catch (e) { killed = { error: String(e).slice(0, 200) }; }
  return { result: { before: Object.keys(before).length, inGrid, reload, lost, killed }, page: reopened };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const build of BUILDS) for (const dev of [false, true]) {
    const label = `${build.name === 'devserver' ? 'devserver' : 'shipped'}-dev-${dev ? 'on' : 'off'}`;
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: dev });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message.slice(0, 200)); });
    await page.goto(`${build.url}/`, { waitUntil: 'domcontentloaded' });
    const title = await titleState(page);
    toJpeg(await page.screenshot(), join(OUT, `title-${label}.jpg`));
    const row = { build: build.name, dev, title, grid: null, errors };
    if (title.grid !== null) {
      const round = await gridRound(page, build.url);
      row.grid = round.result;
      if (row.grid.killed && !('error' in row.grid.killed)) toJpeg(await round.page.screenshot(), join(OUT, `title-${label}-after-grid-kill.jpg`));
    }
    results.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
} finally { await browser.close(); }
writeFileSync(join(OUT, 'entries.json'), `${JSON.stringify(results, null, 2)}\n`);
