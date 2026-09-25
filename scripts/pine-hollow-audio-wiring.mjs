#!/usr/bin/env node
// pine-hollow-audio-wiring.mjs — the audio-wiring lane's evidence (PINE-HOLLOW-REMASTER A-rows): one MUTED headless browser
// (--mute-audio, &mute=1, audio.muted) drives Pine Hollow through each trigger and reads `window.__audioLog`
// (src/audio/audioLog.ts) after each: a lever shot, an NPC talk (Hale), rain, a door, day → night, a waystone relight, the
// zone spots, a zipline ride; then the Antler King (`?boss=antler-king&bossGod=1`) phases I → III and his fall; then
// `?quest=dawn` (the dawn sting). Every page request under /assets/music|sfx after the loading bar (window.__world is set
// once the bar's last step is done) is a lazy fetch — E44 wants none. Last, the same context goes OFFLINE and reloads: the
// service worker must serve the whole boot (the Pine Hollow audio with it) and night must still decode.
//
//   node scripts/pine-hollow-audio-wiring.mjs --url=http://localhost:4331 [--out=progress/pine-hollow-audio-wiring-01.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL0 = flag('url', 'http://localhost:4331');
const OUT = flag('out', 'progress/pine-hollow-audio-wiring-01.json');
const BASE = 'chunk=pine-hollow&tier=phone&skipintro=1&mute=1';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = { url: URL0, when: new Date().toISOString(), steps: [], lazyAudioFetches: [], failedAudio: [], offline: null, errors: [] };
let ready = false, stepName = 'boot';
page.on('request', (r) => { const u = new URL(r.url()); if (ready && /^\/assets\/(music|sfx)\//.test(u.pathname)) report.lazyAudioFetches.push({ step: stepName, path: u.pathname }); });
page.on('requestfailed', (r) => { const u = new URL(r.url()); if (/^\/assets\/(music|sfx)\//.test(u.pathname)) report.failedAudio.push({ step: stepName, path: u.pathname, err: r.failure()?.errorText }); });
page.on('pageerror', (e) => { report.errors.push(String(e)); });

async function boot(q) {
  ready = false; stepName = `boot ${q}`;
  const t0 = Date.now();
  await page.goto(`${URL0}/?${BASE}&${q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__world !== undefined, null, { timeout: 240_000, polling: 500 });
  ready = true;
  const bootMs = Date.now() - t0;
  // the gesture that resumes the AudioContext (and starts the music); muted three ways
  await page.mouse.click(195, 420);
  // ENTER WORLD's own handler (main.ts `enter`: the audio resumed, the music out of the title into the shard's calm)
  await page.evaluate(() => { const w = window.__world; w.audio.muted = true; w.hud.onResume?.(); w.audio.muted = true; });
  await sleep(2500);
  return bootMs;
}
const mark = () => page.evaluate(() => window.__audioLog.length);
async function step(name, fn, waitMs = 2500) {
  stepName = name;
  const from = await mark();
  const extra = await fn();
  await sleep(waitMs);
  const log = await page.evaluate((f) => window.__audioLog.slice(f), from);
  const stems = await page.evaluate(() => { const s = window.__world.music.stems; return { source: s.source, slot: s.slot, scene: s.scene, phase: s.phase, tension: s.tension, layers: s.layers }; });
  report.steps.push({ step: name, log, stems, ...(extra ? { extra } : {}) });
  const line = log.map((e) => `${e.kind}:${e.name}${e.ok === false ? '(!)' : ''}`).join(' ');
  console.log(`· ${name}: ${line === '' ? '(nothing)' : line}`);
}

// ── 1. the Hollow by day: Hale, the lever gun, rain, a door, night, a lantern, the zones, the zipline ──
report.bootMs = await boot('quest=ranger&weapon=lever');
await step('day: boot + first frames', async () => ({ decoded: await page.evaluate(() => window.__world.ambience.sfx.decoded.length) }), 500);
await step('lever-action shot (+ cycle, ridge echo)', () => page.evaluate(() => { window.__lever.tryFire(); }), 2500);
await step('NPC talk: Hale (talk-open bark)', () => page.evaluate(() => { const p = window.__pineQuest.people.find((x) => x.kind === 'ranger') ?? window.__pineQuest.people[0]; p.prompt.onInteract(); return p.kind; }), 2000);
await step('rain', () => page.evaluate(() => { window.__pineWeather.weather.force('rain', 0.6); }), 3000);
await step('cabin door open + close', () => page.evaluate(() => {
  const d = window.__world.cabins.interactables.find((i) => i.label === 'Open door');
  if (!d) return 'no door';
  window.__world.player.spawn(d.position.x + 2, d.position.z + 2, 0);
  d.onInteract(); setTimeout(() => { d.onInteract(); }, 900);
  return d.label;
}), 2500);
await step('day → night (the clock)', () => page.evaluate(() => { window.__pineWeather.weather.force('clear', 0.5); window.__pineQuest.night(); }), 9000);
await step('waystone relight (pond lantern)', () => page.evaluate(() => {
  const q = window.__pineQuest; q.flags.clear?.('lit:pond'); q.flags.set('taken:pond-glass');
  const it = q.lanterns.pond; window.__world.player.spawn(it.position.x + 1.5, it.position.z + 1.5, 0); it.onInteract();
}), 2000);
for (const [zone, x, z] of [['waterfall', -88, 152], ['creek', -151, 14], ['mill', -186, -150], ['ridge', 36, 208], ['oldgrowth', 120, -80], ['cave', 198.5, 198.5]]) {
  await step(`zone: ${zone}`, () => page.evaluate(([px, pz]) => { window.__world.player.spawn(px, pz, 0); }, [x, z]), 2500);
}
await step('mill wheel turning (the errand done)', () => page.evaluate(() => { window.__world.player.spawn(-186, -150, 0); window.__world.cabins.wheelSpeed = 0.55; }), 2000);
await step('zipline ride', () => page.evaluate(() => { const q = window.__pineQuest; q.goto('zip'); setTimeout(() => { q.zip.prompt.onInteract(); }, 600); }), 12000);

// ── 2. the Antler King: phases I → III, his fall ──
report.kingBootMs = await boot('boss=antler-king&bossGod=1');
const king = (frac) => page.evaluate((f) => { const k = window.__antlerKing.fight.king; if (!k) return 'no king'; k.hp = Math.max(1, Math.round(k.maxHp * f)); return k.hp; }, frac);
await step('King: into the stones (intro → phase I)', () => page.evaluate(() => { window.__world.player.spawn(150, -14, 0); }), 7000);
await step('King: phase II (Lanterns Fall)', () => king(0.55), 5000);
await step('King: phase III (the Last Light)', () => king(0.25), 5000);
await step('King: falls (back to the calm)', () => page.evaluate(() => { const k = window.__antlerKing.fight.king; if (k) { k.hp = 0; k.alive = false; } }), 6000);

// ── 3. the dawn ──
report.dawnBootMs = await boot('quest=dawn');
await sleep(10_000); // the page's own ?quest=dawn run may land before the gesture built the music: run the beat again, awake
await step('quest dawn beat (dawn sting)', () => page.evaluate(() => { window.__pineQuest.goto('dawn'); }), 9000);

// ── 4. offline: the same context, no network — the worker serves the boot, night still decodes ──
stepName = 'offline';
await context.setOffline(true);
try {
  const ms = await boot('quest=ranger');
  await step('OFFLINE: day → night (calm-night decoded from the offline cache)', () => page.evaluate(() => { window.__pineQuest.night(); }), 14000);
  await step('OFFLINE: a bark', () => page.evaluate(() => { const p = window.__pineQuest.people[0]; p.prompt.onInteract(); }), 1500);
  report.offline = { ok: true, bootMs: ms, sw: await page.evaluate(() => navigator.serviceWorker.controller !== null) };
} catch (e) { report.offline = { ok: false, error: String(e) }; }
await context.setOffline(false);
await browser.close();

// the verdict per trigger
const all = report.steps.flatMap((s) => s.log.map((e) => ({ ...e, step: s.step })));
const saw = (kind, name, needOk = true) => all.some((e) => e.kind === kind && e.name === name && (!needOk || e.ok !== false));
report.triggers = {
  'music: day→night scene': saw('music', 'scene:night', false) && saw('music', 'deck:night'),
  'music: boss + phases 1→3': saw('music', 'scene:boss', false) && saw('music', 'phase:2', false) && saw('music', 'phase:3', false) && saw('music', 'deck:boss'),
  'music: back to calm after the King': all.some((e) => e.step.startsWith('King: falls') && e.kind === 'music' && /^scene:(night|day)$/.test(e.name)),
  'music: dawn sting': saw('music', 'sting:dawn', false),
  'bed: night': saw('bed', 'night', false), 'bed: rain': saw('bed', 'rain-canopy', false) || saw('bed', 'rain-open', false),
  // a zone is live when its bed comes up and its loop plays (`bed … loop in`) as you walk into it
  'zone beds: waterfall / creek / mill / ridge / oldgrowth / cave': ['waterfall', 'creek', 'mill', 'ridge', 'oldgrowth', 'cave'].every((z) => all.some((e) => e.kind === 'bed' && e.name === z && e.detail === 'loop in')),
  'sfx: leverShot / leverCycle / leverEcho': saw('sfx', 'leverShot') && saw('sfx', 'leverCycle') && saw('sfx', 'leverEcho'),
  'sfx: lanternCreak + lanternLight': saw('sfx', 'lanternCreak') && saw('sfx', 'lanternLight'),
  'sfx: zipline': saw('sfx', 'zipline'), 'sfx: doors': saw('sfx', 'doorOpen') && saw('sfx', 'doorClose'),
  'sfx: King bells / roar / stomp': saw('sfx', 'king_bells') && saw('sfx', 'king_roar') && saw('sfx', 'king_stomp'),
  'sfx: thralls (call / groan / move)': saw('sfx', 'thrall_call') && (saw('sfx', 'thrall_groan') || saw('sfx', 'thrall_move')),
  'sfx: deer snort (seen when a deer went alert on the way)': saw('sfx', 'deer_snort'),
  'music: an engaged elite → combat': all.some((e) => e.kind === 'wire' && e.name === 'elite:engaged') && saw('music', 'mode:combat', false),
  'bark: talk-open': all.some((e) => e.kind === 'bark' && e.ok !== false),
  'no audio fetched after the bar': report.lazyAudioFetches.length === 0,
  'offline reload works': report.offline?.ok === true,
  'offline: calm-night decodes from the cache': all.some((e) => e.step.startsWith('OFFLINE') && e.kind === 'music' && e.name === 'deck:night'),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
console.log(report.triggers, `\nlazy audio fetches: ${report.lazyAudioFetches.length} · failed: ${report.failedAudio.length} · errors: ${report.errors.length}\n→ ${OUT}`);
