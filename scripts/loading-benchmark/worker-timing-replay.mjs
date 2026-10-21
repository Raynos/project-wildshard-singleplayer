// Exercise the real worker's bounded timing replay after the page misses live messages.
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
if (!out) throw new Error('Requires --out=receipt.json');
const scope = readFileSync('src/engine/app/workerScope.js', 'utf8').replaceAll(/^export /gmu, '');
const worker = readFileSync('src/engine/pwa/sw.js', 'utf8')
  .replace("import { workerScope } from '../app/workerScope.js';\n", '')
  .replaceAll('__BUILD_ID__', 'timing-fixture').replaceAll('__ASSET_ID__', 'timing-fixture')
  .replace("'__BUNDLE__'", "'[]'").replace("'__FONTS__'", "'[]'");
const html = `<!doctype html><meta name="viewport" content="width=device-width"><title>Worker timing replay</title>
<script>window.ready=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'all'}).then(()=>navigator.serviceWorker.ready);</script>`;
const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const path = request.url ?? '/';
  if (path === '/sw.js') {
    response.setHeader('Content-Type', 'text/javascript'); response.end(`${scope}\n${worker}`);
  } else if (path === '/' || path === '/index.html') {
    response.setHeader('Content-Type', 'text/html'); response.end(html);
  } else if (path === '/manifest.webmanifest') {
    response.setHeader('Content-Type', 'application/manifest+json'); response.end('{}');
  } else if (path.startsWith('/timing/')) response.end('x');
  else { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Timing fixture did not bind');
const base = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
let receipt;
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => window.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // No page download listener exists during these requests. Replay must recover
  // the late response after the default browser buffer has filled, at the same cap.
  const count = 320;
  await page.evaluate(async total => {
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let index = next++; index < total; index = next++) {
        const response = await fetch(`/timing/${index}.bin`); await response.arrayBuffer();
      }
    }));
  }, count);
  const replay = await page.evaluate(() => new Promise((resolve, reject) => {
    const controller = navigator.serviceWorker.controller;
    if (controller === null) { reject(new Error('Worker lost control')); return; }
    const channel = new MessageChannel(), timer = setTimeout(() => { reject(new Error('Timing replay timed out')); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    controller.postMessage({ type: 'DOWNLOAD_RECEIPTS' }, [channel.port2]);
  }));
  const latest = replay.timings.find(timing => new URL(timing.name).pathname === `/timing/${count - 1}.bin`);
  receipt = { requests: count, replayEntries: replay.timings.length, latest: latest ?? null };
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => { server.close(resolve); });
  writeFileSync(out, JSON.stringify(receipt ?? { error: 'Probe did not reach replay' }, null, 2));
}
console.info(JSON.stringify(receipt));
if (receipt.latest === null || receipt.latest.transferSize <= 0) throw new Error('Replay lost the late network response');
if (receipt.replayEntries > 250) throw new Error('Timing replay grew the browser buffer');
