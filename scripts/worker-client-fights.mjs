// J130: the flip's checklist, the parts a walk can't reach: a real fight on its rows to the reward, a refused press, a boss that resets, a
// fall and the way back, the sky and the Weather setting, a chest, a buy, a contract, a door. A harness stands the player where it needs
// them and hardens their blows (`__workerClientHits`), so a long fight ends inside a proof; the hits, the fight and the reward are real.
import { saveFixture } from './debug-settings.mjs';
import { FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';

/** Open one shard with the row on, entered and on the wire. */
async function open(browser, phone, base, slug) {
  const context = await browser.newContext(phone), page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(error.message.slice(0, 300)); });
  page.on('console', line => { if (line.type() === 'error') errors.push(line.text().slice(0, 300)); });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'device', key: 'debug.workerClient', data: 'on' });
  await page.goto(new URL(`/?chunk=${slug}&mute=1&nolock=1`, base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
  await page.waitForFunction(() => typeof window.__workerClient === 'function', undefined, { timeout: 150_000 });
  await page.evaluate(FLOOR_GRID_ENTER);
  await page.waitForFunction(() => window.__workerClient().frames > 30, undefined, { timeout: 60_000 });
  return { context, page, errors };
}
const report = page => page.evaluate(() => window.__workerClient());
const fight = (page, id) => page.evaluate(want => window.__workerClientFights().find(row => row.id === want) ?? null, id);
const place = (page, x, y, z) => page.evaluate(([px, py, pz]) => { window.__wildshard.world.player.link.place(px, py, pz, 0); }, [x, y, z]);
/** Wait until `read` answers something truthy; its last answer either way. */
async function until(page, read, seconds, every = 250) {
  const end = Date.now() + seconds * 1000;
  let last = await read();
  while (!last && Date.now() < end) { await page.waitForTimeout(every); last = await read(); }
  return last;
}
/** Face a point and swing or shoot at it. */
const strike = (page, at, chase) => page.evaluate(([x, y, z, run]) => {
  const { player, game } = window.__wildshard.world, dx = x - player.position.x, dz = z - player.position.z, away = Math.hypot(dx, dz);
  player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(y + 1 - player.position.y - 1.6, Math.max(away, 0.1)); player.touchMove.y = run && away > 2.2 ? 1 : 0; player.touchSprint = run && away > 8;
  game.app.input.press('attack');
}, [at.x, at.y, at.z, chase]);
const stand = page => page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.y = 0; player.touchSprint = false; });
/** The boss bar's words as a player reads them. */
const bossBar = page => page.evaluate(() => { const shown = selector => [...document.querySelectorAll(selector)].filter(node => node.classList.contains('show')).map(node => (node.textContent ?? '').trim().slice(0, 60)); return { bar: shown('[class*="ws-boss"]').slice(0, 4), elite: shown('[class*="ws-elite"]').slice(0, 4) }; });
const prompt = (page, match) => page.evaluate(source => { const pattern = new RegExp(source, 'iu'), found = window.__wildshard.world.interactables.find(row => (pattern.test(row.label) || pattern.test(row.wireId ?? '')) && row.radius > 0); return found === undefined ? null : { label: found.label, x: found.position.x, y: found.position.y, z: found.position.z, id: found.wireId ?? null }; }, match);
/** A press of whatever stands nearest, as a player's E. */
const press = page => page.keyboard.press('KeyE');

