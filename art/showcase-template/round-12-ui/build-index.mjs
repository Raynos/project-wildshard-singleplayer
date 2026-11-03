#!/usr/bin/env node
// Writes index.html: the round-12 gallery (the round-11-remaster pattern), BEFORE / AFTER per change, grouped, tap to zoom.
//   node art/showcase-template/round-12-ui/build-index.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT } from './lib.mjs';

const GROUPS = [
  ['Combat and levels', [
    ['UI-01', 'xp-bar', 'XP bar + LV chip', 'new', 'A thin bar on the touch bar’s top edge, "LV 6" and the XP at its left over MOVE. Hidden on every shard without levels.'],
    ['UI-02', 'levelup-fight', 'Level-up in a fight', 'new', 'Never blocks: a ring off the chip, the chip flips to LV 7, one gain line above it, HP refilled (VITALS 31 → 179).'],
    ['UI-03', 'levelup-card', 'Level-up card, out of combat', 'new', 'After 5 s calm: each gain ticks up in turn, gold on a big roll, grey on +0, TAP TO SKIP.'],
    ['UI-04', 'nameplates', 'Enemy nameplates within 25 m', 'extends Combat.ts', '"Lv n Name" in the con colour (grey, green, yellow, orange, red, skull), a stagger bar, burn / shock tint, a RARE tag. Crabs stand in for robots.'],
    ['UI-05', 'floating-text', 'Floating combat text', 'extends Combat.ts', 'A big yellow crit, a small grey glance, the DEFLECT and PARRY words, red −12 and DODGE by your vitals. Six on screen, the cap.'],
    ['UI-06', 'guard-button', 'GUARD button (D6)', 'new', 'A disc in the existing slot over JUMP, only while the sword is held; its rim lights in the parry window.'],
    ['UI-07', 'elite-banner', 'Named elite: NAMED ELITE · LV 6', 'extends EliteBar', 'Nalati’s real banner and pinned bar, with the showcase’s Big Pallet and an LV tag.'],
    ['UI-08', 'boss-bar', 'Boss bar with phases', 'extends BossBar', 'Today’s bar already has phase notches and the PHASE caption; the Crate Titan adds LV 20 and three phase pips.'],
    ['UI-09', 'death-card', 'Death card + XP loss', 'extends DeathFade', 'The same card with one more line: −340 XP, 25 % of level 7, never below level 7.'],
    ['UI-10', 'character-tab', 'Character tab (read-only)', 'new tab', 'Bag ▸ CHARACTER: level and XP, the seven attributes against par, ▲▼ aptitude, what each does, the derived numbers.'],
    ['UI-11', 'deflect-hint', 'The DEFLECT first hint', 'extends FirstHints', 'Once, the first time a hit is deflected: fight targets near your level.'],
  ]],
  ['Quests and the world', [
    ['UI-12', 'quest-givers', 'Quest-giver ! markers', 'new', 'Yellow ! when you can take the quest, grey ! when you are too low, both also on the minimap. Wendell and Maren stand in.'],
    ['UI-13', 'requires-level', 'REQUIRES LV 7 in the dialogue', 'extends the talk panel', 'The real dialogue panel with a quest row and a locked accept button.'],
    ['UI-14', 'quest-list', 'Quest list on the map tab (D13, D14)', 'new', 'All twelve active, one tracked (feeds the HUD chip), the tracked quest’s card under the list.'],
    ['UI-15', 'tour-step', 'Shift Orientation tour step (D4)', 'content only', 'The quest chip and a step toast; no new UI.'],
    ['UI-16', 'contract-board', 'Kill-contract board, fixed mode', 'extends Pine’s board', 'Level-locked rows, first-time trophy and joke title.'],
    ['UI-17', 'checkpoint-card', 'Checkpoint card (QC6)', 'new', 'A quest leg done and saved: the reward caption’s type with a CHECKPOINT SAVED tick.'],
    ['UI-18', 'feat-finds-toasts', 'Feat toast + FINDS toast', 'content only', 'Today’s toast with the showcase’s Gold 1×1 / Calibration Chip and a west feat.'],
    ['UI-19', 'shard-complete', 'Shard-complete card', 'content only', 'The real card with the Titan Cleaver and the showcase’s stats.'],
    ['UI-20', 'course-clock', 'Course clock chip (D22)', 'reuses the weather chip', 'Under the quest chip only during a run: time, checkpoint, PB. The toasts step down under it.'],
    ['UI-21', 'pb-board', 'Personal-best board', 'new world sign', 'A 3D sign, so a codex edit of the world band only; the live HUD laid back on top pixel for pixel.'],
    ['UI-22', 'storm-hour', 'Storm hour + beacons', 'extends the storm chip', 'Nalati’s real storm chip reading STORM HOUR, four beacons on the minimap, one lit.'],
    ['UI-23', 'stealth-unseen', 'Stealth: UNSEEN', 'content only', 'Nalati’s stealth layer; the hidden state’s label is data.'],
    ['UI-24', 'wave-banner', 'Gauntlet wave banner', 'new', 'WAVE 2 / 5 in the boundary warning’s type, and the wave chip under the quest chip.'],
    ['UI-25', 'portal-enter', 'Portal ENTER prompt', 'content only', 'The real USE band, reading Enter the Training Vault.'],
    ['UI-26', 'cutscene-card', 'Boss intro title card', 'content only', 'The real letterbox, name card and HOLD TO SKIP ring: THE CRATE TITAN · LV 20.'],
    ['UI-27', 'map-heat', 'Map heat map', 'new', 'The level bands tinted on the map tab, a CON key in the legend.'],
    ['UI-28', 'minimap-band', 'Minimap band border', 'new', 'An orange arc on the rim toward a higher band, BAND 3 · LV 7–9 AHEAD.'],
    ['UI-29', 'vault-room', 'Training Vault sealed room', 'new', 'ROOM 2/4 · 3 left, and the seal toast.'],
    ['UI-30', 'shrine-complete', 'SHRINE COMPLETE card', 'reuses the complete card', 'Time, best, deaths, rooms, the chest and the trophy.'],
    ['UI-31', 'trick-score', 'Hover park trick score', 'new', 'A trick word over the board and the running score chip.'],
  ]],
  ['Economy', [
    ['UI-32', 'upgrades-bench', 'Tinker Rook: UPGRADES / BENCH', 'extends ShopPanel', 'Two tabs, Scrip and parts on every tile, LV tags and locks.'],
    ['UI-33', 'weapons-shop', 'The weapons shop', 'extends ShopPanel', 'Weapons bought, locked by level (the rifle at LV 10).'],
    ['UI-34', 'pack-20', 'The 20-slot pack', 'extends PACK', 'One slot a kind, never full; unfound kinds as dashed silhouettes.'],
    ['UI-35', 'ammo-pouch', 'Ammo pouch + picker (D17, D18)', 'extends BOLTS', 'Pouch counters on the bolts chip; the weapon pie’s look on the BOLTS disc for iron / pitch / broadhead.'],
    ['UI-36', 'trophy-perk', 'Trophy perk card', 'content only', 'The real item card: a hung trophy and its always-on perk.'],
    ['UI-37', 'range-loaner', 'The range’s loaner (D2)', 'extends the weapon pie', 'Nalati’s real pie, every weapon but your own tagged LOAN, and the toast.'],
    ['UI-38', 'scrip-chip', 'Scrip chip + salvage part', 'content only', 'The coin chip as Scrip, and a kill’s +3 Scrip · +1 Servo toast.'],
  ]],
];

