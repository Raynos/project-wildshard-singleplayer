/** E336 real HUD arena portrait capture. Run through scripts/browser-lane.sh. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [base = 'build', outArg = 'progress/e336'] = process.argv.slice(2);
const out = resolve(outArg); mkdirSync(out, { recursive: true });
// Build only after acquiring the lane, so a long queue cannot leave us targeting a recycled preview.
const owned = base === 'build';
const served = owned ? execFileSync('bash', ['scripts/serve-build.sh', '--hours', '4', '--port', '4994', '--name', 'e336-capture'],
  { encoding: 'utf8' }).trim() : base;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    hasTouch: true, isMobile: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('dummy')) errors.push(m.text()); });
  const start = Date.now();
  await page.goto(`${served}/?chunk=driftwood-isle&touch&tier=phone&skipintro&nolock&mute`);
  await page.waitForFunction(() => Boolean(window.__world?.arena), undefined, { timeout: 300000 });
  await page.evaluate(() => window.__world.hud.enterArenaNow());
  await page.waitForFunction(() => window.__world.arena.targets.every((t) => t.ready && t.clips?.bones.length === 13), undefined, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const trim = (Date.now() - start) / 1000;
  await page.screenshot({ path: `${out}/arena-idle.jpg`, type: 'jpeg', quality: 88 });
  const clips = await page.evaluate(() => window.__world.arena.targets.map((t) => ({ variant: t.variant, rig: t.model.rig,
    driven: t.clips.bones.length, clips: [...t.clips.reactions.keys()] })));
  await page.waitForTimeout(2000);
  for (const [name, px, py, amount] of [['body', 0, 1.1, 25], ['head', 0, 1.58, 45], ['left', -0.3, 1.1, 35],
    ['right', 0.3, 1.1, 35], ['heavy', 0, 1.1, 70]]) {
    await page.evaluate(({ px: hitX, py: hitY, amount: damage }) => {
      const w = window.__world;
      for (const t of w.arena.targets) {
        const p = t.position.clone().add({ x: hitX, y: hitY, z: 0.2 });
        t.applyDamage(damage, p, t.position.clone().set(0, 0, -1));
      }
    }, { px, py, amount });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/arena-${name}.jpg`, type: 'jpeg', quality: 88 });
    await page.waitForTimeout(2000);
  }
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { for (const t of window.__world.arena.targets) t.applyDamage(40, t.position.clone().add({ x: 0.2, y: 1.2, z: 0.2 })); });
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(3000);
  const report = { method: 'Built game, actual HUD arena, scripted simultaneous damage calls; portrait phone tier on Chromium Metal',
    clips, errors, videoTrimStart: trim };
  writeFileSync(`${out}/runtime.json`, `${JSON.stringify(report, null, 2)  }\n`);
  const video = page.video(); await context.close();
  const raw = await video.path();
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(trim), '-i', raw, '-t', '20',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/arena-reactions.mp4`]);
  console.log(report);
} finally {
  await browser.close();
  if (owned) execFileSync('bash', ['scripts/serve-build.sh', 'stop', '4994']);
}