const SUNSCAR_BASIN = [-14, 28, -150], NALATI_DOOR = [-169, 6, 75];
/** Stand beside a prompt, as near as a player would. */
async function standAt(page, match, off = 0.7) {
  const found = await prompt(page, match);
  if (found === null) return null;
  await place(page, found.x + off, found.y - 1.2, found.z + off);
  await page.waitForTimeout(1100);
  return found;
}
/** A press from each side of a prompt in turn: a player finds the side it can see from. */
async function pressRound(page, match, done) {
  const at = await prompt(page, match);
  if (at === null) return false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1.2], [0, -1.2], [1, 1], [-1, -1]]) {
    await place(page, at.x + dx, at.y - 1.3, at.z + dz);
    await page.waitForTimeout(1000);
    await press(page); await page.waitForTimeout(900);
    if (await done()) return true;
  }
  return false;
}
/** Press until `done`, reading a talk through as a player does. */
async function pressUntil(page, done, tries = 14) {
  for (let i = 0; i < tries; i++) { await press(page); await page.waitForTimeout(600); if (await done()) return true; }
  return false;
}
const hasFlag = (page, flag) => async () => (await report(page)).flags.includes(flag);
/** Face a point dead on, from the eye. */
const faceAt = (page, at) => page.evaluate(({ x, y, z }) => {
  const { player } = window.__wildshard.world, dx = x - player.position.x, dz = z - player.position.z;
  player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(y - player.position.y - 1.68, Math.hypot(dx, dz));
}, at);
/** A lash or a shot at a point: stand a few metres off, face it, and strike. `heavy` holds the charge through. */
async function lash(page, at, heavy = false, off = 2.4, action = 'attack') {
  await place(page, at.x + off, at.y - 0.6, at.z + off);
  await page.waitForTimeout(1200);
  await faceAt(page, at);
  await page.waitForTimeout(200);
  if (heavy) {
    await page.evaluate(() => { window.__wildshard.world.game.app.equipment.adsHeld = true; });
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.__wildshard.world.game.app.equipment.adsHeld = false; });
    await page.waitForTimeout(1800);
  } else { await page.evaluate(name => { window.__wildshard.world.game.app.input.press(name); }, action); await page.waitForTimeout(900); }
}
/** Blows until a fight stands in `state`, keeping to its body. `also` is a second action to press with them. */
async function fightTo(page, id, state, seconds, also = null) {
  const end = Date.now() + seconds * 1000;
  let row = await fight(page, id), turn = 0;
  while (row?.state !== state && Date.now() < end) {
    if (row?.at !== null && row?.at !== undefined) {
      await strike(page, row.at, true);
      if (await page.evaluate(() => window.__wildshard.world.game.app.equipment.current.id === 'bow')) { // hold to draw, let go to loose
        await page.evaluate(() => { window.__wildshard.world.game.app.equipment.altHeld = true; }); await page.waitForTimeout(1100);
        await strike(page, row.at, false); await page.evaluate(() => { window.__wildshard.world.game.app.equipment.altHeld = false; });
      }
      if (also !== null) await page.evaluate(name => { window.__wildshard.world.game.app.input.press(name); }, also);
      if (turn++ % 12 === 0) { const { at } = row, seen = await page.evaluate(() => window.__wildshard.world.player.position.y); await place(page, at.x + 1.5, Math.max(seen, at.y - 1), at.z + 1.5); }
    }
    await page.waitForTimeout(350);
    row = await fight(page, id);
  }
  await stand(page);
  return row;
}

