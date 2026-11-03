// Round 12 UI prototypes: shared capture helpers. Chromium as an iPhone 16 Pro portrait (402×874 @3×), muted, GPU.
// Every prototype is injected into a LIVE page of a served build (scripts/serve-build.sh): the world, the camera and the
// real HUD are the game's; only the new element is added, built from the engine's own classes (src/engine/ui/styles/*.css)
// plus the few new rules in proto.css. Nothing here touches src/.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const OUT = resolve(new URL('.', import.meta.url).pathname);
export const PROTO_CSS = join(OUT, 'proto.css');
const FONT = '/System/Library/Fonts/SFNSMono.ttf';
export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
export const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);

export async function launch() {
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  return { browser, PHONE: devices['iPhone 16 Pro'] };
}

/** open a shard as the phone, wait for the world, hide the first-run control hints (a returning player's HUD) */
export async function open(browser, PHONE, url, slug) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?chunk=${slug}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await sleep(5000);
  // first-run hints ("DRAG TO MOVE") retire after one use; a returning player never sees them. The build pill is Developer.
  await page.addStyleTag({ content: '.ws-hint-ring, .ws-hint-tag { display: none !important; }' });
  await page.addStyleTag({ path: PROTO_CSS });
  await helpers(page);
  const build = await page.evaluate(async () => (await (await fetch('/version.json')).json()).build);
  return { ctx, page, errors, build };
}

/** pose the player (harness pose: spawn + land + pitch), then let the world settle */
export async function pose(page, p, settle = 2500) {
  await page.evaluate(async (q) => { await window.__wildshard.pose(q); }, p);
  await sleep(settle);
}

/** drop every injected prototype node; restore every hidden or cloned live element */
export async function clean(page) {
  await page.evaluate(() => {
    for (const n of document.querySelectorAll('[data-proto]')) n.remove();
    for (const n of document.querySelectorAll('[data-proto-hide]')) { n.style.visibility = n.dataset.protoHide === '-' ? '' : n.dataset.protoHide; delete n.dataset.protoHide; }
    for (const n of document.querySelectorAll('[data-proto-gone]')) { n.style.display = n.dataset.protoGone === '-' ? '' : n.dataset.protoGone; delete n.dataset.protoGone; }
    for (const n of document.querySelectorAll('[data-proto-class]')) { n.className = n.dataset.protoClass; delete n.dataset.protoClass; }
  });
}

