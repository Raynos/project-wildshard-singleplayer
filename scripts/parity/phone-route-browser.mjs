import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { devices, webkit } from 'playwright';
import { soakInspector } from '../soak/inspector.mjs';
import { bootLifecycleDiagnostic } from './boot-smoke.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';

/** @typedef {{opened:Promise<unknown>,send:(method:string,params?:Record<string,unknown>)=>Promise<unknown>,close:()=>void}} Inspector */
/** @param {unknown} result */
function value(result) {
  if (typeof result !== 'object' || result === null || !('result' in result) || typeof result.result !== 'object' || result.result === null) throw new Error('Invalid Safari evaluation result');
  if ('wasThrown' in result && result.wasThrown === true) throw new Error(JSON.stringify(result.result));
  return 'value' in result.result ? result.result.value : undefined;
}

/** Compose independently valid source statements before either browser executes them.
 * @param {string} paintScript */
export function phoneBootstrap(paintScript) {
  return `${saveFixtureCode({ scope: 'device', key: 'devMode', data: true })};\nwindow.__wildshardHarness={seed:357,capture:null};\n${paintScript};`;
}

/** @param {string} engine @param {string} base @param {string} _out @returns {Promise<import('./phone-route.mjs').PhonePage>} */
export async function openPhoneBrowser(engine, base, _out) {
  /** @type {string[]} */ const faults = [];
  if (engine === 'webkit') {
    const browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => faults.push(error.message));
    page.on('crash', () => faults.push('WebKit page crashed'));
    page.on('response', response => { if (response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/api/')) faults.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/errors' && request.method() === 'POST') {let report;try{report=JSON.parse(request.postData()??'null');}catch{report={malformed:request.postData()};}if(!bootLifecycleDiagnostic(report,true))faults.push(`Game error report: ${JSON.stringify(report)}`);} });
    await context.route(new URL('/api/telemetry', base).href, route => route.fulfill({status:204}));
    await context.addInitScript({ content: phoneBootstrap('') });
    return { engine: 'webkit-iphone', faults,
      async cold(url, paintScript) { await context.addInitScript({ content: paintScript }); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); },
      async click(selector) { await page.locator(selector).tap({ timeout: 10000 }); },
      evaluate: expression => page.evaluate(expression),
      screenshot: path => page.screenshot({ path, type: path.endsWith('.jpg') ? 'jpeg' : 'png', timeout: 10000 }),
      async close() { try { await context.close(); } finally { await browser.close(); } },
    };
  }
  if (engine !== 'simulator' || !process.env.SIM_UDID) throw new Error('Native phone route requires the existing Simulator lane');
  const udid = process.env.SIM_UDID;
  const simctl = (/** @type {string[]} */ args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 10000 });
  const sock = simctl(['getenv', udid, 'RWI_LISTEN_SOCKET']).trim();
  const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${sock}`, '-c', 'null:9221,:9232-9240'], { stdio:'ignore' });
  /** @type {Inspector|null} */ let inspector = null;
  async function connect() {
    inspector?.close(); inspector = null;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      for (let port = 9232; port <= 9240; port++) {
        let list;
        try { list = /** @type {unknown} */ (await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json()); } catch { continue; }
        if (!Array.isArray(list)) continue;
        const found = list.find((/** @type {unknown} */ row) => typeof row === 'object' && row !== null && 'url' in row && typeof row.url === 'string' && row.url.startsWith(base));
        if (typeof found !== 'object' || found === null || !('webSocketDebuggerUrl' in found) || typeof found.webSocketDebuggerUrl !== 'string') continue;
        inspector = soakInspector(found.webSocketDebuggerUrl);
        await inspector.opened; return;
      }
      await sleep(100);
    }
    throw new Error('No Safari inspector for exact phone preview');
  }
  const raw = async (/** @type {string} */ expression) => {
    if (inspector === null) throw new Error('Safari inspector unavailable');
    return value(await inspector.send('Runtime.evaluate', {expression, returnByValue:true, emulateUserGesture:true}));
  };
  // RWI's scalar evaluate does not await promises. Keep one owned result slot,
  // observe its completion, and preserve the real promise's rejection/deadline.
  async function evaluate(/** @type {string} */ expression) {
    await raw(`(()=>{const slot={done:false};window.__phoneRouteEvaluation=slot;Promise.resolve(${expression}).then(value=>Object.assign(slot,{done:true,value}),error=>Object.assign(slot,{done:true,error:String(error)}));return true;})()`);
    const deadline = Date.now() + 155000;
    while (Date.now() < deadline) {
      const result = await raw('window.__phoneRouteEvaluation');
      if (typeof result !== 'object' || result === null) throw new Error('Phone route evaluation lost its document');
      if ('done' in result && result.done === true) {
        if ('error' in result) throw new Error(String(result.error));
        return 'value' in result ? result.value : undefined;
      }
      await sleep(100);
    }
    throw new Error('Phone route asynchronous owner deadline');
  }
  return { engine: 'simulator-safari', faults,
    async cold(url, paintScript) {
      spawnSync('xcrun', ['simctl','terminate',udid,'com.apple.mobilesafari'], { stdio:'ignore' });
      simctl(['openurl',udid,new URL('/version.json',base).href]); await connect();
      await evaluate(`(async()=>{localStorage.clear();sessionStorage.clear();await Promise.all((await caches.keys()).map(key=>caches.delete(key)));await Promise.all((await navigator.serviceWorker.getRegistrations()).map(row=>row.unregister()));return true;})()`);
      if (inspector === null) throw new Error('Safari inspector unavailable');
      await inspector.send('Page.enable');
      await inspector.send('Page.setBootstrapScript', { source: phoneBootstrap(paintScript) });
      simctl(['openurl',udid,url]); await connect();
    },
    async click(selector) {
      await raw(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!(element instanceof HTMLButtonElement)||element.disabled||element.getClientRects().length===0)throw new Error('Unavailable actual phone control');element.click();return true;})()`);
    },
    evaluate,
    screenshot(path) {
      simctl(['io',udid,'screenshot',`--type=${path.endsWith('.jpg')?'jpeg':'png'}`,path]);
      return Promise.resolve(readFileSync(path));
    },
    close() {
      inspector?.close(); proxy.kill('SIGTERM');
      spawnSync('xcrun', ['simctl','terminate',udid,'com.apple.mobilesafari'], {stdio:'ignore'});
      return Promise.resolve();
    },
  };
}
