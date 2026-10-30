#!/usr/bin/env node
// scripts/browser-lane.sh node scripts/perf/draw-census.mjs --url=http://127.0.0.1:4400/ --dist=tmp/serve/.../dist
// Four fresh contexts: Nine P4 and Pine Q4, LEGACY then SHARDFILE.
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { developerSettings, saveFixture, hideDeveloperOverlays } from '../debug-settings.mjs';
import { loadingCardIndex } from '../loading-benchmark/catalogue.mjs';
import { drawFrames } from './draw-census-page.mjs';
import { nativeSummary, attributionSummary, sampledCpu } from './draw-census-report.mjs';

const arg = (name, fallback = '') => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = arg('url'), dist = resolve(arg('dist', 'dist')), frames = Number(arg('frames', '60'));
if (!base || !Number.isInteger(frames) || frames < 10 || frames > 180) throw new Error('Usage: --url=URL --dist=matching-private-dist [--frames=10..180] [--out=tmp/...]');
const response = await fetch(new URL('version.json', base));
if (!response.ok) throw new Error('Census requires a served production build');
const version = await response.json(), local = JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8'));
if (!version.build || version.build !== local.build) throw new Error('Private maps and served build do not match');
const out = resolve(arg('out', `tmp/draw-census/${new Date().toISOString().replaceAll(':', '-')}-${version.build}`)); mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url), { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const maps = new Map();
const locate = frame => {
  const path = new URL(frame.url === '' ? 'about:blank' : frame.url).pathname;
  if (!/^\/assets\/[^/]+\.js$/u.test(path)) return { source: '', name: frame.functionName };
  const file = join(dist, path.slice(1));
  if (!maps.has(file)) maps.set(file, existsSync(`${file}.map`) ? new TraceMap(readFileSync(`${file}.map`, 'utf8')) : null);
  const map = maps.get(file);
  const position = map ? originalPositionFor(map, { line: frame.lineNumber + 1, column: Math.max(0, frame.columnNumber) }) : null;
  return { source: position?.source ?? '', name: `${frame.functionName} ${position?.name ?? ''}`.trim() };
};
const result = { build: version.build, url: base, protocol: { device: 'iPhone 16 Pro', tier: 'phone', dpr: 2, cpuRate: 4, frames,
  baseline: 'native completed Game renderMs/workMs and whole-frame calls, before any census hooks or profiler',
  attribution: 'separate GL submission observation, including shadow/post/held; no GPU synchronization',
  profile: 'separate CDP sampled stacks mapped through the matching private dist; diagnostic, not a floor' }, rows: [] };
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const { slug, poseName, pose } of [
    { slug: 'nine-dragon-stack', poseName: 'P4', pose: { x: 76, y: 146, z: 6, yaw: Math.PI / 2, pitch: -10 * Math.PI / 180 } },
    { slug: 'pine-hollow', poseName: 'Q4', pose: { x: 0, z: -28, yaw: Math.PI / 2, pitch: -4 * Math.PI / 180 } },
  ]) for (const mode of ['legacy', 'shardfile']) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    const row = { slug, poseName, mode, errors: [] }; result.rows.push(row);
    const persist = () => writeFileSync(join(out, 'census.json'), JSON.stringify(result, null, 2));
    try {
      await developerSettings(context, { tier: 'phone', volume: 0, time: 'live', weather: 'live' });
      await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
      await saveFixture(context, { scope: 'device', key: 'debug.global.legacyShardButtons', data: 'on' });
      await saveFixture(context, { scope: 'device', key: 'debug.global.refineDither', data: 'off' });
      await context.addInitScript(hideDeveloperOverlays);
      await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, lane: 'draw-census' }; });
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.on('pageerror', error => row.errors.push(error.message));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(base, { waitUntil: 'load' }); await page.locator('.ws-main-select').click();
      const names = await page.locator('.ws-menu-card b').allTextContents();
      await page.locator(`.ws-menu-dots i[data-i="${loadingCardIndex(names, slug)}"]`).click();
      if (!await page.locator('.ws-menu-shardfile').isVisible()) throw new Error('Matched LEGACY / SHARDFILE selectors unavailable');
      await page.locator(mode === 'legacy' ? '.ws-menu-play' : '.ws-menu-shardfile').click();
      await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered && !document.querySelector('.ws-load') && window.__wildshard.world.game.frameGate(), undefined, { timeout: 240000 });
      row.level = await page.evaluate(() => window.__wildshard.world.game.level.id);
      if (!row.level.includes(slug)) throw new Error('Census entered another shard');
      await page.evaluate(at => window.__wildshard.pose(at), pose);
      // Keep actual actors/health/visibility alive. Settle at the measured pose;
      // record its actual position rather than promising an identical scene.
      await page.waitForTimeout(8000);
      row.pose = await page.evaluate(() => { const world = window.__wildshard.world; return { at: world.player.position.toArray(), yaw: world.player.yaw, pitch: world.player.pitch }; });
      row.baselineFrames = await page.evaluate(drawFrames, { frames, attribution: false });
      row.native = nativeSummary(row.baselineFrames); persist();
      row.attributionFrames = await page.evaluate(drawFrames, { frames, attribution: true });
      row.attribution = attributionSummary(row.attributionFrames); persist();
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
      let profileWindow;
      try { profileWindow = await page.evaluate(drawFrames, { frames, attribution: false }); }
      finally {
        const { profile } = await cdp.send('Profiler.stop'); await cdp.send('Profiler.disable');
        writeFileSync(join(out, `${slug}-${mode}.cpuprofile`), JSON.stringify(profile));
        row.sampledCpu = sampledCpu(profile, locate, profileWindow?.length ?? 0);
      }
      if (row.errors.length > 0) throw new Error('Page errors during draw census');
      row.status = 'passed'; persist(); console.info(`${slug} ${mode}: ${row.native.drawsP50} draws, ${row.native.renderUsPerDrawP50.toFixed(1)} us/draw (native baseline)`);
    } catch (error) { row.status = 'failed'; row.failure = String(error.stack ?? error); persist(); throw error; }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
