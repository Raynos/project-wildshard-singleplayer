// SF68 captures: the admin site's four tools in WebKit as an "iPhone 16 Pro" (portrait), served from dist-admin by a
// throwaway static server inside this process (no dev server left behind). Run through the browser lane:
//   scripts/browser-lane.sh node progress/shard-platform/sf68/capture.mjs [distDir] [outDir]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { webkit, devices } from 'playwright';

const dist = resolve(process.argv[2] ?? 'dist-admin');
const out = resolve(process.argv[3] ?? 'progress/shard-platform/sf68');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
  let file = join(dist, path === '/' ? 'index.html' : path);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(dist, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 16 Pro'], colorScheme: 'dark' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function shot(name) {
  await page.waitForTimeout(250);
  const png = join(out, `${name}.png`);
  await page.screenshot({ path: png });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', png, '--out', join(out, `${name}.jpg`)], { stdio: 'ignore' });
  execFileSync('rm', [png]);
}
async function scrollTo(sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -70));
}

await page.goto(`${base}/#memory/itemized-2026-10-08/2-pine-centre`);
await page.waitForSelector('svg.chart');
await shot('01-memory-pine-centre');
await page.locator('.orow').nth(1).click();
await scrollTo('.orow[aria-expanded="true"]');
await shot('02-memory-owner-drilldown');
await page.getByRole('button', { name: 'RAM', exact: true }).click();
await scrollTo('.owners');
await shot('03-memory-ram-owners');
await page.locator('select.pick').selectOption('itemized-2026-10-08/3-nalati-centre');
await scrollTo('select.pick');
await shot('04-memory-compare');
await page.goto(`${base}/#memory/sf64-report/far-reach-centre`);
await page.waitForSelector('.chip.missing');
await shot('05-memory-missing-pose');
await page.goto(`${base}/#loading`);
await shot('06-loading-empty');
await page.goto(`${base}/#playtests/round-2-2026-10-08`);
await page.waitForSelector('.issue');
await page.locator('.issue summary').first().click();
await shot('07-playtest-top10');
await scrollTo('.gallery');
await shot('08-playtest-gallery');
await page.goto(`${base}/#plan`);
await page.waitForSelector('.ring');
await shot('09-plan-effort');
await scrollTo('.secthead');
await shot('10-plan-rows');
await page.locator('input.search').fill('admin');
await scrollTo('input.search');
await shot('11-plan-decisions-search');

// light mode, one frame
await context.close();
const light = await browser.newContext({ ...devices['iPhone 16 Pro'], colorScheme: 'light' });
const lp = await light.newPage();
await lp.goto(`${base}/#memory/itemized-2026-10-08/1-grid-home`);
await lp.waitForSelector('svg.chart');
await lp.waitForTimeout(250);
await lp.screenshot({ path: join(out, '12-memory-light.png') });
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', join(out, '12-memory-light.png'), '--out', join(out, '12-memory-light.jpg')], { stdio: 'ignore' });
execFileSync('rm', [join(out, '12-memory-light.png')]);
const overflow = await lp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await browser.close();
server.close();
console.log(JSON.stringify({ errors, horizontalOverflowPx: overflow }));
