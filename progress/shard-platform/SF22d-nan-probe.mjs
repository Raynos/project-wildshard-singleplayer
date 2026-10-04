// SF22d NaN repro (E435): boots a served build with Debug ▸ Memory saver ON, catches three's computeBoundingBox NaN error with its
// stack and the geometry's attribute state, and counts GPU readbacks (getBufferSubData) before / after the level unload.
// scripts/browser-lane.sh --max 15 env LEAK=1 node progress/shard-platform/SF22d-nan-probe.mjs <url> <shard> desktop 1500 <weather> on
import { chromium } from 'playwright';
import { installInit } from '../../scripts/parity/init.mjs';
import { debugSettings } from '../../scripts/debug-settings.mjs';
import { advance } from '../../scripts/parity/frames.mjs';
const [url, shard, tier, framesArg, weather = 'clear', saver = 'on'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  const context = await browser.newContext(tier === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' } : { viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha: 'probe', browser: browser.version(), capture: 30, accelerated: true, tier });
  await debugSettings(context, { time: 'midday', weather, memorySaver: saver });
  await context.addInitScript(() => {
    const hits = [];
    window.__nanHits = hits;
    const rb = { calls: 0, bytes: 0, loadingCalls: 0, loadingBytes: 0 }; window.__rb = rb;
    const gbsd = WebGL2RenderingContext.prototype.getBufferSubData;
    WebGL2RenderingContext.prototype.getBufferSubData = function (...a) { const v = a[2]; const b = v && v.byteLength || 0; rb.calls++; rb.bytes += b; rb.t = rb.t || {}; rb.t[a[0]] = (rb.t[a[0]] || 0) + b; if (b > (rb.maxB || 0)) { rb.maxB = b; rb.maxStack = new Error().stack.split('\n').slice(1, 9).join(' | '); } if (document.querySelector('.ws-load') || !window.__wildshard) { rb.loadingCalls++; rb.loadingBytes += b; } return gbsd.apply(this, a); };
    const orig = console.error.bind(console);
    console.error = (...args) => {
      const msg = String(args[0]);
      if (msg.includes('NaN')) {
        const g = args[1];
        const attrs = {};
        if (g && g.attributes) for (const [name, a] of Object.entries(g.attributes)) {
          const d = Object.getOwnPropertyDescriptor(a, 'array');
          const accessor = d !== undefined && typeof d.get === 'function';
          const info = { ctor: a.constructor?.name, itemSize: a.itemSize, count: a.count, usage: a.usage, released: accessor, version: a.version, interleaved: !!a.isInterleavedBufferAttribute };
          if (!accessor && a.array) { info.arr = a.array.constructor.name + ':' + a.array.length; let nan = 0, first = -1; for (let i = 0; i < a.array.length; i++) if (Number.isNaN(a.array[i])) { nan++; if (first < 0) first = i; } info.nan = nan; info.firstNaN = first; info.head = Array.from(a.array.slice(0, 9)); }
          attrs[name] = info;
        }
        hits.push({ msg, name: g?.name, uuid: g?.uuid, type: g?.type, userData: JSON.stringify(g?.userData ?? {}).slice(0, 200), morph: Object.keys(g?.morphAttributes ?? {}), attrs, stack: new Error().stack });
      }
      return orig(...args);
    };
  });
  const page = await context.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const params = new URLSearchParams({ chunk: shard, tier, skipintro: '1', nolock: '1', mute: '1', sw: '0', weather, ...(tier === 'phone' ? { touch: '1' } : {}) });
  await page.goto(`${url}/?${params}`);
  await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load'), undefined, { timeout: 240000 });
  const frames = Number(framesArg);
  for (let done = 0; done < frames; done += 100) {
    await advance(page, 100);
    const n = await page.evaluate(() => window.__nanHits.length);
    if (n > 0) { console.log('hit at frame ~', done + 100); break; }
  }
  const rbPre = await page.evaluate(() => JSON.parse(JSON.stringify(window.__rb))); console.log('PRE-LEAK', JSON.stringify(rbPre)); if (process.env.LEAK === '1') { await page.evaluate(() => window.__wildshard.leak()); }
  const hits = await page.evaluate(() => window.__nanHits); const rb = await page.evaluate(() => window.__rb);
  console.log(JSON.stringify({ rb, hits: hits.slice(0, 1).map((h) => ({ ...h, attrs: Object.keys(h.attrs) })), count: hits.length, errs: [...new Set(errs)].slice(0, 30) }, null, 1));
} finally { await browser.close(); }
