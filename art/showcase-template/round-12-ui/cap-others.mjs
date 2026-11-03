#!/usr/bin/env node
// Round 12: the prototypes that need another shard's live component. Nalati Grasslands has the real EliteBar, BossBar
// (name card + letterbox + HOLD TO SKIP), the storm chip and the stealth layer; Pine Hollow has the contract board, the
// crossbow's bolts chip and the weapon pie. Each BEFORE drives the real component; each AFTER edits or extends it.
//
//   scripts/browser-lane.sh --max 30 node art/showcase-template/round-12-ui/cap-others.mjs --url=http://127.0.0.1:<port> [--only=UI-07]
import { launch, open, pose, pair, sleep, arg } from './lib.mjs';
import { G } from './icons.mjs';

const url = arg('url'), only = arg('only').split(',').filter(Boolean);
if (url === '') { console.error('usage: cap-others.mjs --url=<build> [--only=…]'); process.exit(2); }
const want = (id) => only.length === 0 || only.includes(id);
const clearToasts = (page) => page.evaluate(() => { window.__P.clearToasts(); });
const at = async (page) => { await pose(page, {}, 2600); await page.evaluate(() => { window.__P.holdAll(80); window.__P.clearToasts(); }); };

const NALATI = [
  { id: 'UI-07', slug: 'elite-banner', title: 'Named elite: NAMED ELITE · LV n banner + the pinned bar (EB · 19f)',
    setup: async (page) => {
      await at(page);
      await page.evaluate(() => {
        const bar = window.__wildshard.shard['nalati.elites'].bar; const e = window.__wildshard.shard['nalati.elites'].elites?.[0];
        const name = e?.row?.name ?? e?.name ?? 'Qyran', epithet = e?.row?.epithet ?? e?.epithet ?? 'the golden eagle';
        bar.show(name, epithet); bar.banner(name, epithet);
        const b = document.querySelector('.ws-elite-bar'); b.classList.add('pinned'); b.querySelector('.ws-elite-fill').style.transform = 'scaleX(0.82)';
      });
    },
    inject: (page) => page.evaluate(() => {
      const bar = window.__wildshard.shard['nalati.elites'].bar;
      bar.show('Big Pallet', 'Gate elite of band 2'); bar.banner('Big Pallet', 'the band-2 gate');
      const b = document.querySelector('.ws-elite-bar'); b.classList.add('pinned'); b.querySelector('.ws-elite-fill').style.transform = 'scaleX(0.82)';
      const n = b.querySelector('.ws-elite-name'); window.__P.add(n, '<span class="ws-elite-lv">LV 6</span>');
      window.__P.swap(document.querySelector('.ws-elite-banner-kicker'), (c) => { c.textContent = 'NAMED ELITE · LV 6'; });
    }),
    teardown: (page) => page.evaluate(() => { window.__wildshard.shard['nalati.elites'].bar.hide(); document.querySelector('.ws-elite-banner')?.classList.remove('show'); }) },
  { id: 'UI-08', slug: 'boss-bar', title: 'Boss bar with phases: the Crate Titan, LV 20 (EB · E13)',
    setup: async (page) => {
      await at(page);
      await page.evaluate(() => { const ui = window.__wildshard.shard['nalati.boss'].ui; ui.showBar('THE GOLDEN KING', [0.6, 0.3]); ui.setHp(0.52); ui.setPhase(1, 'PHASE II', 0); });
    },
    inject: (page) => page.evaluate(() => {
      const ui = window.__wildshard.shard['nalati.boss'].ui; ui.showBar('THE CRATE TITAN', [0.66, 0.33]); ui.setHp(0.52); ui.setPhase(1, 'PHASE II · THE BLOCKS ROLL', 0);
      const b = ui.bar;
      window.__P.add(ui.barName, '<span class="ws-boss-lv">LV 20</span>');
      window.__P.add(b, '<div class="ws-boss-bar-pips"><i class="done"></i><i></i><i></i></div>');
    }),
    teardown: (page) => page.evaluate(() => { const ui = window.__wildshard.shard['nalati.boss'].ui; ui.hideBar(); document.querySelector('.ws-boss-bar-caption')?.classList.remove('show'); }) },
  { id: 'UI-26', slug: 'cutscene-card', title: 'Boss intro: letterbox, title card, HOLD TO SKIP (exists; Titan content) (19j · EB)',
    setup: async (page) => {
      await at(page);
      await page.evaluate(() => { const ui = window.__wildshard.shard['nalati.boss'].ui; ui.showNameCard('THE GOLDEN KING', 'LORD OF THE GREAT KURGAN'); ui.setSkip(0.35); for (const h of document.querySelectorAll('.ws-touch, .ws-minimap, .ws-quest-obj')) window.__P.hide(h); });
      await sleep(1800);
    },
    inject: async (page) => {
      await page.evaluate(() => { const ui = window.__wildshard.shard['nalati.boss'].ui; ui.showNameCard('THE CRATE TITAN', 'LV 20 · THE LAST CONTRACT', true); ui.setSkip(0.35); });
      await sleep(900);
    },
    teardown: (page) => page.evaluate(() => { window.__wildshard.shard['nalati.boss'].ui.hideNameCard(); }) },
  { id: 'UI-22', slug: 'storm-hour', title: 'Storm hour: one line as it starts (QC · 8 · W11a)',
    setup: async (page) => { await at(page); await page.evaluate(() => { window.__wildshard.world.hud.setWeather({ chip: { title: 'Storm', sub: 'Lightning · get low', tone: 'storm' }, getLow: false }); }); },
    // Jake 11-03: "way too busy … a really more minimalist, lightweight" storm hour. No minimap beacons, no toast, the storm
    // chip unchanged: one centred line as the hour starts (the wave banner's type), fading after ~2 s; the beacons are found
    // by eye in the world, and lighting one flashes the same line (BEACON 2 / 4).
    note: 'fades after ~2 s',
    inject: (page) => page.evaluate(() => { window.__P.swap(document.querySelector('.ws-game-boundary'), (c) => { c.classList.add('wave'); c.querySelector('.ws-game-bt').textContent = 'Storm hour'; const s = c.querySelector('.ws-game-bs'); s.textContent = 'light the four beacons'; s.style.cssText = 'color:#fff;opacity:1;text-shadow:0 1px 2px #000,0 0 8px #000c'; }); }),
    teardown: async (page) => { await page.evaluate(() => { const c = document.querySelector('.ws-game-weather'); c.classList.remove('hour'); for (const k of ['top', 'right', 'left', 'transform']) c.style.removeProperty(k); window.__wildshard.world.hud.setWeather({ chip: null, getLow: false }); }); await clearToasts(page); } },
  { id: 'UI-23', slug: 'stealth-unseen', title: 'Stealth yard: the stealth layer’s hidden state as UNSEEN (exists in Nalati) (QC Keycard)',
    setup: async (page) => {
      await at(page);
      await page.evaluate(() => {
        const EYE = '<svg viewBox="0 0 24 24"><path d="M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        const real = document.querySelector('.ws-stealth-row'); window.__P.realRow = !!real;
        const row = real ? window.__P.swap(real, () => {}) : window.__P.add('.ws-touch-status', '<div class="ws-touch-row ws-stealth-row"><i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span></div>');
        row.dataset.state = 'hidden'; row.querySelector('.ws-stealth-eye').innerHTML = EYE; row.querySelector('.ws-stealth-label').textContent = 'Hidden';
      });
    },
    note: 'the phone’s stealth row',
    inject: (page) => page.evaluate(() => { const r = document.querySelector('.ws-stealth-row[data-proto]'); r.querySelector('.ws-stealth-label').textContent = 'Unseen'; window.__wildshard.world.hud.toast('Keycard · stay unseen · 2 guards on the yard'); }),
    teardown: clearToasts },
];

