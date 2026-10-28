import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve as resolvePath} from 'node:path';
import {parseArgs} from 'node:util';
import type {Request} from 'playwright';
import {instrument} from './instrument.ts';
import {launchChromium} from './chromium.ts';
import {contactSheet} from './recording.ts';
import {comparisons, printRun, profiles, record, type Capture, type RequestRow, type Run} from './model.ts';
import {developerSettings} from '../debug-settings.mjs';
import {loadingCardIndex} from '../loading-benchmark/catalogue.mjs';

async function main(): Promise<void> {
const {values} = parseArgs({options: {preset: {type: 'string', default: 'phone'}, flow: {type: 'string', default: 'grid'},
  live: {type: 'boolean'}, head: {type: 'boolean'}, rev: {type: 'string'}, url: {type: 'string'},
  record: {type: 'boolean'}, webkit: {type: 'boolean'}, compare: {type: 'string'}, timeout: {type: 'string', default: '240000'},
  'title-dwell': {type: 'string', default: '3000'},
  'after-control': {type: 'string', default: '4000'},
  help: {type: 'boolean'}}});
if (values.help) {
  console.log('pnpm phone-loading [--live | --head | --rev SHA | --url URL] [--preset phone|lte|desktop] [--flow grid|select:SLUG] [--record] [--webkit] [--compare JSON] [--timeout MS] [--title-dwell MS=3000] [--after-control MS=4000]');
  return;
}
const profile = profiles[values.preset];
if (profile === undefined) throw new Error('Unknown preset');
if (values.flow !== 'grid' && !/^select:[a-z0-9_-]+$/u.test(values.flow)) throw new Error('Unknown flow');
if ([values.live, values.head, values.rev, values.url].filter(Boolean).length > 1) throw new Error('Choose one target');
const timeout = Number(values.timeout);
if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid timeout');
const titleDwell = Number(values['title-dwell']);
if (!Number.isFinite(titleDwell) || titleDwell < 0) throw new Error('Invalid title dwell');
const afterControl = Number(values['after-control']);
if (!Number.isFinite(afterControl) || afterControl < 0) throw new Error('Invalid post-control dwell');
process.env['PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS'] = '1';
const {webkit, devices} = await import('playwright');
function command(file: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {env, stdio: ['ignore', 'pipe', 'inherit']});
    let output = ''; child.stdout.on('data', (data: Buffer) => {output += data.toString();});
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`${file} exited ${code}`)));
  });
}
const owner = `phone-loading-${process.pid}`;
const env = {...process.env, SERVE_OWNER: owner};
let url = values.url ?? 'https://wildshard-singleplayer.vercel.app/';
let leased = false;
try {
  if (values.head || values.rev !== undefined) {
    const output = await command('scripts/serve-build.sh', values.head ? ['--head'] : ['--rev', values.rev ?? 'HEAD'], env);
    const ready = output.match(/http:\/\/127\.0\.0\.1:\d+\//gu)?.at(-1);
    if (ready === undefined) throw new Error('Preview returned no ready URL');
    url = ready; leased = true;
  }
  const version = record(await (await fetch(new URL('version.json', url))).json());
  const identity = version['build'] ?? version['sha'] ?? version['commit'];
  if (typeof identity !== 'string') throw new Error('Target has no build identity');
  const build = identity;
  const directory = resolvePath('tmp/phone-loading', `${new Date().toISOString().replaceAll(/[:.]/gu, '-')}-${build.replaceAll(/[^\w-]/gu, '_')}`);
  await mkdir(directory, {recursive: true});
  const previous: unknown = values.compare === undefined ? undefined : JSON.parse(await readFile(values.compare, 'utf8'));
  for (const engine of values.webkit ? ['chromium', 'webkit'] : ['chromium']) {
    const chromium = engine === 'chromium' ? await launchChromium(`${directory}/profile`, profile) : undefined;
    const browser = chromium?.browser ?? await webkit.launch({headless: true});
    const context = await browser.newContext({...devices['iPhone 16 Pro'],
      ...(values.record ? {recordVideo: {dir: directory, size: {width: 402, height: 874}}} : {})});
    const interrupt = (): void => {process.exitCode = 130; void context.close();};
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
      await developerSettings(context, {volume: 0, music: 0, tier: 'phone', holdLoading: false});
      await context.addInitScript(instrument, values.flow);
      for (const cache of ['cold', 'warm']) {
        console.log(`Starting ${engine} ${values.flow} ${cache} at ${url}`);
        const page = await context.newPage();
        await page.bringToFront();
        let tapAt: number | null = null;
        await page.exposeBinding('__phoneLoadingTap', (_source, at: unknown) => {
          if (typeof at === 'number') tapAt = at;
        });
        const requests: RequestRow[] = [], errors: string[] = [], jobs: Promise<void>[] = [];
        const starts = new Map<Request, RequestRow>();
        const start = (request: Request): void => {
          const row: RequestRow = {url: request.url(), start: request.timing().startTime > 0 ? request.timing().startTime : Date.now(),
            end: null, source: request.serviceWorker() !== null ? 'worker' : 'network', bytes: 0, status: 0, failure: null};
          starts.set(request, row); requests.push(row);
        };
        const finish = (request: Request): void => {
          jobs.push((async () => {
            try {
            const response = await request.response();
            const sizes = await request.sizes().catch(() => null);
            const row = starts.get(request);
            if (row === undefined) throw new Error('Finished request without a start');
            row.end = Date.now(); row.source = request.serviceWorker() !== null ? 'worker' : response?.fromServiceWorker() ? 'service-worker' : 'network';
            row.bytes = Math.max(0, sizes?.responseBodySize ?? 0); row.headerBytes = sizes?.responseHeadersSize ?? 0;
            row.status = response?.status() ?? 0; row.failure = request.failure()?.errorText ?? null;
            } catch (error) {errors.push(`Request accounting: ${String(error)}`);}
          })());
        };
        context.on('request', start); context.on('requestfinished', finish); context.on('requestfailed', finish);
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
        if (chromium !== undefined) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: profile.latency, downloadThroughput: profile.down, uploadThroughput: profile.up});
          await cdp.send('Emulation.setCPUThrottlingRate', {rate: profile.cpu});
        }
        let capture: Capture = {tap: null, control: null, rows: [], measures: [], longTasks: [], frameGaps: [], errors: [], rowCoverage: 'unavailable'};
        try {
          await page.goto(url, {waitUntil: 'commit', timeout});
          // The marker belongs to this entry, not the previous warm visit.
          await page.evaluate(() => {
            sessionStorage.removeItem('phone-loading.tap');
            const data: unknown = Reflect.get(window, '__phoneLoading');
            if (typeof data === 'object' && data !== null) Reflect.set(data, 'tap', null);
          });
          await page.locator('.ws-main-select').waitFor({timeout});
          // A protocol dwell, not a readiness retry. PL13 can request 10 s.
          await page.waitForTimeout(titleDwell);
          if (values.flow === 'grid') await page.locator('.ws-main-grid').click({timeout});
          else {
            await page.locator('.ws-main-select').click({timeout});
            await page.locator('.ws-menu-card').first().waitFor({timeout});
            const titles = await page.locator('.ws-menu-card b').allTextContents();
            const index = loadingCardIndex(titles, values.flow.slice(7));
            await page.locator(`.ws-menu-dots i[data-i="${index}"]`).click();
            await page.locator(`.ws-menu-card.selected[data-i="${index}"]`).waitFor({timeout});
            const explicit = page.locator('.ws-menu-shardfile');
            // The ordinary single ENTER WORLD button is the primary compiled
            // entry. The explicit button exists only in the legacy A/B UI.
            await (await explicit.isVisible() ? explicit : page.locator('.ws-menu-play')).click({timeout});
          }
          await page.waitForFunction(() => {
            const data: unknown = Reflect.get(window, '__phoneLoading');
            return typeof data === 'object' && data !== null && (('control' in data && typeof data.control === 'number') || 'fatal' in data);
          }, null, {timeout});
          const reachedControl = await page.evaluate(() => {
            const data: unknown = Reflect.get(window, '__phoneLoading');
            return typeof data === 'object' && data !== null && 'control' in data && typeof data.control === 'number';
          });
          // Match the original capture's background-copy window before the
          // warm visit; this time is outside tap-to-control accounting.
          if (reachedControl) await page.waitForTimeout(afterControl);
        } catch (error) {errors.push(String(error));}
        try {capture = await page.evaluate(() => Reflect.get(window, '__phoneLoading') as Capture);}
        catch (error) {errors.push(`Capture: ${String(error)}`);}
        capture.tap = tapAt ?? capture.tap;
        await Promise.all(jobs);
        context.off('request', start); context.off('requestfinished', finish); context.off('requestfailed', finish);
        const from = capture.tap ?? 0, to = capture.control ?? capture.stoppedAt ?? Date.now();
        const run: Run = {...capture, schema: 1, at: new Date().toISOString(), build, url, engine, flow: values.flow,
          preset: values.preset, cache, profile, totalMs: capture.tap !== null && capture.control !== null ? capture.control - capture.tap : null,
          applied: {pageCPU: chromium !== undefined, pageNetwork: chromium !== undefined, workerNetwork: chromium?.workerNetwork() ?? false,
            notes: [...(chromium === undefined ? ['Playwright WebKit has no CDP CPU/network emulation; unthrottled engine check, not phone-speed equivalence'] : ['Worker CPU throttling is unsupported by CDP']), `Title dwell ${titleDwell}ms; post-control dwell ${afterControl}ms (outside measured total)`]},
          rows: capture.rows, measures: capture.measures.filter(row => row.start >= from && row.start <= to),
          longTasks: capture.longTasks.filter(row => row.start >= from && row.start <= to),
          frameGaps: capture.frameGaps.filter(row => row.start >= from && row.start <= to),
          requests: requests.filter(row => row.start >= from && row.start <= to), errors: [...capture.errors, ...errors, ...(chromium?.errors ?? [])]};
        const name = `${engine}-${values.flow.replace(':', '-')}-${cache}`;
        await page.screenshot({path: `${directory}/${name}.jpg`, type: 'jpeg', quality: 75, timeout: 10_000}).catch((error: unknown) => {run.errors.push(String(error));});
        const video = page.video(); await page.close();
        if (video !== null) {
          run.video = await video.path();
          run.contactSheet = `${directory}/${name}-sheet.jpg`;
          await contactSheet(run.video, run.contactSheet, `${engine} ${values.flow} ${cache} / ${build} / ${values.preset}`)
            .catch((error: unknown) => {run.errors.push(`Contact sheet: ${String(error)}`);});
        }
        await writeFile(`${directory}/${name}.json`, JSON.stringify(run, null, 2));
        printRun(run);
        if (previous !== undefined) for (const warning of comparisons(run, previous)) console.log(`\u001B[31mCOMPARE: ${warning}\u001B[0m`);
        if (run.totalMs === null || run.errors.length > 0) process.exitCode = 1;
        console.log(`JSON ${directory}/${name}.json`);
      }
    } finally {
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      try {await context.close();} finally {await (chromium !== undefined ? chromium.close() : browser.close());}
    }
  }
} finally {if (leased) await command('scripts/serve-build.sh', ['stop', new URL(url).port], env);}
}
await main();
