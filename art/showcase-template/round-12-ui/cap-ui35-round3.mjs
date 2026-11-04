#!/usr/bin/env node
// UI-35 round 3 (Jake 11-03: "option C has a lot of potential … I want to see a lot more variants of something like
// option C … the way you did it is quite chaotic … we have a whole ammunition thing there that can be tapped … We could
// also just … change ammunition in the menu. Show me … where in the menu"). Two boards, Pine Hollow, the crossbow:
//   ui-35-r3-c{1..5}.jpg: tap the weapon chip (top left), five calmer ways to pick the ammo from there;
//   ui-35-r3-m{1,2}.jpg: the ammo set in the bag (GEAR sub-tab, or the PACK tab's pouch).
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-ui35-round3.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, pose, clean, shoot, sleep, arg, OUT } from './lib.mjs';
import { G } from './icons.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-ui35-round3.mjs --url=<build>'); process.exit(2); }
const AMMO = [{ k: 'iron', name: 'Iron', n: 12, what: 'plain bolt', svg: G.bolt }, { k: 'pitch', name: 'Pitch', n: 4, what: 'sets them alight', svg: G.flame }, { k: 'broad', name: 'Broadhead', n: 0, what: 'bleeds · none left', svg: G.broad }];

/** hide the BOLTS disc; mark the chip as pressed; return its rect */
const prep = (page, pressed = true) => page.evaluate((p) => {
  const d = [...document.querySelectorAll('.ws-touch button')].find((b) => b.textContent.trim().toLowerCase() === 'bolts' && b.getBoundingClientRect().width > 0);
  window.__P.hide(d);
  const c = window.__P.swap(document.querySelector('.ws-game-bolts'), (x) => { const t = x.querySelector('.ws-game-weapon'); if (t) t.textContent = 'Crossbow · iron'; if (p) { x.style.borderColor = 'var(--ws-cyan)'; x.style.boxShadow = '0 0 12px #8fe3ff88'; } });
  window.__P.icon = (svg, s, col) => `<i style="display:block;flex:none;width:${s}px;height:${s}px;color:${col}">${svg}</i>`;
  const r = c.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
}, pressed);

