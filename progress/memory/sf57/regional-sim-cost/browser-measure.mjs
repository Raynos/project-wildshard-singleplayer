// SF57 sf57-qualify3: WebContent / renderer phys_footprint delta of N regional template sims vs 0, Chromium and WebKit.
// Muted, "iPhone 16 Pro" context. Run through scripts/browser-lane.sh.
import { chromium, webkit, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const DIST = '/private/tmp/claude-501/sp-builders/sf57-qualify3/simbench/dist';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname === '/' ? '/index.html' : new URL(req.url, 'http://x').pathname));
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }); res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const footprint = (pid) => {
  const out = execFileSync('footprint', ['-p', String(pid)], { encoding: 'utf8' });
  const m = out.match(/phys_footprint:\s*([\d.]+)\s*(KB|MB|GB)/u);
  if (!m) throw new Error(`no footprint for ${pid}: ${out.slice(0, 300)}`);
  return Number(m[1]) * { KB: 1e-3, MB: 1, GB: 1e3 }[m[2]];
};
const pids = (pattern) => execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(Number);
const plan = [0, 3, 6, 12];
const out = { base, steps: plan, runs: [] };
for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
  for (let rep = 0; rep < 2; rep++) {
    const before = new Set(name === 'webkit' ? (() => { try { return pids('ms-playwright/webkit.*WebContent'); } catch { return []; } })() : []);
    const browser = await type.launch({ args: name === 'chromium' ? ['--mute-audio', '--js-flags=--expose-gc'] : [] });
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base);
    await page.evaluate(() => window.simReady());
    let pid;
    if (name === 'chromium') {
      const cdp = await browser.newBrowserCDPSession();
      const info = await cdp.send('SystemInfo.getProcessInfo');
      const renderers = info.processInfo.filter((p) => p.type === 'renderer');
      pid = renderers.at(-1)?.id;
    } else {
      const now = pids('ms-playwright/webkit.*WebContent').filter((p) => !before.has(p));
      pid = now.at(-1);
    }
    if (pid === undefined) throw new Error(`no content pid for ${name}`);
    const gc = async () => { if (name === 'chromium') { const s = await context.newCDPSession(page); await s.send('HeapProfiler.collectGarbage'); await s.detach(); } };
    // warm: build and free one so module caches and first linear-memory growth are paid before the baseline
    await page.evaluate(() => { window.simMake(1); window.simFree(); });
    const rows = [];
    let held = 0;
    for (const n of plan) {
      if (n > held) { await page.evaluate((k) => window.simMake(k), n - held); held = n; }
      await gc(); await sleep(3000); await gc();
      const reads = []; for (let i = 0; i < 5; i++) { reads.push(footprint(pid)); await sleep(400); }
      reads.sort((a, b) => a - b);
      rows.push({ sims: n, footprintMB: reads[2] });
      console.error(name, rep, n, reads[2]);
    }
    const base0 = rows[0].footprintMB;
    const slope = (rows.at(-1).footprintMB - rows[1].footprintMB) / (plan.at(-1) - plan[1]);
    out.runs.push({ browser: name, version: browser.version(), rep, pid, rows: rows.map((r) => ({ ...r, deltaMB: +(r.footprintMB - base0).toFixed(2) })), perSimMB: +((rows.at(-1).footprintMB - base0) / plan.at(-1)).toFixed(3), slope3to12MB: +slope.toFixed(3), errors });
    await browser.close();
  }
}
server.close();
writeFileSync('/private/tmp/claude-501/sp-builders/sf57-qualify3/browser-measure.json', `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify(out.runs.map((r) => ({ b: r.browser, rep: r.rep, perSim: r.perSimMB, slope: r.slope3to12MB, rows: r.rows, errors: r.errors })), null, 1));
