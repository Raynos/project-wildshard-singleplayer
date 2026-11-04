#!/usr/bin/env node
// Variant boards for two HUD changes Jake sent back on 11-03:
//   UI-35 ammo ("show me better variants for how to choose ammo … the main weapon wheel is somewhere else … it looks very
//   messy"): Pine Hollow, the crossbow; four ways to pick iron / pitch / broadhead, none of them a second big wheel.
//   UI-23 stealth ("feels busy … busy on top right with like the two pills"): Nalati, the stealth yard; three quieter ways
//   to say UNSEEN. Writes ui-35-opt-*.jpg, ui-23-opt-*.jpg and one labelled board for each.
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-variants.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, pose, clean, shoot, sleep, arg, OUT } from './lib.mjs';
import { G } from './icons.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-variants.mjs --url=<build>'); process.exit(2); }

const EYE = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const AMMO = [{ k: 'iron', name: 'Iron', n: 12, svg: G.bolt }, { k: 'pitch', name: 'Pitch', n: 4, svg: G.flame }, { k: 'broad', name: 'Broad', n: 0, svg: G.broad }];

/** the BOLTS disc (the crossbow's ammoSelect verb) */
const boltsDisc = `[...document.querySelectorAll('.ws-touch button')].find((d) => d.textContent.trim().toLowerCase() === 'bolts' && d.getBoundingClientRect().width > 0)`;

const AMMO_OPTS = [
  { key: 'a', title: 'UI-35 A · Tap BOLTS to cycle the ammo', sub: 'the disc wears the loaded kind and its count; tap = next kind (empty skipped); dots = which of 3',
    run: (page) => page.evaluate(([sel, a]) => {
      const d = eval(sel); // eslint-disable-line no-eval
      window.__P.hide(d); window.__P.swap(d, (c) => { c.style.visibility = 'visible'; c.querySelector('svg').outerHTML = a[1].svg; c.querySelector('span').innerHTML = 'Pitch <b style="color:#ffd27a">4</b>'; c.classList.add('available'); });
      const r = d.getBoundingClientRect();
      const dots = window.__P.add('#hud', '<div style="position:fixed;display:flex;gap:5px;pointer-events:none"><i style="width:6px;height:6px;border-radius:50%;border:1px solid var(--ws-cyan)"></i><i style="width:6px;height:6px;border-radius:50%;background:var(--ws-cyan);box-shadow:0 0 6px var(--ws-cyan)"></i><i style="width:6px;height:6px;border-radius:50%;border:1px solid #ffffff55"></i></div>');
      dots.style.left = `${r.left + r.width / 2 - 14}px`; dots.style.top = `${r.top - 12}px`;
      window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => { const t = c.querySelector('.ws-game-weapon'); if (t) t.textContent = 'Crossbow · pitch'; });
    }, [boltsDisc, AMMO]) },
  { key: 'b', title: 'UI-35 B · Hold BOLTS: a short stack of three', sub: 'hold the disc, three slim pills rise above it, slide up to one and let go; the empty one is greyed',
    run: (page) => page.evaluate(([sel, a]) => {
      const d = eval(sel); // eslint-disable-line no-eval
      window.__P.cls(d, ['pressed']); d.style.boxShadow = '0 0 0 3px var(--ws-cyan), 0 0 18px #8fe3ff88';
      const r = d.getBoundingClientRect();
      const pill = (x, on) => `<div style="display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;margin-top:6px;border:1px solid ${on ? 'var(--ws-cyan)' : '#8fe3ff40'};background:${on ? '#123344ee' : '#0b1620dd'};color:${x.n === 0 ? '#ffffff55' : on ? 'var(--ws-cyan)' : 'var(--ws-text)'};font:600 13px var(--ws-display);letter-spacing:.14em;text-transform:uppercase;border-radius:20px"><i style="width:18px;height:18px;display:block">${x.svg}</i>${x.name}<b style="margin-left:auto;padding-left:14px">${x.n}</b></div>`;
      const stack = window.__P.add('#hud', `<div style="position:fixed;width:150px;pointer-events:none">${[a[2], a[1], a[0]].map((x) => pill(x, x.k === 'iron')).join('')}</div>`);
      stack.style.left = `${r.right - 150}px`; stack.style.top = `${r.top - 6 - 3 * 46}px`;
    }, [boltsDisc, AMMO]) },
  { key: 'c', title: 'UI-35 C · Three ammo tabs on the bolts chip', sub: 'no BOLTS disc; the chip top left becomes three tabs (icon + count, the loaded one named); tap one',
    run: (page) => page.evaluate(([sel, a]) => {
      window.__P.hide(eval(sel)); // the engine re-shows display each frame; visibility stays // eslint-disable-line no-eval
      window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => {
        c.style.pointerEvents = 'auto'; c.style.height = '30px'; c.style.gap = '0'; c.style.padding = '0';
        c.innerHTML = a.map((x) => `<span style="display:flex;align-items:center;gap:6px;height:100%;padding:0 10px;border-right:1px solid #8fe3ff30;${x.k === 'iron' ? 'background:#8fe3ff22;color:var(--ws-cyan)' : x.n === 0 ? 'color:#ffffff50' : 'color:var(--ws-text)'};font:600 12px var(--ws-display);letter-spacing:.12em;text-transform:uppercase"><i style="width:15px;height:15px;display:block">${x.svg}</i>${x.k === 'iron' ? x.name : ''}<b>${x.n}</b></span>`).join('');
      });
    }, [boltsDisc, AMMO]) },
  { key: 'd', title: 'UI-35 D · Pick the ammo in the bag, not in a fight', sub: 'no BOLTS disc; PACK sets the loaded kind; the chip only says which one is loaded',
    run: (page) => page.evaluate(([sel]) => {
      window.__P.hide(eval(sel)); // the engine re-shows display each frame; visibility stays // eslint-disable-line no-eval
      window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => { const t = c.querySelector('.ws-game-weapon'); if (t) t.textContent = 'Crossbow · iron'; });
    }, [boltsDisc]) },
];

