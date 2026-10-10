// era-audio.mjs — record a historical build's own sound from its own AudioContext (PROGRESS-TRAILER §3.4 "Era-true SFX",
// PT8, E468). Days 1 and 8 synthesise much of their sound in WebAudio (day 1 all of it: `568a1463f:src/audio/Audio.ts`;
// day 8 Driftwood's combat layers and zoned ambience: `2d2c5815a:src/audio/{IslandSfx,IslandAmbience}.ts`), so there is no
// file to extract; this records it. On every build it also logs which audio file each sound played, so the extracted
// files of days 15 / 22 are the ones the take really triggers.
//
//   scripts/browser-lane.sh --max 20 node scripts/progress-trailer/era-audio.mjs --url=http://127.0.0.1:4761 --out=<dir> \
//     --mode=calls --recipe=d01                                   # isolated one-shots through the build's own audio methods
//   … --mode=bed --query='chunk=pine-hollow' --spot=230,0,1.1 --sec=24 --name=bed-rewind   # the ambient bed at a spot
//   … --mode=take --shot=scripts/progress-trailer/shots/w1-combo.mjs [--opt='<json>'] [--name=…]  # a take's track, real time
//
// The page runs in REAL time (no fake clock: WebAudio schedules on its own clock). An init script subclasses the page's
// AudioContext so its `destination` is a gain that feeds only a MediaStreamDestination (and the context's sink is
// {type:'none'}): nothing reaches the speakers, and a MediaRecorder (lossless PCM in WebM where Chrome has it) records
// exactly what the build would have played. Music is silenced (the build's own music volume 0, and any buffer decoded from
// /assets/music/ is disconnected as it starts; media elements are muted), so the recording is SFX and ambience only.
// Every AudioBufferSourceNode start whose buffer came from a fetched audio file is logged with its URL, offset, duration
// and loop points (sprites included). Writes <out>/<sha8>/<name>.wav (48 kHz 24-bit, via ffmpeg) + <name>.json
// ({ sha, query, sec, files: [{ dt, url, offset, duration, loop… }], events, mime }) per sound.
// Calls mode: one recipe per era scene (RECIPES below); each sound is recorded on its own with the bed muted.
// Take mode: a shot module from shots/ (take.mjs's format), its setup then its step track per 1/60 s of real time.
// The browser is launched WITHOUT --mute-audio (the recorder needs the audio graph to run), always muted at the sink.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
const require = createRequire(join(HERE, '../../package.json'));
const { chromium } = require('playwright');

const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL_BASE = arg('url'), OUT = resolve(arg('out', 'era-audio')), MODE = arg('mode', 'calls');
const noMute = (q) => q.split('&').filter((p) => p !== '' && p !== 'mute=1').join('&');

// the legacy world (days 1–8: window.__world) or the app world (day 15 on: window.__wildshard.world)
const WORLD = '(window.__world ?? window.__wildshard?.world)';