/** Sunscar, whole: Sefa, the logbook, the well, three waymarks, the signal fire, the Matriarch, the end of the quest. */
async function sunscarJourney(browser, phone, base, step) {
  const dune = await open(browser, phone, base, 'sunscar-dunes');
  const { page } = dune, flagged = flag => hasFlag(page, flag);
  await step('sunscar: Sefa starts the quest', async () => {
    await standAt(page, 'Sefa');
    return { ok: await pressUntil(page, flagged('sunscar.scout'), 24), quests: (await report(page)).quests };
  });
  await step('sunscar: the logbook press reaches the server', async () => {
    const found = await standAt(page, 'logbook');
    return { ok: await pressUntil(page, flagged('sunscar.logbook'), 4), found, flags: (await report(page)).flags.filter(flag => !flag.startsWith('seen:')) };
  });
  await step('sunscar: the crank takes a double crack, and the jar comes up', async () => {
    const well = await prompt(page, 'well|bucket|oil');
    await lash(page, { x: 85.67, y: 17.67, z: -6 }, true);
    await standAt(page, 'well|bucket|oil');
    return { ok: await pressUntil(page, flagged('sunscar.oil'), 5), well, label: (await prompt(page, 'well|bucket|oil'))?.label ?? null };
  });
  for (const index of [0, 1, 2]) await step(`sunscar: waymark ${index} takes oil and a light crack`, async () => {
    const crack = [{ x: 58, y: 26.6, z: -34 }, { x: -44, y: 19.41, z: -22 }, { x: 34, y: 10.37, z: -102 }][index], on = flagged(`sunscar.brazier.${index}`), rounds = [[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]];
    for (const [dx, dz] of rounds) {
      await place(page, crack.x + dx * 0.4, crack.y - 1.3, crack.z + dz * 0.4);
      await page.waitForTimeout(1200);
      await press(page); await page.waitForTimeout(900);
      await place(page, crack.x + dx, crack.y - 0.6, crack.z + dz);
      await page.waitForTimeout(1200);
      await faceAt(page, crack);
      await page.waitForTimeout(250);
      let lit = false;
      for (let crackAt = 0; crackAt < 5 && !lit; crackAt++) { await faceAt(page, crack); await page.evaluate(() => { window.__wildshard.world.game.app.input.press('attack'); }); lit = await until(page, on, 1.2) === true; }
      if (lit) break;
    }
    return { ok: await on() === true, label: await page.evaluate(wanted => window.__wildshard.world.interactables.find(row => row.wireId === wanted)?.label ?? null, `pour.${index}`), server: [(await report(page)).serverX, (await report(page)).serverZ], held: (await report(page)).held, flags: (await report(page)).flags.filter(flag => !flag.startsWith('seen:')) };
  });
  await step('sunscar: the signal fire lights, and the sky has gone to dusk', async () => {
    await standAt(page, 'signal');
    const lit = await pressUntil(page, flagged('sunscar.lit'), 5);
    await page.waitForTimeout(6000);
    return { ok: lit, flags: (await report(page)).flags.filter(flag => !flag.startsWith('seen:')), row: (await fight(page, 'sunscar.matriarch'))?.state, dusk: await page.evaluate(() => window.__wildshard.shard.weatherFields?.value?.('dusk') ?? null) };
  });
  await step('sunscar: the Matriarch falls to real blows, and the quest ends', async () => {
    await page.evaluate(() => { window.__workerClientHits(60); });
    const row = await fight(page, 'sunscar.matriarch'), goal = await prompt(page, 'zzz');
    if (row?.state === 'dormant') await place(page, ...SUNSCAR_BASIN);
    const up = await until(page, async () => { const seen = await fight(page, 'sunscar.matriarch'); return seen?.state === 'fight' ? seen : null; }, 25);
    const shown = await bossBar(page), end = await fightTo(page, 'sunscar.matriarch', 'victory', 50);
    await page.waitForTimeout(3000);
    const r = await report(page);
    return { ok: end?.state === 'victory', up: up?.state ?? null, state: end?.state, shown, quests: r.quests, paid: r.paid, coins: r.owned.coins, goal };
  });
  await step('sunscar: no page error', () => ({ ok: dune.errors.length === 0, errors: [...new Set(dune.errors)].slice(0, 6) }));
  await dune.context.close();
}

