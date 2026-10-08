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
