// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the exact browser observer and required CI wiring.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Browser callback fixture keeps production services out of the unit test.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { gridFloorPlans, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';
import { bootCases, bootCatalogue, bootSignalRoadPlan, verifyBootSignalRoad } from '../scripts/parity/boot-smoke.mjs';

const source = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
const observer = source.slice(source.indexOf('export function bootObservation()'), source.indexOf('/** @param')).replace('export ', '');

it('refuses the registered-asset fatal before a gameplay probe exists', () => {
  const result: unknown = runInNewContext(`(${observer})()`, {
    document: { querySelectorAll: () => [{ textContent: 'Asset already registered: scene:undefined' }] },
    window: {},
  });
  expect(result).toMatchObject({ ready: false, fatal: ['Asset already registered: scene:undefined'] });
  const playFailure: unknown = runInNewContext(`(${observer})()`, {
    document: { querySelectorAll: () => [{ textContent: 'Shardfile requires the normal play stage' }] },
    window: {},
  });
  expect(playFailure).toMatchObject({ ready: false, fatal: ['Shardfile requires the normal play stage'] });
});

it('requires a real entered gameplay probe, not just a rendered title', () => {
  const result: unknown = runInNewContext(`(${observer})()`, {
    document: { querySelectorAll: () => [] }, window: {},
  });
  expect(result).toMatchObject({ ready: false, frame: -1 });
});

it('gates releases with an exact-SHA real boot outside push CI and pre-push', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const job = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  expect(workflow).not.toContain('\n  boot-smoke:');
  expect(job).toContain('workflow_run:');
  expect(job).toContain('workflows: [deploy]');
  expect(job).toContain("github.event.workflow_run.event == 'push'");
  expect(job).toContain("github.event.workflow_run.conclusion == 'success'");
  expect(job).toMatch(/ref: \$\{\{ inputs\.sha \|\| github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/u);
  expect(job).not.toContain('continue-on-error');
  expect(job).toContain('runs-on: macos-15');
  expect(job).toContain('job-timing.json');
  expect(job).toContain('node scripts/build-shardfiles.mjs && pnpm exec vite build');
  expect(job).toContain('part: [boot-public, boot-developer, hover-chromium, hover-webkit]');
  expect(job).toContain('node scripts/parity/boot-smoke.mjs --case-group=public');
  expect(job).toContain('node scripts/parity/boot-smoke.mjs --case-group=developer');
  expect(job).toContain('-f context=boot-smoke -f state="$state"');
  const pin = readFileSync('scripts/deploy-pin.mjs', 'utf8');
  expect(pin).toContain('event=push&status=success');
  expect(pin).toContain("if (!bootGreen(sha) && !(pin.mode === 'pinned' && productionLive(sha)))");
  expect(workflow).toContain('-f context=production-live -f state=success');
  expect(readFileSync('scripts/vercel-tree-gate.sh', 'utf8')).not.toContain('boot-smoke');
});

it('waits for the real entered HUD, frame gate and current grid reveal before claiming gameplay', () => {
  const observe = (entered: boolean, paused: boolean, revealing: boolean, frameGate: boolean): unknown => runInNewContext(`(${observer})()`, {
    document: { querySelectorAll: () => [], querySelector: (selector: string) => selector === '#hud'
      ? { classList: { contains: () => false } } : selector === '.ws-grid-reveal' && revealing ? {} : null },
    window: { __wildshard: {
      world: {}, requireWorld: () => ({ hud: { entered, paused }, game: { frameGate: () => frameGate, app: { debug: { snapshot: () => ({}) } } } }),
      state: () => ({ appState: 'play', player: { pos: { x: 0, y: 1, z: 0 }, health: 100 } }),
      app: { clock: { frame: 24 } }, shard: { slug: 'platform.grid' },
    } },
  });
  expect(observe(false, false, false, true)).toMatchObject({ ready: false, entered: false });
  expect(observe(true, true, false, true)).toMatchObject({ ready: false, entered: false });
  expect(observe(true, false, true, true)).toMatchObject({ ready: false, revealing: true });
  expect(observe(true, false, false, false)).toMatchObject({ ready: false, frameGate: false });
  expect(observe(true, false, false, true)).toMatchObject({ ready: true, frame: 24 });
});

it('boots the entire actual public catalogue and experimental primaries without frozen or hidden substitutes', () => {
  const catalogue = [
    { slug: 'driftwood-isle', status: 'live', legacy: false },
    { slug: 'pine-hollow', status: 'earlyAccess', legacy: false },
    { slug: 'nalati-grasslands', status: 'earlyAccess', legacy: false },
    { slug: 'sunscar-dunes', status: 'experimental', legacy: false },
    { slug: 'far-reach', status: 'experimental', legacy: false },
    { slug: 'nine-dragon-stack', status: 'experimental', legacy: false },
    { slug: 'driftwood-isle-legacy', status: 'live', legacy: true },
    { slug: '_template', status: 'hidden', legacy: false },
    { slug: 'future-public', status: 'live', legacy: false },
  ];
  const publicCases = bootCases(catalogue, 'public'), developerCases = bootCases(catalogue, 'developer');
  expect(publicCases).toEqual(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'future-public'].map(slug => ['standalone', slug, false]));
  expect(developerCases).toEqual([['standalone', 'sunscar-dunes', true], ['standalone', 'far-reach', true], ['standalone', 'nine-dragon-stack', true], ['grid', 'driftwood-isle', false]]);
  expect(bootCases(catalogue)).toEqual([...publicCases, ...developerCases]);
  expect(() => bootCases(catalogue.filter(row => row.slug !== 'sunscar-dunes'))).toThrow('Signal');
  expect(() => bootCases([...catalogue, catalogue[0] ?? catalogue[1] ?? { slug: '', status: '', legacy: false }])).toThrow('duplicate');
  expect(() => bootCases([{ slug: 'sunscar-dunes', status: 'unknown', legacy: false }])).toThrow('Invalid');
  expect(() => bootCases([{ slug: 'sunscar-dunes', status: 'experimental', legacy: false }])).toThrow('No public');
  const installed = new Map<symbol, unknown>([[Symbol.for('game.shards'), catalogue]]);
  expect(runInNewContext(`(${bootCatalogue.toString()})()`, { Reflect: { get: (_target: unknown, key: symbol) => installed.get(key) }, Symbol })).toEqual(catalogue);
  expect(() => { runInNewContext(`(${bootCatalogue.toString()})()`, { Reflect: { get: () => undefined }, Symbol }); }).toThrow('Missing');
  expect(source).toContain("data: mode === 'grid' || developer");
  expect(source).toContain("url.searchParams.set('chunk', shard)");
  expect(source).toContain("page.locator('.ws-main-select').click()");
  // Developer on: a shardfile-only card (LEGACY disabled) enters through SHARDFILE
  expect(source).toContain("play = page.locator('.ws-menu-play'), shardfile = page.locator('.ws-menu-shardfile')");
  expect(source).toContain('await (viaShardfile ? shardfile : play).click()');
  expect(source).toContain('value.shard === shard && value.grid === null');
  expect(source).toContain('started + 90000');
  expect(source).toContain('grid spawn is under a collider'); // E463
  expect(source).toContain("page.locator('.ws-grid-reveal').dispatchEvent('pointerdown')");
});

