#!/usr/bin/env node
// UI-14 quest screens (Jake 11-03: "now that we have far more space for quests … show me … the quest list, the quest
// details … all the quest related screens"). The bag has five tabs (UI-10); the map tab holds MAP / QUESTS sub-tabs.
// Live Driftwood page, the bag opened on the map tab and re-dressed; writes ui-14-q-{list,detail,locked,map}.jpg + the board.
//   scripts/browser-lane.sh --max 10 node art/showcase-template/round-12-ui/cap-ui14-quests.mjs --url=http://127.0.0.1:<port>
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, open, clean, shoot, sleep, arg, OUT } from './lib.mjs';

const url = arg('url');
if (url === '') { console.error('usage: cap-ui14-quests.mjs --url=<build>'); process.exit(2); }

const CSS = `
.ws-gmenu .qx-sub{display:flex;gap:8px;margin:0 0 14px}
.ws-gmenu .qx-sub span{flex:1;text-align:center;padding:9px 0;font-size:13px;letter-spacing:.22em;text-transform:uppercase;border:1px solid #ffffff26;color:#c9ccd1}
.ws-gmenu .qx-sub span.on{border-color:var(--ws-cyan);color:var(--ws-cyan);background:#7fd8ff1a}
.ws-gmenu .qx-h{display:flex;justify-content:space-between;margin:16px 0 6px;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--ws-text-dim)}
.ws-gmenu .qx-h b{font-weight:400;color:var(--ws-cyan-dim)}
.ws-gmenu .qx-row{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:10px;padding:9px 10px;border:1px solid #8fe3ff14;margin-bottom:5px;background:#ffffff05}
.ws-gmenu .qx-row i{width:7px;height:7px;margin-left:3px;transform:rotate(45deg);border:1px solid var(--ws-cyan-dim)}
.ws-gmenu .qx-row .n{font-family:var(--ws-display);font-weight:600;font-size:15px;letter-spacing:.03em;color:var(--ws-text)}
.ws-gmenu .qx-row .s{display:block;margin-top:2px;font-size:10px;letter-spacing:.1em;color:var(--ws-text-dim)}
.ws-gmenu .qx-row .bar{display:block;height:3px;margin-top:6px;background:#ffffff14}.ws-gmenu .qx-row .bar u{display:block;height:100%;background:var(--ws-cyan)}
.ws-gmenu .qx-row em{font-style:normal;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ws-cyan-dim)}
.ws-gmenu .qx-row.tr{border-color:#8fe3ff70;background:#8fe3ff12}.ws-gmenu .qx-row.tr i{background:var(--ws-cyan);border-color:var(--ws-cyan);box-shadow:0 0 6px #8fe3ffcc}.ws-gmenu .qx-row.tr em{color:var(--ws-cyan)}
.ws-gmenu .qx-row.lk{opacity:.5}.ws-gmenu .qx-row.dn .n{text-decoration:line-through;color:var(--ws-text-dim)}
.ws-gmenu .qx-back{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ws-cyan);margin:0 0 12px}
.ws-gmenu .qx-kick{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--ws-cyan-dim)}
.ws-gmenu .qx-title{font-family:var(--ws-display);font-weight:700;font-size:28px;letter-spacing:.04em;color:var(--ws-text);margin:4px 0 4px}
.ws-gmenu .qx-who{font-size:11px;letter-spacing:.08em;color:var(--ws-text-dim);margin-bottom:12px}
.ws-gmenu .qx-quote{font-size:12px;line-height:1.5;color:#c9ccd1;border-left:2px solid #8fe3ff40;padding:2px 0 2px 10px;margin-bottom:14px;font-style:italic}
.ws-gmenu .qx-step{display:grid;grid-template-columns:16px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #8fe3ff14;font-size:12px;letter-spacing:.05em;color:var(--ws-text)}
.ws-gmenu .qx-step.dn{color:var(--ws-text-dim);text-decoration:line-through}.ws-gmenu .qx-step b{font-weight:600;color:var(--ws-cyan)}
.ws-gmenu .qx-rw{display:flex;flex-wrap:wrap;gap:6px}.ws-gmenu .qx-rw span{padding:6px 9px;border:1px solid #f0c06a55;color:#f3d39a;font-size:11px;letter-spacing:.08em;background:#f0c06a10}
.ws-gmenu .qx-btns{display:flex;gap:8px;margin-top:16px}.ws-gmenu .qx-btns span{flex:1;text-align:center;padding:12px 0;font-size:12px;letter-spacing:.22em;text-transform:uppercase;border:1px solid #ffffff30;color:#c9ccd1}
.ws-gmenu .qx-btns span.on{border-color:var(--ws-cyan);color:var(--ws-cyan);background:#8fe3ff14}
.ws-gmenu .qx-lock{padding:12px;border:1px solid #ffffff22;background:#ffffff08;font-size:12px;line-height:1.5;color:#c9ccd1;margin-bottom:12px}.ws-gmenu .qx-lock b{color:#ff9a7a;font-weight:600}
`;