const C = [
  { key: 'c1', title: 'UI-35 C1 · Tap the chip: a short list drops under it', sub: 'three rows hang from the weapon chip (kind · what it does · count); tap one; it folds up',
    run: async (page) => { const r = await prep(page); await page.evaluate(([r, a]) => {
      const row = (x) => { const on = x.k === 'iron', dead = x.n === 0; return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #8fe3ff1f;${on ? 'background:#8fe3ff1c;' : ''}color:${dead ? '#ffffff55' : on ? 'var(--ws-cyan)' : 'var(--ws-text)'}">${window.__P.icon(x.svg, 20, 'currentColor')}<span style="flex:1"><b style="display:block;font:600 13px var(--ws-display);letter-spacing:.12em;text-transform:uppercase">${x.name}</b><span style="font-size:10px;letter-spacing:.08em;color:var(--ws-text-dim)">${x.what}</span></span><b style="font:700 15px var(--ws-display);color:${dead ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b>${on ? '<span style="font-size:9px;letter-spacing:.18em;color:var(--ws-cyan)">LOADED</span>' : ''}</div>`; };
      const box = window.__P.add('#hud', `<div style="position:fixed;z-index:60;width:${Math.max(250, r.w)}px;border:1px solid var(--ws-cyan);background:#0a1620f2;box-shadow:0 8px 24px #000a">${a.map(row).join('')}</div>`);
      box.style.left = `${r.l}px`; box.style.top = `${r.b + 4}px`;
    }, [r, AMMO]); } },
  { key: 'c2', title: 'UI-35 C2 · Tap the chip: three tiles slide out beside it', sub: 'one row along the top, right of the chip; icon + count; the loaded one lit; tap one',
    run: async (page) => { const r = await prep(page); await page.evaluate(([r, a]) => {
      const tile = (x) => { const on = x.k === 'iron', dead = x.n === 0; return `<div style="width:62px;padding:7px 0 5px;text-align:center;border:1px solid ${on ? 'var(--ws-cyan)' : '#8fe3ff40'};background:${on ? '#123344f2' : '#0a1620e6'};color:${dead ? '#ffffff55' : on ? 'var(--ws-cyan)' : 'var(--ws-text)'}">${window.__P.icon(x.svg, 20, 'currentColor').replace('display:block', 'display:block;margin:0 auto 3px')}<b style="font:700 13px var(--ws-display);color:${dead ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b><div style="font-size:8px;letter-spacing:.14em;text-transform:uppercase">${x.name}</div></div>`; };
      const strip = window.__P.add('#hud', `<div style="position:fixed;z-index:60;display:flex;gap:4px">${a.map(tile).join('')}</div>`);
      strip.style.left = `${r.l}px`; strip.style.top = `${r.b + 6}px`;
    }, [r, AMMO]); } },
  { key: 'c3', title: 'UI-35 C3 · Tap the chip: a quarter wheel from the corner', sub: 'three wedges fan out from the top-left corner around the chip; slide onto one and let go',
    run: async (page) => { const r = await prep(page); await page.evaluate(([r, a]) => {
      const cx = r.l + 10, cy = r.t + 6, r0 = 70, r1 = 190;
      const sec = (a0, a1) => { const p = (rr, aa) => `${(cx + rr * Math.cos(aa)).toFixed(1)} ${(cy + rr * Math.sin(aa)).toFixed(1)}`; return `M${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`; };
      const parts = a.map((x, i) => { const a0 = 0.08 + i * 0.48, a1 = a0 + 0.46, m = (a0 + a1) / 2, mr = (r0 + r1) / 2, on = x.k === 'iron', dead = x.n === 0, col = dead ? '#ffffff55' : on ? '#8fe3ff' : '#e8f4f8';
        const px = cx + mr * Math.cos(m), py = cy + mr * Math.sin(m);
        return `<path d="${sec(a0, a1)}" fill="${on ? '#16405af0' : '#0a1620eb'}" stroke="${on ? '#8fe3ff' : '#8fe3ff55'}" stroke-width="1.5"/><foreignObject x="${px - 40}" y="${py - 22}" width="80" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;color:${col};font:600 11px var(--ws-display);letter-spacing:.12em"><i style="display:block;width:18px;height:18px;margin:0 auto 2px">${x.svg}</i>${x.name.toUpperCase()} <b style="color:${dead ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b></div></foreignObject>`; }).join('');
      window.__P.add('#hud', `<svg style="position:fixed;left:0;top:0;width:${innerWidth}px;height:${innerHeight}px;z-index:60;pointer-events:none">${parts}</svg>`);
    }, [r, AMMO]); } },
  { key: 'c4', title: 'UI-35 C4 · Tap the chip: one card at the top, the fight dims', sub: 'a single card of three big choices under the top bar; the world dims (and slows) until you pick',
    run: async (page) => { await prep(page); await page.evaluate((a) => {
      window.__P.add('#hud', '<div style="position:fixed;inset:0;z-index:55;background:#02080dcc;pointer-events:none"></div>');
      const tile = (x) => { const on = x.k === 'iron', dead = x.n === 0; return `<div style="flex:1;padding:14px 0 10px;text-align:center;border:1px solid ${on ? 'var(--ws-cyan)' : '#8fe3ff40'};background:${on ? '#123344' : '#0d1a24'};color:${dead ? '#ffffff55' : on ? 'var(--ws-cyan)' : 'var(--ws-text)'}">${window.__P.icon(x.svg, 30, 'currentColor').replace('display:block', 'display:block;margin:0 auto 6px')}<div style="font:600 13px var(--ws-display);letter-spacing:.12em;text-transform:uppercase">${x.name}</div><b style="font:700 18px var(--ws-display);color:${dead ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b><div style="font-size:9px;letter-spacing:.06em;color:var(--ws-text-dim);margin-top:2px">${x.what}</div></div>`; };
      window.__P.add('#hud', `<div style="position:fixed;z-index:60;left:14px;right:14px;top:150px;padding:12px;border:1px solid var(--ws-cyan);background:#0a1620f5"><div style="font-size:10px;letter-spacing:.26em;color:var(--ws-cyan-dim);text-transform:uppercase;margin-bottom:10px">Crossbow · load</div><div style="display:flex;gap:8px">${a.map(tile).join('')}</div></div>`);
    }, AMMO); } },
  { key: 'c5', title: 'UI-35 C5 · Tap the chip to step to the next kind', sub: 'nothing opens: each tap on the chip loads the next kind (empty skipped); the chip shows all three',
    run: async (page) => { await prep(page, false); await page.evaluate((a) => {
      window.__P.swap(document.querySelector('.ws-game-bolts[data-proto]'), (c) => {
        c.style.pointerEvents = 'auto'; c.style.borderColor = 'var(--ws-cyan)';
        const t = c.querySelector('.ws-game-weapon'); if (t) t.innerHTML = 'Crossbow · <span style="color:#ffd27a">pitch</span>';
        const pips = document.createElement('span'); pips.style.cssText = 'display:inline-flex;gap:5px;margin-left:8px;align-items:center';
        pips.innerHTML = a.map((x) => `<i style="display:block;width:14px;height:14px;color:${x.n === 0 ? '#ffffff44' : x.k === 'pitch' ? '#ffd27a' : '#8fe3ff88'}">${x.svg}</i>`).join('');
        c.append(pips);
      });
      const r = document.querySelector('.ws-game-bolts[data-proto]:not([style*="display: none"])').getBoundingClientRect();
      const hint = window.__P.add('#hud', '<div style="position:fixed;z-index:60;font-size:9px;letter-spacing:.2em;color:var(--ws-cyan-dim);text-transform:uppercase">tap to switch ammo</div>');
      hint.style.left = `${r.left + 4}px`; hint.style.top = `${r.bottom + 5}px`;
    }, AMMO); } },
];

/** the bag as UI-10 left it: five tabs, CHARACTER / GEAR sub-tabs */
const fiveTabs = (page, active) => page.evaluate((act) => {
  const tabs = document.querySelector('.ws-gmenu-tabs'), gear = tabs.querySelector('[data-tab=gear]');
  const t = document.createElement('div');
  t.innerHTML = `<button class="ws-gmenu-tab${act === 'character' ? ' active' : ''}" type="button" data-tab="character"><i class="ws-gmenu-ticon"><svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="18" r="11"/><path d="M10 58 C10 40 20 32 32 32 C44 32 54 40 54 58 Z"/></svg></i><span class="ws-gmenu-tword">Character</span></button>`;
  const ch = t.firstElementChild; ch.dataset.proto = '1'; gear.after(ch); window.__P.gone(gear);
  if (act === 'character') for (const b of tabs.querySelectorAll('.ws-gmenu-tab.active')) if (b !== ch) window.__P.cls(b, [], ['active']);
}, active);

const ammoRows = (a) => a.map((x) => { const on = x.k === 'iron', dead = x.n === 0; return `<div style="display:flex;align-items:center;gap:12px;padding:11px 12px;margin-top:6px;border:1px solid ${on ? 'var(--ws-cyan)' : '#8fe3ff26'};background:${on ? '#8fe3ff14' : '#ffffff05'};color:${dead ? '#ffffff55' : 'var(--ws-text)'}"><i style="display:block;width:24px;height:24px;color:${dead ? '#ffffff55' : on ? 'var(--ws-cyan)' : '#e8f4f8'}">${x.svg}</i><span style="flex:1"><b style="display:block;font:600 14px var(--ws-display);letter-spacing:.1em;text-transform:uppercase">${x.name}</b><span style="font-size:10px;letter-spacing:.06em;color:var(--ws-text-dim)">${x.what}</span></span><b style="font:700 16px var(--ws-display);color:${dead ? '#ff9a7a88' : '#ffd27a'}">${x.n}</b><span style="width:68px;text-align:center;padding:5px 0;font-size:9px;letter-spacing:.18em;border:1px solid ${on ? 'var(--ws-cyan)' : '#ffffff30'};color:${on ? 'var(--ws-cyan)' : dead ? '#ffffff44' : '#c9ccd1'}">${on ? 'LOADED' : dead ? 'EMPTY' : 'LOAD'}</span></div>`; }).join('');

const M = [
  { key: 'm1', title: 'UI-35 M1 · In the bag: CHARACTER ▸ GEAR, under the crossbow', sub: 'tap the held crossbow: its ammo opens under it; LOAD one; no ammo control in the fight HUD',
    run: async (page) => {
      await page.evaluate(() => { window.__wildshard.world.hud.menu.open('gear'); }); await sleep(1300);
      await fiveTabs(page, 'character');
      await page.evaluate((rows) => {
        const panel = document.querySelector('.ws-gmenu-panel.active');
        for (const k of [...panel.children]) window.__P.gone(k);
        window.__P.add(panel, `<div style="overflow:auto;height:100%"><div style="display:flex;gap:8px;margin:0 0 14px"><span style="flex:1;text-align:center;padding:9px 0;font-size:13px;letter-spacing:.22em;border:1px solid #ffffff26;color:#c9ccd1">CHARACTER</span><span style="flex:1;text-align:center;padding:9px 0;font-size:13px;letter-spacing:.22em;border:1px solid var(--ws-cyan);color:var(--ws-cyan);background:#7fd8ff1a">GEAR</span></div>
          <div class="ws-gmenu-label">Held</div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--ws-cyan);background:#8fe3ff10"><svg viewBox="0 0 64 64" style="width:40px;height:40px;flex:none" fill="none" stroke="#e8f4f8" stroke-width="4" stroke-linecap="round"><path d="M8 20 C20 10 44 10 56 20"/><path d="M8 20 L32 32 L56 20"/><path d="M32 14 V58"/></svg><span style="flex:1"><b style="display:block;font:700 17px var(--ws-display);letter-spacing:.08em;color:var(--ws-text)">CROSSBOW</b><span style="font-size:10px;letter-spacing:.1em;color:var(--ws-text-dim)">30 / 30 BOLTS · TIER II</span></span><span style="padding:5px 9px;font-size:9px;letter-spacing:.18em;border:1px solid var(--ws-cyan);color:var(--ws-cyan)">HELD</span></div>
          <div class="ws-gmenu-label" style="margin-top:16px">Ammo · loads into the crossbow</div>${rows}
          <div class="ws-gmenu-label" style="margin-top:18px">Other weapons</div>
          <div style="display:flex;gap:8px"><span style="flex:1;padding:14px 0;text-align:center;border:1px dashed #8fe3ff40;font:600 12px var(--ws-display);letter-spacing:.12em;color:var(--ws-text-dim)">SABRE</span><span style="flex:1;padding:14px 0;text-align:center;border:1px dashed #8fe3ff40;font:600 12px var(--ws-display);letter-spacing:.12em;color:var(--ws-text-dim)">BOW</span><span style="flex:1;padding:14px 0;text-align:center;border:1px dashed #8fe3ff40;font:600 12px var(--ws-display);letter-spacing:.12em;color:var(--ws-text-dim)">HOVERBOARD</span></div></div>`);
      }, ammoRows(AMMO));
    } },
  // m2 (PACK): Pine Hollow’s bag would not switch to PACK in the harness, so the menu option is shown in GEAR only
];

const { browser, PHONE } = await launch();
try {
  const { ctx, page, build, errors } = await open(browser, PHONE, url, 'pine-hollow');
  await pose(page, {}, 2600);
  await page.evaluate(() => { window.__P.holdAll(80); window.__P.clearToasts(); window.__wildshard.combat.equip('crossbow'); });
  await sleep(1500);
  for (const o of [...C, ...M]) {
    await clean(page);
    await page.evaluate(() => { window.__P.clearToasts(); });
    try { await o.run(page); } catch (e) { console.log('FAIL', o.key, String(e).split('\n')[0]); continue; }
    await sleep(600);
    console.log(o.key, await shoot(page, `ui-35-r3-${o.key}.jpg`, o.title, o.sub, `OPTION (prototype in the live page) · Pine Hollow · build ${build}`, true));
    if (o.key.startsWith('m')) { await page.evaluate(() => { window.__wildshard.world.hud.menu.close(); }); await sleep(600); }
  }
  if (errors.length) console.log('page errors', errors.slice(0, 3));
  await ctx.close();
} finally { await browser.close(); }

for (const [name, list] of [['c', C], ['m', M]]) {
  const files = list.map((o) => join(OUT, `ui-35-r3-${o.key}.jpg`));
  execFileSync('magick', [...files, '-resize', 'x900', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '74', join(OUT, `ui-35-r3-${name}-board.jpg`)]);
  console.log('board', `ui-35-r3-${name}-board.jpg`);
}