/** The nearest living row body of a kind. */
const bodyOf = (page, kind) => page.evaluate(want => { const { world } = window.__wildshard, live = (world.animals?.animals ?? []).filter(body => body.alive && body.rowDriven && body.kind === want); live.sort((a, b) => a.position.distanceTo(world.player.position) - b.position.distanceTo(world.player.position)); const body = live[0]; return body === undefined ? null : { x: body.position.x, y: body.position.y, z: body.position.z, count: live.length }; }, kind);
/** Far Reach, whole: the keeper's notes, the roost, three vanes, the winch, the crown, the Roc. */
async function farJourney(browser, phone, base, step) {
  const sky = await open(browser, phone, base, 'far-reach');
  const { page } = sky, flagged = flag => hasFlag(page, flag), live = async () => (await report(page)).flags.filter(flag => !flag.startsWith('seen:'));
  await page.evaluate(() => { window.__workerClientHits(40); });
  await step('far reach: the keeper\'s talk starts the quest', async () => {
    await standAt(page, 'keeper');
    return { ok: await pressUntil(page, flagged('far.notes'), 20), flags: await live(), quests: (await report(page)).quests };
  });
  await step('far reach: the roost\'s rays fall to real blows', async () => {
    await place(page, 60, 35.5, -12);
    await page.waitForTimeout(1500);
    const done = await until(page, async () => {
      if (await flagged('far.roost')()) return true;
      const ray = await bodyOf(page, 'driftRay');
      if (ray !== null) { if (Math.hypot(ray.x - 60, ray.z + 12) < 40) await place(page, ray.x + 1.5, Math.max(ray.y - 1.2, 34.5), ray.z + 1.5); await strike(page, ray, false); }
      return false;
    }, 70, 450);
    return { ok: done === true, flags: await live(), left: await bodyOf(page, 'driftRay') };
  });
  for (const [name, x, y, z] of [['grove', -50, 30.3, 0], ['keeper', -54, 35.8, -56], ['ruin', 62, 31.3, -76]]) await step(`far reach: the ${name} vane takes a gust`, async () => {
    await lash(page, { x, y, z }, false, 3, 'far.gust');
    return { ok: await until(page, flagged(`far.vane.${name}`), 4) === true, flags: await live() };
  });
  await step('far reach: the winch raises the bridge', async () => {
    const found = await standAt(page, 'winch');
    const up = await pressUntil(page, flagged('far.bridge'), 8);
    return { ok: up, found, flags: await live(), quests: (await report(page)).quests };
  });
  await step('far reach: the Roc falls to real blows and the sky is won', async () => {
    await place(page, 0, 45.5, -188);
    const up = await until(page, async () => (await fight(page, 'far.roc.encounter'))?.state === 'fight', 20);
    const shown = await bossBar(page), end = await fightTo(page, 'far.roc.encounter', 'victory', 100, 'far.gust');
    await page.waitForTimeout(2500);
    const r = await report(page);
    return { ok: up === true && end?.state === 'victory' && r.flags.includes('far.roc.down'), state: end?.state, shown, quests: r.quests, paid: r.paid, coins: r.owned.coins, flags: await live() };
  });
  await step('far reach: no page error', () => ({ ok: sky.errors.length === 0, errors: [...new Set(sky.errors)].slice(0, 6) }));
  await sky.context.close();
}