/** the five tabs of UI-10 (Gear folded into Character), the map tab's MAP / QUESTS sub-tabs, and the panel's own content */
const dress = (page, sub, html) => page.evaluate(([css, s, h]) => {
  if (!document.querySelector('style[data-qx]')) { const st = document.createElement('style'); st.dataset.qx = '1'; st.textContent = css; document.head.append(st); }
  const tabs = document.querySelector('.ws-gmenu-tabs'), gear = tabs.querySelector('[data-tab=gear]');
  const t = document.createElement('div');
  t.innerHTML = '<button class="ws-gmenu-tab" type="button" data-tab="character"><i class="ws-gmenu-ticon"><svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="18" r="11"/><path d="M10 58 C10 40 20 32 32 32 C44 32 54 40 54 58 Z"/></svg></i><span class="ws-gmenu-tword">Character</span></button>';
  const ch = t.firstElementChild; ch.dataset.proto = '1'; gear.after(ch); window.__P.gone(gear);
  const panel = document.querySelector('.ws-gmenu-panel.active');
  const subs = `<div class="qx-sub"><span class="${s === 'map' ? 'on' : ''}">Map</span><span class="${s === 'quests' ? 'on' : ''}">Quests</span></div>`;
  if (s === 'map') { const first = panel.firstElementChild; const d = document.createElement('div'); d.innerHTML = subs; const n = d.firstElementChild; n.dataset.proto = '1'; first.before(n); return; }
  for (const k of [...panel.children]) window.__P.gone(k);
  const box = window.__P.add(panel, `<div style="overflow:auto;height:100%">${subs}${h}</div>`);
  box.scrollTop = 0;
}, [CSS, sub, html]);

const row = (cls, name, sub, tag, frac) => `<div class="qx-row ${cls}"><i></i><span><span class="n">${name}</span><span class="s">${sub}</span>${frac === undefined ? '' : `<span class="bar"><u style="width:${frac * 100}%"></u></span>`}</span><em>${tag}</em></div>`;

const LIST = `
<div class="qx-h">Tracked</div>
${row('tr', 'Drone Season', 'Down 8 Plumb Drones · band 3', '3 / 8', 3 / 8)}
<div class="qx-h">Tier 2 · LV 7–12 <b>the Surveyor · gate plaza</b></div>
${row('', 'Lights Out', 'Storm hour: light the four beacons · LV 9', 'Ready')}
${row('lk', 'Keycard', 'Steal it unseen in the stealth yard', 'LV 10')}
${row('lk', 'The Training Vault', 'Four rooms and the Vault Warden', 'LV 12')}
<div class="qx-h">Tier 1 · LV 1–6 <b>3 / 4 done</b></div>
${row('', 'Big Pallet', 'Hunt the band-2 gate elite · LV 6', 'Hunt')}
${row('dn', 'Survey the Yard', '4 / 4 places found', '✓')}
${row('dn', 'Spare Servos', '6 / 6 Servos to Tinker Rook', '✓')}
${row('dn', 'Clock In', '5 / 5 Crate Mites', '✓')}
<div class="qx-h">Tier 3 · LV 13–20 <b>4 locked</b></div>
<div class="qx-h" style="margin-top:4px">Tap a quest for details · tap the diamond to track</div>`;

