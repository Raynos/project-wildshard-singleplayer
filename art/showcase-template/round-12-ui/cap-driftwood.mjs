#!/usr/bin/env node
// Round 12: the Kitchen Sink v2 UI changes prototyped in a live Driftwood Isle page (the closest look to the showcase's
// polished toon). Driftwood's crabs stand in for the showcase robots; the names and numbers are the showcase's.
//
//   scripts/serve-build.sh --head --name ks-ui-r12                       → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 30 node art/showcase-template/round-12-ui/cap-driftwood.mjs --url=http://127.0.0.1:<port> [--only=UI-01,UI-04]
import { launch, open, pose, pair, sleep, arg } from './lib.mjs';
import { G } from './icons.mjs';

const url = arg('url'), only = arg('only').split(',').filter(Boolean);
if (url === '') { console.error('usage: cap-driftwood.mjs --url=<build> [--only=UI-01,…]'); process.exit(2); }

const BEACH = { x: 134, z: 1, yaw: 0, pitch: -0.12 };
const CAMP = { x: -20, z: -84, yaw: Math.atan2(-(-22 + 20), -(-72.85 + 84)), pitch: -0.04 }; // facing between Wendell and Maren
const PIER = { x: 0, y: 1.3, z: -194, yaw: Math.PI, pitch: 0 };
const WENDELL = { x: -19.6, z: -69.6, yaw: Math.atan2(0, 2.6), pitch: -0.1 }; // 2.6 m in front of him: his real talk prompt

