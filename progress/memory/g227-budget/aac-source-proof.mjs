// Actual defining bounded decoder / adapter versus whole-file decoder, reference PCM diagnostic only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import ts from '@typescript/typescript6';
import { webkit, devices } from 'playwright';
const [out, genre = 'piano'] = process.argv.slice(2);
if (!out || !['piano', 'folk', 'orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral], wrap with browser-lane.sh');
const modules = ['app/ownership', 'app/scopeEnvironment', 'app/scopedProperty', 'app/scope', 'audio/ownership', 'audio/aacIndex', 'audio/aacPull', 'audio/aacNative', 'audio/aacWindows', 'audio/aacTrack', 'audio/aacSource'];
const code = 'const __modules = {};\n' + modules.map(name => {
  const source = readFileSync(`src/engine/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const exports = [...compiled.matchAll(/^export (?:async )?(?:function|class|const|let) (\w+)/gm)].map(match => match[1]);
  const body = compiled.replace(/^import \{([^}]+)\} from ['"]([^'"]+)['"];$/gm, (_all, bindings, path) =>
    `const {${bindings.replace(/ as /g, ': ')}} = __modules[${JSON.stringify(posix.normalize(posix.join(posix.dirname(name), path)))}];`)
    .replace(/^export /gm, '');
  return `__modules[${JSON.stringify(name)}] = (() => {${body}\nreturn {${exports.join(',')}};})();`;
}).join('\n') + '\nObject.assign(globalThis,__modules["app/scope"],__modules["audio/aacTrack"],__modules["audio/aacSource"]);';
const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
const bytes = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const report = { protocol: 'Actual bounded AacSource scheduler with native AAC, scoped windows and context-clock pumps versus original whole-file source; same fades and authored loop. Offline only, no native saving claim.', genre, sourceSha256: createHash('sha256').update(bytes).digest('hex'), errors: [] };
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
    for (const t0 of [.050021, 60 / 104 * 4]) {
      const rate = 48000, seconds = 64;
      const render = async bounded => {
        const ctx = new OfflineAudioContext(2, Math.ceil((t0 + seconds) * rate), rate), gain = ctx.createGain();
        gain.connect(ctx.destination); gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(1, t0 + .6);
        gain.gain.setValueAtTime(1, t0 + 61); gain.gain.linearRampToValueAtTime(0, t0 + 63);
        let peakWindows = 0, residue;
        if (!bounded) {
          const source = ctx.createBufferSource(); source.buffer = reference; source.loop = true;
          source.loopStart = spec.loopStart; source.loopEnd = spec.loopEnd; source.connect(gain); source.start(t0, 0);
        } else {
          const scope = new Scope('AAC.offline'), failures = [];
          const source = new AacSource(prepared, { context: ctx, output: gain, scope,
            failed: error => failures.push(String(error)), ended: () => undefined }, t0);
          try {
            source.stop(t0 + 63.1);
            await new Promise(resolve => setTimeout(resolve, 25));
            const pauses = [];
            for (let at = .25; at < t0 + seconds - .1; at += .25) pauses.push(ctx.suspend(at));
            const rendering = ctx.startRendering();
            for (const pause of pauses) {
              await pause;
              await source.pump();
              await new Promise(resolve => setTimeout(resolve, 1));
              peakWindows = Math.max(peakWindows, source.peakWindows);
              if (failures.length) throw new Error(failures.join('; '));
              await ctx.resume();
            }
            const buffer = await rendering;
            scope.dispose(); residue = scope.census;
            if (failures.length || peakWindows > 6 || Object.values(residue).some(value => value !== 0)) throw new Error('Bounded source lifecycle failed');
            return { buffer, peakWindows, residue };
          } finally { scope.dispose(); }
        }
        return { buffer: await ctx.startRendering(), peakWindows, residue };
      };
      const before = await render(false), after = await render(true);
      let maxAbs = 0, sum = 0, comparedSamples = 0, firstDifference;
      for (let channel = 0; channel < 2; channel++) for (let i = 0; i < before.buffer.length; i++) {
        const a = before.buffer.getChannelData(channel)[i], b = after.buffer.getChannelData(channel)[i], d = a - b;
        if (d !== 0 && firstDifference === undefined) firstDifference = { frame: i, a, b };
        maxAbs = Math.max(maxAbs, Math.abs(d)); sum += d * d; comparedSamples++;
      }
      cases.push({ t0, comparedSamples, maxAbs, rms: Math.sqrt(sum / comparedSamples), firstDifference,
        peakWindows: after.peakWindows, residue: after.residue, exact: maxAbs === 0 });
    }
    return { cases, exact: cases.every(value => value.exact) };
  }, spec);
  if (!report.result.exact) throw new Error('Native-window output parity failed');
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.closed = true; writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