// Jake, 2026-11-03: "group the 38" by what kind of change each is; nothing cut, the cut candidates shown last.
const BY_ID = new Map(GROUPS.flatMap(([, items]) => items).map((it) => [it[0], it]));
const SECTIONS = [
  ['1 · New controls on the fight HUD', 'The only new things on screen all the time in a fight. Floating numbers already exist; the other three are new.',
    ['UI-01', 'UI-04', 'UI-05', 'UI-06']],
  ['2 · Banners: one shared style', 'Short messages across the screen that never block play. Built once, filled in by six moments.',
    ['UI-02', 'UI-07', 'UI-24', 'UI-26', 'UI-22', 'UI-17']],
  ['3 · The chip under the minimap: one at a time', 'A single timer or counter slot that shows only during a run. Built once; this also settles the crowded slot.',
    ['UI-20', 'UI-29', 'UI-31']],
  ['4 · End cards: one shared card', 'A full card after something finishes, only out of combat.',
    ['UI-03', 'UI-19', 'UI-30']],
  ['5 · Menus', 'Screens you open. Two extend an existing shop screen, one extends Pine’s board.',
    ['UI-10', 'UI-14', 'UI-16', 'UI-32', 'UI-33']],
  ['6 · Small additions to screens that already exist', 'A line, a number or a label on something already in the game. No new control.',
    ['UI-13', 'UI-09', 'UI-34', 'UI-35', 'UI-08', 'UI-23', 'UI-25']],
  ['7 · In the world, not HUD', '3D things in the level, seen like any other model.',
    ['UI-12', 'UI-21']],
  ['8 · Could be cut (shown, nothing cut yet)', 'My suggestions to drop, each with why. Your call; all still in the plan.',
    ['UI-11', 'UI-27', 'UI-28', 'UI-38', 'UI-37', 'UI-36', 'UI-15', 'UI-18']],
];
const WHY_CUT = {
  'UI-11': 'The GUARD button already says it.',
  'UI-27': 'Nameplates and REQUIRES LV already tell you an area is too hard.',
  'UI-28': 'Same as the heat map.',
  'UI-38': 'Scrip shows in the shops and the pack.',
  'UI-37': 'A plain toast does it.',
  'UI-36': 'A plain toast does it.',
  'UI-15': 'The tracked-quest chip already shows the step.',
  'UI-18': 'Keep today’s single toast stack.',
};
const listed = SECTIONS.flatMap(([, , ids]) => ids);
if (listed.length !== BY_ID.size || new Set(listed).size !== BY_ID.size) throw new Error(`sections list ${listed.length} of ${BY_ID.size}`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fig = ([id, slug, title, kind, cap]) => {
  const f = `${id.toLowerCase()}-${slug}`;
  const cut = WHY_CUT[id] ? `<p class="cut">Why cut: ${esc(WHY_CUT[id])}</p>` : '';
  return `<section class="pair"><h3>${id} · ${esc(title)} <span>${esc(kind)}</span></h3><p>${esc(cap)}</p>${cut}<div class="two">`
    + `<figure><img loading="lazy" src="${f}-before.jpg" alt="${id} before"><figcaption>BEFORE · live</figcaption></figure>`
    + `<figure><img loading="lazy" src="${f}-after.jpg" alt="${id} after"><figcaption>AFTER · prototype</figcaption></figure></div></section>`;
};
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kitchen Sink v2 · UI in engine</title><style>
:root{color-scheme:dark}body{margin:0;background:#1f2124;color:#eceae6;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:20px 14px 60px}
h1{color:#f08a24;font-size:30px;margin:0 0 6px}h2{color:#f08a24;margin:34px 0 8px;font-size:22px}p{margin:0 0 12px;color:#c9ccd1}
.pairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px}.pair{background:#2b2d30;border-radius:8px;padding:10px 10px 12px}
.pair h3{margin:0 0 4px;font-size:15px;color:#eceae6}.pair h3 span{font-weight:400;font-size:12px;color:#8fe3ff;margin-left:4px}.pair p{font-size:13px;margin:0 0 8px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:6px}figure{margin:0}figure img{width:100%;display:block;cursor:zoom-in;border-radius:4px}
.toc{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 4px}.toc a{color:#8fe3ff;font-size:14px}.pair p.cut{color:#ffb36b;font-weight:600}
figcaption{font-size:11px;color:#9aa3a8;text-align:center;padding-top:3px}
#z{position:fixed;inset:0;background:#000e;display:none;overflow:auto;touch-action:pinch-zoom}#z img{width:100%;max-width:700px;display:block;margin:0 auto}
</style></head><body><main><h1>Kitchen Sink v2 · every UI change, in engine</h1>
<p>Round 12 (2026-11-03). Every frame is the real game on a phone in portrait, from a served build of main. BEFORE is the live page as it is today. AFTER is the same live page with the new element added, built from the engine's own HUD classes. Driftwood Isle's crabs, Wendell and Maren stand in for the showcase's robots and NPCs. The names and numbers are the showcase's. Nalati and Pine Hollow are used where their live component is the one the showcase extends. Only the personal-best board (a 3D sign) is a generated edit. Tap a frame to see it big.</p>
<p>Each HUD change still needs your pick before it is built (the HUD rule).</p>
<p><b>The 38, grouped by what kind of change each is:</b> 4 fight-HUD controls, 6 banners sharing one style, 3 chips sharing one slot, 3 end cards sharing one card, 5 menus, 7 small additions to existing screens, 2 world things, and 8 I'd suggest cutting (shown, not cut).</p>
<nav class="toc">${SECTIONS.map(([name, , ids], i) => `<a href="#s${i + 1}">${esc(name)} (${ids.length})</a>`).join('')}</nav>
${SECTIONS.map(([name, blurb, ids], i) => `<h2 id="s${i + 1}">${esc(name)}</h2><p>${esc(blurb)}</p><div class="pairs">${ids.map((id) => fig(BY_ID.get(id))).join('')}</div>`).join('\n')}
</main><div id="z"><img alt=""></div><script>
const z=document.getElementById('z'),zi=z.querySelector('img');
for(const i of document.querySelectorAll('figure img'))i.onclick=()=>{zi.src=i.src;z.style.display='block';};
z.onclick=()=>{z.style.display='none';};
</script></body></html>
`;
writeFileSync(join(OUT, 'index.html'), html);
console.log('index.html', html.length);
