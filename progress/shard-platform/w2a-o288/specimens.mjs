// SHARD-PLATFORM sp-o288 (W2a): Pine Hollow's creature hulls in the real Model Explorer, one still per creature, on a
// muted Metal "iPhone 16 Pro" portrait context, phone tier / 2x. A finger is held on the canvas before each card opens,
// so the turntable stays on the explorer's own opening angle (no idle turn) and the before / after stills line up.
//   SERVE_OWNER=sp-o288 scripts/serve-build.sh --rev <sha> --shard pine-hollow --name o288
//   TAG=after scripts/browser-lane.sh --max 20 node progress/shard-platform/w2a-o288/specimens.mjs <preview-url> <out-dir> [id,id,…|--list]
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out, want = '--list'] = process.argv.slice(2);
const TAG = process.env.TAG ?? 'now';
if (!base || !out) throw new Error('usage: specimens.mjs <preview-url> <out-dir> [id,id,…|--list]');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { tag: TAG, errors: [], consoleErrors: [], warnings: [], shots: [], requests: { rigBlob: 0, publicRig: 0, ktx2Blob: 0 } };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { report.errors.push(String(error.stack ?? error).slice(0, 400)); });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && report.consoleErrors.length < 12) report.consoleErrors.push(text.slice(0, 300));
    if (msg.type() === 'warning' && /creature rig|rigged/i.test(text)) report.warnings.push(text.slice(0, 300));
  });
  page.on('request', (req) => {
    const url = req.url();
    if (/\/assets\/(gpu\/)?pine-hollow\/creatures\/[^/]*rigged/u.test(url)) report.requests.publicRig++;
    if (url.includes('/shardfiles/pine-hollow/') && url.endsWith('.ktx2')) report.requests.ktx2Blob++;
  });
  await page.goto(`${base}/?chunk=pine-hollow&tier=phone&touch=1&mute=1&nolock=1&sw=0&explore=model`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.ws-x-grid .ws-x-model').length > 0 && window.__wildshard?.world !== undefined, undefined, { timeout: 480000, polling: 1000 });
  const catalog = await page.evaluate(() => [...document.querySelectorAll('.ws-x-grid .ws-x-model')].map((c) => ({ id: c.dataset.id ?? '', name: c.querySelector('b')?.textContent ?? '' })));
  report.catalog = catalog;
  if (want !== '--list') {
    for (const spec of want.split(',')) {
      const [id = '', v] = spec.split('@');
      await page.evaluate(() => {
        const canvas = window.__wildshard.world.game.renderer.domElement;
        if (document.querySelector('.ws-x-models')?.dataset.view === 'model') document.querySelector('.ws-x-back')?.click();
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: 201, clientY: 300, bubbles: true, cancelable: true }));
      });
      const ok = await page.evaluate(([m, n]) => {
        const card = [...document.querySelectorAll('.ws-x-grid .ws-x-model')].find((c) => c.dataset.id === m);
        if (!card) return false;
        card.click();
        if (n !== undefined) { const chip = [...document.querySelectorAll('.ws-x-variants button')].at(Number(n) - 1); if (!chip) return false; chip.click(); }
        return true;
      }, [id, v]);
      if (!ok) { report.shots.push({ spec, missing: true }); continue; }
      await page.waitForFunction(() => (document.querySelector('.ws-x-stats b[data-s="build"]')?.textContent ?? '').trim() !== '', undefined, { timeout: 120000, polling: 250 }).catch(() => undefined);
      await page.waitForTimeout(3500);
      const facts = await page.evaluate(() => {
        const t = (s) => (document.querySelector(s)?.textContent ?? '').trim();
        return { name: t('.ws-x-name'), variant: t('.ws-x-variants button.on'), tris: t('.ws-x-stats b[data-s="tris"]'), calls: t('.ws-x-stats b[data-s="calls"]') };
      });
      const file = join(out, `${TAG}-${spec.replace(/[^a-z0-9-]/giu, '_')}.png`);
      await page.screenshot({ path: file });
      report.shots.push({ spec, file, ...facts });
    }
  }
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(out, `specimens-${TAG}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, catalog: report.catalog?.map((c) => `${c.id} (${c.name})`) }, null, 2));
}
