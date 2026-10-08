// Actual defining bounded decoder / adapter versus whole-file decoder, reference PCM diagnostic only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import ts from '@typescript/typescript6';
import { webkit, devices } from 'playwright';
const [out, genre = 'piano'] = process.argv.slice(2);
if (!out || !['piano', 'folk', 'orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral], wrap with browser-lane.sh');
const modules = ['aacIndex', 'aacPull', 'aacNative'];
const code = modules.map(name => {
  const source = readFileSync(`src/engine/audio/${name}.ts`, 'utf8');
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, '');
}).join('\n') + '\nObject.assign(globalThis,{indexAac,AacPull,nativeAacFactory});';
const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
const bytes = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const report = { protocol: 'Actual defining AacIndex / AacPull / nativeAacFactory, bounded half-second windows with guards. Full PCM exists only in the comparison reference. No playback / native saving claim.', genre, sourceSha256: createHash('sha256').update(bytes).digest('hex'), errors: [] };
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
    const cleanups = new Set(), scope = { disposed: false, capture(_kind, fn) { cleanups.add(fn); return () => cleanups.delete(fn); } };
    let created = 0, closed = 0, outputData = 0, closedData = 0, largestOutputFrames = 0;
    const factory = (output, error) => {
      created++;
      const codec = native(data => {
        outputData++; largestOutputFrames = Math.max(largestOutputFrames, data.numberOfFrames);
        output({ numberOfFrames: data.numberOfFrames, numberOfChannels: data.numberOfChannels, sampleRate: data.sampleRate,
          copyTo: (dest, options) => data.copyTo(dest, options), close: () => { closedData++; data.close(); } });
      }, error);
      return { decode: packet => codec.decode(packet), flush: () => codec.flush(), close: () => { closed++; codec.close(); } };
    };
    const pull = new AacPull(bytes, index, factory, scope);
    const windows = [[0, 24064], [24000, 24064], [48000, 24064],
      [Math.floor((spec.loopEnd - .6) * 48000), 24064], [Math.floor(spec.loopStart * 48000) - 32, 12064], [0, 24064]];
    let maxAbs = 0, sum = 0, comparedSamples = 0, peakRetainedFrames = 0, largestReturnedFrames = 0;
    for (const [start, frames] of windows) {
      const values = await pull.read(start, frames);
      peakRetainedFrames = pull.peakRetainedFrames; largestReturnedFrames = Math.max(largestReturnedFrames, frames);
      for (let channel = 0; channel < 2; channel++) {
        const target = reference.getChannelData(channel);
        for (let i = 0; i < frames; i++) {
          const difference = values[channel][i] - target[start + i];
          maxAbs = Math.max(maxAbs, Math.abs(difference)); sum += difference * difference; comparedSamples++;
        }
      }
    }
    scope.disposed = true; for (const dispose of [...cleanups]) dispose();
    return { windows, maxAbs, rms: Math.sqrt(sum / comparedSamples), comparedSamples, exact: maxAbs === 0,
      peakRetainedFrames, largestReturnedFrames, largestOutputFrames, created, closed, outputData, closedData,
      cleanupResidue: cleanups.size, retainedAfterDispose: pull.retainedFrames };
  }, spec);
  if (!report.result.exact || report.result.cleanupResidue || report.result.retainedAfterDispose
    || report.result.outputData !== report.result.closedData || report.result.created !== report.result.closed) throw new Error('Bounded decoder proof failed');
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.closed = true; writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
