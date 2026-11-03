#!/usr/bin/env node
// UI-21, the personal-best board: a WORLD sign (W3a / W6d records), so it is not injectable DOM. Method:
//   1. capture.  --step=capture  the live pier frame (PNG) + the HUD alone on a transparent page (canvas hidden)
//   2. codex image_gen edits only the 2:3 world band of the frame (adds the sign), see codex-pb-board.txt
//   3. compose.  --step=compose  the edited band pasted back into the frame, then the real HUD layer on top, so every HUD
//      pixel is the live one; BEFORE / AFTER labelled like every other pair.
//
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-pb-board.mjs --step=capture --url=http://127.0.0.1:<port> --dir=tmp/ks-ui-r12/pb
//   node art/showcase-template/round-12-ui/cap-pb-board.mjs --step=compose --dir=tmp/ks-ui-r12/pb --edit=<codex png>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, open, pose, sleep, arg, OUT } from './lib.mjs';

const step = arg('step'), dir = arg('dir'), FONT = '/System/Library/Fonts/SFNSMono.ttf';
const BAND = { y: 640, h: 1809 }; // device px of the 1206 × 2622 frame: a 2:3 band (1206 × 1809) clear of the top HUD row
const label = (src, out, sub, after) => execFileSync('magick', [src, '-resize', '603x', '-background', '#0b0f16', '-gravity', 'north', '-splice', '0x74',
  '-font', FONT, '-pointsize', '15', '-fill', '#f08a24', '-annotate', '+0+7', 'UI-21 · Personal-best board at a course start',
  '-pointsize', '11', '-fill', '#aab6bd', '-annotate', '+0+30', 'W3a · W6d records host, a world sign row',
  '-pointsize', '12', '-fill', after ? '#ffd27a' : '#bfe8f7', '-annotate', '+0+50', sub,
  '-strip', '-interlace', 'JPEG', '-sampling-factor', '4:2:0', '-quality', '80', join(OUT, out)]);

if (step === 'capture') {
  mkdirSync(dir, { recursive: true });
  const { browser, PHONE } = await launch();
  try {
    const { page, build } = await open(browser, PHONE, arg('url'), 'driftwood-isle');
    await pose(page, { x: 0, y: 1.3, z: -194, yaw: Math.PI, pitch: 0 }, 3000);
    await page.evaluate(() => { window.__P.clearToasts(); });
    await sleep(800);
    writeFileSync(join(dir, 'full.png'), await page.screenshot());
    await page.evaluate(() => {
      for (const c of document.querySelectorAll('canvas#game, .ws-waterline')) c.style.visibility = 'hidden';
      document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
    });
    await sleep(500);
    writeFileSync(join(dir, 'hud.png'), await page.screenshot({ omitBackground: true }));
    writeFileSync(join(dir, 'build.txt'), build);
  } finally { await browser.close(); }
  execFileSync('magick', [join(dir, 'full.png'), '-crop', `1206x${BAND.h}+0+${BAND.y}`, '+repage', '-quality', '88', join(dir, 'band.jpg')]);
} else if (step === 'compose') {
  const edit = arg('edit'), build = execFileSync('cat', [join(dir, 'build.txt')]).toString().trim();
  execFileSync('magick', [edit, '-resize', `1206x${BAND.h}!`, join(dir, 'band-edit.png')]);
  execFileSync('magick', [join(dir, 'full.png'), join(dir, 'band-edit.png'), '-geometry', `+0+${BAND.y}`, '-composite', join(dir, 'hud.png'), '-composite', join(dir, 'after.png')]);
  label(join(dir, 'full.png'), 'ui-21-pb-board-before.jpg', `BEFORE (live) · Driftwood Isle · build ${build}`, false);
  label(join(dir, 'after.png'), 'ui-21-pb-board-after.jpg', 'AFTER (codex edit of the world band, live HUD laid back on top) · Driftwood Isle', true);
} else { console.error('--step=capture|compose'); process.exit(2); }
