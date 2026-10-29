import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve as resolvePath} from 'node:path';
import {parseArgs} from 'node:util';
import {instrument} from './instrument.ts';
import {launchChromium} from './chromium.ts';
import {contactSheet} from './recording.ts';
import {observeRequests} from './network.ts';
import {parseSaveFixture} from './fixtures.ts';
import {postControlWindow} from './post-control.ts';
import {comparisons, controlQualification, printRun, profiles, record, type Capture, type ErrorRow, type Run} from './model.ts';
import {developerSettings, saveFixture} from '../debug-settings.mjs';
import {loadingCardIndex} from '../loading-benchmark/catalogue.mjs';

async function main(): Promise<void> {
const {values} = parseArgs({options: {preset: {type: 'string', default: 'phone'}, flow: {type: 'string', default: 'grid'},
  live: {type: 'boolean'}, head: {type: 'boolean'}, rev: {type: 'string'}, url: {type: 'string'},
  record: {type: 'boolean'}, webkit: {type: 'boolean'}, compare: {type: 'string'}, timeout: {type: 'string', default: '240000'},
  'title-dwell': {type: 'string', default: '3000'},
  'after-control': {type: 'string', default: '4000'},
  'save-fixture': {type: 'string'},
  help: {type: 'boolean'}}});
if (values.help) {
  console.log('pnpm phone-loading [--live | --head | --rev SHA | --url URL] [--preset phone|lte|desktop] [--flow grid|select:SLUG] [--record] [--webkit] [--compare JSON] [--timeout MS] [--title-dwell MS=3000] [--after-control MS=4000] [--save-fixture JSON]');
  return;
}
const profile = profiles[values.preset];
const fixture = parseSaveFixture(values['save-fixture']);
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
    const network = observeRequests((start, finish) => {
      context.on('request', start); context.on('requestfinished', finish); context.on('requestfailed', finish);
      return () => {context.off('request', start); context.off('requestfinished', finish); context.off('requestfailed', finish);};
    });
    const interrupt = (): void => {process.exitCode = 130; void context.close();};
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
      await developerSettings(context, {volume: 0, music: 0, tier: 'phone', holdLoading: false});
      if (fixture !== undefined) await saveFixture(context, fixture);
      await context.addInitScript(instrument, values.flow);
      for (const cache of ['cold', 'warm']) {
        console.log(`Starting ${engine} ${values.flow} ${cache} at ${url}`);
        const page = await context.newPage();
        await page.bringToFront();
        let tapAt: number | null = null;
        await page.exposeBinding('__phoneLoadingTap', (_source, at: unknown) => {
          if (typeof at === 'number') tapAt = at;
        });
        const errors: ErrorRow[] = [], visitStart = Date.now();
        const errorAt = (message: string, source: string, address = page.url()): void => {
          errors.push({message, source, url: address, at: Date.now()});
        };
        page.on('pageerror', error => {errorAt(error.message, error.stack ?? 'pageerror');});
        page.on('console', message => {if (message.type() === 'error') {
          const location = message.location();
          errorAt(message.text(), `console.error:${location.lineNumber}:${location.columnNumber}`, location.url);
        }});
        if (chromium !== undefined) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: profile.latency, downloadThroughput: profile.down, uploadThroughput: profile.up});
          await cdp.send('Emulation.setCPUThrottlingRate', {rate: profile.cpu});
        }
        let capture: Capture = {tap: null, control: null, rows: [], measures: [], longTasks: [], frameGaps: [], errors: [], rowCoverage: 'unavailable'};
        let controlDocument: string | null = null;
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
          if (reachedControl) {
            controlDocument = await page.evaluate(() => {
              const data: unknown = Reflect.get(window, '__phoneLoading');
              if (typeof data !== 'object' || data === null || !('controlWitness' in data)) return null;
              const witness: unknown = data.controlWitness;
              return typeof witness === 'object' && witness !== null && 'documentToken' in witness && typeof witness.documentToken === 'string' ? witness.documentToken : null;
            });
            await page.waitForTimeout(afterControl);
          }
        } catch (error) {errorAt(String(error), 'flow');}
        try {capture = await page.evaluate(() => Reflect.get(window, '__phoneLoading') as Capture);}
        catch (error) {errorAt(String(error), 'capture');}
        try {capture = await page.evaluate(() => {
          const read: unknown = Reflect.get(window, '__phoneLoadingReadControl');
          if (typeof read !== 'function') throw new Error('Native control witness reader is unavailable');
          Reflect.apply(read, window, []);
          return Reflect.get(window, '__phoneLoading') as Capture;
        });}
        catch (error) {errorAt(String(error), 'native control capture'); capture.control = null;}
        capture.tap = tapAt ?? capture.tap;
        const refusal = controlQualification(capture, controlDocument);
        capture.qualified = refusal === null;
        if (refusal !== null) {errorAt(`Native control unqualified: ${refusal}`, 'native control/document'); capture.control = null;}
        let longTasksSupported = false;
        try {longTasksSupported = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('longtask'));}
        catch (error) {errorAt(String(error), 'long-task capability');}
        const postControlObservedAt = Date.now();
        const requestAccounting = await network.settle(visitStart);
        if (!requestAccounting.complete) errorAt(`Incomplete request accounting: ${requestAccounting.incomplete} rows; ${requestAccounting.pending} native metadata waits exceeded ${requestAccounting.deadlineMs}ms`, 'request accounting');
        const postControl = postControlWindow(capture.control, postControlObservedAt, afterControl, capture.longTasks, network.rows, longTasksSupported);
        const from = capture.tap ?? 0, to = capture.control ?? capture.stoppedAt ?? Date.now();
        const errorDetails = [...capture.errorDetails ?? [], ...errors, ...network.errors.filter(error => error.at >= visitStart),
          ...(chromium?.errors ?? []).map(message => ({message, source: 'CDP auto-attach', url, at: Date.now()}))];
        const run: Run = {...capture, schema: 1, at: new Date().toISOString(), build, url, engine, flow: values.flow,
          preset: values.preset, cache, profile, totalMs: capture.tap !== null && capture.control !== null ? capture.control - capture.tap : null,
          applied: {pageCPU: chromium !== undefined, pageNetwork: chromium !== undefined, workerNetwork: chromium?.workerNetwork() ?? false,
            notes: [...(chromium === undefined ? ['Playwright WebKit has no CDP CPU/network emulation; unthrottled engine check, not phone-speed equivalence'] : ['Worker CPU throttling is unsupported by CDP']), `Title dwell ${titleDwell}ms; post-control dwell ${afterControl}ms (outside measured total)`, ...fixture === undefined ? [] : [`Save fixture ${JSON.stringify(fixture)}`]]},
          rows: capture.rows, measures: capture.measures.filter(row => row.start >= from && row.start <= to),
          longTasks: capture.longTasks.filter(row => row.start >= from && row.start <= to),
          frameGaps: capture.frameGaps.filter(row => row.start >= from && row.start <= to),
          requests: network.rows.filter(row => row.start >= from && row.start <= to), requestAccounting, postControl, errorDetails,
          errors: errorDetails.map(error => error.message)};
        const name = `${engine}-${values.flow.replace(':', '-')}-${cache}`;
        // Publish the measured/partial data before artifact APIs can fail.
        await writeFile(`${directory}/${name}.json`, JSON.stringify(run, null, 2));
        await page.screenshot({path: `${directory}/${name}.jpg`, type: 'jpeg', quality: 75, timeout: 10_000}).catch((error: unknown) => {
          const message = String(error); run.errors.push(message); run.errorDetails?.push({message, source: 'screenshot', url: page.url(), at: Date.now()});
        });
        const video = page.video(); await page.close();
        if (video !== null) {
          run.video = await video.path();
          run.contactSheet = `${directory}/${name}-sheet.jpg`;
          await contactSheet(run.video, run.contactSheet, `${engine} ${values.flow} ${cache} / ${build} / ${values.preset}`)
            .catch((error: unknown) => {const message = String(error); run.errors.push(message);
              run.errorDetails?.push({message, source: 'contact sheet', url: run.video ?? '', at: Date.now()});});
        }
        await writeFile(`${directory}/${name}.json`, JSON.stringify(run, null, 2));
        printRun(run);
        if (previous !== undefined) for (const warning of comparisons(run, previous)) console.log(`\u001B[31mCOMPARE: ${warning}\u001B[0m`);
        if (run.totalMs === null || run.errors.length > 0) process.exitCode = 1;
        console.log(`JSON ${directory}/${name}.json`);
      }
    } finally {
      network.stop();
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      try {await context.close();} finally {await (chromium !== undefined ? chromium.close() : browser.close());}
    }
  }
} finally {if (leased) await command('scripts/serve-build.sh', ['stop', new URL(url).port], env);}
}
await main();
