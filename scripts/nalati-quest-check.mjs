#!/usr/bin/env node
// nalati-quest-check.mjs — NALATI-MERGE Q1–Q3 in a muted headless browser: Nalati's camp people + the elder's talk, the
// quest chip + markers + the MAP tab card, TULPAR's steps driven (flags / the kokpar's dev win), a reload that keeps the
// progress and the discovered places; then Driftwood's quest on the shared core (Wendell's talk, a shard, the chip).
//
//   node scripts/nalati-quest-check.mjs --url=http://127.0.0.1:5196 [--out=progress/nalati-merge/q] [--touch] [--only=nalati|chapters|driftwood]
//
// `chapters` (Q4 / Q5): chapter 2 and 3 from a save that finished TULPAR — the elder gives each, a balbal's carving (the
// onKill path's own function), the Golden King / Jel Ata beaten in the SAVED boss store and the elites felled in the
// saved elite store before a reload (the quest catches up from what the game saved), the cairn's strip tied.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5196');
const OUT = resolvePath(flag('out', 'progress/nalati-merge/q'));
const TOUCH = argv.includes('--touch');
const ONLY = flag('only', '');
const tag = TOUCH ? 'phone' : 'desktop';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` · ${extra}` : ''}`); };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(TOUCH ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
const shot = async (name) => { writeFileSync(resolvePath(OUT, `${name}-${tag}.jpg`), await page.screenshot({ type: 'jpeg', quality: TOUCH ? 72 : 78 })); };
const q = (s) => page.evaluate(s);
const chipText = () => q(`document.querySelector('.ws-quest-obj.show')?.textContent ?? ''`);
const boot = async (query) => {
  await page.goto(`${URL_BASE}/?${query}&mute=1&nolock=1&skipintro=1${TOUCH ? '&touch=1&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world), undefined, { timeout: 240000, polling: 1000 });
  await sleep(6000);
};

