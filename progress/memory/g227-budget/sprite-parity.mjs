// Rejected crop probe: compare all samples. Nonzero output refuses the candidate; no production change.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { webkit, devices } from 'playwright';

const out = process.argv[2];
if (!out) throw new Error('Pass OUT_JSON; run through browser-lane.sh');
const root = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(readFileSync(resolve(root, 'public/assets/sfx/pine-hollow/sfx.json'), 'utf8'));
const file = resolve(root, 'public/assets/sfx/pine-hollow', manifest.sprite.file), bytes = readFileSync(file);
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await context.newPage();
  await page.goto('about:blank');
  const result = await page.evaluate(async ({ encoded, clips }) => {
    const decoder = new OfflineAudioContext(2, 1, 48000);
    const decoded = await decoder.decodeAudioData(await (await fetch('data:audio/mp4;base64,' + encoded)).arrayBuffer());
    // Isolated rejected candidate: original PCM, a 128-source-frame guard, fractional offset preserved.
    const compactAudioClip = (buffer, offset, duration) => {
      const start = Math.max(0, Math.floor(offset * buffer.sampleRate) - 128);
      const end = Math.min(buffer.length, Math.ceil((offset + duration) * buffer.sampleRate) + 128);
      const copy = decoder.createBuffer(buffer.numberOfChannels, end - start, buffer.sampleRate);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        copy.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel);
      }
      return { buffer: copy, offset: (offset * buffer.sampleRate - start) / buffer.sampleRate, duration };
    };
    const spans = Object.entries(clips).map(([name, [offset, duration]]) => ({ name, offset, duration }));
    const compact = spans.map(span => compactAudioClip(decoded, span.offset, span.duration));
    const cases = [];
    for (const rate of [48000, 44100]) for (const detune of [-40, 0, 40]) {
      const ratio = 2 ** (-detune / 1200);
      const seconds = spans.reduce((sum, span) => sum + span.duration * ratio + 0.1, 0) + 0.2;
      const render = async copied => {
        const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
        let time = 0.05;
        for (let index = 0; index < spans.length; index++) {
          const span = spans[index], clip = copied ? compact[index] : { ...span, buffer: decoded };
          const source = ctx.createBufferSource(); source.buffer = clip.buffer; source.detune.value = detune;
          source.connect(ctx.destination); source.start(time, clip.offset, clip.duration);
          time += span.duration * ratio + 0.1;
        }
        return ctx.startRendering();
      };
      const before = await render(false), after = await render(true);
      const a = before.getChannelData(0), b = after.getChannelData(0);
      let maximumAbsoluteDifference = 0, square = 0, signal = 0;
      for (let index = 0; index < a.length; index++) {
        const delta = a[index] - b[index]; maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, Math.abs(delta));
        square += delta * delta; signal += a[index] * a[index];
      }
      cases.push({ rate, detune, samples: a.length, maximumAbsoluteDifference,
        rmsDifference: Math.sqrt(square / a.length), signalRms: Math.sqrt(signal / a.length) });
    }
    return { channels: decoded.numberOfChannels, rate: decoded.sampleRate, clips: spans.length,
      beforePCMBytes: decoded.length * decoded.numberOfChannels * 4,
      afterPCMBytes: compact.reduce((sum, clip) => sum + clip.buffer.length * clip.buffer.numberOfChannels * 4, 0), cases };
  }, { encoded: bytes.toString('base64'), clips: manifest.sprite.clips });
  const report = { protocol: 'Playwright WebKit OfflineAudioContext, actual shipped AAC decoded once at48kHz. Every clip uses identical start time, original duration and -40/0/+40cent pitch; compare all samples at48/44.1kHz without normalization or alignment shifts. No live audio device.',
    asset: file, assetSha256: createHash('sha256').update(bytes).digest('hex'),
    implementationSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), ...result };
  report.pass = result.cases.every(value => value.signalRms > 0.001 && value.maximumAbsoluteDifference === 0);
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  if (!report.pass) throw new Error('Sprite render is not sample-identical');
} finally { await browser.close(); }