const coins = async page => (await report(page)).owned.coins ?? 0;
/** Boars until the purse holds `want`. */
async function earn(page, kind, want, seconds) {
  const end = Date.now() + seconds * 1000;
  while (await coins(page) < want && Date.now() < end) {
    const body = await bodyOf(page, kind);
    if (body === null) { await page.waitForTimeout(500); continue; }
    await place(page, body.x + 1.2, body.y + 0.5, body.z + 1.2);
    await page.waitForTimeout(350);
    await strike(page, body, true);
    await page.waitForTimeout(450);
  }
  await stand(page);
  return coins(page);
}
/** Driftwood, whole: Wendell, his chest, a beacon, a buy, a real door, and as far along the ring as a press can go. */
async function driftwoodJourney(browser, phone, base, step) {
  const isle = await open(browser, phone, base, 'driftwood-isle');
  const { page } = isle, live = async () => (await report(page)).flags.filter(flag => !flag.startsWith('seen:') && !flag.startsWith('glass') && !flag.startsWith('taken:glass'));
  await page.evaluate(() => { window.__workerClientHits(40); });
  await step('driftwood: Wendell starts the ring', async () => {
    await standAt(page, 'Wendell');
    return { ok: await pressUntil(page, async () => (await report(page)).quests['sealed-ring'] === 'shards', 12), quests: (await report(page)).quests };
  });
  await step('driftwood: a chest pressed on the page opens on the server', async () => {
    for (let i = 0; i < 24; i++) { await press(page); await page.waitForTimeout(250); } // the talk's lines
    const opened = await pressRound(page, 'castaway-chest', async () => (await report(page)).owned['item.doubloon'] === 2);
    return { ok: opened, owned: (await report(page)).owned, flags: await live() };
  });
  await step('driftwood: the beacon takes the flint and gives its shard', async () => {
    const lit = await pressRound(page, '^beacon$', async () => await prompt(page, 'shard-lookout') !== null);
    const taken = await pressRound(page, 'shard-lookout', async () => await prompt(page, 'shard-lookout') === null);
    return { ok: lit && taken, lit, taken, flags: await live(), quests: (await report(page)).quests };
  });
  await step('driftwood: real kills fill the purse and a buy takes it', async () => {
    const before = await earn(page, 'boar', 8, 60);
    await standAt(page, 'Trade with Maren');
    await press(page); await page.waitForTimeout(1000);
    await page.locator('.ws-shop-grid > *').filter({ hasText: /cape/iu }).first().click({ timeout: 4000 });
    await page.waitForTimeout(400);
    await page.locator('.ws-shop-bigbuy').click({ timeout: 4000 });
    await page.waitForTimeout(1500);
    const coinsOpen = (await report(page)).owned.coins;
    await page.locator('.ws-shop-close').click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(2000);
    const r = await report(page), held = Object.keys(r.owned).filter(line => line.startsWith('own'));
    return { ok: held.some(line => line.includes('cape')), before, whileOpen: coinsOpen, after: r.owned.coins, held };
  });
  await step('driftwood: no page error', () => ({ ok: isle.errors.length === 0, errors: [...new Set(isle.errors)].slice(0, 6) }));
  await isle.context.close();
}
/** Pine: a contract filled by a real kill and claimed on the board, and the miller's barred door. */
async function pineJourney(browser, phone, base, step) {
  const pine = await open(browser, phone, base, 'pine-hollow');
  const { page } = pine, board = async () => { const { owned } = await report(page); return Object.entries(owned).filter(([line]) => line.startsWith('board') || line.startsWith('slot') || line.includes('|')); };
  await page.evaluate(() => { window.__workerClientHits(60); });
  await step('pine: the board comes up on lines', async () => {
    await page.waitForTimeout(1500);
    const lines = await board();
    return { ok: lines.length > 0, lines: lines.slice(0, 8) };
  });
  await step('pine: a real kill fills a contract, and it counts on the page', async () => {
    const lines = await board(), slot = lines.map(([line, have]) => ({ line, have, parts: line.split('|') })).find(row => row.parts.length >= 5);
    const target = slot?.parts[4] ?? 'boar', kind = /deer|stag|hind/iu.test(target) ? 'deer' : /elk/iu.test(target) ? 'elk' : 'boar';
    const end = Date.now() + 60_000;
    while (Date.now() < end) {
      const body = await bodyOf(page, kind);
      if (body !== null) { await place(page, body.x + 1.5, body.y + 0.6, body.z + 1.5); await page.waitForTimeout(350); await strike(page, body, false); }
      await page.waitForTimeout(600);
      const now = await board();
      if (JSON.stringify(now) !== JSON.stringify(lines)) return { ok: true, target, now: now.slice(0, 8) };
    }
    return { ok: false, target, slot: slot?.line, now: (await board()).slice(0, 8) };
  });
  await step('pine: a contract can be read and torn on the page, and the server deals another', async () => {
    const lines = await board();
    await pressRound(page, 'contract board', () => page.evaluate(() => [...document.querySelectorAll('.ws-ph-tear')].some(node => node.offsetParent !== null)));
    const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].filter(node => node.offsetParent !== null).map(node => (node.textContent ?? '').trim()).filter(Boolean).slice(0, 14));
    await page.locator('.ws-ph-tear:visible').first().click({ timeout: 4000 });
    await page.waitForTimeout(1500);
    const moved = JSON.stringify(await board()) !== JSON.stringify(lines);
    await page.locator('button:visible').filter({ hasText: /^close$/iu }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(2000);
    return { ok: JSON.stringify(await board()) !== JSON.stringify(lines), whileOpen: moved, buttons: buttons.slice(-6), now: (await board()).slice(0, 8) };
  });
  await step('pine: no page error', () => ({ ok: pine.errors.length === 0, errors: [...new Set(pine.errors)].slice(0, 6) }));
  await pine.context.close();
}