const standAtElder = async () => {
  await q(`(() => { const f = window.__nalatiQuest.people.fig.elder, p = window.__world.player; p.position.set(f.feet.x, f.feet.y + 0.2, f.feet.z - 2.4); p.yaw = Math.PI; p.pitch = 0.05; })()`);
  await sleep(1500);
};
const talkThrough = async (id, name) => {
  await q(`window.__nalatiQuest.talk('${id}')`);
  await sleep(2000);
  if (name) await shot(name);
  for (let i = 0; i < 16 && await q(`window.__nalatiQuest.dialogue.isOpen`); i++) { await q(`window.__nalatiQuest.talk('${id}')`); await sleep(150); }
  await sleep(700);
};
/** write the game's own saved stores (the boss / elite modules read them at boot) — a reload follows */
const saveStores = (boss, elites) => q(`(() => {
  const b = JSON.parse(localStorage.getItem('ws.boss.v1') ?? '{}'); for (const id of ${JSON.stringify(boss)}) b['nalati-grasslands#' + id] = { defeated: true, rewardTaken: true, kills: 1 };
  localStorage.setItem('ws.boss.v1', JSON.stringify(b));
  const e = JSON.parse(localStorage.getItem('ws.elites.v1') ?? '{}'); for (const id of ${JSON.stringify(elites)}) e[id] = { ...(e[id] ?? { timer: 0, discovered: true, skinTaken: true, retired: false }), kills: 1 };
  localStorage.setItem('ws.elites.v1', JSON.stringify(e));
})()`);
const drain = async () => { for (let i = 0; i < 12 && await q(`window.__nalatiQuest.dialogue.isOpen`); i++) { await q(`window.__nalatiQuest.dialogue.advance()`); await sleep(120); } };
async function chapters() {
  const FROM = 'chunk=nalati-grasslands&at=88,-6,205,3.14,0';
  await boot(`${FROM}&resetquest=1&questflags=talked:elder,tamed:horse,won:kokpar,told:tulpar,quest:tulpar`);
  await q(`(() => { localStorage.removeItem('ws.boss.v1'); localStorage.removeItem('ws.elites.v1'); })()`);
  const c0 = await chipText();
  check('chapters: after TULPAR the chip points at the elder (The Golden King │ BAQYT ATA)', /Golden King/i.test(c0) && /BAQYT/i.test(c0), c0);
  await standAtElder();
  await talkThrough('elder', 'q4-dialogue');
  await q(`(() => { const p = window.__world.player; p.position.x += 6; p.position.z -= 9; })()`);
  await sleep(1500);
  const c1 = await chipText();
  check('chapters: THE GOLDEN KING 1/4 │ KURGAN FIELD', /1\/4/.test(c1) && /KURGAN FIELD/i.test(c1), c1);
  await shot('q4-chip-clues');
  await q(`window.__nalatiQuest.carving()`);
  await sleep(2200);
  const carving = await q(`document.querySelector('.ws-quest-talk.show')?.textContent ?? ''`);
  check('chapters: a toppled balbal shows its carving (clue 1/3)', /balbal/i.test(carving) && /sun/i.test(carving), carving.slice(0, 80));
  await shot('q4-carving');
  for (let k = 0; k < 2; k++) { await drain(); await q(`window.__nalatiQuest.carving()`); await sleep(500); }
  await drain();
  await sleep(1200);
  const c2 = await chipText();
  check('chapters: three clues → 2/4 │ GREAT KURGAN', /2\/4/.test(c2) && /GREAT KURGAN/i.test(c2), c2);
  // the King beaten in the saved boss store (as in an earlier session) → reload: the quest catches up
  await saveStores(['golden-king'], []);
  await boot(FROM);
  const c3 = await chipText();
  check('chapters: the saved King → 4/4 │ BAQYT ATA (door + king skipped)', /4\/4/.test(c3) && /BAQYT/i.test(c3), c3);
  await standAtElder();
  await talkThrough('elder', 'q4-dialogue-plaque');
  await sleep(1500);
  check('chapters: THE GOLDEN KING complete', await q(`window.__nalatiQuest.flags.has('quest:golden-king')`));
  await shot('q4-reward');
  await sleep(5500);
  await talkThrough('elder', 'q5-dialogue');
  await q(`(() => { const p = window.__world.player; p.position.x += 6; p.position.z -= 9; })()`);
  await sleep(1500);
  const c4 = await chipText();
  check('chapters: FATHER OF THE WIND 1/4 │ an elite', /Father of the Wind/i.test(c4) && /1\/4/.test(c4), c4);
  await shot('q5-chip-feathers');
  // two elites felled in the saved elite store → reload: two feathers
  await saveStores([], ['kokbori', 'qyran']);
  await boot(FROM);
  await sleep(2500);
  const f2 = await q(`window.__nalatiQuest.flags.all.filter((f) => f.startsWith('feather:')).length`);
  check('chapters: two elites felled (saved) → two storm feathers', f2 === 2, String(f2));
  await (TOUCH ? page.click('.ws-minimap') : page.keyboard.press('KeyM'));
  await sleep(2000);
  const card = await q(`document.querySelector('.ws-gmenu-mapquest')?.textContent ?? ''`);
  check('chapters: MAP card (Chapter 3 · feathers 2 / 3)', /Chapter 3/.test(card) && /2 \/ 3/.test(card), card.slice(0, 120));
  await shot('q5-map-card');
  await (TOUCH ? q(`document.querySelector('.ws-gmenu-close, .ws-gmenu [data-close]')?.click?.()`) : page.keyboard.press('Escape'));
  await sleep(800);
  await saveStores([], ['aqbars']);
  await boot(FROM);
  await sleep(2500);
  const c5 = await chipText();
  check('chapters: the third feather → 2/4 │ WIND CAIRN', /2\/4/.test(c5) && /WIND CAIRN/i.test(c5), c5);
  // the strip tied at the cairn (the titan's own `tied`, which the cairn's prompt sets in a storm)
  await q(`window.__world.nalati.titan.fight.tied = true`);
  await sleep(1200);
  await q(`window.__world.nalati.titan.fight.tied = false`);
  const c6 = await chipText();
  check('chapters: the strip tied → 3/4 │ JEL ATA', /3\/4/.test(c6) && /JEL ATA/i.test(c6), c6);
  await saveStores(['storm-titan'], []);
  await boot(FROM);
  const c7 = await chipText();
  check('chapters: Jel Ata beaten (saved) → 4/4 │ BAQYT ATA', /4\/4/.test(c7) && /BAQYT/i.test(c7), c7);
  await standAtElder();
  await talkThrough('elder', 'q5-dialogue-home');
  await sleep(1500);
  check('chapters: FATHER OF THE WIND complete, the line finished', await q(`window.__nalatiQuest.flags.has('quest:father-wind') && window.__nalatiQuest.line.active === null`));
  await shot('q5-reward');
  await q(`(() => { localStorage.removeItem('ws.boss.v1'); localStorage.removeItem('ws.elites.v1'); })()`);
}

