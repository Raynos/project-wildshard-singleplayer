// Actual defining bounded decoder / adapter versus whole-file decoder, reference PCM diagnostic only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import ts from '@typescript/typescript6';
import { webkit, devices } from 'playwright';
const [out, genre = 'piano'] = process.argv.slice(2);
if (!out || !['piano', 'folk', 'orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral], wrap with browser-lane.sh');
const modules = ['app/ownership', 'app/scopeEnvironment', 'app/scopedProperty', 'app/scope', 'app/resources', 'core/harnessTap', 'audio/ownership', 'audio/aacIndex', 'audio/aacPull', 'audio/aacNative', 'audio/aacWindows', 'audio/aacTrack', 'audio/aacSource', 'audio/Stems', 'audio/score/score', 'audio/Music'];
const code = 'const __modules = {"ui/Settings": {setting: () => "on", getNumber: () => 1, setNumber: () => {}, onNumber: () => {}, getMusicStyle: () => "piano", onMusicStyle: () => {}}, "boot/tables": {musicManifests: () => ({}), publicBytes: () => ({})}, "audio/preload": {trackBusy: (_kind, work) => work, cachedBytes: async () => {throw new Error("Unexpected cache read")}, decodeBytes: bytes => new OfflineAudioContext(2,1,48000).decodeAudioData(bytes)}, "audio/audioLog": {audioLog: () => {}}};\n'  + modules.map(name => {
  const source = readFileSync(`src/engine/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const exports = [...compiled.matchAll(/^export (?:async )?(?:function|class|const|let) (\w+)/gm)].map(match => match[1]);
  const body = compiled.replace(/^import \{([^}]+)\} from ['"]([^'"]+)['"];$/gm, (_all, bindings, path) =>
    `const {${bindings.replace(/ as /g, ': ')}} = __modules[${JSON.stringify(posix.normalize(posix.join(posix.dirname(name), path)))}];`)
    .replace(/^export /gm, '');
  return `__modules[${JSON.stringify(name)}] = (() => {${body}\nreturn {${exports.join(',')}};})();`;
}).join('\n') + '\nObject.assign(globalThis,__modules["app/scope"],__modules["audio/aacTrack"],__modules["audio/aacSource"],__modules["audio/Stems"],__modules["app/ownership"],__modules["audio/score/score"],__modules["audio/Music"]);';
const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
const bytes = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const report = { protocol: 'Actual Stems Deck plus bounded AAC scheduler versus the original decoded Deck; authored loop, bar/fade and paired incoming Deck unchanged. Offline only, no native saving claim.', genre, sourceSha256: createHash('sha256').update(bytes).digest('hex'), errors: [] };
const server = createServer((req, res) => { if (req.url === '/track') res.end(bytes); else res.end('<!doctype html><title>Bounded AAC native proof</title>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No diagnostic origin');
let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${address.port}`); await page.addScriptTag({ content: code });
  report.result = await page.evaluate(async spec => {
    const bytes = new Uint8Array(await (await fetch('/track')).arrayBuffer());
    const reference = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes.slice().buffer);
    const prepared = await AacTrack.prepare(bytes, spec.loopStart, spec.loopEnd, () => Promise.reject(new Error('No whole decode expected')));
    if (!prepared) throw new Error('Native AAC unavailable or ineligible');
    const cases = [];
    for (const scenario of ['loop-fade', 'bar-handoff']) {
      const rate = 48000, t0 = .050021, seconds = scenario === 'loop-fade' ? 64 : 8;
      const render = async bounded => {
        const ctx = new OfflineAudioContext(2, Math.ceil((t0 + seconds) * rate), rate);
        const scope = new Scope('AAC.deck.offline'), failures = [];
        const slotSpec = { ...spec, calm: spec.full, tension: undefined, layers: [], phases: {} };
        const audio = { genre: 'piano', slot: 'title', spec: slotSpec, calm: bounded ? prepared : reference, tension: undefined, layers: [] };
        if (bounded) await prepared.prime(scope);
        const deck = withOwner(scope, () => new Deck(ctx, audio, ctx.destination, t0, .6, 0, 1, error => failures.push(String(error))));
        const stream = Reflect.get(deck, 'stream');
        let peakWindows = 0;
        try {
          if (scenario === 'bar-handoff') {
            const at = deck.nextBar(t0 + 1), fade = 2.5;
            deck.fadeOut(at, fade);
            withOwner(scope, () => new Deck(ctx, { ...audio, slot: 'incoming', calm: reference, tension: reference }, ctx.destination, at, fade, .4));
          } else deck.fadeOut(t0 + 61, 2);
          if (stream) await stream.pump();
          const pauses = [];
          if (stream) for (let at = .25; at < t0 + seconds - .1; at += .25) pauses.push(ctx.suspend(at));
          const rendering = ctx.startRendering();
          for (const pause of pauses) {
            await pause; await stream.pump();
            peakWindows = Math.max(peakWindows, stream.peakWindows);
            if (failures.length) throw new Error(failures.join('; '));
            await ctx.resume();
          }
          const buffer = await rendering;
          scope.dispose();
          const residue = scope.census;
          if (failures.length || peakWindows > 48 || Object.values(residue).some(value => value !== 0)) throw new Error('Deck source lifecycle failed');
          return { buffer, peakWindows, residue };
        } finally { scope.dispose(); }
      };
      const before = await render(false), after = await render(true);
      let maxAbs = 0, sum = 0, comparedSamples = 0, firstDifference;
      for (let channel = 0; channel < 2; channel++) for (let i = 0; i < before.buffer.length; i++) {
        const a = before.buffer.getChannelData(channel)[i], b = after.buffer.getChannelData(channel)[i], d = a - b;
        if (d !== 0 && firstDifference === undefined) firstDifference = { frame: i, a, b };
        maxAbs = Math.max(maxAbs, Math.abs(d)); sum += d * d; comparedSamples++;
      }
      cases.push({ scenario, t0, comparedSamples, maxAbs, rms: Math.sqrt(sum / comparedSamples), firstDifference,
        peakWindows: after.peakWindows, residue: after.residue, exact: maxAbs === 0 });
    }
    installScore({ arrangements: {theme: {name: 'theme', segments: [], driven: false}}, chords: {}, chordRoot: {}, dorianOf: {},
      dorianPitch: n => n, stings: {pickup: [], death: {chords: ['', ''], bass: []}, chunk: {chord: '', bell: []}} });
    const fences = [];
    for (const [rate, retire] of [[48000, false], [44100, false], [44100, true]]) {
      let decodes = 0, resolveFallback;
      const track = await AacTrack.prepare(bytes, spec.loopStart, spec.loopEnd, () => { decodes++; return new Promise(resolve => { resolveFallback = resolve; }); });
      if (!track) throw new Error('Missing prepared track');
      const scope = new Scope('Music.fallback'), ctx = new OfflineAudioContext(2, 48000, rate), master = ctx.createGain();
      master.gain.value = 0; master.connect(ctx.destination);
      const audio = {genre: 'piano', slot: 'title', spec: {...spec, calm: spec.full, tension: undefined, layers: [], phases: {}}, calm: track, tension: undefined, layers: []};
      const music = withOwner(scope, () => new Music({ctx, master}));
      music.useBank({genre: 'piano', set: 'base', slots: new Map([['title',audio]]), stings: new Map(), log: []});
      withOwner(scope, () => { music.play('theme'); for (let i = 0; i < 4; i++) music.refreshScore(); });
      if (rate === 48000 && decodes !== 0 || rate !== 48000 && decodes !== 1) throw new Error('Wrong fallback decode count');
      if (retire) scope.dispose();
      resolveFallback?.(reference);
      for (let i = 0; i < 30; i++) await Promise.resolve();
      const original = audio.calm === reference, source = music.stems.source;
      if (rate === 44100 && original === retire) throw new Error('Fallback owner fence failed');
      music.stop(); scope.dispose();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const residue = scope.census;
      if (Object.values(residue).some(value => value !== 0)) throw new Error('Music owner residue');
      fences.push({rate, retire, decodes, original, source, residue});
    }
    const replayScope = new Scope('Music.replay'), replayContext = new OfflineAudioContext(2, 48000, 48000);
    const replayMaster = replayContext.createGain(); replayMaster.gain.value = 0; replayMaster.connect(replayContext.destination);
    let replayDecodes = 0;
    const replayTrack = await AacTrack.prepare(bytes, spec.loopStart, spec.loopEnd, () => { replayDecodes++; throw new Error('Replay must not decode whole PCM'); });
    if (!replayTrack) throw new Error('Replay track unavailable');
    const replayAudio = {genre: 'piano', slot: 'title', spec: {...spec, calm: spec.full, tension: undefined, layers: [], phases: {}}, calm: replayTrack, tension: undefined, layers: []};
    const replayMusic = withOwner(replayScope, () => new Music({ctx: replayContext, master: replayMaster}));
    replayMusic.useBank({genre: 'piano', set: 'base', slots: new Map([['title', replayAudio]]), stings: new Map(), log: []});
    withOwner(replayScope, () => replayMusic.play('theme'));
    if (replayTrack.ready || replayMusic.stems.source !== 'stems') throw new Error('First play did not transfer prepared PCM');
    withOwner(replayScope, () => { replayMusic.play('theme'); for (let i = 0; i < 4; i++) replayMusic.refreshScore(); });
    for (let i = 0; i < 1000 && replayMusic.stems.source !== 'stems'; i++) await new Promise(resolve => setTimeout(resolve, 10));
    if (replayMusic.stems.source !== 'stems' || replayTrack.ready || replayDecodes !== 0) throw new Error('Bounded replay did not complete');
    replayScope.dispose();
    const replay = {decodes: replayDecodes, source: replayMusic.stems.source, residue: replayScope.census};
    if (Object.values(replay.residue).some(value => value !== 0)) throw new Error('Replay owner residue');
    return { cases, fences, replay, exact: cases.every(value => value.exact) };
  }, spec);
  if (!report.result.exact) throw new Error('Native-window output parity failed');
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.closed = true; writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