const pie = (page, items, anchorText = null) => page.evaluate(([list, hub, anchor]) => {
  list.hub = hub;
  const ring = anchor === null ? document.querySelector('.ws-touch-swap') : [...document.querySelectorAll('.ws-touch button')].find((d) => d.textContent.trim().toLowerCase() === anchor && d.getBoundingClientRect().width > 0), layer = document.querySelector('.ws-touch');
  const lr = layer.getBoundingClientRect(), cr = ring.getBoundingClientRect();
  const cx = cr.left + cr.width / 2 - lr.left, cy = Math.min(lr.height - 136, Math.max(136, cr.top + cr.height / 2 - lr.top));
  const R = 128, H = 28, size = R * 2 + 4, n = list.length, span = 180 / n;
  const at = (r, a) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  let wedges = '', labels = '';
  // the strip's pie fans across the right half; anchored on the right edge (the BOLTS disc) it mirrors to the left half
  const left = cx > lr.width / 2, dir = left ? -1 : 1, base = left ? 270 : -90, sw = left ? 0 : 1;
  list.forEach((k, i) => {
    const a0 = (base + dir * i * span) * Math.PI / 180, a1 = (base + dir * (i + 1) * span) * Math.PI / 180, mid = (a0 + a1) / 2, r = (H + R) / 2 + 6;
    wedges += `<path class="ws-touch-pie-wedge${k.held ? ' held' : ''}" d="M ${at(H, a0)} L ${at(R, a0)} A ${R} ${R} 0 0 ${sw} ${at(R, a1)} L ${at(H, a1)} A ${H} ${H} 0 0 ${1 - sw} ${at(H, a0)} Z"/>`;
    labels += `<div class="ws-touch-pie-label${k.held ? ' held' : ''}" style="transform:translate(${(Math.cos(mid) * r).toFixed(1)}px,${(Math.sin(mid) * r).toFixed(1)}px)">${k.svg}<span>${k.name} <b class="${k.n === 0 ? 'empty' : ''}">${k.n}</b></span></div>`;
  });
  const p = window.__P.add(layer, `<div class="ws-touch-pie open" style="left:${cx}px;top:${cy}px"><svg class="ws-touch-pie-disc" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" width="${size}" height="${size}">${wedges}</svg>${labels}<div class="ws-touch-pie-hub">${list.hub ?? ''}</div></div>`);
  void p;
}, [items, items.hub ?? '', anchorText]);