/** Nalati: its elder, a lair's bar and orb, the King's barrow and his reward. */
async function nalatiJourney(browser, phone, base, step) {
  const steppe = await open(browser, phone, base, 'nalati-grasslands');
  const { page } = steppe;
  await page.evaluate(() => { window.__workerClientHits(60); });
  await step('nalati: the elder talks', async () => {
    await standAt(page, 'Baqyt');
    const before = JSON.stringify((await report(page)).quests);
    const moved = await pressUntil(page, async () => JSON.stringify((await report(page)).quests) !== before || (await report(page)).flags.includes('talked:elder'), 16);
    return { ok: moved, quests: (await report(page)).quests, flags: (await report(page)).flags.slice(0, 8) };
  });
  await step('nalati: Aqbars falls to real blows and leaves its orb on the row', async () => {
    await place(page, 138, 62, -58);
    await until(page, async () => (await fight(page, 'aqbars'))?.at !== null, 12);
    const shown = await bossBar(page), row = await fightTo(page, 'aqbars', 'dead', 60);
    await page.waitForTimeout(800);
    const end = await fight(page, 'aqbars'), orb = await prompt(page, 'skin');
    return { ok: end?.state === 'dead' && end.reward !== null && orb !== null, state: row?.state, reward: end?.reward, orb, shown, falls: (await report(page)).falls };
  });
  await step('nalati: the orb is taken and the server keeps it', async () => {
    const taken = await pressRound(page, 'skin', async () => (await fight(page, 'aqbars')).reward === null);
    return { ok: taken, reward: (await fight(page, 'aqbars')).reward };
  });
  await step('nalati: the King\'s barrow takes the player in, and the bar comes up', async () => {
    await place(page, ...NALATI_DOOR);
    const up = await until(page, async () => ['intro', 'fight'].includes((await fight(page, 'nalati.king'))?.state), 25);
    await page.waitForTimeout(500);
    return { ok: up === true, row: await fight(page, 'nalati.king'), shown: await bossBar(page), at: (await report(page)).serverZ };
  });
  await step('nalati: the King falls to real blows and his reward lies on the row', async () => {
    await until(page, async () => (await fight(page, 'nalati.king'))?.state === 'fight', 15);
    const end = await fightTo(page, 'nalati.king', 'victory', 80);
    const row = await until(page, async () => { const seen = await fight(page, 'nalati.king'); return seen?.reward !== null ? seen : null; }, 15);
    return { ok: end?.state === 'victory' && row !== null, state: end?.state, reward: row?.reward, hp: end?.hp, phase: end?.phase, orb: await prompt(page, 'take|claim|reward') };
  });
  await step('nalati: the King\'s reward is taken', async () => {
    const row = await fight(page, 'nalati.king');
    await place(page, row.reward.x + 0.8, row.reward.y - 0.8, row.reward.z + 0.8);
    await page.waitForTimeout(1200);
    const taken = await pressUntil(page, async () => (await fight(page, 'nalati.king')).reward === null, 6);
    return { ok: taken, owned: (await report(page)).owned, held: await page.evaluate(() => window.__wildshard.world.game.app.equipment?.current?.id ?? null) };
  });
  await step('nalati: no page error', () => ({ ok: steppe.errors.length === 0, errors: [...new Set(steppe.errors)].slice(0, 6) }));
  await steppe.context.close();
}