// Calls-mode recipes. `quiet` mutes the bed before the one-shots; each sound's `js` runs with W (the world), a (its
// audio), P (the player) and ahead(d) (a world point d m in front of the eye) in scope; `sec` is the recording after it.
const RECIPES = {
  // day 1 (568a1463f): all synth. Fired from the south gate (far from every herd), as d01-hunt waits there.
  d01: {
    query: 'nolock=1&skipintro=1',
    spot: [0, -236, Math.PI],
    quiet: 'a.setAmbient(false)',
    sounds: [
      { name: 'crossbowFire', js: 'a.crossbowFire()', sec: 0.8 },
      { name: 'reload', js: 'a.reload()', sec: 1.8 },
      { name: 'boltImpact-flesh', js: "a.boltImpact('flesh', 0, 1)", sec: 0.8 },
      { name: 'boltImpact-ground', js: "a.boltImpact('ground', 0, 1)", sec: 0.8 },
      { name: 'boltImpact-wood', js: "a.boltImpact('wood', 0, 1)", sec: 0.8 },
      { name: 'hitMarker', js: 'a.hitMarker()', sec: 0.6 },
      { name: 'kill', js: 'a.kill()', sec: 1 },
      { name: 'footsteps-walk', js: 'for (let i = 0; i < 6; i++) setTimeout(() => a.footstep(false), i * 450)', sec: 3.2 },
      { name: 'deer_call', js: "a.animal('deer_call', ahead(15), P.position, P.yaw)", sec: 1.2 },
      { name: 'hoofsteps', js: "a.animal('hoofsteps', ahead(15), P.position, P.yaw)", sec: 1.2 },
    ],
  },
  // day 8 (2d2c5815a) on Driftwood: the sword's island layers are the procedural bank (IslandSfx via audio.voices), the
  // boar's barks too; the speeds / strengths are Sword.ts's (light 0.7, finisher 0.85; strikes 0.5 / 0.75)
  'd08-island': {
    query: 'chunk=driftwood-isle&nolock=1&skipintro=1',
    near: 'boar',
    quiet: 'a.setAmbient(false)',
    prep: 'W.islandSfx?.prewarm?.()',
    sounds: [
      { name: 'whoosh-1', js: 'W.islandSfx.whoosh(0.7, { heavy: false, dir: -1 })', sec: 0.8 },
      { name: 'whoosh-2', js: 'W.islandSfx.whoosh(0.7, { heavy: false, dir: 1 })', sec: 0.8 },
      { name: 'whoosh-finisher', js: 'W.islandSfx.whoosh(0.85, { heavy: false, dir: -1 })', sec: 0.9 },
      { name: 'impact-flesh-combo', js: "W.islandSfx.impact('flesh', 0.5, ahead(2.4))", sec: 0.8 },
      { name: 'impact-flesh-finisher', js: "W.islandSfx.impact('flesh', 0.75, ahead(2.4))", sec: 0.9 },
      { name: 'boar-vocal', js: "W.islandSfx.vocal('boar', ahead(2.4), 1)", sec: 1.2 },
      { name: 'boar-windup', js: "W.islandSfx.windup('boar', ahead(2.4))", sec: 1.2 },
      { name: 'boar_grunt', js: "W.islandSfx.animal('boar_grunt', ahead(2.4)) || a.animal('boar_grunt', ahead(2.4), P.position, P.yaw)", sec: 1.2 },
      { name: 'boar_squeal', js: "W.islandSfx.animal('boar_squeal', ahead(2.4)) || a.animal('boar_squeal', ahead(2.4), P.position, P.yaw)", sec: 1.2 },
      { name: 'footsteps-sand', js: "for (let i = 0; i < 6; i++) setTimeout(() => W.islandSfx.footstep('sand', 4.3), i * 450)", sec: 3.2 },
    ],
  },
  // day 8 on Pine Hollow (the rewind's second build): the 'best' set's files, played through the build's own chain
  'd08-pine': {
    query: 'chunk=pine-hollow&nolock=1&skipintro=1&tracer=0',
    spot: [0, -236, Math.PI],
    quiet: 'a.setAmbient(false)',
    sounds: [
      { name: 'crossbowFire', js: 'a.crossbowFire()', sec: 1 },
      { name: 'boltImpact-flesh', js: "a.boltImpact('flesh', 0, 1)", sec: 1 },
      { name: 'kill', js: 'a.kill()', sec: 1.2 },
      { name: 'hitMarker', js: 'a.hitMarker()', sec: 0.8 },
      { name: 'footsteps-litter', js: "for (let i = 0; i < 6; i++) setTimeout(() => a.footstep(false, 'litter'), i * 450)", sec: 3.2 },
    ],
  },
  // days 15 / 22 on Pine Hollow: the rewind's impact and kill through the crossbow's own handlers (the code a real hit runs:
  // weapons.onImpact → the impact cue, weapons.onHit → hit marker + kill), 12 m out as the stag stands
  'app-pine-kill': {
    query: 'chunk=pine-hollow&nolock=1&skipintro=1',
    spot: [230, 0, 1.13],
    quiet: "a.setAmbient(false); const amb = a.bus?.('ambience'); if (amb) amb.gain.value = 0", // the zoned beds sit on the ambience bus
    sounds: [
      { name: 'crossbowFire', js: 'W.weapons.onFire?.()', sec: 1 },
      { name: 'boltImpact-flesh', js: "W.weapons.onImpact('flesh', ahead(12))", sec: 1 },
      { name: 'hit-kill', js: "W.weapons.onHit('deer', true, true)", sec: 1.5 },
    ],
  },
  // day 22 on Sunscar Dunes: the whip is the held weapon; its crack is the shard's routed kit voice (cue.fire → kit.swordSwing)
  'd22-whip': {
    query: 'chunk=sunscar-dunes&nolock=1&skipintro=1',
    quiet: 'a.setAmbient(false)',
    sounds: [
      { name: 'whip-1', js: 'W.weapons.tryFire()', sec: 1.2 },
      { name: 'whip-2', js: 'W.weapons.tryFire()', sec: 1.2 },
      { name: 'whip-impact', js: "W.weapons.onImpact?.('flesh', ahead(5))", sec: 1 },
    ],
  },
};