it('requires an actual entered Signal road crossing, not a prepared cell or ready home', () => {
  const cells: FloorGridState['cells'] = [
    { slug: 'driftwood-isle', instance: 'home', cell: [0, 0] },
    { slug: 'sunscar-dunes', instance: 'signal', cell: [2, -1] },
  ];
  const plan = bootSignalRoadPlan({ cells });
  expect(plan.start).toEqual({ x: 1110, z: -277.5 });
  expect(plan.waypoints).toEqual([{ x: 1110, z: -310 }]);
  expect(plan).toMatchObject({ from: null, to: 'signal', requiredResidents: ['signal'], finishOnArrival: true });
  expect(() => bootSignalRoadPlan({ cells: [cells[0]] })).toThrow('missing');
  expect(() => bootSignalRoadPlan({ cells: [...cells, cells[1]] })).toThrow('ambiguous');
  expect(() => bootSignalRoadPlan({ cells: [{ slug: 'sunscar-dunes', instance: 'signal', cell: [Number.NaN, 0] }] })).toThrow('address');
  const state = (current: string | null, crossings: number, z: number): FloorGridState => ({
    home: 'home', inside: current, cells,
    live: { crossing: { phase: 'idle', issue: null }, live: { current, crossings,
      worldFeet: { x: 1110, y: 0.55, z }, gameplayReady: true,
      residents: current === null ? [] : [current], transitions: current === null ? [] : [{ from: null, to: current }] } },
  });
  expect(plan.start).toEqual(gridFloorPlans(state('home', 0, 0), 'sun-entry')[0]?.start);
  const witness: FloorGridWitness = { plan, before: state(null, 0, -277.5), after: state('signal', 1, -310),
    elapsedSeconds: 1, trace: [{ seconds: 0.25, x: 1110, y: 0.55, z: -304, current: null, gameplayReady: true }] };
  expect(() => verifyBootSignalRoad(witness)).not.toThrow();
  expect(() => verifyBootSignalRoad({ ...witness, after: state('home', 1, 0) })).toThrow('Destination');
  expect(() => verifyBootSignalRoad({ ...witness, after: { ...witness.after, live: { ...witness.after.live,
    live: { ...witness.after.live.live, crossings: 0, transitions: [] } } } })).toThrow('frame commits');
  expect(() => verifyBootSignalRoad({ ...witness, after: { ...witness.after, live: { ...witness.after.live,
    live: { ...witness.after.live.live, gameplayReady: false } } } })).toThrow('not ready');
  expect(() => verifyBootSignalRoad({ ...witness, after: { ...witness.after, live: { ...witness.after.live,
    live: { ...witness.after.live.live, residents: [] } } } })).toThrow('residents');
  expect(() => verifyBootSignalRoad({ ...witness, trace: [{ seconds: 0.25, x: 1110, y: 0.55, z: -304, current: 'signal', gameplayReady: true }] })).toThrow('road frame');
  expect(source).toContain("const road = mode === 'grid' ? await bootSignalRoad(page, faults) : null");
  expect(source).toContain('runFloorGridRoute(page, plan, documentOrigin)');
  expect(source).toContain('Date.now() + 90000');
  expect(source).toContain('Signal ten live gameplay frames');
});

