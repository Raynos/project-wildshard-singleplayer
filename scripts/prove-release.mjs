import { KEYCHAIN_ARGS } from './chromium-keychain.mjs';
// Real phone-profile visits of one finished artifact. No game service stubs.
import { chromium, webkit, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { observeReleaseModules, waitForReleaseWorker } from './release-worker.mjs';
import { recordFirstReleaseCard, proveLoadingCard, proveEmber } from './release-play.mjs';
import {existingReleaseBypass} from './release-access.mjs';
import {profileReleaseWorker} from './release-worker-profile.mjs';
import {observeReleaseStorage} from './release-storage-profile.mjs';
const base = process.argv[2];
if (base === undefined) throw new Error('Usage: prove-release.mjs https://staged-origin');
// Separate admitted machine slots can run both complete phone journeys at
// once. The default still proves both; selection never changes an assertion.
const selected = process.argv.filter(arg => arg.startsWith('--browser='));
if (selected.length > 1 || selected.some(arg => !['--browser=Chromium', '--browser=WebKit'].includes(arg))) throw new Error('Select exactly one of Chromium or WebKit, or omit --browser to prove both');
const phones = [['Chromium', chromium], ['WebKit', webkit]].filter(([name]) => selected.length === 0 || selected[0] === `--browser=${name}`);
const chromiumArgs = [...KEYCHAIN_ARGS, '--mute-audio'];
const staged = process.argv.includes('--vercel');
const extended = staged || process.argv.includes('--extended');
if (staged && !/^https:\/\/(?:wildshard-singleplayer-[a-z0-9]+-raynos-projects|wildshard-singleplayer)\.vercel\.app\/?$/u.test(base)) throw new Error('Vercel proof requires this project\'s deployment or production HTTPS origin');
const pin = JSON.parse(readFileSync(new URL('../engine.pin.json', import.meta.url), 'utf8'));
let bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (staged && process.argv.includes('--existing-bypass') && !bypass) {
  bypass = await existingReleaseBypass();
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
for (const [name, type] of phones) {
  let browser = await type.launch({ headless: true, ...(name === 'Chromium' ? { args: [...chromiumArgs, ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])] } : {}) });
  try {
    const createContext = async () => {
      const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2, serviceWorkers: staged ? 'allow' : 'block' });
      if (process.argv.includes('--profile-worker')) await context.addInitScript(observeReleaseStorage);
      if (extended) {
        await context.grantPermissions(name === 'Chromium' ? ['clipboard-read', 'clipboard-write'] : ['clipboard-read']);
        await context.addInitScript(recordFirstReleaseCard);
      }
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
      await context.addInitScript(extended => {
        HTMLMediaElement.prototype.play = async () => undefined;
        if (localStorage.getItem('j189-proof-seeded') === null) {
          localStorage.setItem('wildshard.save.v2.global', JSON.stringify({ keys: { settings: { v: 1, data: { music: false, sfx: false, holdLoading: extended } }, gfx: { v: 1, data: {} }, hints: { v: 1, data: ['old-progress'] } } }));
          localStorage.setItem('wildshard.save.v2.driftwood-isle', '{"keys":{"purse":{"v":1,"data":999}}}');
          localStorage.setItem('wildshard.save.v2.device', '{"keys":{"devMode":{"v":1,"data":true}}}');
          localStorage.setItem('j189-proof-seeded', '1');
        }
      }, extended);
      return context;
    };
    let context = await createContext();
    for (const [label, path] of [['title', '/'], ['Driftwood', '/?chunk=driftwood-isle&mute=1&nolock=1'], ['Pine', '/?chunk=pine-hollow&mute=1&nolock=1'], ['Nalati', '/?chunk=nalati-grasslands&mute=1&nolock=1'], ['grid', '/?mute=1&nolock=1']].filter(([label]) => !process.argv.includes('--grid-only') || label === 'grid')) {
      if (label === 'grid') {
        // Closing a standalone page can leave a real crash-resume checkpoint.
        // Grid entry is an independent title journey, not a crash-resume test.
        await context.close();
        // Exercise the inherited Chromium starvation mode on the actual grid,
        // after closing the ordinary native-GPU phone visits and their browser.
        if (extended && name === 'Chromium') {
          await browser.close();
          browser = await type.launch({ headless: true, args: chromiumArgs });
        }
        context = await createContext();
      }
      const page = await context.newPage(), errors = [];
      const modules = observeReleaseModules(page);
      const consoleErrors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 400)); });
      page.on('response', result => { if (result.status() >= 400) errors.push(`${result.status()} ${result.url()}`); });
      await page.goto(new URL(path, base).href, { waitUntil: 'load', timeout: 90_000 });
      // Prove migration before any real play can earn fresh hints. The GRID
      // crossing deliberately creates new progress, which must then survive.
      await page.waitForFunction(prefix => localStorage.getItem(prefix + 'global') !== null, prefix, { timeout: 90_000 });
      const migrated = await page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + 'global')), prefix);
      if (((label === 'title' || label === 'grid') && migrated.keys.hints !== undefined) || JSON.stringify(migrated.keys.hints ?? null).includes('old-progress') || migrated.keys.settings?.data?.music !== false || migrated.keys.settings?.data?.sfx !== false) throw new Error(`${name} ${label}: old progress carried or settings lost before play`);
      if (label === 'grid') {
        if (staged) {
          await waitForReleaseWorker(page);
          await modules.wait();
          await page.reload({ waitUntil: 'load' });
          await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 90_000 });
        }
        await page.waitForFunction(() => document.querySelector('.ws-main-dev') !== null, undefined, { timeout: 90_000 });
        await page.evaluate(() => {
          const developer = document.querySelector('.ws-main-dev');
          if (developer?.getAttribute('aria-checked') === 'false') developer.click();
        });
        await page.waitForFunction(() => document.querySelector('.ws-main-grid') !== null, undefined, { timeout: 90_000 });
        await modules.wait();
        await Promise.all([page.waitForURL(url => url.searchParams.has('chunk'), { timeout: 90_000 }), page.locator('.ws-main-grid').click()]);
      }
      if (label === 'title') await page.locator('.ws-menu-play').waitFor({ state: 'visible', timeout: 90_000 });
      else {
        try {
          if (extended) await proveLoadingCard(page, label === 'grid' ? 'driftwood-isle' : new URL(path, base).searchParams.get('chunk'), `${name} ${label}`, label !== 'grid');
          await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
        } catch (error) {
          const state = await page.evaluate(() => {
            const timing = window.__bootTiming?.read(), world = window.__wildshard?.world;
            return { shard: window.__wildshard?.shard?.slug ?? null, step: document.querySelector('.ws-load')?.getAttribute('data-step'),
              text: document.body.innerText.slice(0, 1000), fatal: [...document.querySelectorAll('[data-boot-fatal],#wserr,.ws-load-error')].map(node => node.textContent),
              active: timing?.active, overflow: timing?.overflow, tail: timing?.entries.slice(-12),
              frames: world?.game.renderer.info.render.frame, app: world?.game.app.state, visibility: document.visibilityState,
              storageFaults: Reflect.get(globalThis, '__releaseStorageFaults') };
          }).catch(() => null);
          console.error('FAIL phone boot', name, label, JSON.stringify({ state, errors, consoleErrors: consoleErrors.slice(-20) }));
          throw error;
        }
        await page.waitForFunction(() => window.__workerClient !== undefined, undefined, { timeout: 90_000 });
        const firstFrame = await page.evaluate(() => {
          const before = window.__workerClient().frames;
          window.__wildshard.world.hud.enterNow();
          window.__wildshard.world.hud.setPaused(false);
          if (window.__wildshard.world.game.app.clock.paused) throw new Error('Actual entered world stayed paused');
          return before;
        });
        await page.waitForFunction(before => (window.__workerClient?.().frames ?? 0) > Math.max(10, before + 10), firstFrame, { timeout: 90_000 });
        if (extended && label === 'grid') {
          let stopProfile;
          const beforeLongRoad = async () => {
          if (name === 'Chromium' && process.argv.includes('--profile-worker')) {
            const workers = page.workers().filter(worker => /\/standalone\/serverWorker[^/]*\.js$/u.test(new URL(worker.url()).pathname));
            if (workers.length !== 1) throw new Error('Expected one actual standalone server worker to profile');
            const attempt = process.argv.includes('--grid-only') ? 'grid' : 'full';
            // The independent failure diagnosis samples a bounded native
            // window; its actual road proof still runs the full 210 seconds.
            // Full-window traces repeatedly miss their unchanged drain cap.
            stopProfile = await profileReleaseWorker(browser, workers[0].url(), `tmp/release-worker-profile/${version.build}-${attempt}-worker.json`, { durationMs: attempt === 'grid' ? 15_000 : 210_000, page });
          }
          };
          let failure;
          try { await proveEmber(page, modules, name, { beforeLongRoad }); } catch (error) { failure = error; }
          try { await stopProfile?.(); }
          catch (error) { failure = failure === undefined ? error : new AggregateError([failure, error], 'Road and worker profile both refused'); }
          if (failure !== undefined) throw failure;
        }
      }
      if (staged && label === 'title') {
        await waitForReleaseWorker(page);
        await modules.wait();
        await page.reload({ waitUntil: 'load' });
        await page.locator('.ws-menu-play').waitFor({ state: 'visible', timeout: 90_000 });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 90_000 });
      }
      const observed = await page.evaluate(prefix => ({ shard: window.__wildshard?.shard?.slug ?? null, grid: window.__wildshard?.shard?.grid !== undefined, settings: localStorage.getItem(prefix + 'global'), serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null, fatal: [...document.querySelectorAll('[data-boot-fatal],#wserr,.ws-load-error')].map(node => node.textContent), canvas: document.querySelectorAll('canvas').length }), prefix);
      if (staged && observed.serviceWorker === null) throw new Error(`${name} ${label}: service worker is not controlling the staged page`);
      if (label === 'grid' && !observed.grid) throw new Error(`${name}: title tap did not enter grid mode`);
      if (errors.length > 0 || observed.fatal.length > 0) throw new Error(`${name} ${label}: ${JSON.stringify({ errors, observed })}`);
      const global = JSON.parse(observed.settings ?? 'null');
      if (global === null || JSON.stringify(global.keys.hints ?? null).includes('old-progress') || global.keys.settings?.data?.music !== false || global.keys.settings?.data?.sfx !== false) throw new Error(`${name} ${label}: progress carry or missing epoch`);
      console.log('PASS', name, label, JSON.stringify(observed));
      modules.dispose();
      await page.close();
    }
    await context.close();
  } finally { await browser.close(); }
}