const PINE = [
  { id: 'UI-16', slug: 'contract-board', title: 'Kill-contract board, fixed mode: level-locked rows, first-time trophy + title (E1f · QC5)',
    setup: async (page) => {
      await at(page);
      await pose(page, { x: -166, z: -110, yaw: Math.atan2(3, 4), pitch: 0 }, 2400);
      const r = await page.evaluate(() => { const i = window.__wildshard.world.interactables.find((x) => x.label === 'Read the contract board'); if (!i) return 'none'; i.onInteract(); return 'interactable'; });
      console.log('board via', r);
      await sleep(1500);
    },
    inject: (page) => page.evaluate(() => {
      const board = document.querySelector('.ws-ph-board.show');
      window.__P.swap(board, (c) => {
        c.querySelector('.ws-ph-kicker').textContent = 'The gate plaza'; c.querySelector('.ws-ph-title').textContent = 'Kill contracts';
        c.querySelector('.ws-ph-tally').innerHTML = '<span>Done 2 / 13</span><span>Titles 1</span><span>LV 7</span>';
        const N = [
          ['Count · band 3', 'Drone Season', 'Down 20 Plumb Drones', 8, 20, 'Pays 70 Scrip · first time: a trophy and the title Drone Ranger', '', -1.2],
          ['Elite · LV 6', 'Big Pallet', 'Down the band-2 gate elite', 1, 1, 'Claimed · title Forklift Certified', 'done', 0.8],
          ['Elite · LV 12', 'The Vault Warden', 'Opens at LV 12', 0, 1, 'Pays 300 Scrip · title Plate Expectations', 'locked', -0.5],
        ];
        const body = c.querySelector('.ws-ph-body'), foot = c.querySelector('.ws-ph-foot');
        for (const n of body.querySelectorAll('.ws-ph-note')) n.remove();
        for (const [kind, title, goal, have, need, pay, st, tilt] of N) {
          const d = document.createElement('div'); d.className = 'ws-ph-note'; d.style.setProperty('--tilt', tilt + 'deg');
          if (st === 'locked') d.style.filter = 'grayscale(1) brightness(0.62)';
          const shown = Math.min(need, 5), lit = Math.round(shown * have / need);
          const cells = Array.from({ length: shown }, (_, i) => '<i class="' + (i < lit ? 'on' : '') + '"></i>').join('');
          const count = st === 'locked' ? 'LV 12' : have + ' / ' + need;
          const btn = st === 'done' ? 'Claimed' : st === 'locked' ? 'Locked' : 'Track';
          d.innerHTML = '<i class="ws-ph-pin"></i><div class="ws-ph-note-kind">' + kind + '</div><div class="ws-ph-note-title">' + title + '</div><div class="ws-ph-note-goal">' + goal + '</div><div class="ws-ph-note-bar">' + cells + '<b class="ws-ph-note-count">' + count + '</b></div><div class="ws-ph-note-pay">' + pay + '</div><div class="ws-ph-note-row"><button class="ws-ph-tear" type="button">' + btn + '</button></div>';
          foot.before(d);
        }
        foot.textContent = 'A fixed list, opened by level. The first clear pays a trophy and a joke title; repeats pay Scrip and parts.';
      });
    }),
    teardown: (page) => page.evaluate(() => { for (const b of document.querySelectorAll('.ws-ph-board.show .ws-ph-close')) b.click(); }) },
  { id: 'UI-35', slug: 'ammo-pouch', title: 'Crossbow ammo: pouch counters + the ammo picker (iron / pitch / broadhead) (W3b · D17 / D18)',
    setup: async (page) => { await at(page); await page.evaluate(() => { window.__wildshard.combat.equip('crossbow'); }); await sleep(1500); await clearToasts(page); },
    inject: async (page) => {
      await page.evaluate(() => {
        window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => { const t = c.querySelector('.ws-game-weapon'); if (t) t.textContent = 'Crossbow · iron'; });
        // the pouch: a status row under the bolts chip (hudSlots.row), one counter a kind, never pack slots (D17)
        const row = window.__P.add('.ws-touch-status', '<div class="ws-touch-row ws-game-pouch"><span class="on">IRON<b>12</b></span><span>PITCH<b>4</b></span><span>BROAD<b>0</b></span></div>');
        document.querySelector('.ws-game-bolts[data-proto]').after(row);
      });
      const list = [{ name: 'Iron', n: 12, held: true, svg: G.bolt }, { name: 'Pitch', n: 4, svg: G.flame }, { name: 'Broadhead', n: 0, svg: G.broad }];
      list.hub = G.bolt; await pie(page, list, 'bolts');
    } },
];

