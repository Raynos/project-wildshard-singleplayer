// Offline, sample-aligned comparison of the actual Music/Deck implementation at two committed revisions.
// Run through scripts/browser-lane.sh. No live audio device is opened.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { build } from 'vite';
import { webkit, devices } from 'playwright';

const [before = '8ecb6c70b', after = '29f650e1e', output = 'progress/memory/g227-budget/audio-parity.json'] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '../../..');
const sourceHashes = Object.fromEntries([before, after].map(rev => [rev, Object.fromEntries(['Music', 'Stems', 'SetScore', 'preload'].map(name => {
  const path = `src/engine/audio/${name}.ts`, bytes = execFileSync('git', ['show', `${rev}:${path}`]);
  return [path, createHash('sha256').update(bytes).digest('hex')];
}))]));
async function bundle(rev) {
  const entry = resolve(root, 'progress/memory/g227-budget/audio-parity-entry.ts');
  const result = await build({ root, configFile: false, publicDir: false, logLevel: 'error',
    plugins: [{ name: 'committed-audio', enforce: 'pre',
      resolveId: id => id === entry ? id : undefined,
      load(id) {
        if (id === entry) return ['audio/Music', 'audio/Stems', 'audio/SetScore', 'audio/preload', 'app/scope', 'app/ownership', 'boot/tables', 'audio/score/score']
          .map(path => `export * from ${JSON.stringify(resolve(root, 'src/engine', path + '.ts'))};`).join('\n');
        if (/\/src\/engine\/audio\/(Music|Stems|SetScore|preload)\.ts$/u.test(id))
          return execFileSync('git', ['show', `${rev}:${relative(root, id)}`], { encoding: 'utf8' });
        return undefined;
      } }],
    build: { write: false, minify: false, lib: { entry, formats: ['es'] } } });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap(item => item.output).find(item => item.type === 'chunk' && item.isEntry);
  if (chunk?.type !== 'chunk') throw new Error('Missing audio parity bundle');
  return `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`;
}
const urls = await Promise.all([bundle(before), bundle(after)]);
const server = createServer((_request, response) => { response.end('<!doctype html><title>Offline audio proof</title>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Missing offline proof origin');
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'log' || message.type() === 'info') console.log(message.text()); });
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await page.goto(`http://127.0.0.1:${address.port}`);
  const { cases, titleFallback } = await page.evaluate(async modules => {
    const apis = await Promise.all(modules.map(url => import(url)));
    let titleFallback;
    async function render(api, scenario) {
      const rate = 48000, seconds = 14, ctx = new OfflineAudioContext(2, rate * seconds, rate);
      const scope = new api.Scope('offline-parity'), master = ctx.createGain(); master.connect(ctx.destination);
      const spec = id => ({ calm: id + '.m4a', tension: id + '-tension.m4a', layers: [], phases: {}, bpm: 120,
        beatsPerBar: 4, loopStart: 0, loopEnd: 4, duration: 4 });
      const titleUrl = '/assets/music/piano/title.m4a';
      api.installAssetTables({ bytes: { [titleUrl]: 1 }, versions: {}, sfx: {}, packs: {}, music: {
        fixture: { slots: { a: spec('a'), b: spec('b') } }, piano: { slots: { title: { ...spec('title'), tension: undefined } } },
      } });
      api.installScore({ arrangements: { theme: { name: 'theme', segments: [], driven: false } }, chords: {}, chordRoot: {}, dorianOf: {},
        dorianPitch: n => n, stings: { pickup: [], death: { chords: ['', ''], bass: [] }, chunk: { chord: '', bell: [] } } });
      const buffer = frequency => {
        const value = ctx.createBuffer(2, rate * 4, rate);
        for (let c = 0; c < 2; c++) {
          const samples = value.getChannelData(c);
          for (let i = 0; i < samples.length; i++) samples[i] = 0.1 * Math.sin(2 * Math.PI * frequency * i / rate + c * 0.2);
        }
        return value;
      };
      const audio = id => ({ genre: 'piano', slot: id, spec: spec(id), calm: buffer(id === 'a' ? 220 : 330), tension: buffer(id === 'a' ? 550 : 770), layers: [] });
      const a = audio('a'), b = audio('b'), title = audio('title');
      // Float PCM WAV: the initial title and its returning-menu decode contain the exact same samples.
      const wav = source => {
        const frames = source.length, channels = source.numberOfChannels, size = frames * channels * 4;
        const bytes = new ArrayBuffer(44 + size), view = new DataView(bytes);
        const text = (offset, value) => [...value].forEach((character, i) => view.setUint8(offset + i, character.charCodeAt(0)));
        text(0, 'RIFF'); view.setUint32(4, 36 + size, true); text(8, 'WAVE'); text(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, channels, true);
        view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 4, true);
        view.setUint16(32, channels * 4, true); view.setUint16(34, 32, true); text(36, 'data'); view.setUint32(40, size, true);
        for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) view.setFloat32(44 + (i * channels + c) * 4, source.getChannelData(c)[i], true);
        return bytes;
      };
      title.tension = undefined; title.spec.tension = undefined;
      const titleBytes = wav(title.calm);
      title.calm = await new OfflineAudioContext(2, 1, rate).decodeAudioData(titleBytes.slice(0));
      let titleReads = 0;
      const fetch = window.fetch;
      window.fetch = (input, options) => {
        if (String(input) === titleUrl) { titleReads++; return Promise.resolve(new Response(scenario === 'invalid-title-return' ? new ArrayBuffer(1) : titleBytes.slice(0))); }
        return fetch(input, options);
      };
      const titleCase = scenario === 'title-retirement' || scenario === 'title-return' || scenario === 'invalid-title-return';
      const bank = (...slots) => ({ genre: 'piano', set: 'base', slots: new Map(slots.map(value => [value.slot, value])), stings: new Map(), log: [] });
      const music = api.withOwner(scope, () => new api.Music({ ctx, master }));
      music.useBank(bank(title, a)); if (!titleCase) music.setState({ mode: 'calm' });
      const scene = { slot: 'a' };
      const source = scenario === 'bank-switch' ? {
        slots: ['a', 'b'], base: 'a', pending: false, stings: new Map(), useBank: () => undefined,
        target: () => scene.slot, want: () => music.residentBank().slots.get(scene.slot),
      } : Object.assign(new api.SetScore({ dir: '/fixture/', manifestKey: 'fixture', scene,
        pick: value => [value.slot], read: () => Promise.reject(Error('Unexpected read')),
        decode: () => Promise.reject(Error('Unexpected decode')), onReady: () => music.refreshScore() }), { base: 'a' });
      if (scenario !== 'bank-switch') source.useBank({ slots: new Map([['a', a], ['b', b]]), stings: new Map() });
      if (scenario === 'sting-reuse') {
        const stingBytes = wav(a.calm), bootSting = await api.decodeBytes(stingBytes.slice(0)), runtimeSting = await api.decodeBytes(stingBytes.slice(0));
        if ((bootSting === runtimeSting) !== (api === apis[1])) throw new Error('Unexpected decoded-sting identity');
        music.residentBank().stings.set('pickup', bootSting); source.stings.set('pickup', runtimeSting);
      }
      const leave = music.setScore('first', source); music.play();
      const changed = ctx.suspend(2.5), returned = scenario === 'title-return' || scenario === 'invalid-title-return' ? ctx.suspend(6.5) : null, stopped = ctx.suspend(9);
      const rendering = ctx.startRendering();
      await changed;
      if (titleCase) music.setState({ mode: 'calm' });
      else if (scenario === 'calm-to-tension') music.setState({ mode: 'combat', intensity: 1 });
      else if (scenario === 'sting-reuse') music.sting('pickup');
      else if (scenario === 'bank-switch') { scene.slot = 'b'; music.useBank(bank(title, b)); }
      else {
        leave(); source.dispose();
        const next = Object.assign(new api.SetScore({ dir: '/fixture/', manifestKey: 'fixture', scene: { slot: 'b' },
          pick: value => [value.slot], read: () => Promise.reject(Error('Unexpected read')),
          decode: () => Promise.reject(Error('Unexpected decode')), onReady: () => music.refreshScore() }), { base: 'b' });
        next.useBank({ slots: new Map([['b', b]]), stings: new Map() });
        music.useBank(bank(title, b)); music.setScore('second', next);
      }
      await ctx.resume();
      if (returned !== null) {
        await returned; music.setState({ mode: 'menu' });
        // Suspend the context clock while the return-to-title compressed bytes decode. Compare the scheduled
        // transition, with no time shift or normalization; the active gameplay deck carries the loading interval.
        if (scenario === 'invalid-title-return') {
          for (let attempt = 0; attempt < 20; attempt++) { await new Promise(resolve => setTimeout(resolve, 5)); music.refreshScore(); }
          titleFallback = { titleReads, titleRetained: music.residentBank().slots.has('title'), source: music.stems.source };
          if (titleReads !== 1 || titleFallback.titleRetained || titleFallback.source !== 'synth') throw new Error('Invalid returning title did not settle to the bounded fallback');
        } else {
          for (let attempt = 0; attempt < 2000 && music.stems.slot !== 'title'; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
          if (music.stems.slot !== 'title') throw new Error('Returning menu never decoded its title: ' + JSON.stringify({implementation: api === apis[1] ? 'after' : 'before', titleReads, stems: music.stems, state: music.state, slots: [...music.residentBank().slots.keys()]}));
          if (api === apis[1] && titleReads !== 1) throw new Error(`Returning title read ${titleReads} files, expected one`);
        }
        await ctx.resume();
      }
      await stopped; music.stop(); await ctx.resume();
      const rendered = await rendering; scope.dispose(); window.fetch = fetch;
      return rendered;
    }
    const results = [];
    for (const scenario of ['bank-switch', 'calm-to-tension', 'shard-handoff', 'title-retirement', 'title-return', 'sting-reuse']) {
      console.log('rendering', scenario);
      const beforeBuffer = await render(apis[0], scenario), afterBuffer = await render(apis[1], scenario);
      let maximumAbsoluteDifference = 0, squaredDifference = 0, squaredSignal = 0, samples = 0;
      for (let c = 0; c < beforeBuffer.numberOfChannels; c++) {
        const beforeSamples = beforeBuffer.getChannelData(c), afterSamples = afterBuffer.getChannelData(c);
        for (let i = 0; i < beforeSamples.length; i++) {
          const delta = beforeSamples[i] - afterSamples[i]; maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, Math.abs(delta));
          squaredDifference += delta * delta; squaredSignal += beforeSamples[i] ** 2; samples++;
        }
      }
      results.push({ scenario, samples, sampleRate: beforeBuffer.sampleRate, maximumAbsoluteDifference,
        rmsDifference: Math.sqrt(squaredDifference / samples), signalRms: Math.sqrt(squaredSignal / samples) });
    }
    await render(apis[1], 'invalid-title-return');
    return { cases: results, titleFallback };
  }, urls);
  const pass = cases.every(result => result.signalRms > 0.001 && result.maximumAbsoluteDifference <= 1e-7 && result.rmsDifference <= 1e-8);
  const report = { before, after, sourceHashes, engine: 'Playwright WebKit OfflineAudioContext', muted: true,
    protocol: 'Actual Music/Deck code from each committed revision; deterministic 48kHz stereo stem fixtures. Same first-gesture-equivalent start, bank replacement, title retirement and returning-menu re-decode, bar-aligned calm/tension automation and source disposal/handoff; stop at9s, render14s. Compare every sample, without alignment shifts or normalization.',
    cases, titleFallback, pass };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  if (!pass) throw new Error('Rendered music differs beyond float noise');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
