#!/usr/bin/env node
import { debugSettings } from './debug-settings.mjs';
// Reproduce the phone's null precision result or the Simulator's shaderSource failure during boot.
// Run after `pnpm build` with `pnpm exec vite preview --port 4184` up:
// node scripts/test-nine-gpu-boot.mjs [--url=http://127.0.0.1:4184] [--only=webkit|chromium|all] [--fault=precision|shader|context|texture]
// A pass requires one failure, an error panel, no second load, and diagnostics in both reporting transports.
import { chromium, webkit } from 'playwright';

const option = (name, fallback) => process.argv.find((part) => part.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = option('url', 'http://127.0.0.1:4184').replace(/\/$/, '');
const only = option('only', 'webkit');
const fault = option('fault', 'shader');
if (!['shader', 'precision', 'context', 'texture'].includes(fault)) throw new Error(`Unknown fault: ${fault}`);
const engines = only === 'all' ? [['webkit', webkit], ['chromium', chromium]] : [[only, only === 'chromium' ? chromium : webkit]];
if (only !== 'all' && only !== 'webkit' && only !== 'chromium') throw new Error(`Unknown engine: ${only}`);

let failed = false;
for (const [name, engine] of engines) {
  const browser = await engine.launch(name === 'chromium' ? { args: ['--use-angle=metal'] } : {});
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 402, height: 654 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const reports = [];
    await context.route('**/api/errors', async (route) => {
      reports.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"synthetic-test"}' });
    });
    // Synthetic errors test the envelope locally, without polluting production Sentry issues.
    const envelopes = [];
    await context.route(/https:\/\/[^/]+\.ingest\.[^/]+\/api\//, async (route) => {
      envelopes.push(route.request().postData() ?? '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    if (fault === 'texture') await debugSettings(context, { tex: 'ktx2' });
    await context.addInitScript((selectedFault) => {
      if (selectedFault === 'texture') {
        // Ask the actual driver to reject one upload; do not fabricate getError's result.
        // oxlint-disable-next-line typescript/unbound-method -- native receiver supplied with Reflect.apply
        const original = WebGL2RenderingContext.prototype.compressedTexSubImage2D;
        let injected = false;
        WebGL2RenderingContext.prototype.compressedTexSubImage2D = function compressedTexSubImage2D(...args) {
          if (!injected && document.querySelector('.ws-load')?.dataset.step === 'shaders') {
            injected = true;
            args[6] = 0; // not a compressed texture format: INVALID_ENUM
            console.info('[gpu-boot-test] injected compressed upload failure');
          }
          Reflect.apply(original, this, args);
        };
        return;
      }
      if (selectedFault === 'context') {
        // Lose the REAL context while getContext returns it; all WebGL queries now obey native
        // context-loss semantics. The old renderer constructor reproduces the phone's exact TypeError.
        // oxlint-disable-next-line typescript/unbound-method -- native receiver supplied with Reflect.apply
        const original = HTMLCanvasElement.prototype.getContext;
        let injected = false;
        HTMLCanvasElement.prototype.getContext = function getContext(...args) {
          const gl = Reflect.apply(original, this, args);
          if (!injected && this.id === 'game' && gl instanceof WebGL2RenderingContext) {
            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose === null) throw new Error('Recovery test needs WEBGL_lose_context');
            injected = true;
            this.addEventListener('webglcontextlost', () => {
              // The APPLICATION must preventDefault to allow this restoration.
              setTimeout(() => { lose.restoreContext(); }, 750);
            }, { once: true });
            lose.loseContext();
            console.info('[gpu-boot-test] injected real context loss');
          }
          return gl;
        };
        return;
      }
      if (selectedFault === 'precision') {
        // oxlint-disable-next-line typescript/unbound-method -- invoked with the original WebGL receiver via call()
        const precision = WebGL2RenderingContext.prototype.getShaderPrecisionFormat;
        let injected = false;
        WebGL2RenderingContext.prototype.getShaderPrecisionFormat = function getShaderPrecisionFormat(...args) {
          if (!injected) {
            injected = true;
            console.info('[gpu-boot-test] injected precision failure');
          }
          // Keep capabilities unavailable through the bounded startup recovery window.
          precision.call(this, ...args);
          return null;
        };
        return;
      }
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
    }, fault);
    page = await context.newPage();
    const navigations = [];
    let injections = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    page.on('console', (message) => { if (message.text().includes('[gpu-boot-test] injected')) { injections++; console.log(`${name}: injected ${fault} failure`); } });
    page.on('pageerror', (error) => { console.log(`${name}: page error ${error.message.slice(0, 180)}`); });
    const entry = fault === 'context' ? '' : '&skipintro=1';
    await page.goto(`${base}/?chunk=nine-dragon-stack${entry}&nolock=1&mute=1&touch=1&tier=phone&sw=0`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (fault === 'context') {
      await page.waitForFunction(() => Boolean(window.__wildshard?.world) || Boolean(document.querySelector('#wserr')), null, { timeout: 90_000 });
      await page.locator('.ws-menu-explore').click();
      await page.locator('.ws-x-card[data-m="world"]').click();
      await page.waitForFunction(() => {
        const trace = (JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.['boot.trace']?.data ?? null);
        return trace?.status === 'ready' && trace.checkpoints?.some((point) => point.operation === 'explore:stable');
      }, null, { timeout: 25_000 });
      const state = await page.evaluate(() => ({
        world: Boolean(window.__wildshard?.world), exploring: Boolean(document.querySelector('.ws-x.show[data-mode="world"]')),
        lost: window.__wildshard?.world?.game.renderer.getContext().isContextLost(),
        calls: window.__wildshard?.world?.game.renderer.info.render.calls ?? 0,
        error: Boolean(document.querySelector('#wserr')),
        trace: JSON.stringify(JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.['boot.trace']?.data ?? null),
      }));
      const okay = injections === 1 && navigations.length === 1 && state.world && state.exploring &&
        state.lost === false && state.calls > 0 && !state.error && reports.length === 0 &&
        state.trace.includes('renderer:waiting') && state.trace.includes('"status":"ready"');
      console.log(`${okay ? 'PASS' : 'FAIL'} ${name}/context: ${JSON.stringify({ injections, navigations: navigations.length, ...state, trace: undefined })}`);
      if (!okay) failed = true;
      continue;
    }
    await page.waitForSelector('#wserr[role="alertdialog"]', { timeout: 30_000 });
    // Sentry loads lazily after a fault; allow its module fetch and transport to finish.
    for (let i = 0; i < 50 && envelopes.length === 0; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(1500); // an automatic recovery navigation would have happened by now
    const state = await page.evaluate(() => ({
      error: document.querySelector('#wserr .msg')?.textContent ?? '',
      detail: document.querySelector('#wserr .n')?.textContent ?? '',
      retry: Boolean(document.querySelector('#wserr button.here')),
      title: Boolean(document.querySelector('#wserr button.title')),
      url: location.href,
      loadAttempt: (JSON.parse(sessionStorage.getItem('wildshard.save.v2.session') ?? '{}').keys?.loadAttempt?.data ?? null)?.count ?? null,
    }));
    const otherNavigation = navigations.some((url) => new URL(url).searchParams.get('chunk') !== 'nine-dragon-stack');
    const expectedError = fault === 'precision' ? 'Graphics context did not recover' : fault === 'texture' ? 'Graphics error 1280 after compressed texture' : 'Nine Dragon GPU boot failed';
    const expectedOperation = fault === 'precision' ? 'renderer:waiting' : fault === 'texture' ? 'texture:upload' : 'compile:before';
    const evidence = reports.some((report) => report.context?.bootDiagnostic?.includes(expectedOperation));
    const sentryEvidence = envelopes.some((envelope) => envelope.includes('boot_diagnostic') && envelope.includes(expectedOperation));
    const okay = injections === 1 && !otherNavigation && state.error.includes(expectedError) && state.detail === '' && state.retry && state.title && state.loadAttempt === 1 && evidence && sentryEvidence;
    console.log(`${okay ? 'PASS' : 'FAIL'} ${name}/${fault}: ${JSON.stringify({ injections, navigations, evidence, sentryEvidence, envelopes: envelopes.length, ...state })}`);
    if (!okay) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${String(error)}`);
    if (page) console.error(JSON.stringify(await page.evaluate(() => ({ url: location.href, step: document.querySelector('.ws-load')?.dataset.step, title: Boolean(document.querySelector('.ws-menu')), error: document.querySelector('#wserr .msg')?.textContent ?? '', world: Boolean(window.__wildshard?.world) })).catch(() => null)));
  } finally { await browser.close(); }
}
if (failed) process.exitCode = 1;