// the range's loaner: Nalati's real weapon pie (a long press on the SWAP ring), the lent wedges tagged
let cdp = null;
const swapPress = async (page, down) => {
  const r = await page.evaluate(() => { const b = document.querySelector('.ws-touch-swap').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  cdp ??= await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchCancel', touchPoints: down ? [{ x: r.x, y: r.y, id: 1 }] : [] });
};
NALATI.push({ id: 'UI-37', slug: 'range-loaner', title: 'The range lends every weapon inside its fence (W3a · D2)',
  setup: async (page) => { await at(page); await page.evaluate(() => { window.__wildshard.combat.equip('sabre'); }); await sleep(1200); await clearToasts(page); await swapPress(page, true); await sleep(700); },
  inject: async (page) => {
    const opened = await page.evaluate(() => {
      const p = document.querySelector('.ws-touch-pie.open'); if (!p) return false;
      for (const l of p.querySelectorAll('.ws-touch-pie-label')) if (!/sabre/i.test(l.textContent)) window.__P.add(l, '<span class="loan">LOAN</span>');
      return true;
    });
    console.log('real pie open', opened);
    await page.evaluate(() => { window.__wildshard.world.hud.toast('The range lends every weapon inside its fence · they go back at the gate'); });
    await sleep(400);
  }, teardown: async (page) => { await swapPress(page, false); await clearToasts(page); } });

const { browser, PHONE } = await launch();
try {
  for (const [slug, shard, items] of [['nalati-grasslands', 'Nalati Grasslands', NALATI], ['pine-hollow', 'Pine Hollow', PINE]]) {
    if (!items.some((i) => want(i.id))) continue;
    const { ctx, page, build, errors } = await open(browser, PHONE, url, slug);
    const c = { page, build, shard };
    for (const item of items) {
      if (!want(item.id)) continue;
      try { await pair(c, item); } catch (e) { console.log('FAIL', item.id, String(e).slice(0, 300)); }
    }
    const dump = await page.evaluate(() => window.__P.dump ?? null);
    if (dump) console.log('DUMP', dump.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>'));
    if (errors.length) console.log('page errors', errors.slice(0, 5));
    await ctx.close();
  }
} finally { await browser.close(); }
