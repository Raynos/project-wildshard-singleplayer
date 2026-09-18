// Render the score offline through the real engine (src/audio/Music.ts renderOffline → OfflineAudioContext 48 kHz stereo)
// in headless Chromium, and write WAVs:
//   node scripts/music/render.mjs                → scripts/trailer/score-30.wav  score-15.wav  theme-loop.wav
//   node scripts/music/render.mjs theme 40 out.wav [solo layers, e.g. pluck,marimba] [state JSON, e.g. '{"mode":"combat","shard":"island"}']
// Needs the Vite dev server (http://localhost:5173) and dev/music.html.
import { chromium } from '/Users/raynos/projects/project-wildshard-singleplayer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const trailer = resolve(here, '../trailer');
const jobs = process.argv.length >= 5
  ? [[process.argv[2], Number(process.argv[3]), resolve(process.argv[4]), process.argv[5] ? process.argv[5].split(',').filter(Boolean) : undefined, process.argv[6] ? JSON.parse(process.argv[6]) : undefined]]
  : [['trailer30', 28.2, `${trailer}/score-30.wav`], ['trailer15', 15.0, `${trailer}/score-15.wav`], ['theme', 40, `${trailer}/theme-loop.wav`]];

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto('http://localhost:5173/dev/music.html?render=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__music, null, { timeout: 30000 });
for (const [name, seconds, out, solo, state] of jobs) {
  const t = Date.now();
  const b64 = await page.evaluate(([n, s, so, st]) => window.__music.renderWav(n, s, so && so.length ? so : undefined, st), [name, seconds, solo, state]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`${name} ${seconds}s → ${out} (${(Buffer.byteLength(b64, 'base64') / 1e6).toFixed(1)} MB, ${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
await browser.close();
