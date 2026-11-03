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
      const b = document.querySelector('.ws-boss-bar');
      window.__P.add(b.querySelector('.ws-boss-bar-name'), '<span class="ws-boss-lv">LV 20</span>');
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
  { id: 'UI-22', slug: 'storm-hour', title: 'Storm hour: the storm chip as STORM HOUR + four beacons on the minimap (QC · 8 · W11a)',
    setup: async (page) => { await at(page); await page.evaluate(() => { window.__wildshard.world.hud.setWeather({ chip: { title: 'Storm', sub: 'Lightning · get low', tone: 'storm' }, getLow: false }); }); },
    inject: async (page) => {
      await page.evaluate(() => {
        window.__wildshard.world.hud.setWeather({ chip: { title: 'Storm hour', sub: 'Lights Out · beacons 1 / 4', tone: 'storm' }, getLow: false });
        document.querySelector('.ws-game-weather').classList.add('hour');
        const mm = document.querySelector('.ws-minimap'), w = mm.getBoundingClientRect().width;
        for (const [x, y, lit] of [[0.3, 0.28, true], [0.74, 0.34, false], [0.26, 0.72, false], [0.7, 0.76, false]]) { const b = window.__P.add(mm, `<i class="ws-minimap-beacon${lit ? ' lit' : ''}"></i>`); b.style.left = `${x * w}px`; b.style.top = `${y * w}px`; }
        window.__wildshard.world.hud.toast('Lights Out · beacon 1 lit · the storm holds until all four burn');
        window.__P.restack(document.querySelector('.ws-game-weather'));
      });
      await sleep(400);
    },
    teardown: async (page) => { await page.evaluate(() => { const c = document.querySelector('.ws-game-weather'); c.classList.remove('hour'); for (const k of ['top', 'right', 'left', 'transform']) c.style.removeProperty(k); window.__wildshard.world.hud.setWeather({ chip: null, getLow: false }); }); await clearToasts(page); } },
  { id: 'UI-23', slug: 'stealth-unseen', title: 'Stealth yard: the stealth layer’s hidden state as UNSEEN (exists in Nalati) (QC Keycard)',
    setup: async (page) => {
      await at(page);
      await page.evaluate(() => {
        const real = document.querySelector('.ws-stealth'); if (real) window.__P.hide(real);
        window.__P.protoStealth = true;
        const s = window.__P.add('#hud', '<div class="ws-stealth"><div class="ws-stealth-vig"></div><div class="ws-stealth-pip"><i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span></div><div class="ws-stealth-chev"></div></div>');
        s.dataset.state = 'hidden'; s.querySelector('.ws-stealth-label').textContent = 'Hidden';
        s.querySelector('.ws-stealth-eye').innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      });
    },
    inject: (page) => page.evaluate(() => { const s = document.querySelector('.ws-stealth[data-proto]'); s.querySelector('.ws-stealth-label').textContent = 'Unseen'; window.__wildshard.world.hud.toast('Keycard · stay unseen · 2 guards on the yard'); }),
    teardown: clearToasts },
];

const pie = (page, items, anchorText = null) => page.evaluate(([list, hub, anchor]) => {
  list.hub = hub;
  const ring = anchor === null ? document.querySelector('.ws-touch-swap') : [...document.querySelectorAll('.ws-touch-disc')].find((d) => d.textContent.trim().toLowerCase() === anchor), layer = document.querySelector('.ws-touch');
  const lr = layer.getBoundingClientRect(), cr = ring.getBoundingClientRect();
  const cx = cr.left + cr.width / 2 - lr.left, cy = Math.min(lr.height - 136, Math.max(136, cr.top + cr.height / 2 - lr.top));
  const R = 128, H = 28, size = R * 2 + 4, n = list.length, span = 180 / n;
  const at = (r, a) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  let wedges = '', labels = '';
  list.forEach((k, i) => {
    const a0 = (-90 + i * span) * Math.PI / 180, a1 = (-90 + (i + 1) * span) * Math.PI / 180, mid = (a0 + a1) / 2, r = (H + R) / 2 + 6;
    wedges += `<path class="ws-touch-pie-wedge${k.held ? ' held' : ''}" d="M ${at(H, a0)} L ${at(R, a0)} A ${R} ${R} 0 0 1 ${at(R, a1)} L ${at(H, a1)} A ${H} ${H} 0 0 0 ${at(H, a0)} Z"/>`;
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
      const board = document.querySelector('.ws-ph-board.show') ?? document.querySelector('[class*=board].show');
      window.__P.dump = board?.outerHTML.slice(0, 3000);
      window.__P.swap(board, (c) => { c.dataset.protoBoard = '1'; });
    }) },
  { id: 'UI-35', slug: 'ammo-pouch', title: 'Crossbow ammo: pouch counters + the ammo picker (iron / pitch / broadhead) (W3b · D17 / D18)',
    setup: async (page) => { await at(page); await page.evaluate(() => { window.__wildshard.combat.equip('crossbow'); }); await sleep(1500); await clearToasts(page); },
    inject: async (page) => {
      await page.evaluate(() => {
        window.__P.swap(document.querySelector('.ws-game-bolts'), (c) => {
          const t = c.querySelector('.ws-game-weapon'); if (t) t.textContent = 'Crossbow · iron';
          const pouch = document.createElement('span'); pouch.className = 'ws-game-pouch';
          pouch.innerHTML = '<span class="on">IRON<b>12</b></span><span>PITCH<b>4</b></span><span>BROAD<b>0</b></span>';
          c.append(pouch);
        });
      });
      const list = [{ name: 'Iron', n: 12, held: true, svg: G.bolt }, { name: 'Pitch', n: 4, svg: G.flame }, { name: 'Broadhead', n: 0, svg: G.broad }];
      list.hub = G.bolt; await pie(page, list, 'bolts');
    } },
];

// the range's loaner: Nalati's real weapon pie (a long press on the SWAP ring), the lent wedges tagged
const swapPress = (page, down) => page.evaluate((d) => {
  const ring = document.querySelector('.ws-touch-swap'), r = ring.getBoundingClientRect();
  ring.dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointercancel', { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}, down);
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