/** page-side helpers: project a world point to CSS px, hide a live element, swap it for an edited clone */
export async function helpers(page) {
  await page.evaluate(() => {
    const w = () => window.__wildshard.world;
    window.__P = {
      project(x, y, z) {
        const cam = w().game.camera; const v = cam.position.clone().set(x, y, z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, ok: v.z < 1 && v.z > -1 };
      },
      local(x, y, z) { const cam = w().game.camera; const v = cam.position.clone().set(x, y, z).applyMatrix4(cam.matrixWorldInverse); return { right: v.x, ahead: -v.z }; },
      hide(el) { if (el && el.dataset.protoHide === undefined) { el.dataset.protoHide = el.style.visibility || '-'; el.style.visibility = 'hidden'; } },
      cls(el, add = [], remove = []) { if (!el) return; if (el.dataset.protoClass === undefined) el.dataset.protoClass = el.className; for (const c of remove) el.classList.remove(c); for (const c of add) el.classList.add(c); },
      gone(el) { if (el && el.dataset.protoGone === undefined) { el.dataset.protoGone = el.style.display || '-'; el.style.display = 'none'; } },
      swap(el, edit) { if (!el) return null; const c = el.cloneNode(true); c.dataset.proto = '1'; delete c.dataset.protoHide; delete c.dataset.protoGone; window.__P.gone(el); el.after(c); edit(c); return c; },
      add(parent, html) { const t = document.createElement('div'); t.innerHTML = html.trim(); const out = []; for (const n of [...t.children]) { n.dataset.proto = '1'; (typeof parent === 'string' ? document.querySelector(parent) : parent).append(n); out.push(n); } return out[0]; },
      at(el, p, dx = 0, dy = 0) { el.style.transform = `translate3d(${(p.x + dx).toFixed(1)}px,${(p.y + dy).toFixed(1)}px,0)`; return el; },
      holdAll(r = 40) { const pl = w().player.position; for (const a of w().animals.animals) if (Math.hypot(a.position.x - pl.x, a.position.z - pl.z) < r) a.harnessHold = true; },
      near(kind, r = 30) { const pl = w().player.position; return w().animals.animals.filter((a) => a.alive && (kind === null || a.kind === kind) && Math.hypot(a.position.x - pl.x, a.position.z - pl.z) < r).map((a) => { const h = a.position.clone(); a.headWorld(h); h.y += 0.2; return { kind: a.kind, x: h.x, y: h.y, z: h.z, d: Math.hypot(a.position.x - pl.x, a.position.z - pl.z) }; }).sort((a, b) => a.d - b.d); },
      /** creatures whose head projects inside the play area (clear of the top bar and the touch bar), nearest first */
      visible(kind, r = 45) { return window.__P.near(kind, r).map((c) => ({ ...c, p: window.__P.project(c.x, c.y, c.z) })).filter((c) => c.p.ok && c.p.x > 30 && c.p.x < innerWidth - 30 && c.p.y > 200 && c.p.y < innerHeight - 260); },
      /** a chip under the minimap stacks under the quest chip; the toast column steps down under it */
      restack(chip) {
        const q = document.querySelector('.ws-quest-obj.show'), mm = document.querySelector('.ws-minimap');
        const anchor = (q && q.getBoundingClientRect().height > 0 ? q : mm).getBoundingClientRect();
        chip.style.top = `${anchor.bottom + 6}px`; chip.style.right = `${innerWidth - anchor.right}px`; chip.style.left = 'auto'; chip.style.transform = 'none';
        const t = document.querySelector('.ws-game-toasts'); t.style.setProperty('--ws-toast-top', `${chip.getBoundingClientRect().bottom + 8}px`);
      },
      clearToasts() { for (const t of document.querySelectorAll('.ws-game-toasts .ws-game-toast')) t.remove(); },
      vitals(n) { const v = document.querySelector('.ws-game-vitals'); if (!v) return; window.__P.swap(v, (c) => { c.classList.remove('hp-fade', 'hp-gone'); c.querySelector('.ws-game-num').textContent = String(n); c.querySelector('.ws-game-vbar i').style.width = `${n}%`; }); },
    };
  });
}

/** screenshot → JPEG 603 px wide with a burned-in label strip on top; asserts ≤ 250 KB */
export async function shoot(page, file, title, refs, sub, after) {
  const png = await page.screenshot();
  const tmp = join(OUT, `.${file}.png`), jpg = join(OUT, file);
  writeFileSync(tmp, png);
  const big = title.length > 62 ? '12' : title.length > 54 ? '13' : '15';
  const run = (q) => execFileSync('magick', [tmp, '-resize', '603x', '-background', '#0b0f16', '-gravity', 'north', '-splice', '0x74',
    '-font', FONT, '-pointsize', big, '-fill', '#f08a24', '-annotate', '+0+7', title,
    '-pointsize', '11', '-fill', '#aab6bd', '-annotate', '+0+30', refs,
    '-pointsize', '12', '-fill', after ? '#ffd27a' : '#bfe8f7', '-annotate', '+0+50', sub,
    '-strip', '-interlace', 'JPEG', '-sampling-factor', '4:2:0', '-quality', String(q), jpg]);
  run(80);
  if (statSync(jpg).size > 250000) run(68);
  rmSync(tmp, { force: true });
  return statSync(jpg).size;
}

/** a BEFORE / AFTER pair: setup() reaches the live state, inject() adds the prototype */
export async function pair(ctx, item) {
  const { page, build, shard } = ctx;
  await clean(page);
  if (item.setup) await item.setup(page);
  await sleep(item.wait ?? 900);
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(item.title);
  const head = `${item.id} · ${m ? m[1] : item.title}`, refs = m ? m[2] : '';
  const b = await shoot(page, `${item.id.toLowerCase()}-${item.slug}-before.jpg`, head, refs, `BEFORE (live) · ${shard} · build ${build}`, false);
  if (item.inject) await item.inject(page);
  await sleep(item.afterWait ?? 700);
  const a = await shoot(page, `${item.id.toLowerCase()}-${item.slug}-after.jpg`, head, refs, `AFTER (prototype in the live page) · ${shard}${item.note ? ` · ${item.note}` : ''}`, true);
  if (item.teardown) await item.teardown(page);
  console.log(item.id, item.slug, b, a);
}

export function makeDir(p) { mkdirSync(p, { recursive: true }); }