const DETAIL = `
<div class="qx-back">‹ Quests</div>
<div class="qx-kick">Tier 2 · LV 7 · kill</div>
<div class="qx-title">Drone Season</div>
<div class="qx-who">From the Surveyor · gate plaza · pays on your return</div>
<div class="qx-quote">“The Plumb Drones are nesting in the band-3 pipes again. Bring eight down before they wire the yard shut.”</div>
<div class="qx-h">Steps</div>
<div class="qx-step dn"><span>✓</span><span>Talk to the Surveyor</span><span></span></div>
<div class="qx-step"><span>◆</span><span>Down Plumb Drones in band 3</span><b>3 / 8</b></div>
<div class="qx-step" style="color:var(--ws-text-dim)"><span>◇</span><span>Return to the Surveyor</span><span></span></div>
<div class="qx-h">Reward · first time</div>
<div class="qx-rw"><span>90 Scrip</span><span>Drone Season contract</span><span>Title · Pest Control</span></div>
<div class="qx-h" style="margin-top:8px">XP comes from the kills, not the quest</div>
<div class="qx-btns"><span class="on">◆ Tracked</span><span>Show on map</span></div>`;

const LOCKED = `
<div class="qx-back">‹ Quests</div>
<div class="qx-kick">Tier 2 · LV 10 · set piece (stealth)</div>
<div class="qx-title">Keycard</div>
<div class="qx-who">From the Surveyor · gate plaza</div>
<div class="qx-lock"><b>Needs LV 10.</b> You are LV 7. The Surveyor’s ! stays grey until then; kill in band 3 to level up.</div>
<div class="qx-quote">“Somebody locked the vault and walked off with the card. It’s in the yard behind the cranes. Don’t get seen.”</div>
<div class="qx-h">Reward · first time</div>
<div class="qx-rw"><span>Opens the Training Vault</span><span>120 Scrip</span></div>
<div class="qx-btns"><span style="opacity:.45">Track at LV 10</span><span>Show on map</span></div>`;

const SCREENS = [
  { key: 'list', title: 'UI-14 · Quests: the list, grouped by tier', sub: 'QUESTS sub-tab · tracked first, then tiers with their giver · done struck through',
    run: (page) => dress(page, 'quests', LIST) },
  { key: 'detail', title: 'UI-14 · Quests: one quest’s details', sub: 'tap a quest · steps with progress, the giver, the reward, TRACK and SHOW ON MAP',
    run: (page) => dress(page, 'quests', DETAIL) },
  { key: 'locked', title: 'UI-14 · Quests: a locked quest', sub: 'still readable · says the level it needs and what it opens',
    run: (page) => dress(page, 'quests', LOCKED) },
  { key: 'map', title: 'UI-14 · Map: the tracked quest under the map', sub: 'MAP sub-tab (the default) · the tracked quest’s card, as today',
    run: async (page) => {
      await dress(page, 'map', '');
      await page.evaluate(() => {
        window.__P.swap(document.querySelector('.ws-gmenu-mapquest'), (c) => {
          c.hidden = false;
          c.querySelector('.ws-gmenu-mapquest-title').textContent = 'Drone Season · tracked';
          c.querySelector('.ws-gmenu-mapquest-obj').innerHTML = '<i></i>Down 8 Plumb Drones in band 3 · 3 / 8';
          c.querySelector('.ws-gmenu-mapquest-hint').textContent = 'The Surveyor, at the gate plaza, pays on your return';
        });
      });
    } },
];

const { browser, PHONE } = await launch();
try {
  const { ctx, page, build, errors } = await open(browser, PHONE, url, 'driftwood-isle');
  for (const s of SCREENS) {
    await clean(page);
    await page.evaluate(() => { window.__wildshard.world.hud.menu.open('map'); }); await sleep(1300);
    await s.run(page);
    await sleep(600);
    console.log(s.key, await shoot(page, `ui-14-q-${s.key}.jpg`, s.title, s.sub, `AFTER (prototype in the live page) · Driftwood Isle · build ${build}`, true));
    await page.evaluate(() => { window.__wildshard.world.hud.menu.close(); }); await sleep(600);
  }
  if (errors.length) console.log('page errors', errors.slice(0, 3));
  await ctx.close();
} finally { await browser.close(); }

const files = SCREENS.map((s) => join(OUT, `ui-14-q-${s.key}.jpg`));
execFileSync('magick', [...files, '-resize', 'x1000', '-bordercolor', '#1f2124', '-border', '6', '+append', '-strip', '-quality', '76', join(OUT, 'ui-14-q-board.jpg')]);
console.log('board', join(OUT, 'ui-14-q-board.jpg'));
