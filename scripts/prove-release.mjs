// Real phone-profile visits of one finished artifact. No game service stubs.
import { chromium, webkit, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.argv[2];
if (base === undefined) throw new Error('Usage: prove-release.mjs https://staged-origin');
const staged = process.argv.includes('--vercel');
if (staged && !/^https:\/\/(?:wildshard-singleplayer-[a-z0-9]+-raynos-projects|wildshard-singleplayer)\.vercel\.app\/?$/u.test(base)) throw new Error('Vercel proof requires this project\'s deployment or production HTTPS origin');
const pin = JSON.parse(readFileSync(new URL('../engine.pin.json', import.meta.url), 'utf8'));
let bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (staged && process.argv.includes('--existing-bypass') && !bypass) {
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
  // Read an existing token only; unlike `vercel curl`, never create one.
  const metadata = JSON.parse(execFileSync('vercel', ['api', `/v9/projects/${project.projectId}?teamId=${project.orgId}`, '--scope', 'raynos-projects'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  bypass = Object.entries(metadata.protectionBypass ?? {}).find(([, value]) => value.scope === 'automation-bypass')?.[0];
  if (!bypass) throw new Error('No existing automation bypass token; project protection was not changed');
}
const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
const request = (path, init = {}) => fetch(new URL(path, base), { cache: 'no-store', redirect: 'error', ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(30_000) });
const response = await request('/version.json');
if (!response.ok) throw new Error('Release version unavailable');
const version = await response.json();
if (version.saveEpoch !== pin.saveEpoch) throw new Error('Release progress epoch differs from pinned engine');
if (staged) {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const short = version.build?.split('-')[0];
  if (!/^[a-f0-9]{7,40}$/u.test(short ?? '') || !sha.startsWith(short)) throw new Error('Staged build differs from exact shell HEAD');
}
const prefix = `wildshard.save.v2@${pin.saveEpoch}.`;
if (staged) {
  for (const [path, cache] of [['/', 'no-store'], ['/version.json', 'no-store'], ['/sw.js', 'no-cache']]) {
    const result = await request(path);
    if (result.status !== 200 || !result.headers.get('cache-control')?.includes(cache)) throw new Error(`Vercel header contract failed: ${path} HTTP ${result.status}`);
    if (path === '/') {
      const html = await result.text(), asset = html.match(/<script\b[^>]*\bsrc="(\/b\/[^"]+\.js)"/u)?.[1];
      if (!asset) throw new Error('Vercel HTML has no build-scoped module');
      const module = await request(asset, { method: 'HEAD' });
      if (module.status !== 200 || !module.headers.get('cache-control')?.includes('immutable')) throw new Error('Vercel build-scoped module is not immutable');
    }
    console.log('PASS Vercel headers', path, result.headers.get('cache-control'));
  }
  for (const route of ['inbox', 'errors', 'waitlist', 'telemetry']) {
    const origin = route === 'waitlist' ? 'https://wildshard.io' : 'capacitor://localhost';
    const options = await request(`/api/${route}`, { method: 'OPTIONS', headers: { Origin: origin } });
    const get = await request(`/api/${route}`), body = await get.json();
    if (options.status !== 204 || options.headers.get('access-control-allow-origin') !== origin || get.status !== 401 || body.error !== 'bad password' || !get.headers.get('cache-control')?.includes('no-store')) throw new Error(`Vercel API function contract failed: ${route} OPTIONS ${options.status}, GET ${get.status}`);
    console.log('PASS Vercel API', route, 'OPTIONS 204; unauthenticated GET 401; no-store');
  }
}
console.log('Proving', JSON.stringify(version));
for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
  const browser = await type.launch({ headless: true, ...(name === 'Chromium' ? { args: ['--mute-audio'] } : {}) });
  try {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: staged ? 'allow' : 'block' });
    if (bypass) {
      // Authenticate only to this origin. A global browser header would also
      // send the credential to third-party telemetry and asset hosts.
      const authenticated = await context.request.get(base, { headers: { ...headers, 'x-vercel-set-bypass-cookie': 'true' }, maxRedirects: 0 });
      if (![200, 307].includes(authenticated.status()) || !(await context.cookies(base)).some(cookie => cookie.name === '_vercel_jwt')) throw new Error('Staged bypass did not establish an origin cookie');
      await authenticated.dispose();
      const cookieOnly = await context.request.get(base, { maxRedirects: 0 });
      if (cookieOnly.status() !== 200) throw new Error('Staged origin refused cookie-only access');
      await cookieOnly.dispose();
    }
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = async () => undefined;
      if (localStorage.getItem('j189-proof-seeded') === null) {
        localStorage.setItem('wildshard.save.v2.global', JSON.stringify({ keys: { settings: { v: 1, data: { music: false, sfx: false } }, gfx: { v: 1, data: {} }, hints: { v: 1, data: ['old-progress'] } } }));
        localStorage.setItem('wildshard.save.v2.driftwood-isle', '{"keys":{"purse":{"v":1,"data":999}}}');
        localStorage.setItem('wildshard.save.v2.device', '{"keys":{"devMode":{"v":1,"data":true}}}');
        localStorage.setItem('j189-proof-seeded', '1');
      }
    });
    for (const [label, path] of [['title', '/'], ['Driftwood', '/?chunk=driftwood-isle&mute=1&nolock=1'], ['Pine', '/?chunk=pine-hollow&mute=1&nolock=1'], ['Nalati', '/?chunk=nalati-grasslands&mute=1&nolock=1'], ['grid', '/?mute=1&nolock=1']].filter(([label]) => process.argv[3] !== '--grid-only' || label === 'grid')) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', result => { if (result.status() >= 400) errors.push(`${result.status()} ${result.url()}`); });
      await page.goto(new URL(path, base).href, { waitUntil: 'load', timeout: 90_000 });
      if (label === 'grid') {
        await page.waitForFunction(() => document.querySelector('.ws-main-dev') !== null, undefined, { timeout: 90_000 });
        await page.evaluate(() => {
          const developer = document.querySelector('.ws-main-dev');
          if (developer?.getAttribute('aria-checked') === 'false') developer.click();
        });
        await page.waitForFunction(() => document.querySelector('.ws-main-grid') !== null, undefined, { timeout: 90_000 });
        // The shipped floor proof uses this exact title-button operation: the
        // inactive carousel remains attached and inert during title transitions.
        await Promise.all([page.waitForURL(url => url.searchParams.has('chunk'), { timeout: 90_000 }), page.evaluate(() => document.querySelector('.ws-main-grid').click())]);
      }
      if (label === 'title') await page.locator('.ws-menu-play').waitFor({ state: 'visible', timeout: 90_000 });
      else {
        await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
        await page.waitForFunction(() => window.__workerClient !== undefined, undefined, { timeout: 90_000 });
        await page.evaluate(() => window.__wildshard.world.hud.enterNow());
        await page.waitForFunction(() => (window.__workerClient?.().frames ?? 0) > 10, undefined, { timeout: 90_000 });
      }
      if (staged && label === 'title') {
        await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', undefined, { timeout: 90_000 });
        await page.reload({ waitUntil: 'load' });
        await page.locator('.ws-menu-play').waitFor({ state: 'visible', timeout: 90_000 });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 90_000 });
      }
      const observed = await page.evaluate(prefix => ({ shard: window.__wildshard?.shard?.slug ?? null, grid: window.__wildshard?.shard?.grid !== undefined, settings: localStorage.getItem(prefix + 'global'), serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null, fatal: [...document.querySelectorAll('[data-boot-fatal],#wserr,.ws-load-error')].map(node => node.textContent), canvas: document.querySelectorAll('canvas').length }), prefix);
      if (staged && observed.serviceWorker === null) throw new Error(`${name} ${label}: service worker is not controlling the staged page`);
      if (label === 'grid' && !observed.grid) throw new Error(`${name}: title tap did not enter grid mode`);
      if (errors.length > 0 || observed.fatal.length > 0) throw new Error(`${name} ${label}: ${JSON.stringify({ errors, observed })}`);
      const global = JSON.parse(observed.settings ?? 'null');
      if (global === null || global.keys.hints !== undefined || global.keys.settings?.data?.music !== false || global.keys.settings?.data?.sfx !== false) throw new Error(`${name} ${label}: progress carry or missing epoch`);
      console.log('PASS', name, label, JSON.stringify(observed));
      await page.close();
    }
    await context.close();
  } finally { await browser.close(); }
}