const atBeach = async (page) => { await pose(page, BEACH, 2600); await page.evaluate(() => { window.__P.holdAll(40); window.__P.clearToasts(); }); };
/** the crab pack seen across its long axis, so six plates spread out (a fight read from the side, 7 m off) */
const atSpread = async (page) => {
  const p = await page.evaluate(() => {
    const cs = window.__wildshard.world.animals.animals.filter((a) => a.alive && a.kind === 'crab' && Math.hypot(a.position.x - 134, a.position.z + 8) < 16);
    const mx = cs.reduce((s, a) => s + a.position.x, 0) / cs.length, mz = cs.reduce((s, a) => s + a.position.z, 0) / cs.length;
    let xx = 0, zz = 0, xz = 0; for (const a of cs) { const dx = a.position.x - mx, dz = a.position.z - mz; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
    const ang = 0.5 * Math.atan2(2 * xz, xx - zz), nx = -Math.sin(ang), nz = Math.cos(ang);
    const cand = [1, -1].map((s) => ({ x: mx + s * nx * 7.5, z: mz + s * nz * 7.5 }));
    const c = cand.sort((a, b) => Math.hypot(a.x - 134, a.z - 1) - Math.hypot(b.x - 134, b.z - 1))[0]; // the beach side
    return { x: c.x, z: c.z, yaw: Math.atan2(-(mx - c.x), -(mz - c.z)), pitch: -0.2 };
  });
  await pose(page, p, 2600); await page.evaluate(() => { window.__P.holdAll(40); window.__P.clearToasts(); });
};
const atPier = async (page) => { await pose(page, PIER, 2600); await page.evaluate(() => { window.__P.clearToasts(); }); };
const atCamp = async (page) => { await pose(page, CAMP, 2600); await page.evaluate(() => { window.__P.holdAll(60); window.__P.clearToasts(); }); };
const clearToasts = (page) => page.evaluate(() => { window.__P.clearToasts(); });
const menu = async (page, tab) => { await page.evaluate((t) => { window.__wildshard.world.hud.menu.open(t); }, tab); await sleep(1300); };
const closeMenu = async (page) => { await page.evaluate(() => { window.__wildshard.world.hud.menu.close(); }); await sleep(600); };
const weather = (page, chip) => page.evaluate((c) => { window.__wildshard.world.hud.setWeather({ chip: c, getLow: false }); }, chip);
/** the real weather chip with a prototype icon; `null` hides it again */
const chipWith = async (page, chip, iconSvg, extra = []) => {
  await weather(page, chip);
  await page.evaluate(([svg, cls]) => {
    const c = document.querySelector('.ws-game-weather'); if (!c) return;
    for (const k of cls) c.classList.add(k); c.dataset.protoChip = cls.join(' ');
    const i = c.querySelector('.ws-game-wicon'); window.__P.stormIcon ??= i.innerHTML; i.innerHTML = svg;
    window.__P.restack(c);
  }, [iconSvg, extra]);
};
const chipOff = async (page) => {
  await page.evaluate(() => {
    const c = document.querySelector('.ws-game-weather'); if (!c) return;
    const i = c.querySelector('.ws-game-wicon'); if (i && window.__P.stormIcon) i.innerHTML = window.__P.stormIcon;
    for (const k of (c.dataset.protoChip ?? '').split(' ').filter(Boolean)) c.classList.remove(k);
    delete c.dataset.protoChip; for (const k of ['top', 'right', 'left', 'transform']) c.style.removeProperty(k);
    document.querySelector('.ws-game-toasts')?.style.removeProperty('--ws-toast-top');
  });
  await weather(page, null);
};

// ── the bottom meter (UI-01), reused by the later levelled shots ──
const meterHtml = (frac, lv, xp, flash = false) => `
  <div class="ws-game-meter${flash ? ' flash' : ''}"><i style="width:${(frac * 100).toFixed(1)}%"></i>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<u style="left:${k * 10}%"></u>`).join('')}</div>`;
const meterChip = (lv, xp, flip = false) => `<div class="ws-game-meter-chip${flip ? ' flip' : ''}"><b><small>LV</small>${lv}</b><span>${xp}</span></div>`;
const addMeter = (page, frac, lv, xp, o = {}) => page.evaluate(([m, c]) => { const t = document.querySelector('.ws-touch'); window.__P.add(t, m); window.__P.add(t, c); },
  [meterHtml(frac, lv, xp, o.flash), meterChip(lv, xp, o.flip)]);

// ── nameplates: a prototype layer over the crabs (the real Combat layer hidden under it) ──
const PLATES = [
  { lv: 6, con: 'yellow', name: 'Pallet Jack', hp: 0.55, stagger: 0.62, status: 'burn' },
  { lv: 7, con: 'orange', name: 'Plumb Drone', hp: 1, stagger: 0, rare: true },
  { lv: 4, con: 'green', name: 'Pallet Jack', hp: 1, stagger: 0 },
  { lv: 9, con: 'red', name: 'Plumb Drone', hp: 0.8, stagger: 0.2, status: 'shock' },
  { lv: 2, con: 'grey', name: 'Crate Mite', hp: 1, stagger: 0, grey: true },
  { lv: 12, con: 'skull', name: 'Welder Unit', hp: 1, stagger: 0 },
];
const plates = (page, rows) => page.evaluate((list) => {
  window.__P.hide(document.querySelector('.ws-combat-layer'));
  const layer = window.__P.add('#hud', '<div class="ws-combat-layer"></div>');
  // nearest first, skipping a crab whose plate would sit on one already placed (the pool keeps the nearest six)
  const placed = [];
  for (const c of window.__P.visible('crab')) { if (placed.length < list.length && placed.every((q) => Math.abs(q.p.x - c.p.x) > 124 || Math.abs(q.p.y - c.p.y) > 40)) placed.push(c); }
  window.__P.placed = placed;
  list.forEach((r, i) => {
    const c = placed[i]; if (!c) return;
    const p = c.p;
    const cls = ['ws-combat-hp', 'lvl', 'show', r.hp < 0.5 ? 'low' : '', r.grey ? 'grey' : '', r.rare ? 'rare' : '', r.status ?? ''].filter(Boolean).join(' ');
    const el = window.__P.add(layer, `<div class="${cls}">${r.rare ? '<span class="ws-combat-hp-tag">Rare</span>' : ''}<span class="ws-combat-hp-kind"><span class="lv con-${r.con}">Lv ${r.lv}</span>${r.name}${r.status ? `<span class="ws-combat-hp-status">${r.status === 'burn' ? '▲ BURN' : 'ϟ SHOCK'}</span>` : ''}</span><div class="ws-combat-hp-track"><i class="ws-combat-hp-fill" style="transform:scaleX(${r.hp})"></i></div>${r.stagger > 0 ? `<div class="ws-combat-hp-stagger"><i style="width:${r.stagger * 100}%"></i></div>` : ''}</div>`);
    window.__P.at(el, p);
  });
}, rows);
const floats = (page, rows) => page.evaluate((list) => {
  const layer = document.querySelector('.ws-combat-layer[data-proto]') ?? window.__P.add('#hud', '<div class="ws-combat-layer"></div>');
  const placed = window.__P.placed ?? [], all = window.__P.visible('crab');
  const crabs = [...placed, ...all.filter((c) => placed.every((q) => Math.hypot(q.p.x - c.p.x, q.p.y - c.p.y) > 60))];
  for (const r of list) {
    let p;
    if (r.at === 'you') { const v = document.querySelector('.ws-touch-status'); const b = v.getBoundingClientRect(); p = { x: b.left + 150, y: b.top + 14 }; }
    else { const c = crabs[r.at]; if (!c) continue; p = c.p; }
    const el = window.__P.add(layer, `<div class="ws-combat-float show ${r.cls}"><b>${r.text}</b><i>${r.label ?? ''}</i></div>`);
    el.style.transform = `translate3d(${(p.x + (r.dx ?? 0)).toFixed(1)}px,${(p.y - 34 - 16 + (r.dy ?? 0)).toFixed(1)}px,0)`;
  }
}, rows);

const ITEMS = [
  // ───────────── combat and levels ─────────────
  { id: 'UI-01', slug: 'xp-bar', title: 'XP bar + LV chip (E0e · HC1)', setup: atPier,
    inject: (page) => addMeter(page, 0.62, 6, '1,240 / 2,010 XP') },
  { id: 'UI-02', slug: 'levelup-fight', title: 'Level-up in a fight: ring, LV flip, gain chip, HP refill (E0e · HC2)',
    setup: async (page) => { await atBeach(page); await page.evaluate(() => { window.__P.vitals(31); }); },
    inject: async (page) => {
      await page.evaluate(() => { for (const v of document.querySelectorAll('.ws-game-vitals[data-proto]')) { v.querySelector('.ws-game-num').textContent = '179'; v.querySelector('.ws-game-vbar i').style.width = '100%'; v.classList.add('refill'); } });
      await addMeter(page, 0.03, 7, '64 / 2,890 XP', { flash: true, flip: true });
      await page.evaluate(() => {
        const t = document.querySelector('.ws-touch');
        window.__P.add(t, '<div class="ws-game-burst-ring"></div>'); window.__P.add(t, '<div class="ws-game-burst-ring inner"></div>');
        window.__P.add(t, '<div class="ws-game-burst-chip"><b>LEVEL 7</b>· +11 VIT</div>');
      });
      await plates(page, PLATES.slice(0, 1));
    } },
  { id: 'UI-03', slug: 'levelup-card', title: 'Level-up card, only out of combat (E0e · HC2, ruling 19aa)', setup: atPier,
    inject: async (page) => {
      await addMeter(page, 0.03, 7, '64 / 2,890 XP', { flip: true });
      const rows = [['VIT', 168, 179, '+11', 'big'], ['STR', 30, 33, '+3', ''], ['DEX', 33, 37, '+4', ''], ['AGI', 40, 41, '+1', ''], ['DEF', 37, 40, '+3', ''], ['MDEF', 16, 17, '+1', 'pending'], ['LUK', 12, 12, '+0', 'zero pending']];
      const cap = { VIT: 660, STR: 132, DEX: 132, AGI: 88, DEF: 88, MDEF: 88, LUK: 22 };
      await page.evaluate((html) => { window.__P.add('#hud', html); }, `<div class="ws-lvcard"><i class="cb tl"></i><i class="cb br"></i>
        <div class="ws-lvcard-kicker">LEVEL UP</div><div class="ws-lvcard-level"><small>LV</small>7</div>
        ${rows.map(([k, a, b, g, c]) => `<div class="ws-lvcard-row ${c}"><span>${k}</span><span class="bar"><i style="width:${(a / cap[k] * 100).toFixed(1)}%"></i><i style="left:${(a / cap[k] * 100).toFixed(1)}%;width:${((b - a) / cap[k] * 100).toFixed(1)}%"></i></span><b>${c.includes('pending') ? a : b}</b><em>${g}</em></div>`).join('')}
        <div class="ws-lvcard-foot"><span>HP refilled · 179</span><b>Tap to skip</b></div></div>`);
    } },
  { id: 'UI-04', slug: 'nameplates', title: 'Enemy nameplates within 25 m: Lv, con colour, stagger, status, rarity (E0f · HC4)', setup: atBeach,
    note: 'crabs stand in for robots',
    inject: (page) => plates(page, PLATES) },
  { id: 'UI-05', slug: 'floating-text', title: 'Floating combat text: crit, glance, DEFLECT / DODGE / PARRY, red on you (E0f · HC3)',
    setup: async (page) => { await atBeach(page); await page.evaluate(() => { window.__P.vitals(74); }); },
    note: '6 on screen, the cap',
    inject: async (page) => {
      await plates(page, PLATES.slice(0, 4));
      await floats(page, [
        { at: 0, cls: 'crit', text: '38', label: 'Crit', dy: -18 },
        { at: 1, cls: 'fail', text: 'DEFLECT', dy: -14 },
        { at: 2, cls: 'glance', text: '9', label: '', dy: -12 },
        { at: 3, cls: 'fail parry', text: 'PARRY', dy: -12 },
        { at: 'you', cls: 'onyou', text: '−12' },
        { at: 'you', cls: 'onyou fail', text: 'DODGE', dx: 52, dy: 2 },
      ]);
    } },
  { id: 'UI-06', slug: 'guard-button', title: 'GUARD button, only while the sword is held (W3d · D6)', setup: atBeach,
    inject: (page) => page.evaluate((svg) => { window.__P.add('.ws-touch', `<button class="ws-touch-disc at at-up0 ws-touch-guard show window" type="button">${svg}<span>Guard</span></button>`); }, G.shield) },
  { id: 'UI-09', slug: 'death-card', title: 'Death card + the XP-loss line (E0e · HC7)', setup: async (page) => {
      await atBeach(page);
      await page.evaluate(() => {
        const d = document.querySelector('.ws-combat-death'); window.__P.cls(d, ['show']); d.style.setProperty('--ws-death-veil', '0.86');
        d.querySelector('.ws-combat-death-cause').textContent = 'Snapped up by a crab'; d.querySelector('.ws-combat-death-where').textContent = 'respawning at Wreck Cove';
      });
    },
    inject: (page) => page.evaluate(() => {
      const d = document.querySelector('.ws-combat-death');
      d.querySelector('.ws-combat-death-cause').textContent = 'Killed by a Plumb Drone'; d.querySelector('.ws-combat-death-where').textContent = 'respawning at the East Gate';
      window.__P.add(d.querySelector('.ws-combat-death-card'), '<div class="ws-combat-death-cost"><b>−340 XP</b>25 % of level 7<small>never below level 7 · Scrip and parts kept</small></div>');
    }),
    teardown: (page) => page.evaluate(() => { const d = document.querySelector('.ws-combat-death'); d.style.removeProperty('--ws-death-veil'); }) },
  { id: 'UI-10', slug: 'character-tab', title: 'Character tab (read-only): 7 attributes vs par, ▲▼ aptitude, derived (E0f · HC5)',
    setup: (page) => menu(page, 'gear'),
    inject: (page) => page.evaluate(() => {
      const tabs = document.querySelector('.ws-gmenu-tabs'); window.__P.cls(tabs, ['review']);
      for (const b of tabs.querySelectorAll('.ws-gmenu-tab.active')) window.__P.cls(b, [], ['active']);
      const gear = tabs.querySelector('[data-tab=gear]'), icon = gear.querySelector('.ws-gmenu-ticon').innerHTML;
      void icon; const btn = document.createElement('div'); btn.innerHTML = `<button class="ws-gmenu-tab active" type="button" data-tab="character"><i class="ws-gmenu-ticon"><svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="18" r="11"/><path d="M10 58 C10 40 20 32 32 32 C44 32 54 40 54 58 Z"/></svg></i><span class="ws-gmenu-tword">Character</span></button>`;
      const b = btn.firstElementChild; b.dataset.proto = '1'; gear.after(b);
      const old = document.querySelector('.ws-gmenu-panel.active'); window.__P.cls(old, [], ['active']);
      const A = [['VIT', 184, 176, 660, 'up', '▲ 1.2', 'HP'], ['STR', 33, 35, 132, '', '1.0', 'melee damage'], ['DEX', 37, 35, 132, 'up', '▲ 1.2', 'ranged damage · hit chance · melee crit'], ['AGI', 41, 45, 88, 'down', '▼ 0.8', 'dodge · ranged crit'], ['DEF', 40, 39, 88, '', '1.0', 'physical armour · more DEFLECTs on you'], ['MDEF', 17, 18, 88, '', '1.0', 'burn · shock · blast'], ['LUK', 12, 13, 22, 'down', '▼ 0.8', 'crit size · lucky saves']];
      const rows = A.map(([k, v, par, cap, cls, apt, what]) => `<div class="ws-char-row"><span>${k}</span><span class="bar"><i style="width:${(v / cap * 100).toFixed(1)}%"></i><u style="left:${(par / cap * 100).toFixed(1)}%"></u></span><b>${v}</b><em class="${cls}">${cls === 'up' ? '▲ ' : cls === 'down' ? '▼ ' : ''}par ${par}</em><div class="ws-char-what">${what}</div></div>`).join('');
      window.__P.add(old.parentElement, `<div class="ws-gmenu-panel scroll active" data-scroll="">
        <div class="ws-gmenu-label">Level 7 · this shard only</div>
        <div class="ws-gmenu-card"><div class="ws-gmenu-cardtitle">LV 7 · 64 / 2,890 XP</div><div class="ws-bar"><i style="width:2.2%"></i></div><div class="ws-gmenu-note">Your level and attributes belong to this shard. They grow by themselves each level: nothing to spend.</div></div>
        <div class="ws-gmenu-label">Attributes · white tick = par at LV 7 · ▲▼ aptitude</div>${rows}
        <div class="ws-gmenu-label">What they make</div>
        <div class="ws-char-derived"><div>Health<b>184</b></div><div>Armour<b>28 %</b></div><div>Energy armour<b>14 %</b></div><div>Crit<b>13 % · ×1.62</b></div><div>Dodge share<b>46 %</b></div><div>Fail vs equal level<b>12 %</b></div></div>
      </div>`);
      document.querySelector('.ws-gmenu-panel.active[data-proto]').scrollTop = 0;
    }),
    teardown: closeMenu },
  { id: 'UI-11', slug: 'deflect-hint', title: 'The levelled first hint: DEFLECT (E0b)', setup: atBeach,
    inject: async (page) => {
      await plates(page, PLATES.slice(0, 1));
      await floats(page, [{ at: 0, cls: 'fail', text: 'DEFLECT', dy: -16 }]);
      await page.evaluate(() => { window.__P.add('#hud', '<div class="ws-glass ws-hint-tag desk show proto-show proto-wide" style="top:calc(50% + 118px)"><span><b>DEFLECT</b> · it is above your level<br>fight targets near LV 6</span></div>'); });
    } },

  // ───────────── quests and the world ─────────────
  { id: 'UI-12', slug: 'quest-givers', title: 'Quest-giver markers: yellow ! (eligible), grey ! (too low) (W1b · HC6)', setup: atCamp,
    note: 'Wendell and Maren stand in for the tier givers',
    inject: (page) => page.evaluate(() => {
      const givers = [{ x: -19.6, y: 21.6, z: -72.2, cls: '', sub: 'YARD BOSS · L1–6' }, { x: -24.4, y: 21.6, z: -73.5, cls: 'grey', sub: 'SURVEYOR · LV 7' }];
      const layer = window.__P.add('#hud', '<div class="ws-combat-layer"></div>');
      const mm = document.querySelector('.ws-minimap'), r = mm.getBoundingClientRect();
      for (const g of givers) {
        const p = window.__P.project(g.x, g.y, g.z);
        window.__P.at(window.__P.add(layer, `<div class="ws-quest-giver ${g.cls}"><b>!</b><span>${g.sub}</span></div>`), p, 0, -30);
        const l = window.__P.local(g.x, g.y, g.z), k = (r.width / 2) / 110;
        const pip = window.__P.add(mm, `<i class="ws-quest-mappip ${g.cls}">!</i>`);
        pip.style.left = `${r.width / 2 + l.right * k}px`; pip.style.top = `${r.height / 2 - l.ahead * k}px`;
      }
    }) },
  { id: 'UI-13', slug: 'requires-level', title: 'Dialogue: a quest above your level, REQUIRES LV 7 (W1b)',
    setup: async (page) => {
      await pose(page, WENDELL, 2600); await clearToasts(page);
      await page.evaluate(() => { const i = window.__wildshard.world.interactables.find((x) => x.label === 'Talk to Wendell'); i.onInteract(); });
      await sleep(2200); await clearToasts(page);
    },
    inject: (page) => page.evaluate(() => {
      window.__P.swap(document.querySelector('.ws-quest-talk.show'), (c) => {
        c.querySelector('.ws-quest-talk-name').textContent = 'The Surveyor · tier 2 giver';
        c.querySelector('.ws-quest-talk-text').textContent = 'Drones in the yard again. Come back when you can stand up to them.';
        const foot = c.querySelector('.ws-quest-talk-foot');
        const gate = document.createElement('div'); gate.className = 'ws-quest-talk-gate';
        gate.innerHTML = '<span class="quest">Quest · tier 2<b>Drone Season</b></span><span class="btn">REQUIRES LV 7</span>';
        foot.before(gate);
      });
    }),
    teardown: async (page) => { await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => { document.querySelector('.ws-quest-talk.show')?.click(); }); await sleep(600); } },
  { id: 'UI-14', slug: 'quest-list', title: 'Quest list on the map tab: all 12 active, one tracked (W1b · D13 / D14)',
    setup: (page) => menu(page, 'map'),
    inject: (page) => page.evaluate(() => {
      const Q = [['tracked', 'Drone Season', 'LV 7 · 3 / 8 drones', 'Tracked'], ['', 'Clock In', 'LV 1 · done', 'done'], ['', 'Spare Servos', 'LV 2 · 4 / 6 servos', 'T1'], ['', 'Survey the Yard', 'LV 4 · 3 / 4 places', 'T1'], ['', 'Big Pallet', 'LV 6 · hunt', 'T1'], ['', 'Lights Out', 'LV 9 · storm hour', 'T2'], ['locked', 'Keycard', 'needs LV 10', 'T2']];
      const rows = Q.map(([c, n, s, t]) => `<div class="ws-gmenu-qrow ${c === 'tracked' ? 'tracked' : c === 'locked' ? 'locked' : ''}${t === 'done' ? ' done' : ''}"><i></i><span>${n} <span style="color:var(--ws-text-dim);font-size:8.5px;letter-spacing:.14em">· ${s}</span></span><em>${t === 'done' ? '✓' : t}</em></div>`).join('');
      const card = document.querySelector('.ws-gmenu-mapquest');
      const list = document.createElement('div'); list.className = 'ws-gmenu-qlist'; list.dataset.proto = '1';
      list.innerHTML = `<div class="ws-gmenu-label">Quests · 11 active · 1 done</div>${rows}<div class="ws-gmenu-qmore">+ 5 more · tap a quest to track it</div>`;
      card.before(list);
      window.__P.swap(card, (c) => {
        c.querySelector('.ws-gmenu-mapquest-title').textContent = 'Drone Season · tracked';
        c.querySelector('.ws-gmenu-mapquest-obj').innerHTML = '<i></i>Down 8 Plumb Drones in band 3 · 3 / 8';
        c.querySelector('.ws-gmenu-mapquest-hint').textContent = 'The Surveyor, at the gate plaza, pays on your return';
      });
    }),
    teardown: closeMenu },
  { id: 'UI-15', slug: 'tour-step', title: 'Shift Orientation: the tour steps on the quest chip (W1b · D4)', setup: atPier,
    inject: async (page) => {
      await page.evaluate(() => {
        window.__P.swap(document.querySelector('.ws-quest-obj'), (c) => {
          c.querySelector('.ws-quest-obj-label').textContent = 'Shift Orientation'; c.querySelector('.ws-quest-obj-count').textContent = '2/5';
          c.querySelector('.ws-quest-obj-name').textContent = 'RIDING LAP'; const d = c.querySelector('.ws-quest-obj-dist'); if (d) d.textContent = '140 M';
        });
      });
      await page.evaluate(() => { window.__wildshard.world.hud.toast('Shift Orientation · the range ✓ · next: a riding lap'); });
      await sleep(400);
    }, teardown: clearToasts },
  { id: 'UI-17', slug: 'checkpoint-card', title: 'Checkpoint card: a quest leg done, saved (QC6)', setup: atBeach,
    inject: async (page) => {
      await addMeter(page, 0.38, 2, '96 / 254 XP');
      await page.evaluate(() => { window.__P.add('#hud', '<div class="ws-quest-reward show checkpoint"><div class="ws-quest-reward-kicker">Clock In · step 2 / 3</div><div class="ws-quest-reward-title">Five Crate Mites down</div><div class="ws-quest-reward-sub">next: report to the Yard Boss</div><span class="ws-quest-saved"><i></i>CHECKPOINT SAVED</span></div>'); });
    } },
  { id: 'UI-18', slug: 'feat-finds-toasts', title: 'Feat toast + FINDS toast (exists; showcase content) (W9b · 19i)', setup: async (page) => {
      await atPier(page);
      await page.evaluate(() => { window.__wildshard.world.hud.toast('Achievement · Message in a Bottle — title unlocked: Honorary Castaway'); });
      await sleep(500);
    },
    inject: async (page) => {
      await clearToasts(page);
      await page.evaluate(() => { const h = window.__wildshard.world.hud; h.toast('Found · Gold 1×1 · 5 / 20 — Calibration Chip: +5 % board and reel speed'); h.toast('Achievement · Lap of Honour — title unlocked: Paddock Legend'); });
      await sleep(500);
    }, teardown: clearToasts },
  { id: 'UI-19', slug: 'shard-complete', title: 'Shard-complete card: the Titan Cleaver (exists; showcase content) (21)',
    setup: async (page) => { await atPier(page); await page.evaluate(() => { window.__wildshard.shard['driftwood.adventure'].complete.open(); }); await sleep(1600); },
    inject: (page) => page.evaluate(() => {
      const c = document.querySelector('.ws-complete.show .ws-complete-card');
      const t = (s, v) => { const e = c.querySelector(s); if (e) e.textContent = v; };
      t('.ws-complete-kicker', 'The Last Contract · the Crate Titan down'); t('.ws-complete-title', 'Showcase Template');
      c.querySelector('.ws-complete-flavour').innerHTML = 'The Crate Titan is scrap.<br>The Titan Cleaver is yours.';
      const stats = [['Time played', '58h 12m'], ['Level', '20', 1], ['Quests', '12 / 12', 1], ['Contracts', '13 / 13', 1], ['Gold 1×1s', '17 / 20', 0.85], ['Title', 'Crate Expectations']];
      c.querySelector('.ws-complete-grid').innerHTML = stats.map(([l, v, f]) => `<div class="ws-complete-stat"><div class="ws-complete-lab">${l}</div><div class="ws-complete-val${l === 'Title' ? ' sm' : ''}">${v}</div>${f !== undefined ? `<div class="ws-complete-bar"><i style="width:${f * 100}%"></i></div>` : ''}</div>`).join('');
      c.querySelector('.ws-complete-todo').innerHTML = '<span>3 Gold 1×1s</span> <span>Riveting Rita</span> <span>Cache 4</span>';
      c.querySelector('[data-act=next]').innerHTML = '<small>Next shard:</small>Driftwood Isle';
    }),
    teardown: async (page) => { await page.evaluate(() => { document.querySelector('.ws-complete [data-act=keep]')?.click(); }); await sleep(900); } },
  { id: 'UI-20', slug: 'course-clock', title: 'Course clock chip under the minimap, during a run only (W6d · D22)', setup: atPier,
    inject: (page) => chipWith(page, { title: '0:42.3', sub: 'Movers run · 3/6 · PB 1:05.8', tone: 'plain' }, G.watch, ['clock']),
    teardown: chipOff },
  { id: 'UI-24', slug: 'wave-banner', title: 'Gauntlet wave banner + wave chip (EB · E11c)', setup: atBeach,
    note: 'crabs stand in for robots',
    inject: async (page) => {
      await page.evaluate(() => { window.__P.swap(document.querySelector('.ws-game-boundary'), (c) => { c.classList.add('wave'); c.querySelector('.ws-game-bt').textContent = 'Wave 2 / 5'; c.querySelector('.ws-game-bs').textContent = 'C1 Loading Yard · 6 robots'; }); });
      await chipWith(page, { title: 'Wave 2/5', sub: 'C1 Loading Yard · 6 left', tone: 'plain' }, G.swords, ['wave']);
    }, teardown: chipOff },
  { id: 'UI-25', slug: 'portal-enter', title: 'Portal prompt: ENTER on the USE band (19ac · DG)', setup: async (page) => { await pose(page, WENDELL, 2600); await clearToasts(page); },
    inject: (page) => page.evaluate(() => { window.__P.swap(document.querySelector('.ws-touch-use'), (c) => { c.classList.add('show'); c.textContent = 'Enter the Training Vault'; }); }) },
  { id: 'UI-27', slug: 'map-heat', title: 'Map heat map: the level bands on the map tab (map plan)', setup: (page) => menu(page, 'map'),
    note: 'bands drawn over Driftwood’s map',
    inject: (page) => page.evaluate(() => {
      const frame = document.querySelector('.ws-gmenu-mapcanvas'); const r = frame.getBoundingClientRect();
      const B = [['#7be38a', 54, 64, 'LV 1–3'], ['#ffe066', 66, 46, 'LV 4–6'], ['#ff9a3c', 46, 34, 'LV 7–9'], ['#ff5a4a', 30, 44, 'LV 10–12'], ['#9aa3a8', 30, 66, 'west · no XP']];
      const heat = window.__P.add(frame, `<div class="ws-gmenu-heat">${B.map(([c, x, y]) => `<i style="background:${c};left:${x - 13}%;top:${y - 11}%;width:26%;height:22%"></i>`).join('')}${B.map(([c, x, y, t]) => `<span style="left:${x}%;top:${y}%;border-color:${c}">${t}</span>`).join('')}</div>`);
      heat.style.zIndex = '5'; void r;
      const foot = document.querySelector('.ws-gmenu-legend');
      window.__P.add(foot, '<span class="ws-gmenu-heatkey"><i style="background:#9aa3a8"></i><i style="background:#7be38a"></i><i style="background:#ffe066"></i><i style="background:#ff9a3c"></i><i style="background:#ff5a4a"></i>CON</span>');
    }), teardown: closeMenu },
  { id: 'UI-28', slug: 'minimap-band', title: 'Minimap band border: crossing into a higher band (map plan · 19aa)', setup: atBeach,
    inject: async (page) => {
      await addMeter(page, 0.62, 6, '1,240 / 2,010 XP');
      await page.evaluate(() => { const mm = document.querySelector('.ws-minimap'); window.__P.add(mm, '<i class="ws-minimap-band"></i>'); window.__P.add(mm, '<span class="ws-minimap-bandtag">BAND 3 · LV 7–9 AHEAD</span>'); });
    } },
  { id: 'UI-29', slug: 'vault-room', title: 'Training Vault sealed room: the room and wave counter (DG1)', setup: atBeach,
    note: 'crabs stand in for robots',
    inject: async (page) => {
      await chipWith(page, { title: 'Room 2/4', sub: 'Sealed · 3 left · doors open on the last', tone: 'plain' }, G.vault, ['wave']);
      await page.evaluate(() => { window.__wildshard.world.hud.toast('The doors seal · clear the room'); window.__P.restack(document.querySelector('.ws-game-weather')); });
      await sleep(400);
    }, teardown: async (page) => { await chipOff(page); await clearToasts(page); } },
  { id: 'UI-30', slug: 'shrine-complete', title: 'SHRINE COMPLETE card: time, deaths, rooms (DG3, the complete card’s layout)',
    setup: async (page) => { await atPier(page); await page.evaluate(() => { window.__wildshard.shard['driftwood.adventure'].complete.open(); }); await sleep(1600); },
    inject: (page) => page.evaluate(() => {
      const c = document.querySelector('.ws-complete.show .ws-complete-card');
      const t = (s, v) => { const e = c.querySelector(s); if (e) e.textContent = v; };
      t('.ws-complete-kicker', 'The Training Vault · the Vault Warden down'); t('.ws-complete-title', 'Training Vault'); t('.ws-complete-done', '· Shrine complete ·');
      c.querySelector('.ws-complete-flavour').innerHTML = 'Solved puzzles stay solved. The chest is open.';
      const stats = [['Time', '11:42'], ['Best', '11:42 · new'], ['Deaths', '2'], ['Rooms', '4 / 4', 1], ['Chest', '150 Scrip · Plate Core'], ['Trophy', 'Warden’s Plate']];
      c.querySelector('.ws-complete-grid').innerHTML = stats.map(([l, v, f]) => `<div class="ws-complete-stat"><div class="ws-complete-lab">${l}</div><div class="ws-complete-val${v.length > 9 ? ' sm' : ''}">${v}</div>${f !== undefined ? `<div class="ws-complete-bar"><i style="width:${f * 100}%"></i></div>` : ''}</div>`).join('');
      for (const n of c.querySelectorAll('.ws-complete-todo, .ws-complete-rule + .ws-complete-lab')) n.style.display = 'none';
      c.querySelector('[data-act=keep]').innerHTML = 'Through the exit portal<b>▸</b>';
      c.querySelector('.ws-complete-row2').innerHTML = '<button type="button" class="ws-complete-btn sec">Run it again</button><button type="button" class="ws-complete-btn sec">Best times</button>';
    }),
    teardown: async (page) => { await page.evaluate(() => { document.querySelector('.ws-complete [data-act=keep]')?.click(); }); await sleep(900); } },
  { id: 'UI-31', slug: 'trick-score', title: 'Hover park: trick words + the running score (W5b)',
    setup: async (page) => { await atPier(page); await page.evaluate(() => { window.__wildshard.world.player.setHover(true); }); await sleep(2200); await clearToasts(page); },
    inject: async (page) => {
      await page.evaluate(() => { const l = window.__P.add('#hud', '<div class="ws-combat-layer"></div>'); const f = window.__P.add(l, '<div class="ws-combat-float show trick"><b>360</b><i>1.4 s air · ×3</i></div>'); f.style.transform = `translate3d(${innerWidth / 2}px,${innerHeight * 0.36}px,0)`; });
      await chipWith(page, { title: '2,450', sub: 'Trick score · ×3 combo · PB 3,120', tone: 'plain' }, G.board, ['clock']);
    }, teardown: async (page) => { await chipOff(page); await page.evaluate(() => { window.__wildshard.world.player.setHover(false); }); await sleep(1200); } },

  // ───────────── economy ─────────────
  { id: 'UI-32', slug: 'upgrades-bench', title: 'Tinker Rook’s stall: UPGRADES / BENCH tabs, Scrip + parts, LV locks (W2b · 19g)',
    setup: async (page) => { await pose(page, { x: -24.4, z: -70.5, yaw: 0, pitch: -0.05 }, 2200); await page.evaluate(() => { window.__wildshard.world.interactables.find((x) => x.label === 'Trade with Maren').onInteract(); }); await sleep(1600); },
    inject: (page) => page.evaluate(([servo, tine, rotor, core, sword]) => {
      const s = [...document.querySelectorAll('.ws-shop')].pop();
      const t = (q, v) => { const e = s.querySelector(q); if (e) e.textContent = v; };
      window.__P.swap(s.querySelector('.ws-shop-top'), (c) => { c.querySelector('.ws-shop-title b').textContent = 'Tinker Rook’s stall'; c.querySelector('.ws-shop-title span').textContent = 'Main Street · the town'; });
      const big = s.querySelector('.ws-shop-big');
      window.__P.swap(big, (c) => {
        c.querySelector('.ws-shop-bigwho').textContent = 'Tinker Rook';
        c.querySelector('.ws-shop-bigpurse').innerHTML = `<i class="ws-shop-ring"></i><b>340</b>`;
        const tabs = document.createElement('div'); tabs.className = 'ws-shop-tabs'; tabs.innerHTML = '<span class="on">Upgrades</span><span>Bench</span>';
        c.querySelector('.ws-shop-bighead').after(tabs);
        const goods = [['Hover Grip', servo, 2, 'owned', 'Owned', '3 servo'], ['Sturdy Heart I', core, 3, 'owned', 'Owned', '5 servo'], ['Quiver Strap', tine, 4, 'on', '60', '4 tine · 9 held'], ['Forge I · Iron', sword, 5, '', '80', '6 tine · 9 held'], ['Scrap Scanner', rotor, 7, '', '120', '4 rotor · 3 held'], ['Forge II · Steel', sword, 9, 'locked', 'LV 9', '8 rotor']];
        c.querySelector('.ws-shop-grid').innerHTML = goods.map(([n, ic, lv, st, foot, parts]) => `<div class="ws-icard-tile ${st === 'on' ? 'on' : ''} ${st === 'locked' ? 'locked' : ''} ${st === 'owned' ? 'owned' : ''}" style="position:relative"><span class="ws-icard-lv">LV ${lv}</span><i class="ws-icard-well"><i class="ws-icard-icon">${ic}</i></i><b class="ws-icard-name">${n}</b><span class="ws-icard-parts">${parts}</span><span class="ws-icard-foot">${/^\d/.test(foot) ? `<i class="ws-icard-ring"></i>${foot}` : foot}</span></div>`).join('');
        const buy = c.querySelector('.ws-shop-bigbuy'); buy.disabled = false; buy.className = 'ws-shop-bigbuy'; buy.textContent = 'Buy · 60 Scrip + 4 Tine';
      });
      void t;
    }, [G.servo, G.tine, G.rotor, G.core, G.sword]),
    teardown: async (page) => { await page.evaluate(() => { document.querySelector('.ws-shop.show .ws-shop-close')?.click(); }); await sleep(700); } },
  { id: 'UI-33', slug: 'weapons-shop', title: 'The weapons shop: weapons bought, locked by level (W2b · 19j)',
    setup: async (page) => { await pose(page, { x: -24.4, z: -70.5, yaw: 0, pitch: -0.05 }, 2200); await page.evaluate(() => { window.__wildshard.world.interactables.find((x) => x.label === 'Trade with Maren').onInteract(); }); await sleep(1600); },
    inject: (page) => page.evaluate(([sword, spear, bow, crossbow, rifle]) => {
      const s = [...document.querySelectorAll('.ws-shop')].pop();
      window.__P.swap(s.querySelector('.ws-shop-top'), (c) => { c.querySelector('.ws-shop-title b').textContent = 'Gunsmith Brass'; c.querySelector('.ws-shop-title span').textContent = 'Weapons · Main Street'; });
      window.__P.swap(s.querySelector('.ws-shop-big'), (c) => {
        c.querySelector('.ws-shop-bigwho').textContent = 'Gunsmith Brass · Weapons';
        c.querySelector('.ws-shop-bigpurse').innerHTML = '<i class="ws-shop-ring"></i><b>340</b>';
        const goods = [['Sword', sword, 1, 'owned', 'Owned'], ['Spear', spear, 3, 'on', '120'], ['Bow', bow, 4, '', '150'], ['Crossbow', crossbow, 6, '', '260'], ['Lever rifle', rifle, 10, 'locked', 'LV 10'], ['Hi-vis vest', sword, 1, '', '150']];
        goods[5][1] = '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M20 6 L26 6 L32 14 L38 6 L44 6 L56 16 L50 58 L14 58 L8 16 Z"/><rect x="14" y="36" width="36" height="5" fill="#0b1520" opacity=".6"/></svg>';
        c.querySelector('.ws-shop-grid').innerHTML = goods.map(([n, ic, lv, st, foot]) => `<div class="ws-icard-tile ${st === 'on' ? 'on' : ''} ${st === 'locked' ? 'locked' : ''} ${st === 'owned' ? 'owned' : ''}" style="position:relative"><span class="ws-icard-lv">LV ${lv}</span><i class="ws-icard-well"><i class="ws-icard-icon">${ic}</i></i><b class="ws-icard-name">${n}</b><span class="ws-icard-foot">${/^\d/.test(foot) ? `<i class="ws-icard-ring"></i>${foot}` : foot}</span></div>`).join('');
        const buy = c.querySelector('.ws-shop-bigbuy'); buy.disabled = false; buy.className = 'ws-shop-bigbuy'; buy.textContent = 'Buy the spear · 120 Scrip';
      });
    }, [G.sword, G.spear, G.bow, G.crossbow, G.rifle]),
    teardown: async (page) => { await page.evaluate(() => { document.querySelector('.ws-shop.show .ws-shop-close')?.click(); }); await sleep(700); } },
  { id: 'UI-34', slug: 'pack-20', title: 'The 20-slot pack: one slot a kind, unfound kinds as silhouettes (W2a · loot 4)',
    setup: (page) => menu(page, 'inventory'),
    inject: (page) => page.evaluate((I) => {
      const p = document.querySelector('.ws-gmenu-panel.active');
      const kinds = [['Servo', I.servo, 14], ['Tine', I.tine, 9], ['Rotor', I.rotor, 3], ['Hydraulic Heart', I.core, 1], ['Nozzle', I.nozzle], ['Rivet plate', I.rivet], ['Arc coil', I.coil], ['Plate Core', I.core], ['Foreman’s Capacitor', I.core], ['Vault keycard', I.keycard]];
      const slots = [];
      for (let i = 0; i < 20; i++) {
        const k = kinds[i];
        if (!k) { slots.push('<div class="ws-gmenu-slot empty"></div>'); continue; }
        const [name, ic, n] = k;
        slots.push(n !== undefined ? `<div class="ws-gmenu-slot"><i class="ws-gmenu-sicon">${ic}</i><b class="ws-gmenu-count">×${n}</b><span class="ws-gmenu-sname">${name}</span></div>` : `<div class="ws-gmenu-slot unfound"><i class="ws-gmenu-sicon">${ic}</i><span class="ws-gmenu-sname">???</span></div>`);
      }
      window.__P.swap(p, (c) => { c.innerHTML = `<div class="ws-gmenu-label">Pack · 4 of 10 kinds found · 20 slots</div><div class="ws-gmenu-packnote">Never full: one slot a kind · ammo stays in the pouch</div><div class="ws-gmenu-grid twenty">${slots.join('')}</div>`; c.classList.add('active'); });
    }, { servo: G.servo, tine: G.tine, rotor: G.rotor, core: G.core, nozzle: G.nozzle, rivet: G.rivet, coil: G.coil, keycard: G.keycard }),
    teardown: closeMenu },
  { id: 'UI-36', slug: 'trophy-perk', title: 'Trophy wall: a hung trophy’s perk card (loot 7, the item card)',
    setup: async (page) => { await atPier(page); await page.evaluate(() => { window.__wildshard.world.hud.pickupCard({ name: 'Sea glass', icon: 'star', detail: '3 / 15 found' }); }); await sleep(700); },
    inject: async (page) => {
      await page.evaluate(() => { window.__wildshard.world.hud.pickupCard({ name: 'Big Pallet’s Tines', icon: 'laurel', detail: 'Hung · perk on: +5 % damage to crate robots' }); });
      await sleep(700);
      await page.evaluate(() => { const k = document.querySelector('.ws-icard-pop.show .ws-icard-kicker'); if (k) window.__P.swap(k, (c) => { c.textContent = 'Trophy wall · 1 / 12'; }); });
    } },
  { id: 'UI-38', slug: 'scrip-chip', title: 'Scrip: the currency chip + a salvage part on pickup (W2a · E1d · E1e)', setup: atBeach,
    note: 'crabs stand in for robots',
    inject: async (page) => {
      await page.evaluate((svg) => { window.__P.swap(document.querySelector('.ws-loot-chip'), (c) => { const i = c.querySelector('.ws-loot-coin'); i.innerHTML = svg; i.style.color = 'var(--ws-amber)'; c.querySelector('.ws-loot-num').textContent = '343'; }); }, G.scrip);
      await addMeter(page, 0.66, 6, '1,330 / 2,010 XP');
      await page.evaluate(() => { const h = window.__wildshard.world.hud; h.toast('+3 Scrip · +1 Servo (14 / 20 for Hover Grip II)'); });
      await sleep(400);
    }, teardown: clearToasts },
];

const { browser, PHONE } = await launch();
try {
  const { page, build, errors } = await open(browser, PHONE, url, 'driftwood-isle');
  const ctx = { page, build, shard: 'Driftwood Isle' };
  for (const item of ITEMS) {
    if (only.length > 0 && !only.includes(item.id)) continue;
    try { await pair(ctx, item); } catch (e) { console.log('FAIL', item.id, String(e).slice(0, 300)); }
  }
  if (errors.length) console.log('page errors', errors.slice(0, 5));
} finally { await browser.close(); }
