// riggate.mjs — lab P8 round 13: the rig gate (joint angles / velocities at 60 Hz over the scripted sequence) + skin checks
//   node riggate.mjs <out.json>
import { writeFileSync } from 'node:fs';

const { chromium } = await import('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs');
const out = process.argv[2];
const LIM = {
  pronation: [-75, 75], flexion: [-60, 60], deviation: [-32, 22], elbow: [0, 150],
  // °/s: elite wrist / forearm / elbow speeds in sword and racket strokes top out ~1500–2000; a snap reads as a spike
  vel: { elbow: 1500, pronation: 1500, flexion: 1200, deviation: 900 },
  // ° per frame² at 60 Hz: 12 = a change of 720 °/s within one frame (a smooth strike ramps over 3–5 frames)
  acc: 12,
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal'] });
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 600)}`));
  await page.goto('http://localhost:5173/dev/nd-lab-viewmodel.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ndVm !== undefined, undefined, { timeout: 120000 });
  await page.evaluate(() => window.__ndVm.ready);
  await page.evaluate(() => { window.__ndVm.clock(false); });
  const skin = await page.evaluate(() => window.__ndVm.skin());
  const g = await page.evaluate(() => window.__ndVm.gate());
  const fails = [];
  const names = ['elbow', 'pronation', 'flexion', 'deviation'];
  const table = [];
  for (const side of ['R', 'L']) {
    for (const nm of names) {
      const lo = g.max[`${side}.${nm}.min`], hi = g.max[`${side}.${nm}.max`], v = g.max[`${side}.${nm}.vel`], a = g.max[`${side}.${nm}.acc`];
      const lim = LIM[nm];
      const ok = lo >= lim[0] - 0.5 && hi <= lim[1] + 0.5 && v <= LIM.vel[nm] && a <= LIM.acc;
      if (!ok) fails.push(`${side}.${nm}`);
      table.push(`${side} ${nm.padEnd(10)} range ${lo.toFixed(1)} … ${hi.toFixed(1)} (limit ${lim[0]} … ${lim[1]}) · max |ω| ${v.toFixed(0)} °/s (≤ ${LIM.vel[nm]}) · max |Δ²| ${a.toFixed(2)} °/f² (≤ ${LIM.acc})  ${ok ? 'PASS' : 'FAIL'}`);
    }
  }
  // where the worst spikes are
  const spikes = [];
  for (const side of ['R', 'L']) for (let k = 0; k < 4; k++) {
    for (let i = 2; i < g.frames.length; i++) {
      const x = g.frames[i][side][k], p = g.frames[i - 1][side][k], pp = g.frames[i - 2][side][k];
      const acc = Math.abs(x - 2 * p + pp);
      if (acc > LIM.acc * 0.75) spikes.push({ t: Number(g.frames[i].t.toFixed(3)), side, joint: names[k], acc: Number(acc.toFixed(1)) });
    }
  }
  const skinOk = skin.maxWeightSumError <= 2e-3 && skin.badIndices === 0 && skin.bindRestoreError <= 1e-4;
  const clothPen = g.max['cloth.penetration'];
  const clothOk = clothPen <= 0.005;
  table.push(`cloth: deepest tassel / talisman point inside the fist / forearm / guard ${(clothPen * 1000).toFixed(1)} mm (≤ 5)  ${clothOk ? 'PASS' : 'FAIL'}`);
  if (!clothOk) fails.push('cloth');
  const verdict = fails.length === 0 && skinOk ? 'PASS' : 'FAIL';
  const report = { verdict, fails, skin, skinOk, table, spikes: spikes.slice(0, 40), events: g.events, frames: g.frames.length, limits: LIM };
  writeFileSync(out, JSON.stringify({ ...report, series: g.frames }, null, 0));
  console.log(`rig gate: ${verdict} · ${g.frames.length} frames @ 60 Hz · skin ${JSON.stringify(skin)}`);
  console.log(table.join('\n'));
  if (spikes.length > 0) console.log('spikes:', JSON.stringify(spikes.slice(0, 20)));
  await context.close();
} finally { await browser.close(); }
