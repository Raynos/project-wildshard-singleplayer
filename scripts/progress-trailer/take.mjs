// take.mjs — one input-driven, fixed-step first-person take on a historical build (PROGRESS-TRAILER §3.1, E468).
//
//   scripts/browser-lane.sh --max 30 node scripts/progress-trailer/take.mjs --shot=scripts/progress-trailer/shots/d01-hunt.mjs \
//     --url=http://127.0.0.1:<port> --out=<scratch>/takes [--frames=<n>] [--opt='<json>'] [--dry]
//
// The build is one `build-rev.sh` made (its dist/SHA names the commit). The shot module exports `shot` =
//   { name, era: 'legacy' | 'app', query, warmSec, frames, setup, step, accept }
// where `setup` (run once in the page, returns facts such as the prey it chose) and `step` (run before every frame with
// (f, t, S), S = what setup returned) are function sources, and `accept(receipt)` refuses a take that did not happen.
// `--opt` is JSON the setup reads as window.__takeOpt (which prey, which approach); setup and step push
// { t, e, … } onto window.__takeEvents (the SFX cue list) and may define window.__takeFinal().
// Every frame is one game frame of exactly 1/60 s: the page runs on Playwright's fake clock, the era adapter pins the
// game's delta (legacy: the THREE clock's getDelta; app: app.clock.setCapture(60)), and the runner asserts that each
// step drew exactly one frame. Both adapters define window.__hold(code, on) for held movement (the key set, or the
// InputService where the player reads one). 1920×1080, desktop, muted, every DOM element hidden except the main canvas (the
// viewmodel is in the canvas and stays). Writes <out>/<name>-<sha8>-<recipe8>/ with frames + receipt.json.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
const require = createRequire(join(HERE, '../../package.json'));
const { chromium } = require('playwright');

const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SHOT = resolve(arg('shot')), URL_BASE = arg('url'), OUT = resolve(arg('out', 'takes')), DRY = process.argv.includes('--dry');
const { shot } = await import(pathToFileURL(SHOT).href);
const FRAMES = Number(arg('frames', '')) || shot.frames;
const recipe = createHash('sha1').update(readFileSync(SHOT)).update(readFileSync(import.meta.filename)).update(arg('opt', '{}')).digest('hex');
const sha = (await (await fetch(`${URL_BASE}/SHA`)).text()).trim();
const dir = join(OUT, `${shot.name}-${sha.slice(0, 8)}-${recipe.slice(0, 8)}`);
mkdirSync(dir, { recursive: true });

// era adapters: pin the game's delta to 1/60 and count drawn frames
const ADAPT = {
  legacy: `(() => {
    const w = window.__world, g = w.game;
    window.__sim = { t: 0, frames: 0 };
    g.clock.getDelta = () => { window.__sim.t += 1 / 60; g.clock.elapsedTime = window.__sim.t; return 1 / 60; };
    const render = g.composer.render.bind(g.composer);
    g.composer.render = (dt) => { window.__sim.frames++; return render(dt); };
    window.__hold = (code, on) => { if (on) w.player.keys.add(code); else w.player.keys.delete(code); };
    return { keys: Object.keys(w).length };
  })()`,
  app: `(() => {
    const w = window.__wildshard.world, g = w.game;
    g.app.clock.setCapture(60);
    window.__sim = { get t() { return g.app.clock.now; }, get frames() { return g.app.clock.frame; } };
    // held movement: the InputService where the player reads one (day 22 on), else the key set (day 15)
    const ACTION = { KeyW: 'move.forward', KeyS: 'move.back', KeyA: 'move.left', KeyD: 'move.right', ShiftLeft: 'sprint', Space: 'jump' };
    window.__hold = (code, on) => {
      const input = w.player.inputService;
      if (input && ACTION[code]) input.setHeld(ACTION[code], on);
      else if (on) w.player.keys.add(code);
      else w.player.keys.delete(code);
    };
    return { keys: Object.keys(w).length, input: Boolean(w.player.inputService), world: Object.keys(w).slice(0, 60) };
  })()`,
};
const WORLD = { legacy: 'window.__world', app: 'window.__wildshard?.world' };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
const receipt = { shot: shot.name, sha, recipe, era: shot.era, url: `${URL_BASE}/?${shot.query}`, frames: 0, steps: [], events: [], errors };
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  await page.clock.install();
  await page.goto(receipt.url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(`Boolean(${WORLD[shot.era]}?.game)`, undefined, { timeout: 300000, polling: 1000 });
  await page.waitForTimeout((shot.warmSec ?? 10) * 1000); // stream the world in (real time, the fake clock still flows)
  receipt.adapter = await page.evaluate(ADAPT[shot.era]);
  await page.evaluate(`window.__takeOpt = ${arg('opt', '{}')}; window.__takeEvents = []`);
  receipt.opt = JSON.parse(arg('opt', '{}'));
  receipt.setup = await page.evaluate(`window.__takeSetup = (${shot.setup})(); window.__takeSetup`);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = c; }
    }
    if (best) best.dataset.main = '1';
  });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas[data-main] { visibility: visible !important; } html, body { background: #000 !important; }' });
  await page.clock.pauseAt(Date.now() + 1000);
  receipt.simStart = await page.evaluate('window.__sim.t');
  const step = `(${shot.step})`;
  for (let f = 0; f < FRAMES; f++) {
    await page.evaluate(`${step}(${f}, ${f / 60}, window.__takeSetup)`);
    const before = await page.evaluate('window.__sim.frames');
    let after = before;
    for (let k = 0; k < 40 && after === before; k++) { await page.clock.runFor(2); after = await page.evaluate('window.__sim.frames'); }
    receipt.steps.push(after - before);
    if (!DRY || f % 30 === 0) await page.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (f % 60 === 0) console.log(`frame ${f}/${FRAMES}`);
  }
  receipt.frames = FRAMES;
  receipt.simEnd = await page.evaluate('window.__sim.t');
  receipt.events = await page.evaluate('window.__takeEvents ?? []');
  receipt.final = await page.evaluate('window.__takeFinal?.() ?? null');
} finally {
  await browser.close();
}
const bad = receipt.steps.filter((d) => d !== 1).length;
receipt.oneFramePerStep = bad === 0;
receipt.problems = [...(bad ? [`${bad} steps did not draw exactly one frame`] : []), ...(errors.length > 0 ? [`${errors.length} page errors`] : []), ...(shot.accept?.(receipt) ?? [])];
receipt.accepted = receipt.problems.length === 0;
writeFileSync(join(dir, 'receipt.json'), JSON.stringify(receipt, null, 1));
console.log(`${receipt.accepted ? 'ACCEPTED' : 'REFUSED'} ${dir}`);
console.log(JSON.stringify({ sim: [receipt.simStart, receipt.simEnd], setup: receipt.setup, events: receipt.events.slice(0, 12), final: receipt.final, problems: receipt.problems }));