// in the page before any script: the recording context, the file log and the music guard
const INIT = () => {
  const AUDIO = /\.(m4a|mp3|ogg|opus|wav|webm|flac|aac)(\?|$)/iu;
  const log = [], bySize = new Map(), urlOf = new WeakMap(), bufUrl = new WeakMap();
  window.__eraLog = log;
  window.__eraT0 = performance.now();
  window.__eraCtx = [];
  window.__eraDropped = [];
  window.__eraLoops = [];
  const orig = (proto, key) => Object.getOwnPropertyDescriptor(proto, key).value;
  const pab = orig(Response.prototype, 'arrayBuffer');
  Response.prototype.arrayBuffer = async function arrayBuffer() {
    const b = await Reflect.apply(pab, this, []);
    if (AUDIO.test(this.url)) { urlOf.set(b, this.url); bySize.set(b.byteLength, this.url); }
    return b;
  };
  const pd = orig(BaseAudioContext.prototype, 'decodeAudioData');
  BaseAudioContext.prototype.decodeAudioData = function decodeAudioData(ab, ok, err) {
    // a file fetched another way (a stream reader, the preload cache) is named by its byte length; Node resolves it
    // against the served build's audio files (--dist)
    const url = urlOf.get(ab) ?? bySize.get(ab.byteLength) ?? (ab.byteLength > 0 ? `bytes:${ab.byteLength}` : null);
    const p = Reflect.apply(pd, this, [ab, ok ? (b) => { if (url) bufUrl.set(b, url); ok(b); } : undefined, err]);
    return p.then((b) => { if (url) bufUrl.set(b, url); return b; });
  };
  const ps = orig(AudioBufferSourceNode.prototype, 'start');
  AudioBufferSourceNode.prototype.start = function start(when, offset, duration) {
    const url = this.buffer ? bufUrl.get(this.buffer) : undefined;
    const music = url && (/\/assets\/music\//u.test(url) || window.__eraMusicBytes?.has(url));
    if (music) { this.disconnect(); window.__eraDropped.push(url); }
    else if (url) {
      const row = { dt: Math.round(performance.now() - window.__eraT0) / 1000, url: url.startsWith('bytes:') ? url : new URL(url, location.href).pathname, offset: offset ?? 0,
        duration: duration ?? null, bufferSec: Math.round(this.buffer.duration * 1000) / 1000, loop: this.loop,
        loopStart: this.loop ? this.loopStart : undefined, loopEnd: this.loop ? this.loopEnd : undefined, rate: this.playbackRate.value };
      log.push(row);
      // every loop (a bed, a hum) since the page loaded, and whether it still plays: a bed started before a recording
      if (this.loop) { const l = { ...row }; window.__eraLoops.push(l); this.addEventListener('ended', () => { l.ended = true; }); }
    }
    Reflect.apply(ps, this, [when ?? 0, offset, duration]);
  };
  const playMedia = orig(HTMLMediaElement.prototype, 'play');
  HTMLMediaElement.prototype.play = function play() { this.muted = true; this.volume = 0; return Reflect.apply(playMedia, this, []); };
  const AC = window.AudioContext;
  class RecordedContext extends AC {
    constructor(o) {
      super(o);
      const tap = this.createGain(), msd = this.createMediaStreamDestination();
      tap.connect(msd);
      Object.defineProperty(this, 'destination', { get: () => tap, configurable: true });
      window.__eraCtx.push({ ctx: this, msd });
      const quiet = () => { /* no device sink: nothing reaches the speakers either way */ };
      try { void this.setSinkId?.({ type: 'none' })?.catch?.(quiet); } catch { quiet(); }
    }
  }
  window.AudioContext = RecordedContext;
  window.webkitAudioContext = RecordedContext;
};

// page helpers, installed once the world is up
const HELPERS = `(() => {
  window.__eraW = ${WORLD};
  const W = window.__eraW;
  window.__eraAhead = (d) => { const p = W.player.position, y = W.player.yaw; return { x: p.x - Math.sin(y) * d, y: p.y + 1.2, z: p.z - Math.cos(y) * d }; };
  window.__eraRecStart = () => {
    const mime = ['audio/webm;codecs=pcm', 'audio/webm;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    window.__eraRecs = window.__eraCtx.filter((e) => e.ctx.state !== 'closed').map((e) => {
      const rec = new MediaRecorder(e.msd.stream, { mimeType: mime, audioBitsPerSecond: 320000 }), chunks = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      rec.start(250);
      return { rec, chunks, mime, rate: e.ctx.sampleRate, state: e.ctx.state };
    });
    window.__eraLog.length = 0;
    window.__eraT0 = performance.now();
    return { mime, contexts: window.__eraRecs.length };
  };
  window.__eraRecStop = () => Promise.all(window.__eraRecs.map((r) => new Promise((res) => {
    r.rec.onstop = async () => {
      const u8 = new Uint8Array(await new Blob(r.chunks, { type: r.mime }).arrayBuffer());
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      res({ b64: btoa(s), mime: r.mime, rate: r.rate, state: r.state });
    };
    r.rec.stop();
  }))).then((recs) => ({ recs, files: window.__eraLog.slice(), loops: window.__eraLoops.filter((l) => !l.ended), dropped: [...new Set(window.__eraDropped)] }));
  // the build's own music to 0 (the legacy and app Music both persist a 'music' volume through Settings)
  try { if (W.music && 'volume' in W.music) W.music.volume = 0; } catch { /* no music handle */ }
  try { W.audio?.resume?.(); } catch { /* resumed on the build's own enter */ }
  let samples = null;
  try { samples = W.audio?.samples ?? null; } catch { /* no sample bank on this build */ }
  return { keys: Object.keys(W).length, audio: Boolean(W.audio), music: Boolean(W.music), contexts: window.__eraCtx.length, samples };
})()`;

const HOLD = `(() => {
  const w = ${WORLD};
  const ACTION = { KeyW: 'move.forward', KeyS: 'move.back', KeyA: 'move.left', KeyD: 'move.right', ShiftLeft: 'sprint', Space: 'jump' };
  window.__hold = (code, on) => {
    const input = w.player.inputService;
    if (input && ACTION[code]) input.setHeld(ACTION[code], on);
    else if (on) w.player.keys.add(code);
    else w.player.keys.delete(code);
  };
})()`;

// --dist: the served build's folder; its audio files by byte length name a buffer whose fetch the log didn't see
const DIST = arg('dist');
const bySize = new Map();
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(m4a|mp3|ogg|opus|wav|webm|flac|aac)$/u.test(e.name)) {
      const k = `bytes:${statSync(p).size}`;
      bySize.set(k, [...(bySize.get(k) ?? []), `/${relative(DIST, p)}`]);
    }
  }
};
if (DIST) walk(DIST);
const musicBytes = [...bySize].filter(([, ps]) => ps.some((p) => p.includes('/assets/music/'))).map(([k]) => k);
const named = (url) => (url.startsWith('bytes:') ? (bySize.get(url) ?? [url]).join(' | ') : url);

