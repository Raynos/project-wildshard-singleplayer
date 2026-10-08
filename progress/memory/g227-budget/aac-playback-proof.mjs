// Actual defining bounded decoder / adapter versus whole-file decoder, reference PCM diagnostic only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import ts from '@typescript/typescript6';
import { webkit, devices } from 'playwright';
const [out, genre = 'piano'] = process.argv.slice(2);
if (!out || !['piano', 'folk', 'orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral], wrap with browser-lane.sh');
const modules = ['aacIndex', 'aacPull', 'aacNative', 'aacWindows'];
const code = modules.map(name => {
  const source = readFileSync(`src/engine/audio/${name}.ts`, 'utf8');
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, '');
}).join('\n') + '\nObject.assign(globalThis,{indexAac,AacPull,nativeAacFactory,AacWindows});';
const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
const bytes = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const report = { protocol: 'Actual defining AAC reader/native decoder/window planner into native AudioBufferSourceNodes versus original whole-file source; same fades, authored loop, integral source frames, several absolute start phases. Offline only, no native saving claim.', genre, sourceSha256: createHash('sha256').update(bytes).digest('hex'), errors: [] };
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
    const index = indexAac(bytes), native = await nativeAacFactory(index);
    if (!native) throw new Error('Native AAC unavailable');
    const cases = [];
    for (const t0 of [.1, 60 / 104 * 4, .050021]) {
      const rate = 48000, seconds = 4, initial = Math.round((spec.loopEnd - .6) * rate);
      const render = async bounded => {
        const ctx = new OfflineAudioContext(2, Math.ceil((t0 + seconds) * rate), rate), gain = ctx.createGain();
        gain.connect(ctx.destination); gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(1, t0 + .6);
        gain.gain.setValueAtTime(1, t0 + 2); gain.gain.linearRampToValueAtTime(0, t0 + 3.5);
        let peakRetainedFrames = 0, largestBufferFrames = 0, sources = 0;
        if (!bounded) {
          const source = ctx.createBufferSource(); source.buffer = reference; source.loop = true;
          source.loopStart = spec.loopStart; source.loopEnd = spec.loopEnd; source.connect(gain); source.start(t0, initial / rate);
        } else {
          const cleanups = new Set(), scope = { disposed: false, capture(_kind, fn) { cleanups.add(fn); return () => cleanups.delete(fn); } };
          const pull = new AacPull(bytes, index, native, scope);
          const windows = new AacWindows(Math.round(spec.loopStart * rate), Math.round(spec.loopEnd * rate), reference.length, initial);
          for (;;) {
            const plan = windows.next(); if (plan.timeline >= seconds * rate) break;
            const buffer = ctx.createBuffer(2, plan.frames, rate); largestBufferFrames = Math.max(largestBufferFrames, plan.frames);
            for (const part of plan.parts) {
              const values = await pull.read(part.start, part.frames);
              for (let channel = 0; channel < 2; channel++) buffer.getChannelData(channel).set(values[channel], part.destination);
            }
            const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(gain);
            if (plan.loop) { source.loop = true; source.loopStart = plan.loop.start / rate; source.loopEnd = plan.loop.end / rate; }
            const start = t0 + plan.timeline / rate;
            source.start(start, plan.offset / rate); source.stop(t0 + (plan.timeline + plan.duration) / rate); sources++;
          }
          peakRetainedFrames = pull.peakRetainedFrames; pull.dispose();
          if (cleanups.size) throw new Error('Decoder owner residue');
        }
        return { buffer: await ctx.startRendering(), peakRetainedFrames, largestBufferFrames, sources };
      };
      const before = await render(false), after = await render(true);
      let maxAbs = 0, sum = 0, comparedSamples = 0, firstDifference;
      for (let channel = 0; channel < 2; channel++) for (let i = 0; i < before.buffer.length; i++) {
        const a = before.buffer.getChannelData(channel)[i], b = after.buffer.getChannelData(channel)[i], d = a - b;
        if (d !== 0 && firstDifference === undefined) firstDifference = { frame: i, a, b };
        maxAbs = Math.max(maxAbs, Math.abs(d)); sum += d * d; comparedSamples++;
      }
      cases.push({ t0, comparedSamples, maxAbs, rms: Math.sqrt(sum / comparedSamples), firstDifference,
        largestBufferFrames: after.largestBufferFrames, peakDecoderFrames: after.peakRetainedFrames, sources: after.sources, exact: maxAbs === 0 });
    }
    return { cases, exact: cases.every(value => value.exact) };
  }, spec);
  if (!report.result.exact) throw new Error('Native-window output parity failed');
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.closed = true; writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