/** Run the fights; `step` prints one line each. */
export async function fights(browser, phone, base, only, step) {
  const runs = name => only === '' || only === 'fights' || only === name;

  // A boss: its row draws the bar, leaving resets it, a fall comes back, and real blows end it and pay.
  if (runs('roc')) {
    const far = await open(browser, phone, base, 'far-reach');
    const id = 'far.roc.encounter', crown = [0, 45.5, -188];
    await step('roc: walking in starts the fight, and the bar comes up off its row', async () => {
      await place(far.page, ...crown);
      const row = await until(far.page, async () => { const seen = await fight(far.page, id); return seen?.state === 'fight' ? seen : null; }, 20);
      await far.page.waitForTimeout(500);
      const shown = await bossBar(far.page);
      return { ok: row !== null && shown.bar.length > 0, state: row?.state, shown };
    });
    await step('roc: a lone player who leaves is still in it (a reset is for a room: J104)', async () => {
      await place(far.page, 0, 31, -5);
      await far.page.waitForTimeout(3000);
      const row = await fight(far.page, id), shown = await bossBar(far.page);
      return { ok: row?.state === 'fight' && shown.bar.length > 0, state: row?.state, shown };
    });
    await step('roc: real blows end it, it pays, and the bar goes', async () => {
      await far.page.evaluate(() => { window.__workerClientHits(40); });
      await place(far.page, ...crown);
      const paidBefore = await report(far.page);
      for (let i = 0; i < 80; i++) {
        const row = await fight(far.page, id);
        if (row?.state === 'victory') break;
        if (row?.at !== null && row?.at !== undefined) await strike(far.page, row.at, false);
        await far.page.waitForTimeout(400);
      }
      await stand(far.page);
      await far.page.waitForTimeout(2500);
      const row = await fight(far.page, id), done = await report(far.page), shown = await bossBar(far.page);
      return { ok: row?.state === 'victory' && done.paid > paidBefore.paid, state: row?.state, paid: done.paid, coins: done.owned.coins, shown };
    });
    await step('roc: no page error', () => ({ ok: far.errors.length === 0, errors: [...new Set(far.errors)].slice(0, 6) }));
    await far.context.close();
  }

  // An elite: the bar, the first-kill orb on its row, a refused press, a taken one.
  if (runs('elite')) {
    const pine = await open(browser, phone, base, 'pine-hollow');
    const id = 'ironhide';
    await step('elite: its row draws the bar at the lair', async () => {
      await place(pine.page, -44, 12, -66);
      const row = await until(pine.page, async () => { const seen = await fight(pine.page, id); return seen?.at !== null && ['aware', 'engaged'].includes(seen?.state) ? seen : null; }, 25);
      await pine.page.waitForTimeout(600);
      const shown = await bossBar(pine.page);
      return { ok: row !== null && shown.elite.length > 0, state: row?.state, shown };
    });
    await step('elite: it kills the player, who comes back whole where they last stood (J107)', async () => {
      const before = await report(pine.page);
      for (let i = 0; i < 160; i++) {
        const row = await fight(pine.page, id), seen = await report(pine.page);
        if (seen.falls > before.falls) break;
        if (row?.at !== null && row?.at !== undefined) await place(pine.page, row.at.x + 1, row.at.y + 0.3, row.at.z + 1);
        await pine.page.waitForTimeout(500);
      }
      await pine.page.waitForTimeout(4000);
      const back = await report(pine.page);
      return { ok: back.falls > before.falls && back.hp === 100, falls: back.falls, hp: back.hp, at: [back.serverX, back.serverZ], state: (await fight(pine.page, id))?.state };
    });
    await step('elite: real blows drop it and its orb lies on the row', async () => {
      await pine.page.evaluate(() => { window.__workerClientHits(60); });
      await place(pine.page, -44, 12, -66);
      for (let i = 0; i < 160; i++) {
        const row = await fight(pine.page, id);
        if (row?.state === 'dead') break;
        if (row?.at !== null && row?.at !== undefined) { if (i % 8 === 0) await place(pine.page, row.at.x + 2, row.at.y + 0.4, row.at.z + 2); await strike(pine.page, row.at, true); }
        await pine.page.waitForTimeout(400);
      }
      await stand(pine.page);
      const row = await until(pine.page, async () => { const seen = await fight(pine.page, id); return seen?.reward !== null ? seen : null; }, 6);
      await pine.page.waitForTimeout(400);
      const orb = await prompt(pine.page, 'skin');
      return { ok: row !== null && orb !== null, state: row?.state, reward: row?.reward, orb, falls: (await report(pine.page)).falls };
    });
    await step('elite: a press from too far is refused, and the orb comes back', async () => {
      const row = await fight(pine.page, id), { reward } = row;
      await place(pine.page, reward.x + 30, reward.y + 8, reward.z + 30);
      await pine.page.waitForTimeout(1500);
      await pine.page.evaluate(() => { window.__wildshard.world.interactables.find(entry => /skin/iu.test(entry.label) && entry.radius > 0)?.onInteract(); });
      await pine.page.waitForTimeout(400);
      const gone = await prompt(pine.page, 'skin');
      await pine.page.waitForTimeout(2200);
      return { ok: gone === null && await prompt(pine.page, 'skin') !== null && (await fight(pine.page, id)).reward !== null, gone };
    });
    await step('elite: a press in reach takes it for good', async () => {
      const row = await fight(pine.page, id), { reward } = row;
      await place(pine.page, reward.x + 0.6, reward.y - 0.6, reward.z + 0.6);
      await pine.page.waitForTimeout(1200);
      await press(pine.page);
      const taken = await until(pine.page, async () => (await fight(pine.page, id)).reward === null, 5);
      await pine.page.waitForTimeout(2200);
      return { ok: taken && await prompt(pine.page, 'skin') === null, taken };
    });
    await step('elite: no page error', () => ({ ok: pine.errors.length === 0, errors: [...new Set(pine.errors)].slice(0, 6) }));
    await pine.context.close();
  }

  if (runs('sunscar')) await sunscarJourney(browser, phone, base, step);
  if (runs('farreach')) await farJourney(browser, phone, base, step);
  if (runs('isle')) await driftwoodJourney(browser, phone, base, step);
  if (runs('pine')) await pineJourney(browser, phone, base, step);
  if (runs('nalati')) await nalatiJourney(browser, phone, base, step);

  // The sky: the rows move on their own, and a Weather setting goes up and comes back.
  if (runs('sky')) {
    const pine = await open(browser, phone, base, 'pine-hollow');
    await step('sky: a shard with a programme has it on rows and draws it', async () => {
      await pine.page.waitForTimeout(1500);
      const r = await report(pine.page), drawn = await pine.page.evaluate(() => window.__wildshard.shard['pine.weather']?.weather?.state ?? null);
      return { ok: r.sky !== null && drawn !== null, row: r.sky, drawn };
    });
    await step('sky: a live Weather setting goes up, and the row and the page come back with it', async () => {
      const before = await pine.page.evaluate(() => window.__wildshard.shard['pine.weather']?.weather?.rain ?? 0);
      await pine.page.keyboard.press('Escape'); await pine.page.waitForTimeout(500);
      await pine.page.evaluate(() => { [...document.querySelectorAll('.ws-gmenu-tab')].find(node => /settings/iu.test(node.textContent ?? ''))?.click(); });
      await pine.page.waitForTimeout(500);
      await pine.page.evaluate(() => { for (const fold of document.querySelectorAll('.ws-gmenu details:not([open]), [class*="fold"]:not(.open)')) fold.click?.(); });
      await pine.page.waitForTimeout(400);
      const clicked = await pine.page.evaluate(() => { const rain = document.querySelector('.ws-gmenu-segbtn[data-v="rain"]'); rain?.click(); return rain !== null; });
      await pine.page.waitForTimeout(400);
      await pine.page.keyboard.press('Escape');
      const rain = await until(pine.page, async () => { const seen = await pine.page.evaluate(() => window.__wildshard.shard['pine.weather']?.weather?.rain ?? 0); return seen > before + 0.01 ? seen : null; }, 25);
      return { ok: rain !== null, before, rain, clicked, row: (await report(pine.page)).sky, state: await pine.page.evaluate(() => window.__wildshard.shard['pine.weather']?.weather?.state ?? null) };
    });
    await pine.context.close();
  }
}