const sha = (await (await fetch(`${URL_BASE}/SHA`)).text()).trim();
const dir = join(OUT, sha.slice(0, 8));
mkdirSync(dir, { recursive: true });

function save(name, res, meta) {
  const outs = [];
  res.recs.forEach((r, i) => {
    const base = res.recs.length > 1 ? `${name}-c${i}` : name;
    const raw = join(dir, `${base}.webm`);
    writeFileSync(raw, Buffer.from(r.b64, 'base64'));
    const wav = join(dir, `${base}.wav`);
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-ar', '48000', '-c:a', 'pcm_s24le', wav], { encoding: 'utf8' });
    if (ff.status !== 0) throw new Error(`ffmpeg ${base}: ${ff.stderr}`);
    spawnSync('rm', [raw]);
    const vol = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    outs.push({ wav, mime: r.mime, contextRate: r.rate, contextState: r.state, maxDb: Number(/max_volume: (-?[\d.]+)/u.exec(vol)?.[1] ?? Number.NaN), meanDb: Number(/mean_volume: (-?[\d.]+)/u.exec(vol)?.[1] ?? Number.NaN) });
  });
  res.files = res.files.map((f) => ({ ...f, url: named(f.url) }));
  const loops = res.loops.map((f) => ({ ...f, url: named(f.url) }));
  const row = { sha, name, ...meta, outputs: outs, files: res.files, loopsPlaying: loops, musicDropped: res.dropped.map(named) };
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(row, null, 1));
  console.log(`${name}: ${outs.map((o) => `${o.wav.split('/').pop()} max ${o.maxDb} dB mean ${o.meanDb} dB`).join(', ')}; files ${[...new Set(res.files.map((f) => f.url.split('/').pop()))].join(' ') || '-'}; loops ${[...new Set(loops.map((f) => f.url.split('/').pop()))].join(' ') || '-'}`);
  return row;
}

