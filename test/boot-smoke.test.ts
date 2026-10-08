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

it('makes built-dist boot a required parallel push job, outside pre-push', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const job = workflow.split('\n  boot-smoke:')[1]?.split('\n  coverage:')[0];
  expect(job).toBeDefined();
  expect(job).toContain("if: github.event_name == 'push' || github.event_name == 'pull_request'");
  expect(job).not.toMatch(/continue-on-error|needs:/u);
  expect(job).toContain('runs-on: macos-15');
  expect(job).toContain('job-timing.json');
  expect(job).toContain('node scripts/build-shardfiles.mjs\n          pnpm exec vite build');
  expect(job).toContain('node scripts/parity/boot-smoke.mjs');
  expect(readFileSync('scripts/deploy-pin.mjs', 'utf8')).toContain('event=push&status=success');
  expect(readFileSync('scripts/vercel-tree-gate.sh', 'utf8')).not.toContain('boot-smoke');
});
