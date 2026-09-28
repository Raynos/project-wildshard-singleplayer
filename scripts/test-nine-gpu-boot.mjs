#!/usr/bin/env node
// Reproduce the iOS Simulator's shaderSource failure during Nine Dragon's first load.
// Run after `pnpm build` with `pnpm exec vite preview --port 4184` up:
// node scripts/test-nine-gpu-boot.mjs [--url=http://127.0.0.1:4184] [--only=webkit|chromium|all]
// A pass means one injected failure, a fatal error panel, and no automatic second load or navigation.
import { chromium, webkit } from 'playwright';

const option = (name, fallback) => process.argv.find((part) => part.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = option('url', 'http://127.0.0.1:4184').replace(/\/$/, '');
const only = option('only', 'webkit');
const engines = only === 'all' ? [['webkit', webkit], ['chromium', chromium]] : [[only, only === 'chromium' ? chromium : webkit]];
if (only !== 'all' && only !== 'webkit' && only !== 'chromium') throw new Error(`Unknown engine: ${only}`);

let failed = false;
for (const [name, engine] of engines) {
  const browser = await engine.launch(name === 'chromium' ? { args: ['--use-angle=metal'] } : {});
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      // oxlint-disable-next-line typescript/unbound-method -- the native method is always invoked with its WebGL context via call()
      const original = WebGL2RenderingContext.prototype.shaderSource;
      let injected = false;
      WebGL2RenderingContext.prototype.shaderSource = function shaderSource(shader, source) {
        if (!injected && document.querySelector('.ws-load')?.dataset.step === 'shaders') {
          injected = true;
          console.info('[gpu-boot-test] injected shaderSource failure');
          throw new TypeError("Argument 1 ('shader') to WebGL2RenderingContext.shaderSource must be an instance of WebGLShader");
        }
        original.call(this, shader, source);
      };
    });
    page = await context.newPage();
    const navigations = [];
    let injections = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    page.on('console', (message) => { if (message.text().includes('[gpu-boot-test] injected')) { injections++; console.log(`${name}: injected shaderSource failure`); } });
    page.on('pageerror', (error) => { console.log(`${name}: page error ${error.message.slice(0, 180)}`); });
    await page.goto(`${base}/?chunk=nine-dragon-stack&skipintro=1&nolock=1&mute=1&touch=1&tier=phone&sw=0`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#wserr[role="alertdialog"]', { timeout: 30_000 });
    await page.waitForTimeout(1500); // an automatic recovery navigation would have happened by now
    const state = await page.evaluate(() => ({
      error: document.querySelector('#wserr .msg')?.textContent ?? '',
      detail: document.querySelector('#wserr .n')?.textContent ?? '',
      retry: Boolean(document.querySelector('#wserr button.here')),
      title: Boolean(document.querySelector('#wserr button.title')),
      url: location.href,
      loadAttempt: JSON.parse(sessionStorage.getItem('ws.loadAttempt') ?? 'null')?.count ?? null,
    }));
    const otherNavigation = navigations.some((url) => new URL(url).searchParams.get('chunk') !== 'nine-dragon-stack');
    const okay = injections === 1 && !otherNavigation && state.error.includes('Nine Dragon GPU boot failed') && state.detail === '' && state.retry && state.title && state.loadAttempt === 1;
    console.log(`${okay ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify({ injections, navigations, ...state })}`);
    if (!okay) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${String(error)}`);
    if (page) console.error(JSON.stringify(await page.evaluate(() => ({ url: location.href, step: document.querySelector('.ws-load')?.dataset.step, title: Boolean(document.querySelector('.ws-menu')), error: document.querySelector('#wserr .msg')?.textContent ?? '', world: Boolean(window.__world) })).catch(() => null)));
  } finally { await browser.close(); }
}
if (failed) process.exitCode = 1;