const shot = MODE === 'take' ? (await import(pathToFileURL(resolve(arg('shot'))).href)).shot : null;
const recipe = MODE === 'calls' ? RECIPES[arg('recipe')] : null;
if (MODE === 'calls' && !recipe) throw new Error(`--recipe= one of ${Object.keys(RECIPES).join(', ')}`);
const query = noMute(MODE === 'take' ? arg('query', shot.query) : MODE === 'bed' ? arg('query') : recipe.query);
const sleep = (s) => new Promise((_resolve) => { setTimeout(_resolve, s * 1000); });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.addInitScript((keys) => { window.__eraMusicBytes = new Set(keys); }, musicBytes);
  await page.addInitScript(INIT);
  if (shot?.storage) await page.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, shot.storage);
  await page.goto(`${URL_BASE}/?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(`Boolean(${WORLD}?.game)`, undefined, { timeout: 300000, polling: 1000 });
  await sleep(Number(arg('warm', String(shot?.warmSec ?? 12))));
  console.log('helpers', JSON.stringify(await page.evaluate(HELPERS)));
  await page.evaluate(HOLD);
  const withScope = (js) => `(() => { const W = window.__eraW, a = W.audio, P = W.player, ahead = window.__eraAhead; ${js}; })()`;

  if (MODE === 'calls') {
    if (recipe.spot) await page.evaluate(withScope(`P.spawn(${recipe.spot.join(', ')})`));
    if (recipe.near) {
      // 12 m from the nearest live `near` animal, facing it (the take's beach, out of its aggro)
      await page.evaluate(withScope(`const e = W.animals.animals.filter((x) => x.kind === '${recipe.near}' && x.alive).sort((x, y) => x.position.distanceTo(P.position) - y.position.distanceTo(P.position))[0];
        if (e) { const ang = Math.atan2(P.position.x - e.position.x, P.position.z - e.position.z); P.spawn(e.position.x + Math.sin(ang) * 12, e.position.z + Math.cos(ang) * 12, 0); P.yaw = Math.atan2(-(e.position.x - P.position.x), -(e.position.z - P.position.z)); }`));
    }
    if (recipe.prep) await page.evaluate(withScope(recipe.prep));
    await sleep(4);
    // the bed at this spot first, then every one-shot with the bed muted
    await page.evaluate('window.__eraRecStart()');
    await sleep(Number(arg('bedSec', '20')));
    rows.push(save('bed', await page.evaluate('window.__eraRecStop()'), { query, kind: 'bed', sec: Number(arg('bedSec', '20')) }));
    await page.evaluate(withScope(recipe.quiet));
    await sleep(3);
    for (const s of recipe.sounds) {
      await page.evaluate('window.__eraRecStart()');
      await sleep(0.25);
      await page.evaluate(withScope(s.js));
      await sleep(s.sec);
      rows.push(save(s.name, await page.evaluate('window.__eraRecStop()'), { query, kind: 'oneshot', js: s.js, lead: 0.25, sec: s.sec }));
    }
  } else if (MODE === 'bed') {
    const [x, z, yaw] = arg('spot').split(',').map(Number);
    await page.evaluate(withScope(`P.spawn(${x}, ${z}, ${yaw ?? 0}); P.pitch = 0`));
    await sleep(6);
    const sec = Number(arg('sec', '24'));
    await page.evaluate('window.__eraRecStart()');
    await sleep(sec);
    rows.push(save(arg('name', 'bed'), await page.evaluate('window.__eraRecStop()'), { query, kind: 'bed', spot: [x, z, yaw], sec }));
  } else {
    await page.evaluate(`window.__takeOpt = ${arg('opt', '{}')}; window.__takeEvents = []; window.__sim = { t: 0, frames: 0 }`);
    const setup = await page.evaluate(`window.__takeSetup = (${shot.setup})(); window.__takeSetup`);
    await sleep(3);
    await page.evaluate('window.__eraRecStart()');
    await sleep(0.5);
    const frames = Number(arg('frames', '')) || shot.frames;
    await page.evaluate(`new Promise((res) => {
      const step = (${shot.step}), t0 = performance.now();
      window.__sim = { get t() { return (performance.now() - t0) / 1000; }, frames: 0 };
      let f = -1;
      const tick = () => {
        const want = Math.min(${frames - 1}, Math.floor(((performance.now() - t0) / 1000) * 60));
        while (f < want) { f++; step(f, f / 60, window.__takeSetup); }
        if (f >= ${frames - 1}) res(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })`);
    await sleep(Number(arg('tail', '1.5')));
    const events = await page.evaluate('window.__takeEvents ?? []');
    const final = await page.evaluate('window.__takeFinal?.() ?? null');
    rows.push(save(arg('name', shot.name), await page.evaluate('window.__eraRecStop()'), { query, kind: 'take', shot: shot.name, opt: JSON.parse(arg('opt', '{}')), lead: 0.5, frames, setup, events, final }));
  }
  if (errors.length > 0) console.log(`page errors (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(`wrote ${rows.length} sounds to ${dir}`);