const value = number => number === null || number === undefined ? 'n/a' : number.toFixed(2);
const columns = result.rows.map(row => `${row.slug} ${row.mode}`);
const table = [ ['metric', ...columns], ['---', ...columns.map(() => '---')],
  ['work p50 ms', ...result.rows.map(row => value(row.native.workMsP50))],
  ['render p50 ms', ...result.rows.map(row => value(row.native.renderMsP50))],
  ['render us/draw p50 (paired)', ...result.rows.map(row => value(row.native.renderUsPerDrawP50))],
  ['draws (main / shadow)', ...result.rows.map(row => `${value(row.attribution.draws)} (${value(row.attribution.draws - (row.attribution.passes.shadow ?? 0))} / ${value(row.attribution.passes.shadow ?? 0)})`)],
  ['one-copy main draws', ...result.rows.map(row => value(row.attribution.singleCopyMain))],
  ['node draws', ...result.rows.map(row => value(row.attribution.nodeDraws))],
  ['distinct programs drawn/frame', ...result.rows.map(row => value(row.attribution.programsPerFrame))],
  ['useProgram/frame', ...result.rows.map(row => value(row.attribution.useProgram))],
  ['uniform calls/frame', ...result.rows.map(row => value(row.attribution.uniforms))],
  ['materials / geometries (window)', ...result.rows.map(row => `${row.attribution.materials} / ${row.attribution.geometries}`)],
  ['triangles p50', ...result.rows.map(row => value(row.native.trianglesP50))],
  ['forest tree draws (main / shadow)', ...result.rows.map(row => `${value(row.attribution.treeDraws.main)} / ${value(row.attribution.treeDraws.shadow)}`)],
  ['sampled draw wrappers ms/frame', ...result.rows.map(row => value(row.sampledCpu.msPerFrame.drawWrappers))] ];
const summary = table.map(cells => `| ${cells.join(' | ')} |`).join('\n');
const owners = result.rows.map(row => `\n${row.slug} ${row.mode} — top pass/owners (calls per frame):\n\n${row.attribution.byOwner.slice(0, 20).map(owner => `- ${value(owner.drawsPerFrame)} ${owner.owner}`).join('\n')}`).join('\n');
const markdown = `${summary}\n${owners}`;
writeFileSync(join(out, 'table.md'), `${markdown}\n`); console.info(markdown); console.info(`Raw per-frame/pass/owner rows and profiles: ${out}`);