try {
  if (ONLY === '' || ONLY === 'nalati') {
    // ── Nalati: a fresh start by the camp ──
    await boot('chunk=nalati-grasslands&resetquest=1&at=88,-6,205,3.14,0');
    const nq = await q(`Boolean(window.__nalatiQuest)`);
    check('nalati: the adventure is installed', nq);
    const elder = await q(`(() => { const f = window.__nalatiQuest.people.fig.elder; return [f.feet.x, f.feet.y, f.feet.z]; })()`);
    // the camp's people from the yard's open (road, −x) side: Erlan at the rail, the child, the cook, the elder beyond
    await q(`(() => { const p = window.__world.player; p.position.set(81.5, ${elder[1]} + 0.2, 209.5); p.yaw = -2.1; p.pitch = -0.06; })()`);
    await sleep(5000);
    await shot('q2-camp-people');
    const chip0 = await chipText();
    check('nalati: the chip before the elder (TULPAR │ BAQYT ATA)', /Tulpar/i.test(chip0) && /BAQYT/i.test(chip0), chip0);
    // walk up to the elder and talk with E (desktop) / the prompt (phone)
    await q(`(() => { const p = window.__world.player; p.position.set(${elder[0]}, ${elder[1]} + 0.2, ${elder[2]} - 2.4); p.yaw = Math.PI; p.pitch = 0.05; })()`);
    await sleep(2500);
    await (TOUCH ? q(`window.__nalatiQuest.talk('elder')`) : page.keyboard.press('KeyE'));
    await sleep(2500);
    const talkOpen = await q(`document.querySelector('.ws-quest-talk.show')?.textContent ?? ''`);
    check('nalati: the elder talks', /Baqyt/i.test(talkOpen) && /Salem/.test(talkOpen), talkOpen.slice(0, 80));
    await shot('q3-dialogue');
    for (let i = 0; i < 12 && await q(`window.__nalatiQuest.dialogue.isOpen`); i++) { await q(`window.__nalatiQuest.talk('elder')`); await sleep(150); }
    await sleep(600);
    check('nalati: talked:elder raised', await q(`window.__nalatiQuest.flags.has('talked:elder')`));
    await q(`(() => { const p = window.__world.player; p.position.set(${elder[0]} + 6, ${elder[1]} + 0.2, ${elder[2]} - 10); p.yaw = Math.PI * 0.9; })()`);
    await sleep(2500);
    const chip1 = await chipText();
    check('nalati: chip TULPAR 1/3 │ HORSE PLAINS', /Tulpar/i.test(chip1) && /1\/3/.test(chip1) && /HORSE PLAINS/i.test(chip1), chip1);
    await shot('q3-chip-step1');
    // the MAP tab: the quest card + the blue markers
    await (TOUCH ? page.click('.ws-minimap') : page.keyboard.press('KeyM'));
    await sleep(2000);
    const card = await q(`document.querySelector('.ws-gmenu-mapquest')?.textContent ?? ''`);
    check('nalati: MAP card (Chapter 1 · Tulpar · the objective)', /Chapter 1/.test(card) && /stallion/i.test(card), card.slice(0, 120));
    await shot('q3-map-card');
    await (TOUCH ? q(`document.querySelector('.ws-gmenu-close, .ws-gmenu [data-close]')?.click?.()`) : page.keyboard.press('Escape'));
    await sleep(800);
    // step 1 → 2: the taming (driven as a flag: the taming itself has its own harness, Taming.forceBreak)
    await q(`window.__nalatiQuest.flags.set('tamed:horse')`);
    await sleep(1200);
    const chip2 = await chipText();
    check('nalati: tamed → chip 2/3 │ KOKPAR FIELD', /2\/3/.test(chip2) && /KOKPAR/i.test(chip2), chip2);
    // step 2 → 3: a kokpar round, played: mount a camp horse, ride over the goat, into a tai-qazan
    const goat = await q(`(() => { const g = window.__nalatiQuest.kokpar.object.position; return [g.x, g.z]; })()`);
    await q(`(() => { const w = window.__world, m = w.ride.mount; if (!m.mounted) { const h = w.wildlife.campHorses[0]; w.player.position.set(${goat[0]} + 6, w.player.position.y, ${goat[1]}); m.mount(h); } m.teleport(${goat[0]} + 5, ${goat[1]} - 1.2, -Math.PI / 2 - 0.3); })()`);
    await sleep(4000);   // the field streams in; the goat is not picked up yet (5 m off)
    await q(`window.__world.ride.mount.teleport(${goat[0]} + 0.5, ${goat[1]}, -Math.PI / 2)`);
    await sleep(700);
    check('nalati: kokpar — mounted over the goat, it is carried', await q(`window.__nalatiQuest.kokpar.carrying`));
    await q(`(() => { const w = window.__world; w.player.yaw = Math.PI * 0.35; w.player.pitch = -0.25; })()`);
    await sleep(500);
    await shot('q3-kokpar-carry');
    const goal = await q(`(() => { const g = window.__nalatiQuest.kokparGoals[0]; return [g.x, g.z]; })()`);
    await q(`window.__world.ride.mount.teleport(${goal[0]}, ${goal[1]}, 0)`);
    await sleep(1000);
    check('nalati: kokpar — into the tai-qazan, won', await q(`window.__nalatiQuest.flags.has('won:kokpar')`));
    await shot('q3-kokpar-win');
    const chip3 = await chipText();
    check('nalati: kokpar won → chip 3/3 │ BAQYT ATA', /3\/3/.test(chip3) && /BAQYT/i.test(chip3), chip3);
    const seen = await q(`window.__nalatiQuest.flags.all.filter((f) => f.startsWith('seen:'))`);
    check('nalati: places discovered (saved seen: flags)', seen.includes('seen:nomad-camp'), seen.join(' '));

    // ── reload: the progress and the discovery persist ──
    await boot('chunk=nalati-grasslands&at=88,-6,205,3.14,0');
    const after = await q(`({ f: window.__nalatiQuest.flags.all, step: window.__nalatiQuest.line.active?.current?.id ?? null })`);
    check('nalati: reload keeps the step (home)', after.step === 'home', String(after.step));
    check('nalati: reload keeps the discovered places', after.f.includes('seen:nomad-camp'));
    await (TOUCH ? page.click('.ws-minimap') : page.keyboard.press('KeyM'));
    await sleep(2000);
    await shot('q1-map-after-reload');
    await (TOUCH ? q(`document.querySelector('.ws-gmenu-close, .ws-gmenu [data-close]')?.click?.()`) : page.keyboard.press('Escape'));
    await sleep(800);
    // back to the elder: the chapter completes, the caption + the title
    await q(`(() => { const p = window.__world.player; p.position.set(${elder[0]}, ${elder[1]} + 0.2, ${elder[2]} - 2.4); p.yaw = Math.PI; p.pitch = 0.05; })()`);
    await sleep(1500);
    await q(`window.__nalatiQuest.talk('elder')`);
    await sleep(2200);
    await shot('q3-dialogue-home');
    for (let i = 0; i < 12 && await q(`window.__nalatiQuest.dialogue.isOpen`); i++) { await q(`window.__nalatiQuest.talk('elder')`); await sleep(150); }
    await sleep(2500);
    check('nalati: TULPAR complete', await q(`window.__nalatiQuest.flags.has('quest:tulpar')`));
    await shot('q3-reward');
    // the other people talk too
    for (const id of ['herderGate', 'herderRail', 'child', 'cook']) {
      await q(`(() => { const f = window.__nalatiQuest.people.fig['${id}'], p = window.__world.player; p.position.set(f.feet.x, f.feet.y + 0.2, f.feet.z - 2.2); p.yaw = Math.PI; p.pitch = 0.1; })()`);
      await sleep(1500);
      await q(`window.__nalatiQuest.talk('${id}')`);
      await sleep(400);
      const t = await q(`document.querySelector('.ws-quest-talk.show')?.textContent ?? ''`);
      check(`nalati: ${id} talks`, t.length > 10, t.slice(0, 60));
      await sleep(1600);
      await shot(`q2-talk-${id}`);
      for (let i = 0; i < 6 && await q(`window.__nalatiQuest.dialogue.isOpen`); i++) { await q(`window.__nalatiQuest.talk('${id}')`); await sleep(120); }
    }
  }

  if (ONLY === '' || ONLY === 'chapters') {
    await chapters();
  }

  if (ONLY === '' || ONLY === 'driftwood') {
    // ── Driftwood: the Sealed Ring on the shared core, unchanged ──
    await boot('chunk=driftwood-isle&resetquest=1');
    check('driftwood: the adventure is installed', await q(`Boolean(window.__adventure?.spine)`));
    const chipD0 = await chipText();
    check('driftwood: chip before Wendell (Who lit the fire? │ CASTAWAY)', /Who lit the fire/i.test(chipD0) && /CASTAWAY/i.test(chipD0), chipD0);
    const c = await q(`(() => { const a = window.__adventure.spine.castaway.position; return [a.x, a.y, a.z]; })()`);
    // two metres from Wendell, looking at him (forward = (−sin yaw, −cos yaw))
    await q(`(() => { const p = window.__world.player, dx = 0, dz = -2.2; p.position.set(${c[0]} + dx, ${c[1]} + 0.2, ${c[2]} + dz); p.yaw = Math.PI; p.pitch = -0.1; })()`);
    await sleep(2500);
    await page.keyboard.press('KeyE');
    await sleep(2000);
    const talkD = await q(`document.querySelector('.ws-quest-talk.show')?.textContent ?? ''`);
    if (!/Wendell/.test(talkD)) { // the prompt did not pick (camera angle): the dialogue check still runs through the flags
      console.log('  (E did not open Wendell from here; raising talked:castaway directly)');
    } else await shot('q1-driftwood-wendell');
    check('driftwood: Wendell talks (E)', /Wendell/.test(talkD), talkD.slice(0, 60));
    for (let i = 0; i < 12 && await q(`window.__adventure.spine.dialogue.isOpen`); i++) { await page.keyboard.press('KeyE'); await sleep(200); }
    await q(`window.__adventure.flags.set('talked:castaway')`);
    await sleep(1200);
    const chipD1 = await chipText();
    check('driftwood: chip Glyph shards 0/3 │ a shard marker', /Glyph shards/i.test(chipD1) && /0\/3/.test(chipD1), chipD1);
    await q(`window.__adventure.flags.set('shard:wreck')`);
    await sleep(1200);
    const chipD2 = await chipText();
    check('driftwood: a shard → 1/3', /1\/3/.test(chipD2), chipD2);
    const mk = await q(`window.__adventure.spine.markers().map((m) => m.id)`);
    check('driftwood: the taken shard\'s marker hides', !mk.includes('wreck') && mk.length === 2, mk.join(','));
    await shot('q1-driftwood-chip');
  }
} finally {
  const real = errors.filter((e) => !/favicon|net::ERR_ABORTED/.test(e));
  check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
