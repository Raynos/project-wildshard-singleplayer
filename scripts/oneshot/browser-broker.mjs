#!/usr/bin/env node
// Parent-side isolated-seat driver. Run only through browser-lane; no endpoint, source path or credentials enter the seat.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve as resolvePath, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright';
import { browserOperation, browserPacket, productFile, proofReaders } from './browser-policy.mjs';
import { browserPipe, browserReply } from './browser-channel.mjs';
import { installInit } from '../parity/init.mjs';
import { saveFixture } from '../debug-settings.mjs';

/** @param {Promise<void>} task @param {() => void} stop */
async function settle(task, stop) {
  try { await task; } catch (error) { console.error(error); stop(); }
}

const [seatArg, productArg, channelArg, session] = process.argv.slice(2);
assert.ok(seatArg && productArg && channelArg && session, 'Usage: browser-broker.mjs SEAT BUILT_PRODUCT CHANNEL OWN_SESSION');
assert.ok(!existsSync(resolvePath(import.meta.dirname, '../../.git/quiet')), 'Wait for quiet release');
const seat = realpathSync(seatArg), product = realpathSync(productArg), channel = resolvePath(channelArg);
assert.ok(product.startsWith(`${seat}${sep}`) && channel.startsWith(`${seat}${sep}`), 'Product and relay must belong to this isolated seat');
assert.ok(!existsSync(channel), 'Use a fresh relay directory');
mkdirSync(resolvePath(channel, 'replies'), { recursive: true });
assert.equal(realpathSync(channel), channel, 'Relay parent cannot be a symlink');
const require = createRequire(resolvePath(seat, 'package.json'));
const sdk = /** @type {Pick<typeof import('../../src/sdk/headless'), 'proveSceneClient' | 'proveEquippedItemClient'>} */ (await import(pathToFileURL(require.resolve('@wildshard/sdk/headless')).href));
const readers = await proofReaders(sdk), orderedReaders = [...readers.values()];
const cli = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer((request, response) => {
  try {
    const path = productFile(product, decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
    response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream'); response.end(readFileSync(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const address = server.address(); assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;
let browser, receiver;
let deniedNetwork = 0, done;
const finished = new Promise(resolve => { done = resolve; });
const stop = () => { done(); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
try {
  cli('--args', '--mute-audio,--use-angle=metal', 'open', 'about:blank');
  const connection = JSON.parse(cli('get', 'cdp-url', '--json'));
  const cdp = typeof connection.data === 'string' ? connection.data : connection.data?.url ?? connection.data?.cdpUrl ?? connection.data?.cdp_url;
  assert.equal(typeof cdp, 'string'); browser = await chromium.connectOverCDP(cdp);
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block', acceptDownloads: false });
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { deniedNetwork++; await route.abort('blockedbyclient'); }
  });
  await context.routeWebSocket('**/*', socket => { void socket.close(); });
  await installInit(context, { lane: session, sha: 'isolated-author-product', browser: 'chromium', accelerated: false, tier: 'phone' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.setDefaultTimeout(60_000);
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => window.__wildshard?.shard?.shardfile && !document.querySelector('.ws-load'));
  const select = page.locator('.ws-main-select');
  if (await select.isVisible()) await select.click();
  const enter = page.locator('.ws-menu-play');
  await (await enter.count() === 1 ? enter.click() : page.keyboard.press('Enter'));
  try { await page.waitForFunction(() => window.__wildshard.app.state === 'play'); }
  catch (error) {
    console.error(await page.evaluate(() => ({ state: window.__wildshard.app.state, text: document.body.textContent,
      errors: window.__wildshardHarness.errors })));
    throw error;
  }
  await page.evaluate(() => window.__parity.advance(5));
  await page.evaluate(() => { window.__parity.free = true; });
  await page.waitForFunction(() => { const evidence = window.__wildshard.shard.shardfile.sceneEvidence(); return evidence.tick > 0 && evidence.frames > 0; });
  let tail = Promise.resolve();

  /** @param {string} id @param {unknown} input */
  const dispatch = async (id, input) => {
    const reply = resolvePath(channel, 'replies', `${id}.fifo`);
    let response;
    try {
      const message = browserOperation(input);
      let value;
      if (message.op === 'evaluate' || message.op === 'scene' || message.op === 'equipment') {
        const read = message.op === 'evaluate' ? readers.get(message.code ?? '') : orderedReaders[message.op === 'scene' ? 0 : 1];
        if (read === undefined) throw new Error('Only installed SDK read-only proof callbacks are allowed');
        value = await page.evaluate(read);
      } else if (message.op === 'text') value = { url: page.url(), text: await page.locator('body').textContent(), deniedNetwork };
      else if (message.op === 'key') {
        assert.ok(message.key); await page.keyboard.down(message.key);
        try { await delay(message.duration); } finally { await page.keyboard.up(message.key); }
        value = { inputDelivered: true };
      } else if (message.op === 'close') { value = { closed: true }; setImmediate(stop); }
      response = { ok: true, value };
    } catch (error) { response = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
    assert.equal(realpathSync(resolvePath(channel, 'replies')), resolvePath(channel, 'replies'));
    await browserReply(reply, response);
  };
  receiver = browserPipe(resolvePath(channel, 'requests.fifo'), true);
  let pending = '';
  receiver.setEncoding('utf8');
  receiver.on('data', chunk => {
    pending += String(chunk);
    while (pending.includes('\n')) {
      const end = pending.indexOf('\n'), line = pending.slice(0, end); pending = pending.slice(end + 1);
      if (Buffer.byteLength(line) > 4096) { stop(); return; }
      let packet;
      try { packet = browserPacket(JSON.parse(line)); } catch { stop(); return; }
      tail = tail.then(() => dispatch(packet.id, packet.message));
      void settle(tail, stop);
    }
    if (Buffer.byteLength(pending) > 4096) stop();
  });
  // Helpers are copied before sandbox entry; ready contains no URL, CDP, credentials or source authority.
  writeFileSync(resolvePath(channel, 'ready.json'), JSON.stringify({ version: 1, surface: 'iPhone 16 Pro', transport: 'file', readOnlyProofPorts: 2 }));
  console.info(`Browser relay ready: ${channel}`);
  await finished; await tail;
} finally {
  receiver?.destroy();
  if (existsSync(resolvePath(channel, 'ready.json'))) unlinkSync(resolvePath(channel, 'ready.json'));
  await browser?.close(); try { cli('close'); } catch { /* This own browser may already have closed on the deadline. */ }
  await new Promise(resolve => { server.close(resolve); });
  process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
}
