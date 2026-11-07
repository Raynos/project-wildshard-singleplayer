// Real phone-profile visits of one finished artifact. No game service stubs.
import { chromium, webkit, devices } from 'playwright';
const base = process.argv[2];
if (base === undefined) throw new Error('Usage: prove-release.mjs https://staged-origin');
const response = await fetch(new URL('/version.json', base), { cache: 'no-store' });
if (!response.ok) throw new Error('Release version unavailable');
const version = await response.json();
if (version.saveEpoch !== 1) throw new Error('Release progress epoch is not one');
console.log('Proving', JSON.stringify(version));
for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
  const browser = await type.launch({ headless: true, ...(name === 'Chromium' ? { args: ['--mute-audio'] } : {}) });
  try {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = async () => undefined;
      if (localStorage.getItem('j189-proof-seeded') === null) {
        localStorage.setItem('wildshard.save.v2.global', JSON.stringify({ keys: { settings: { v: 1, data: { music: false, sfx: false } }, gfx: { v: 1, data: {} }, hints: { v: 1, data: ['old-progress'] } } }));
        localStorage.setItem('wildshard.save.v2.driftwood-isle', '{"keys":{"purse":{"v":1,"data":999}}}');
        localStorage.setItem('wildshard.save.v2.device', '{"keys":{"devMode":{"v":1,"data":true}}}');
        localStorage.setItem('j189-proof-seeded', '1');
      }
    });
    for (const [label, path] of [['title', '/'], ['Driftwood', '/?chunk=driftwood-isle&mute=1&nolock=1'], ['Pine', '/?chunk=pine-hollow&mute=1&nolock=1'], ['Nalati', '/?chunk=nalati-grasslands&mute=1&nolock=1'], ['grid', '/?chunk=grid&mute=1&nolock=1']]) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', result => { if (result.status() >= 400) errors.push(`${result.status()} ${result.url()}`); });
      await page.goto(new URL(path, base).href, { waitUntil: 'load', timeout: 90_000 });
      if (label === 'title') await page.locator('.ws-menu-play').waitFor({ state: 'visible', timeout: 90_000 });
      else {
        await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
        await page.evaluate(() => window.__wildshard.world.hud.enterNow());
        await page.waitForFunction(() => (window.__workerClient?.().frames ?? 0) > 10, undefined, { timeout: 90_000 });
      }
      const observed = await page.evaluate(() => ({ shard: window.__wildshard?.shard?.slug ?? null, settings: localStorage.getItem('wildshard.save.v2@1.global'), fatal: [...document.querySelectorAll('[data-boot-fatal],#wserr,.ws-load-error')].map(node => node.textContent), canvas: document.querySelectorAll('canvas').length }));
      if (errors.length > 0 || observed.fatal.length > 0) throw new Error(`${name} ${label}: ${JSON.stringify({ errors, observed })}`);
      const global = JSON.parse(observed.settings ?? 'null');
      if (global === null || global.keys.hints !== undefined || global.keys.settings?.data?.music !== false || global.keys.settings?.data?.sfx !== false) throw new Error(`${name} ${label}: progress carry or missing epoch`);
      console.log('PASS', name, label, JSON.stringify(observed));
      await page.close();
    }
    await context.close();
  } finally { await browser.close(); }
}
