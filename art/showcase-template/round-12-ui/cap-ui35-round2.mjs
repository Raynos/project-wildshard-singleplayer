#!/usr/bin/env node
// UI-35 round 2 (Jake 11-03: "there's not much variant here … I'm not feeling this bolt button above the three buttons …
// what if the ammo selection was on the right hand side … on the top … some kind of wheel that comes from the top … we
// need to think bigger"). Every option drops the BOLTS disc from the thumb row; the ammo lives somewhere else.
// Pine Hollow, the crossbow. Writes ui-35-r2-{a..e}.jpg + ui-35-r2-board.jpg.
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-ui35-round2.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, pose, clean, shoot, sleep, arg, OUT } from './lib.mjs';
import { G } from './icons.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-ui35-round2.mjs --url=<build>'); process.exit(2); }

const AMMO = [{ k: 'iron', name: 'Iron', n: 12, svg: G.bolt }, { k: 'pitch', name: 'Pitch', n: 4, svg: G.flame }, { k: 'broad', name: 'Broad', n: 0, svg: G.broad }];

/** page-side: hide the BOLTS disc, and an SVG ring-sector path helper */
const prep = (page) => page.evaluate(() => {
  const d = [...document.querySelectorAll('.ws-touch button')].find((b) => b.textContent.trim().toLowerCase() === 'bolts' && b.getBoundingClientRect().width > 0);
  window.__P.hide(d);
  window.__P.sector = (cx, cy, r0, r1, a0, a1) => {
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`, big = a1 - a0 > Math.PI ? 1 : 0;
    return `M${p(r1, a0)} A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)} Z`;
  };
  window.__P.icon = (svg, x, y, s, col) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})" style="color:${col}">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
});

const CHIP = (page, kind) => page.evaluate((k) => { window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => { const t = c.querySelector('.ws-game-weapon'); if (t) t.textContent = `Crossbow · ${k}`; }); }, kind);

const OPTS = [
  { key: 'a', title: 'UI-35 A · An ammo tab on the right edge', sub: 'mirrors HOVER on the left: the loaded kind + count; tap = next kind; no BOLTS disc in the thumb row',
    run: async (page) => { await CHIP(page, 'pitch'); await page.evaluate((a) => {
      const hov = document.querySelector('.ws-touch-hover, [class*=hover]'); const hr = hov ? hov.getBoundingClientRect() : { top: 420, height: 90 };
      const tab = window.__P.add('#hud', `<div style="position:fixed;right:0;width:56px;padding:12px 0 10px;border:1px solid var(--ws-cyan-line);border-right:0;border-radius:14px 0 0 14px;background:var(--ws-glass-deep);color:var(--ws-cyan);text-align:center;font:600 10px var(--ws-display);letter-spacing:.14em;text-transform:uppercase;z-index:50"><i style="display:block;width:22px;height:22px;margin:0 auto 4px">${a[1].svg}</i>Pitch<b style="display:block;font-size:13px;color:#ffd27a">4</b><div style="display:flex;gap:4px;justify-content:center;margin-top:5px"><i style="width:5px;height:5px;border-radius:50%;border:1px solid var(--ws-cyan)"></i><i style="width:5px;height:5px;border-radius:50%;background:var(--ws-cyan)"></i><i style="width:5px;height:5px;border-radius:50%;border:1px solid #ffffff44"></i></div></div>`);
      tab.style.top = `${hr.top}px`;
    }, AMMO); } },
  { key: 'b', title: 'UI-35 B · The right-edge tab opens a column', sub: 'tap the tab: three kinds slide out of the right edge; tap one; it folds back in 2 s',
    run: async (page) => { await CHIP(page, 'iron'); await page.evaluate((a) => {
      const hov = document.querySelector('.ws-touch-hover, [class*=hover]'); const hr = hov ? hov.getBoundingClientRect() : { top: 420, height: 90 };
      const row = (x, on) => `<div style="display:flex;align-items:center;gap:10px;height:46px;padding:0 12px;margin-bottom:6px;border:1px solid ${on ? 'var(--ws-cyan)' : 'var(--ws-cyan-line)'};border-right:0;border-radius:23px 0 0 23px;background:${on ? '#123344ee' : 'var(--ws-glass-deep)'};color:${x.n === 0 ? '#ffffff55' : on ? 'var(--ws-cyan)' : 'var(--ws-text)'};font:600 13px var(--ws-display);letter-spacing:.14em;text-transform:uppercase"><i style="width:20px;height:20px;display:block">${x.svg}</i>${x.name}<b style="margin-left:auto;color:${x.n === 0 ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b></div>`;
      const col = window.__P.add('#hud', `<div style="position:fixed;right:0;width:150px;z-index:50">${a.map((x) => row(x, x.k === 'iron')).join('')}</div>`);
      col.style.top = `${hr.top - 50}px`;
    }, AMMO); } },
  { key: 'c', title: 'UI-35 C · A wheel that drops from the top', sub: 'tap the weapon chip: a half wheel hangs from the top edge; slide onto a kind; the fight stays in view',
    run: async (page) => { await CHIP(page, 'iron'); await page.evaluate((a) => {
      const W = innerWidth, cx = W / 2, cy = 70, r0 = 52, r1 = 150;
      const parts = a.map((x, i) => {
        const a0 = Math.PI * (0.12 + i * 0.253), a1 = a0 + Math.PI * 0.245, mid = (a0 + a1) / 2, on = x.k === 'iron', mr = (r0 + r1) / 2;
        const col = x.n === 0 ? '#ffffff55' : on ? '#8fe3ff' : '#e8f4f8';
        return `<path d="${window.__P.sector(cx, cy, r0, r1, a0, a1)}" fill="${on ? '#16405acc' : '#0b1620d9'}" stroke="${on ? '#8fe3ff' : '#8fe3ff55'}" stroke-width="1.5"/>`
          + window.__P.icon(x.svg, cx + mr * Math.cos(mid), cy + mr * Math.sin(mid) - 10, 24, col)
          + `<text x="${(cx + mr * Math.cos(mid)).toFixed(1)}" y="${(cy + mr * Math.sin(mid) + 18).toFixed(1)}" text-anchor="middle" fill="${col}" style="font:600 11px var(--ws-display);letter-spacing:.14em">${x.name.toUpperCase()} ${x.n}</text>`;
      }).join('');
      window.__P.add('#hud', `<svg style="position:fixed;left:0;top:0;width:${W}px;height:260px;z-index:50;pointer-events:none" viewBox="0 0 ${W} 260"><circle cx="${cx}" cy="${cy}" r="${r0 - 4}" fill="#0b1620e6" stroke="#8fe3ff" stroke-width="1.5"/>${window.__P.icon(a[0].svg, cx, cy + 14, 22, '#8fe3ff')}${parts}</svg>`);
    }, AMMO); } },
  { key: 'd', title: 'UI-35 D · Ammo pips on the FIRE ring', sub: 'three pips on FIRE’s rim, the loaded one lit; swipe up on FIRE to step to the next; nothing new on screen',
    run: async (page) => { await CHIP(page, 'pitch'); await page.evaluate((a) => {
      const f = document.querySelector('.ws-touch-attack');
      const r = f.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 + 2;
      const pips = a.map((x, i) => {
        const ang = -Math.PI / 2 + (i - 1) * 0.62, on = x.k === 'pitch', px = cx + R * Math.cos(ang), py = cy + R * Math.sin(ang);
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${on ? 15 : 12}" fill="${on ? '#16405a' : '#0b1620'}" stroke="${x.n === 0 ? '#ffffff44' : on ? '#ffd27a' : '#8fe3ff88'}" stroke-width="${on ? 2 : 1.2}"/>` + window.__P.icon(x.svg, px, py, on ? 16 : 13, x.n === 0 ? '#ffffff55' : on ? '#ffd27a' : '#8fe3ff');
      }).join('');
      window.__P.add('#hud', `<svg style="position:fixed;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px;z-index:60;pointer-events:none">${pips}<text x="${cx}" y="${(cy - R - 24).toFixed(1)}" text-anchor="middle" fill="#ffd27a" style="font:600 11px var(--ws-display);letter-spacing:.16em">PITCH 4 · SWIPE ↑</text></svg>`);
    }, AMMO); } },
  { key: 'e', title: 'UI-35 E · The ammo lives in the weapon wheel', sub: 'hold the weapon ring (left): the crossbow’s slice opens an outer ring of its three kinds; one wheel for both',
    run: async (page) => { await CHIP(page, 'iron'); await page.evaluate((a) => {
      const hov = document.querySelector('.ws-touch-hover, [class*=hover]'); const hr = hov ? hov.getBoundingClientRect() : { top: 420, bottom: 510 };
      const cx = 0, cy = hr.bottom + 150, r0 = 40, r1 = 118, r2 = 196;
      const W = [['Sabre'], ['Bow'], ['Crossbow']];
      const inner = W.map(([n], i) => {
        const a0 = -Math.PI / 2 + i * (Math.PI / 3), a1 = a0 + Math.PI / 3, mid = (a0 + a1) / 2, on = n === 'Crossbow', mr = (r0 + r1) / 2 + 8;
        return `<path d="${window.__P.sector(cx, cy, r0, r1, a0 + 0.02, a1 - 0.02)}" fill="${on ? '#16405acc' : '#0b1620d9'}" stroke="${on ? '#8fe3ff' : '#8fe3ff55'}" stroke-width="1.5"/>`
          + `<text x="${(cx + mr * Math.cos(mid)).toFixed(1)}" y="${(cy + mr * Math.sin(mid) + 4).toFixed(1)}" text-anchor="middle" fill="${on ? '#8fe3ff' : '#e8f4f8'}" style="font:600 10px var(--ws-display);letter-spacing:.12em">${n.toUpperCase()}</text>`;
      }).join('');
      const outer = a.map((x, i) => {
        const a0 = Math.PI / 6 - 0.32 + i * 0.36, a1 = a0 + 0.34, mid = (a0 + a1) / 2, on = x.k === 'iron', mr = (r1 + r2) / 2 + 4, col = x.n === 0 ? '#ffffff55' : on ? '#ffd27a' : '#e8f4f8';
        return `<path d="${window.__P.sector(cx, cy, r1 + 6, r2, a0, a1)}" fill="${on ? '#3a2c10dd' : '#0b1620d9'}" stroke="${on ? '#ffd27a' : '#ffd27a55'}" stroke-width="1.5"/>`
          + window.__P.icon(x.svg, cx + mr * Math.cos(mid), cy + mr * Math.sin(mid) - 7, 18, col)
          + `<text x="${(cx + mr * Math.cos(mid)).toFixed(1)}" y="${(cy + mr * Math.sin(mid) + 14).toFixed(1)}" text-anchor="middle" fill="${col}" style="font:600 9px var(--ws-display);letter-spacing:.1em">${x.name.toUpperCase()} ${x.n}</text>`;
      }).join('');
      window.__P.add('#hud', `<svg style="position:fixed;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px;z-index:60;pointer-events:none">${inner}${outer}<circle cx="${cx}" cy="${cy}" r="${r0 - 4}" fill="#0b1620e6" stroke="#8fe3ff" stroke-width="1.5"/></svg>`);
    }, AMMO); } },
];

const { browser, PHONE } = await launch();
try {
  const { ctx, page, build, errors } = await open(browser, PHONE, url, 'pine-hollow');
  await pose(page, {}, 2600);
  await page.evaluate(() => { window.__P.holdAll(80); window.__P.clearToasts(); window.__wildshard.combat.equip('crossbow'); });
  await sleep(1500);
  for (const o of OPTS) {
    await clean(page);
    await page.evaluate(() => { window.__P.clearToasts(); });
    await prep(page);
    try { await o.run(page); } catch (e) { console.log('FAIL', o.key, String(e).split('\n')[0]); continue; }
    await sleep(600);
    console.log(o.key, await shoot(page, `ui-35-r2-${o.key}.jpg`, o.title, o.sub, `OPTION (prototype in the live page) · Pine Hollow · build ${build}`, true));
  }
  if (errors.length) console.log('page errors', errors.slice(0, 3));
  await ctx.close();
} finally { await browser.close(); }

const files = OPTS.map((o) => join(OUT, `ui-35-r2-${o.key}.jpg`));
execFileSync('magick', [...files, '-resize', 'x900', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '74', join(OUT, 'ui-35-r2-board.jpg')]);
console.log('board', join(OUT, 'ui-35-r2-board.jpg'));
