#!/usr/bin/env node
// E357 L7 / E188: dropped module bodies must be downloaded again in the newest iOS Simulator Safari.
// Run ONLY through scripts/sim-lane.sh run --max 15 wildshard-iphone node scripts/ios-retry-check.mjs --rev=<sha>.
// --url=<served build> skips building; --dist=<its dist> supplies its actual chunk module report.
import { createServer } from 'node:http';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

/** Cut a first JS response mid-body, then forward subsequent requests completely. */
export async function retryProxy(base, paths) {
  const cuts = new Set(paths), attempts = new Map(), log = [];
  const forward = async (req, res) => {
    const path = new URL(req.url ?? '/', base).pathname;
    const attempt = (attempts.get(path) ?? 0) + 1; attempts.set(path, attempt);
    try {
      const upstream = await fetch(new URL(req.url ?? '/', base));
      const body = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = upstream.status;
      res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/octet-stream');
      res.setHeader('cache-control', 'no-store'); res.setHeader('content-length', body.length);
      if (cuts.has(path) && attempt === 1 && upstream.ok && body.length > 1) {
        log.push({ path, attempt, cut: true, bytes: body.length });
        res.flushHeaders(); res.write(body.subarray(0, Math.max(1, Math.floor(body.length / 2))));
        await sleep(30); res.destroy();
      } else {
        res.on('finish', () => { log.push({ path, attempt, cut: false, status: upstream.status, bytes: body.length }); });
        res.end(body);
      }
    } catch (error) { log.push({ path, attempt, error: String(error) }); res.destroy(); }
  };
  const server = createServer((req, res) => { void forward(req, res); });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('retry proxy has no port');
  return { url: `http://127.0.0.1:${address.port}/`, log,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }) };
}

/** Raw WebKit inspector protocol, including ios_webkit_debug_proxy's Target multiplexing. */
function inspector(url) {
  const ws = new WebSocket(url), pending = new Map(); let seq = 0, target = null;
  const raw = (value) => ws.send(JSON.stringify(value));
  const opened = new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  const receive = (message) => {
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); if (message.error) waiter.reject(new Error(message.error.message)); else waiter.done(message.result); }
  };
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') target = message.params.targetInfo.targetId;
    else if (message.method === 'Target.didCommitProvisionalTarget') target = message.params.newTargetId;
    else if (message.method === 'Target.dispatchMessageFromTarget') receive(JSON.parse(message.params.message));
    else receive(message);
  });
  const evaluate = async (expression) => {
    const id = ++seq;
    const result = new Promise((resolve, reject) => {
      pending.set(id, { done: resolve, reject });
      const message = { id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } };
      if (target) raw({ id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } });
      else raw(message);
    });
    try { return (await Promise.race([result, sleep(4000).then(() => null)]))?.result?.value; }
    finally { pending.delete(id); }
  };
  return { opened, evaluate, close: () => ws.close() };
}

export function retryChunks(modules) {
  const find = (name, matches) => {
    const named = Object.entries(modules).find(([, row]) => row.name === name && row.moduleIds.some(matches));
    const fallback = Object.entries(modules).find(([, row]) => row.moduleIds.some(matches));
    const file = (named ?? fallback)?.[0];
    if (!file) throw new Error(`No actual chunk for ${name}`);
    return `/${file}`;
  };
  return [...new Set([
    find('three', (id) => /node_modules\/three\/build\/three[^/]*\.js$/.test(id)),
    find('engine', (id) => id === 'src/engine/core/Game.ts'),
    find('shard-pine-hollow', (id) => id === 'src/shards/pine-hollow/plugin.ts'),
  ])];
}

async function main() {
  const udid = process.env.SIM_UDID;
  if (!udid) throw new Error('Use scripts/sim-lane.sh run; SIM_UDID is required');
  const root = resolvePath(import.meta.dirname, '..');
  const flag = (key) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  const out = resolvePath(flag('out') ?? '/private/tmp/e357-ios-retry'); mkdirSync(out, { recursive: true });
  let base = flag('url'), servedPort = null, servedRegistry = null, proxy = null, bridge = null, page = null;
  const result = { passed: false, device: udid, runtime: '', chunks: [], requests: [], boot: false };
  try {
    const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' })).devices;
    result.runtime = Object.entries(devices).find(([, rows]) => rows.some((device) => device.udid === udid))?.[0] ?? '';
    let dist = flag('dist');
    if (!base) {
      base = execFileSync('bash', [join(root, 'scripts/serve-build.sh'), '--rev', flag('rev') ?? 'HEAD', '--hours', '1', '--name', 'ios-retry'], { encoding: 'utf8', cwd: out, env: { ...process.env, SERVE_BUILD_DIR: join(out, 'serve'), SERVE_RECYCLE_MIN: '999999' } }).trim().split('\n').at(-1);
      servedPort = new URL(base).port;
      servedRegistry = readFileSync(join(process.env.HOME, '.dev-servers', servedPort), 'utf8');
      const registry = servedRegistry.trim().split(' ');
      dist = join(registry[2], 'dist');
    }
    if (!dist) throw new Error('--url requires --dist=<served build output>');
    result.chunks = retryChunks(JSON.parse(readFileSync(join(dist, '.vite/chunk-modules.json'), 'utf8')));
    proxy = await retryProxy(base, result.chunks); result.requests = proxy.log;
    spawnSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari']);
    execFileSync('xcrun', ['simctl', 'openurl', udid, `${proxy.url}version.json`]);
    await sleep(4000);
    const socket = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
    bridge = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
    for (let i = 0; i < 30; i++) {
      try {
        const pages = await (await fetch('http://127.0.0.1:9232/json')).json();
        const found = pages.find((item) => item.url.startsWith(proxy.url));
        if (found) { page = inspector(found.webSocketDebuggerUrl); await page.opened; await sleep(700); break; }
      } catch { /* Inspector startup. */ }
      await sleep(1000);
    }
    if (!page) throw new Error('Safari retry page missing from Web Inspector');
    const gameUrl = `${proxy.url}?chunk=pine-hollow&skipintro=1&mute=1&sw=0`;
    await page.evaluate(`location.href=${JSON.stringify(gameUrl)}`);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      result.boot = await page.evaluate("typeof window.__wildshard?.boot === 'object'") === true;
      if (result.boot) break;
      await sleep(1000);
    }
    result.failureText = await page.evaluate("document.body.innerText.slice(-2000)");
    result.passed = result.boot && result.chunks.every((path) => result.requests.some((row) => row.path === path && row.cut === true) && result.requests.some((row) => row.path === path && row.attempt > 1 && row.cut === false && row.status === 200));
    if (!result.passed) throw new Error('Dropped chunks were not all retried completely, or world boot was not reached within 120 s');
    console.log(`iOS retry passed (${result.runtime}): ${result.chunks.join(', ')}`);
  } catch (error) { result.error = String(error); process.exitCode = 1; console.error(result.error); }
  finally {
    page?.close(); bridge?.kill(); await proxy?.close();
    if (servedPort && servedRegistry) {
      const registryPath = join(process.env.HOME, '.dev-servers', servedPort);
      if (existsSync(registryPath) && readFileSync(registryPath, 'utf8') === servedRegistry) spawnSync('bash', [join(root, 'scripts/serve-build.sh'), 'stop', servedPort], { stdio: 'inherit' });
    }
    writeFileSync(join(out, 'retry.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
