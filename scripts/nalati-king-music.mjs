#!/usr/bin/env node
// nalati-king-music.mjs — NALATI-FINISH B3 (E302) evidence: the Golden King's music plays in a real browser, not only in
// test/steppe-score.test.ts. ONE muted headless browser (--mute-audio, &mute=1, audio.muted) boots Nalati at the kurgan's
// chamber door (the harness params boss=golden-king + bossGod) and reads the live audio graph:
//   · the score's scene (nalati.boss.inside → music.setSteppe({ boss: 'king' })) and the slot it asks for (steppe-king);
//   · the slot decoded on demand (SteppeScore.log: the decode ms), its calm / tension buffers (duration, channels, RMS);
//   · the deck on the air (Music.deck: its slot, start time vs the AudioContext clock, the context running) and a tap on the
//     stem bus (an AnalyserNode: the RMS actually flowing out of the deck; the master is disconnected, so nothing is heard);
//   · window.__audioLog's music lines (deck:steppe-king ok).
// Also the two B3 one-shots (spearThrust, javelinImpact-flesh): decoded on the steppe, fired, their buffers' length / peak.
//
//   node scripts/nalati-king-music.mjs --url=http://localhost:4377 [--out=progress/b3/king-music-01.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL0 = flag('url', 'http://localhost:4377');
const OUT = flag('out', 'progress/b3/king-music-01.json');
const QS = 'chunk=nalati-grasslands&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&boss=golden-king&bossGod=1';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = { url: `${URL0}/?${QS}`, when: new Date().toISOString(), polls: [], errors: [], failedAudio: [] };
page.on('pageerror', (e) => { report.errors.push(String(e)); });
page.on('requestfailed', (r) => { const u = new URL(r.url()); if (/^\/assets\/(music|sfx)\//.test(u.pathname)) report.failedAudio.push({ path: u.pathname, err: r.failure()?.errorText }); });

const probe = () => page.evaluate(() => {
  const w = window.__world, m = w.music, st = m.steppe, d = m.deck, ctx = m.rig?.ctx;
  const rms = (b) => { if (!b) return null; const x = b.getChannelData(0); let s = 0, pk = 0; for (let i = 0; i < x.length; i += 7) { s += x[i] * x[i]; pk = Math.max(pk, Math.abs(x[i])); } return { rms: +Math.sqrt(s / (x.length / 7)).toFixed(4), peak: +pk.toFixed(3) }; };
  const buf = (b) => (b ? { duration: +b.duration.toFixed(3), channels: b.numberOfChannels, sampleRate: b.sampleRate, ...rms(b) } : null);
  const king = st.slots.get('steppe-king');
  return {
    inside: w.nalati?.boss?.inside ?? null,
    scene: { ...st.scene }, target: st.target(), resident: st.resident, pending: st.pending, decodeLog: st.log,
    kingSpec: king ? { calm: king.spec.calm, tension: king.spec.tension, bpm: king.spec.bpm, loopStart: king.spec.loopStart, loopEnd: king.spec.loopEnd } : null,
    kingCalm: buf(king?.calm), kingTension: buf(king?.tension),
    deck: d ? { slot: d.audio.slot, t0: +d.t0.toFixed(3), sources: d.srcs.length, sourceBuffers: d.srcs.map((s) => s.buffer?.duration.toFixed(2)) } : null,
    ctx: ctx ? { state: ctx.state, currentTime: +ctx.currentTime.toFixed(3) } : null,
    muted: w.audio.muted,
  };
});

try {
  const t0 = Date.now();
  await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__world?.music !== undefined, null, { timeout: 300_000, polling: 500 });
  report.bootMs = Date.now() - t0;
  await page.mouse.click(195, 420); // the gesture that resumes the AudioContext; muted three ways
  await page.evaluate(() => { const w = window.__world; w.audio.muted = true; w.hud.onResume?.(); w.audio.muted = true; });
  // poll until the king's deck is on the air (the slot decodes on demand, then takes over on the bar)
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const p = await probe();
    report.polls.push({ at: Date.now() - t0, ...p });
    if (p.deck?.slot === 'steppe-king' && p.ctx && p.ctx.currentTime > p.deck.t0 + 3) break;
  }
  // a tap on the stem bus: what the deck is actually putting out (post-deck, pre-master) over ~5.6 s (0.68 s windows)
  report.tap = await page.evaluate(async () => {
    const m = window.__world.music, rig = m.rig, d = m.deck;
    if (!rig || !d) return 'no rig / deck';
    const tap = (node) => { const an = rig.ctx.createAnalyser(); an.fftSize = 32768; node.connect(an); return an; };
    const taps = { deckOut: tap(d.out), stemBus: tap(rig.stemBus) };
    const x = new Float32Array(32768), out = [];
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => { setTimeout(r, 700); });
      const row = { at: +(rig.ctx.currentTime - d.t0).toFixed(2) }; // seconds into the king's calm stem
      for (const [k, an] of Object.entries(taps)) {
        an.getFloatTimeDomainData(x);
        let s = 0, pk = 0; for (const v of x) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
        row[k] = { rmsDb: +(20 * Math.log10(Math.sqrt(s / x.length) + 1e-9)).toFixed(1), peak: +pk.toFixed(3) };
      }
      out.push(row);
    }
    d.out.disconnect(taps.deckOut); rig.stemBus.disconnect(taps.stemBus);
    return { windows: out, deck: m.deck?.audio.slot ?? null, deckOutGain: +d.out.gain.value.toFixed(3), stemBusGain: +rig.stemBus.gain.value.toFixed(3) };
  });
  report.audioLog = await page.evaluate(() => window.__audioLog.filter((e) => e.kind === 'music'));
  // the B3 one-shots: decoded on the steppe? fire each and read their buffers
  report.sfx = await page.evaluate(() => {
    const a = window.__world.audio, out = {};
    for (const f of ['spearThrust', 'javelinImpact-flesh', 'javelinImpact-wood', 'javelinThrow']) {
      const set = a.shots.get(f);
      out[f] = set ? set.bufs.map((b) => { const x = b.getChannelData(0); let pk = 0, s = 0; for (const v of x) { pk = Math.max(pk, Math.abs(v)); s += v * v; } return { duration: +b.duration.toFixed(3), peak: +pk.toFixed(3), rms: +Math.sqrt(s / x.length).toFixed(4) }; }) : 'synth (no file)';
    }
    const before = { ...a.counts };
    a.spearThrust(); a.javelinImpact('flesh');
    out.fired = { spearThrust: (a.counts.spearThrust ?? 0) - (before.spearThrust ?? 0), 'javelinImpact:flesh': (a.counts['javelinImpact:flesh'] ?? 0) - (before['javelinImpact:flesh'] ?? 0) };
    return out;
  });
  const last = report.polls.at(-1);
  report.verdict = {
    kingSlotSelected: last?.target === 'steppe-king',
    kingDecoded: last?.kingCalm !== null && (last?.kingCalm?.duration ?? 0) > 1,
    kingDeckOnAir: last?.deck?.slot === 'steppe-king' && (last?.ctx?.state === 'running') && (last?.ctx?.currentTime ?? 0) > (last?.deck?.t0 ?? Infinity),
    signalOnStemBus: typeof report.tap === 'object' && report.tap.windows.some((w) => w.stemBus.peak > 0.05),
    logDeckKing: report.audioLog.some((e) => e.name === 'deck:steppe-king' && e.ok === true),
  };
  console.log(JSON.stringify({ verdict: report.verdict, last, tap: report.tap, sfx: report.sfx }, null, 1));
} catch (e) {
  report.errors.push(`script: ${String(e)}`);
  console.error(e);
} finally {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
}