const STEALTH_OPTS = [
  { key: 'a', title: 'UI-23 A · The quest chip becomes the stealth chip', sub: 'one chip: KEYCARD | UNSEEN with the eye; no toast, no second row; the quest chip comes back after',
    run: (page) => page.evaluate((eye) => {
      window.__P.swap(document.querySelector('.ws-quest-obj'), (c) => {
        const go = c.querySelector('.ws-quest-obj-goal'), na = c.querySelector('.ws-quest-obj-nav');
        if (go) go.innerHTML = '<span class="ws-quest-obj-label">Keycard</span>';
        if (na) na.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">${eye}Unseen</span>`;
      });
    }, EYE) },
  { key: 'b', title: 'UI-23 B · One small eye under the weapon chip', sub: 'the stealth row alone (eye + UNSEEN), top left; the quest chip as it is; no toast',
    run: (page) => page.evaluate((eye) => {
      const real = document.querySelector('.ws-stealth-row');
      const row = real ? window.__P.swap(real, () => {}) : window.__P.add('.ws-touch-status', '<div class="ws-touch-row ws-stealth-row"><i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span></div>');
      row.dataset.state = 'hidden'; row.querySelector('.ws-stealth-eye').innerHTML = eye; row.querySelector('.ws-stealth-label').textContent = 'Unseen';
    }, EYE) },
  { key: 'c', title: 'UI-23 C · No words: the screen edge says it', sub: 'a soft dark edge while unseen (it flashes red when a guard spots you) + one eye over the crosshair',
    run: (page) => page.evaluate((eye) => {
      window.__P.add('#hud', '<div style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 52%, transparent 52%, #04101acc 100%)"></div>');
      const e = window.__P.add('#hud', `<div style="position:fixed;left:50%;top:47%;transform:translate(-50%,-100%);color:var(--ws-cyan);opacity:.9;filter:drop-shadow(0 0 4px #000)">${eye.replace('width="16" height="16"', 'width="26" height="26"')}</div>`);
      void e;
    }, EYE) },
];

const board = (prefix, opts) => {
  const files = opts.map((o) => join(OUT, `${prefix}-opt-${o.key}.jpg`));
  execFileSync('magick', [...files, '-resize', 'x1000', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '76', join(OUT, `${prefix}-board.jpg`)]);
  console.log('board', `${prefix}-board.jpg`);
};

const { browser, PHONE } = await launch();
try {
  for (const [slug, shard, prefix, opts, setup] of [
    ['pine-hollow', 'Pine Hollow', 'ui-35', AMMO_OPTS, async (page) => { await page.evaluate(() => { window.__wildshard.combat.equip('crossbow'); }); await sleep(1500); }],
    ['nalati-grasslands', 'Nalati Grasslands', 'ui-23', STEALTH_OPTS, async () => {}],
  ]) {
    const { ctx, page, build, errors } = await open(browser, PHONE, url, slug);
    await pose(page, {}, 2600);
    await page.evaluate(() => { window.__P.holdAll(80); window.__P.clearToasts(); });
    await setup(page);
    for (const o of opts) {
      await clean(page);
      await page.evaluate(() => { window.__P.clearToasts(); });
      await o.run(page);
      await sleep(700);
      console.log(prefix, o.key, await shoot(page, `${prefix}-opt-${o.key}.jpg`, o.title, o.sub, `OPTION (prototype in the live page) · ${shard} · build ${build}`, true));
    }
    if (errors.length) console.log('page errors', errors.slice(0, 3));
    await ctx.close();
    board(prefix, opts);
  }
} finally { await browser.close(); }
