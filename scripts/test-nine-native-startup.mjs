#!/usr/bin/env node
// macOS native WebKit GPU restart during renderer creation (E257).
// node scripts/test-nine-native-startup.mjs --url=http://127.0.0.1:4184
// Only the fresh Playwright GPU process is killed; every pre-existing process is excluded.
import { webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

if (process.platform !== 'darwin') throw new Error('This drill uses the macOS Playwright WebKit GPU process');
const base = process.argv.find((v) => v.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:4184';
const gpuPids = () => execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n')
  .filter((line) => line.includes('ms-playwright/webkit') && line.includes('WebKit.GPU'))
  .map((line) => Number(line.trim().split(/\s+/)[0]));
const before = new Set(gpuPids());
const browser = await webkit.launch();
const native = { ownedPid: 0, killed: false };
const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (request.url === '/restart' && native.ownedPid && !native.killed) {
    native.killed = true;
    process.kill(native.ownedPid, 'SIGKILL');
  }
  response.end('ok');
});
try {
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  const context = await browser.newContext({ viewport: { width: 402, height: 654 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const reports = [];
  await context.route('**/api/errors', async (route) => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, body: '{}' });
  });
  await context.route(/https:\/\/[^/]+\.ingest\.[^/]+\/api\//, (route) => route.fulfill({ status: 200, body: '{}' }));
  const page = await context.newPage();
  // Start this browser's GPU process, then identify it before navigating to the game.
  const available = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  if (!available) throw new Error('WebGL unavailable before the test');
  const fresh = gpuPids().filter((pid) => !before.has(pid));
  if (fresh.length !== 1) throw new Error(`Cannot exclusively identify this test's GPU process: ${fresh.join(', ')}`);
  native.ownedPid = fresh[0];
  await context.addInitScript((port) => {
    // oxlint-disable-next-line typescript/unbound-method -- native receiver supplied with Reflect.apply
    const get = HTMLCanvasElement.prototype.getContext;
    let once = false;
    HTMLCanvasElement.prototype.getContext = function getContext(...args) {
      const gl = Reflect.apply(get, this, args);
      if (this.id === 'game' && gl instanceof WebGL2RenderingContext && !once) {
        once = true;
        // Synchronize the native restart with creation, before Three reads precision. No GL
        // return values are fabricated. This synchronous request exists only in this drill.
        const request = new XMLHttpRequest();
        request.open('GET', `http://127.0.0.1:${port}/restart`, false);
        request.send();
      }
      return gl;
    };
  }, address.port);
  await page.goto(`${base}/?chunk=nine-dragon-stack&tier=phone&touch=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world) || Boolean(document.querySelector('#wserr')), null, { timeout: 60_000 });
  if (await page.locator('.ws-menu-explore').isVisible()) {
    await page.locator('.ws-menu-explore').click();
    await page.locator('.ws-x-card[data-m="world"]').click();
  }
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    world: Boolean(window.__wildshard?.world), lost: window.__wildshard?.world?.game.renderer.getContext().isContextLost(),
    exploring: Boolean(document.querySelector('.ws-x.show[data-mode="world"]')),
    error: document.querySelector('#wserr .msg')?.textContent ?? '',
    waited: (localStorage.getItem('ws.nineBoot') ?? '').includes('renderer:waiting'),
  }));
  const okay = native.killed && state.waited && state.world && !state.lost && state.exploring && !state.error && reports.length === 0;
  console.log(`${okay ? 'PASS' : 'FAIL'} native GPU restart: ${JSON.stringify({ killed: native.killed, reports: reports.length, ...state })}`);
  if (!okay) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
