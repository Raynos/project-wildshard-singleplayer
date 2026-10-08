import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { driveFloorGrid, gridFloorPlans } from '../../../scripts/frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
const { TraceMap, originalPositionFor } = createRequire(import.meta.url)('@jridgewell/trace-mapping');
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'One muted Chromium/Metal iPhone 16 Pro, Developer ON, live input crossings. Claims count retained resources; hidden is not freed.',
  driverHash: createHash('sha256').update(driveFloorGrid.toString()).digest('hex'), snapshots: [], routes: [], errors: [], console: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null };
    window.__gridAdmissionLongTasks = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__gridAdmissionLongTasks.push({ start: entry.startTime, ms: entry.duration,
        live: window.__wildshard?.shard?.grid?.state().live?.live });
    }).observe({ entryTypes: ['longtask'] });
  });
  const page = await context.newPage();
  const profiler = await context.newCDPSession(page);
  let profileStart = null;
  page.on('requestfailed', request => { report.console.push(`REQUEST FAILED ${request.url()} ${request.failure()?.errorText}`); });
  page.on('pageerror', error => { report.errors.push(String(error)); save(); });
  page.on('console', message => { if (['error', 'warn'].includes(message.type())) report.console.push(message.text().slice(0, 1200)); });
  const snapshot = async label => {
    const value = await page.evaluate(() => {
      const api = window.__wildshard, grid = api.shard.grid;
      const roots = [];
      api.world.game.rootScene.traverse(object => {
        if (object.isMesh && object.name.startsWith('grid-')) roots.push({ name: object.name, visible: object.visible,
          vertices: object.geometry?.attributes.position?.count, indices: object.geometry?.index?.count });
      });
      return { state: grid.state(), residency: grid.residency(), road: grid.roadResident(), roots, longTasks: window.__gridAdmissionLongTasks,
        runtime: { texture: api.world.game.level.assets?.texture, level: api.world.game.level.id },
        reveal: window.__wsReveal };
    });
    report.stage = label; report.snapshots.push({ label, ...value }); save(); console.log(label, value.state.playingMB, 'MB', value.state.live?.live.current);
  };
  try {
    await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 });
    report.stage = 'title'; save(); console.log('title navigation');
    await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
    await page.locator('.ws-main-grid').click();
    report.stage = 'grid-loading'; save(); console.log('grid title tapped');
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
    await page.waitForTimeout(5000); await snapshot('home-settled');
    await profiler.send('Performance.enable');
    const { metrics } = await profiler.send('Performance.getMetrics');
    profileStart = metrics.find(row => row.name === 'NavigationStart')?.value;
    if (profileStart === undefined) throw new Error('CPU profile navigation clock missing');
    await profiler.send('Profiler.enable'); await profiler.send('Profiler.setSamplingInterval', { interval: 5000 });
    await profiler.send('Profiler.start');
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const plans = gridFloorPlans(state, 'runtime-travel');
    for (const original of plans) {
      const plan = { ...original, requiredResidents: [original.to] };
      report.stage = `route:${plan.name}`; save();
      // Entry-edge poses first, then a real-input route into each cell centre. No diagnostic teleport across a seam.
      report.routes.push(await page.evaluate(driveFloorGrid, plan));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-entry`);
      const cell = state.cells.find(row => row.instance === plan.to); if (!cell) throw new Error('Missing destination');
      report.routes.push(await page.evaluate(driveFloorGrid, { name: `${plan.to}-centre`, from: plan.to, to: plan.to,
        waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-centre`);
    }
  } catch (error) {
    report.failure = String(error);
    report.diagnostic = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(-6000),
      boot: window.__wildshard?.world?.game?.app?.state, grid: window.__wildshard?.shard?.grid?.state(), reveal: window.__wsReveal,
      longTasks: window.__gridAdmissionLongTasks,
      resources: performance.getEntriesByType('resource').slice(-20).map(row => ({ name: row.name, duration: row.duration })) })).catch(() => null);
    save(); console.error(report.failure); process.exitCode = 1;
  }
  finally {
    if (profileStart !== null) {
      try {
        const { profile } = await profiler.send('Profiler.stop');
        const timings = await page.evaluate(() => window.__wildshard?.shard?.grid?.state().live?.runtimeTiming?.completed ?? []);
        const maps = new Map(), nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
        for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
        for (const url of new Set(profile.nodes.map(node => node.callFrame.url).filter(url => url.startsWith(base) && url.endsWith('.js')))) {
          const response = await fetch(`${url}.map`); if (response.ok) maps.set(url, new TraceMap(await response.json()));
        }
        const frames = new Map(profile.nodes.map(node => {
          const frame = node.callFrame, map = maps.get(frame.url), original = map === undefined ? null : originalPositionFor(map, { line: frame.lineNumber + 1, column: frame.columnNumber });
          return [node.id, original?.source == null ? `${frame.functionName} (${frame.url}:${frame.lineNumber + 1})`
            : `${original.name ?? frame.functionName} (${original.source}:${original.line}:${original.column})`];
        }));
        const tasks = await page.evaluate(() => window.__gridAdmissionLongTasks ?? []);
        const groups = [...timings.map(timing => ({ ...timing, kind: 'hook' })), ...tasks.filter(task => task.ms >= 100).map(task => ({
          kind: 'longtask', instance: task.live?.current ?? null, hook: 'frame', start: task.start, end: task.start + task.ms,
        }))].map(timing => ({ ...timing, sampledMicros: 0, stacks: new Map() }));
        let time = profile.startTime;
        for (const [i, id] of (profile.samples ?? []).entries()) {
          const delta = profile.timeDeltas?.[i] ?? 0; time += delta;
          const ms = time / 1000 - profileStart * 1000, matching = groups.filter(row => ms >= row.start && ms <= row.end);
          if (matching.length === 0) continue;
          const stack = []; let at = id;
          while (at !== undefined && stack.length < 16) { stack.push(frames.get(at)); at = parents.get(at); }
          const key = stack.join('\n');
          for (const group of matching) { group.sampledMicros += delta; group.stacks.set(key, (group.stacks.get(key) ?? 0) + delta); }
        }
        report.hookProfiles = groups.map(({ stacks, ...timing }) => ({ ...timing, topStacks: [...stacks].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([stack, micros]) => ({ milliseconds: micros / 1000, stack: stack.split('\n') })) }));
      } catch (error) { report.profileFailure = String(error); }
      save();
    }
    await context.close();
  }
} finally { await browser.close(); report.closed = true; save(); }
