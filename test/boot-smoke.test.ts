// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the exact browser observer and required CI wiring.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Browser callback fixture keeps production services out of the unit test.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
const observer = source.slice(source.indexOf('export function bootObservation()'), source.indexOf('/** @param')).replace('export ', '');

it('refuses the registered-asset fatal before a gameplay probe exists', () => {
  const result: unknown = runInNewContext(`(${observer})()`, {
    document: { querySelectorAll: () => [{ textContent: 'Asset already registered: scene:undefined' }] },
    window: {},
  });
  expect(result).toMatchObject({ ready: false, fatal: ['Asset already registered: scene:undefined'] });
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
  expect(job).toContain('node scripts/parity/boot-smoke.mjs');
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

it('boots public Pine through real SHARD SELECT as well as Driftwood, Developer Signal Dunes and the Developer grid', () => {
  expect(source).toContain("['standalone', 'pine-hollow', false]");
  expect(source).toContain("['standalone', 'sunscar-dunes', true]"); // the Developer-only shard SF57's composer coverage broke
  expect(source).toContain("data: mode === 'grid' || developer");
  expect(source).toContain("url.searchParams.set('chunk', shard)");
  expect(source).toContain("page.locator('.ws-main-select').click()");
  expect(source).toContain("page.locator('.ws-menu-play').click()");
  expect(source).toContain('value.shard === shard && value.grid === null');
  expect(source).toContain('started + 90000');
  expect(source).toContain('grid spawn is under a collider'); // E463
  expect(source).toContain("page.locator('.ws-grid-reveal').dispatchEvent('pointerdown')");
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
  expect(workflow).toContain("- name: Checks and build (parallel)\n        if: env.DEPLOY != 'true'\n        run: node scripts/ci-checks.mjs");
  expect(workflow).toContain('\n  typecheck-lint:\n');
  expect(workflow).toContain('shard: [1, 2, 3, 4, 5, 6, 7, 8]');
  expect(workflow).toContain("find shards -path 'shards/vitest-coverage-*/coverage-final.json' | wc -l)\" = 8");
  expect(job).toContain(`group: boot-smoke-\${{ matrix.part }}-\${{ github.event_name == 'workflow_run' && 'main' || inputs.sha || github.sha }}`);
  // SF74 W16: the boot and HOVER legs run at once; `verdict` publishes the one exact-SHA status from both.
  expect(job).toContain('part: [boot, hover]');
  expect(job).toContain("needs: boot-smoke\n    if: always() && needs.boot-smoke.result != 'skipped'");
  expect(job).toContain("cancelled) state=error;");
  expect(workflow).toContain('python3 scripts/heavy-lane.py build -- pnpm exec vite build');
  expect(workflow).toContain('node scripts/check-chunks.mjs dist');
  expect(workflow).toContain('node "$RUNNER_TEMP/deploy-version.mjs" verify');
});