it('keeps hourly/manual promotion and reuses only an exact successful push-CI proof', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const job = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  // G284: a green boot smoke dispatches the release only when the hourly slot is free and production lacks the SHA.
  const release = job.slice(job.indexOf('\n  release:'));
  expect(release).toContain("if: github.event_name == 'workflow_run' && needs.boot-smoke.result == 'success'");
  expect(release.indexOf('node scripts/deploy-version.mjs check')).toBeLessThan(release.indexOf('gh workflow run deploy.yml'));
  expect(release.indexOf('node scripts/deploy-pin.mjs release-slot')).toBeLessThan(release.indexOf('gh workflow run deploy.yml'));
  expect(job.slice(0, job.indexOf('\n  release:'))).not.toContain('gh workflow run deploy');
  expect(workflow).toContain('cron: \'17 * * * *\'');
  // SF74 W15: a CI-green pin skips typecheck, lint and the Test step; an unproven pin still runs all three.
  for (const step of ['Typecheck', 'Lint', 'Test']) {
    expect(workflow).toContain(`- name: ${step}\n        if: env.DEPLOY == 'true' && steps.live.outputs.skip != 'true' && steps.pin.outputs.ci_green != 'true'`);
  }
  // SF74 W16: push CI runs test:checks + the build in parallel, typecheck and lint in their own job, vitest in 8 shards.
  expect(workflow).toContain("- name: Checks and build (parallel)\n        if: env.DEPLOY != 'true'\n        run: node scripts/build-without-browser.mjs -- node scripts/ci-checks.mjs");
  expect(workflow).toContain('\n  typecheck-lint:\n');
  expect(workflow).toContain('shard: [1, 2, 3, 4, 5, 6, 7, 8]');
  // G287: push CI runs the shards without coverage; coverage.yml instruments them, merges and ratchets nightly + milestones.
  expect(workflow).not.toContain('--coverage');
  const coverage = readFileSync('.github/workflows/coverage.yml', 'utf8');
  expect(coverage).toContain('shard: [1, 2, 3, 4, 5, 6, 7, 8]');
  expect(coverage).toContain('--coverage --coverage.reporter=json');
  expect(coverage).toContain("find shards -path 'shards/vitest-coverage-*/coverage-final.json' | wc -l)\" = 8");
  expect(coverage).toMatch(/schedule:\n {4}- cron: '[^']+'/u);
  expect(coverage).toContain('workflow_dispatch:');
  expect(coverage).not.toMatch(/^ {2}(push|pull_request):/mu);
  expect(job).toContain(`group: boot-smoke-\${{ matrix.part }}-\${{ github.event_name == 'workflow_run' && 'main' || inputs.sha || github.sha }}`);
  // Every catalogue case and both full browser drives keep their deadlines; all four legs supply the exact-SHA verdict.
  expect(job).toContain('part: [boot-public, boot-developer, hover-chromium, hover-webkit]');
  expect(job).toContain("if: matrix.part == 'boot-public'\n        run: node scripts/parity/boot-smoke.mjs --case-group=public");
  expect(job).toContain("if: matrix.part == 'boot-developer'\n        run: node scripts/parity/boot-smoke.mjs --case-group=developer");
  expect(job).toContain("if: matrix.part == 'hover-chromium'\n        run: node scripts/parity/hover-touch.mjs --out=boot-smoke-results/hover-chromium");
  expect(job).toContain("if: matrix.part == 'hover-webkit'\n        run: scripts/browser-lane.sh --max 8 node scripts/parity/hover-touch.mjs --engine=webkit --out=boot-smoke-results/hover-webkit");
  expect(job).toContain('timeout-minutes: 12');
  expect(job).toContain('fail-fast: false');
  expect(job).toContain("needs: boot-smoke\n    if: always() && needs.boot-smoke.result != 'skipped'");
  expect(job).toContain("cancelled) state=error;");
  expect(workflow).toContain('python3 scripts/heavy-lane.py build -- pnpm exec vite build');
  expect(workflow).toContain('node scripts/check-chunks.mjs dist');
  expect(workflow).toContain('node "$RUNNER_TEMP/deploy-version.mjs" verify');
});
