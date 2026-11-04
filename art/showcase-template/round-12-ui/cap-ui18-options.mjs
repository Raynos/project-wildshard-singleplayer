#!/usr/bin/env node
// UI-18 options (Jake 11-03: "definitely very busy"): today two long toasts stack under the quest chip, each spelling out
// the whole find or feat. Three quieter ways to say "you found something" on Driftwood's pier; the details live in the
// bag's FINDS / FEATS tabs. Writes ui-18-opt-{a,b,c}.jpg + the board.
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-ui18-options.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, pose, clean, shoot, sleep, arg, OUT } from './lib.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-ui18-options.mjs --url=<build>'); process.exit(2); }
const PIER = { x: 0, y: 1.3, z: -194, yaw: Math.PI, pitch: 0 };

const OPTIONS = [
  { key: 'a', title: 'UI-18 A · One short line at a time', sub: 'FOUND · GOLD 1×1 · 5 / 20, no effect text; a second toast waits its turn; details in FINDS',
    run: (page) => page.evaluate(() => { window.__wildshard.world.hud.toast('Found · Gold 1×1 · 5 / 20'); }) },
  { key: 'b', title: 'UI-18 B · A small card in the middle, then gone', sub: 'one centred two-line card (what + the reward) for ~2 s, like the wave line; nothing under the minimap',
    run: (page) => page.evaluate(() => {
      window.__P.swap(document.querySelector('.ws-game-boundary'), (c) => { c.classList.add('wave'); c.querySelector('.ws-game-bt').textContent = 'Gold 1×1 · 5 / 20'; const s = c.querySelector('.ws-game-bs'); s.textContent = 'Calibration Chip · +5 % board speed'; s.style.cssText = 'color:#fff;opacity:1;text-shadow:0 1px 2px #000,0 0 8px #000c'; });
    }) },
  { key: 'c', title: 'UI-18 C · No toast: +1 FIND by the bag', sub: 'a small gold +1 FIND by the bag icon for a moment; open the bag to see what it was',
    run: (page) => page.evaluate(() => {
      const b = document.querySelector('.ws-minimap-bag'); const r = b.getBoundingClientRect();
      const dot = window.__P.add('#hud', '<div style="position:fixed;z-index:9999;width:14px;height:14px;border-radius:50%;background:#ffd54a;border:2px solid #2a1a02;box-shadow:0 0 10px #ffd54acc;pointer-events:none"></div>');
      dot.style.display = "none";
      const tag = window.__P.add('#hud', '<div style="position:fixed;z-index:9999;padding:2px 6px;background:#0b1620cc;border:1px solid #ffd54a88;font:700 13px var(--ws-display);letter-spacing:.12em;color:#ffd54a;text-shadow:0 1px 2px #000,0 0 6px #000;pointer-events:none">+1 FIND</div>');
      tag.style.left = `${r.right - 84}px`; tag.style.top = `${r.bottom + 6}px`;
    }) },
];

const { browser, PHONE } = await launch();
try {
  const { ctx, page, build, errors } = await open(browser, PHONE, url, 'driftwood-isle');
  await pose(page, PIER, 2600);
  for (const o of OPTIONS) {
    await clean(page);
    await page.evaluate(() => { window.__P.clearToasts(); });
    await o.run(page);
    await sleep(600);
    console.log(o.key, await shoot(page, `ui-18-opt-${o.key}.jpg`, o.title, o.sub, `OPTION (prototype in the live page) · Driftwood Isle · build ${build}`, true));
  }
  if (errors.length) console.log('page errors', errors.slice(0, 3));
  await ctx.close();
} finally { await browser.close(); }

const files = OPTIONS.map((o) => join(OUT, `ui-18-opt-${o.key}.jpg`));
execFileSync('magick', [...files, '-resize', 'x1000', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '76', join(OUT, 'ui-18-board.jpg')]);
console.log('board', join(OUT, 'ui-18-board.jpg'));
