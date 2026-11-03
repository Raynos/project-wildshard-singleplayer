#!/usr/bin/env node
// UI-29 options (Jake 11-03: "way too busy … you can hide the rest of the quest, and you can have like a dungeon specific
// quest chip, but like just one"). Every option hides the tracked quest while inside the Training Vault and shows at most
// one thing under the minimap. Live Driftwood page, crabs stand in for robots; writes ui-29-opt-{a,b,c}.jpg + the board.
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-ui29-options.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, pose, shoot, clean, sleep, arg, OUT } from './lib.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-ui29-options.mjs --url=<build>'); process.exit(2); }
const BEACH = { x: 134, z: 1, yaw: 0, pitch: -0.12 };

/** the live quest chip, re-dressed as the vault's own chip: one diamond, the vault's name, the room count */
const vaultChip = (page, goal, nav) => page.evaluate(([g, n]) => {
  window.__P.swap(document.querySelector('.ws-quest-obj'), (c) => {
    c.classList.add('show'); c.classList.remove('ws-quest-hide');
    const go = c.querySelector('.ws-quest-obj-goal'), na = c.querySelector('.ws-quest-obj-nav');
    if (go) go.innerHTML = `<span class="ws-quest-obj-label">${g}</span>`;
    if (na) na.innerHTML = n;
    c.querySelector('.ws-quest-obj-sep')?.style.setProperty('display', n === '' ? 'none' : '');
  });
}, [goal, nav]);

const OPTIONS = [
  { key: 'a', title: 'A · The vault’s own quest chip', sub: 'the tracked quest hides inside; one chip: TRAINING VAULT | ROOM 2/4 · 3 LEFT',
    run: (page) => vaultChip(page, 'Training Vault', '<span class="ws-quest-obj-count">Room 2/4 · 3 left</span>') },
  { key: 'b', title: 'B · Nothing stays on screen', sub: 'no chip at all; ROOM 2 / 4 flashes in the middle as the doors seal, then fades',
    run: (page) => page.evaluate(() => {
      window.__P.gone(document.querySelector('.ws-quest-obj'));
      window.__P.swap(document.querySelector('.ws-game-boundary'), (c) => { c.classList.add('wave'); c.querySelector('.ws-game-bt').textContent = 'Room 2 / 4'; const s = c.querySelector('.ws-game-bs'); s.textContent = 'the doors seal'; s.style.cssText = 'color:#fff;opacity:1;text-shadow:0 1px 2px #000,0 0 8px #000c'; });
    }) },
  { key: 'c', title: 'C · Room pips only', sub: 'one small chip of four room pips (two done, this one lit) and the robots left',
    run: (page) => vaultChip(page, '<span style="letter-spacing:.32em;color:var(--ws-cyan)">◆◆<span style="color:#fff;text-shadow:0 0 6px var(--ws-cyan)">◆</span><span style="opacity:.35">◇</span></span>', '<span class="ws-quest-obj-count">3 left</span>') },
];

const { browser, PHONE } = await launch();
try {
  const { ctx, page, build, errors } = await open(browser, PHONE, url, 'driftwood-isle');
  for (const o of OPTIONS) {
    await clean(page);
    await pose(page, BEACH, 2600);
    await page.evaluate(() => { window.__P.holdAll(40); window.__P.clearToasts(); });
    await o.run(page);
    await sleep(800);
    console.log(o.key, await shoot(page, `ui-29-opt-${o.key}.jpg`, `UI-29 ${o.title}`, o.sub, `OPTION (prototype in the live page) · Driftwood Isle · build ${build}`, true));
  }
  if (errors.length) console.log('page errors', errors.slice(0, 3));
  await ctx.close();
} finally { await browser.close(); }

// the labelled A / B / C board, side by side, each panel already carries its burned-in label
const files = OPTIONS.map((o) => join(OUT, `ui-29-opt-${o.key}.jpg`));
execFileSync('magick', [...files, '-resize', 'x1100', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '78', join(OUT, 'ui-29-board.jpg')]);
console.log('board', join(OUT, 'ui-29-board.jpg'));
