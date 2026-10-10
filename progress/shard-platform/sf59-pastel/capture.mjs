#!/usr/bin/env node
// SF59 / G169: capture the pastel plain on a served build as "iPhone 16 Pro" portrait at 2x, with Settings ▸ Debug ▸ Look
// ▸ "Graph materials" off and on, and record every console error (shader compile errors included) and the GL program count.
//   scripts/browser-lane.sh node progress/shard-platform/sf59-pastel/capture.mjs <served url> <out dir>
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [base = 'http://127.0.0.1:4408', out = 'progress/shard-platform/sf59-pastel'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const views = [{ name: 'spawn', x: 0, y: 1.7, z: 6, yaw: 0, pitch: -0.05 }, { name: 'hut', x: 6, y: 2.2, z: 2, yaw: 0.45, pitch: -0.08 }];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const result = {};
try {
  for (const graphs of (process.env.GRAPHS ?? 'off,on').split(',')) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await context.addInitScript({ content: [
      saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', graphMaterials: graphs }, merge: true }),
      saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
      saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
    ].join(';') });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 400)));
    page.on('console', (m) => { if (m.type() === 'error' || /shader|WebGLProgram/iu.test(m.text())) errors.push(m.text().slice(0, 400)); });
    await page.goto(`${base}/?chunk=pastel-plain&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    const status = () => { const failure = document.querySelector('.ws-load-error');
      return { ready: Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), error: document.querySelector('#wserr .msg')?.textContent ?? (failure ? [...failure.querySelectorAll('h1,p')].map((n) => n.textContent).join(' — ') : undefined), loading: document.querySelector('.ws-load')?.textContent?.slice(-300), stack: document.querySelector('#wserr pre')?.textContent?.slice(0, 3000) ?? document.querySelector('.ws-load-error pre')?.textContent?.slice(0, 3000) }; };
    const deadline = Date.now() + 240_000; let state = await page.evaluate(status);
    while (!state.ready && state.error === undefined && Date.now() < deadline) { await page.waitForTimeout(1000); state = await page.evaluate(status); }
    if (!state.ready) { result[graphs] = { failed: state, errors }; await context.close(); continue; }
    await page.waitForTimeout(4000);
    const shots = {};
    for (const view of views) {
      await page.evaluate((v) => { const p = window.__wildshard.world.player; p.position.set(v.x, v.y, v.z); p.yaw = v.yaw; p.pitch = v.pitch; }, view);
      await page.waitForTimeout(2500);
      const file = join(out, `${view.name}-graphs-${graphs}.png`);
      await page.screenshot({ path: file }); shots[view.name] = file;
    }
    const gl = await page.evaluate(() => { const g = window.__wildshard.world.game; return { programs: g.renderer.info.programs?.length ?? null, level: g.level.id, renderScale: g.renderer.getPixelRatio(), canvas: [g.canvas.width, g.canvas.height] }; });
    result[graphs] = { shots, errors, gl };
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(join(out, 'capture.json'), `${JSON.stringify(result, null, 2)}\n`);
console.info(JSON.stringify(result, null, 2));
