import { afterEach, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Executes the real deploy backstop in an isolated shell fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Owns and removes the isolated shell fixture files.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Places the owned shell fixture in the system temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolves the executable fixture and source paths.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserves the host environment when spawning the Node-side shell test.
import { env } from 'node:process';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function run(slot: string, options: { dry?: boolean; scheduled?: boolean; ambiguous?: boolean; ready?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'deploy-backstop-')); roots.push(root);
  const bin = join(root, 'bin'), scripts = join(root, 'scripts/deploy-backstop');
  mkdirSync(bin); mkdirSync(scripts, { recursive: true });
  copyFileSync(resolve('scripts/deploy-backstop/backstop.sh'), join(scripts, 'backstop.sh'));
  const executable = (name: string, body: string) => writeFileSync(join(bin, name), `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
  executable('date', 'echo 2026-10-11T15:00:00Z');
  executable('sleep', ':');
  executable('node', `if [[ "$*" == 'scripts/deploy-pin.mjs release-ready' ]]; then
  echo ready >> "$FIXTURE/readiness"
  if [[ "$READY" == error ]]; then exit 1; fi
  printf '%s\\n' "$READY" >> "$GITHUB_OUTPUT"
  exit 0
fi
[[ "$*" == 'scripts/deploy-pin.mjs release-slot' ]]
echo check >> "$FIXTURE/checks"
if [[ "$SLOT" == error ]]; then exit 1; fi
if [[ "$AMBIGUOUS" == 1 && -f "$FIXTURE/dispatch" ]]; then
  echo free=false >> "$GITHUB_OUTPUT"
else
  printf '%s\\n' "$SLOT" >> "$GITHUB_OUTPUT"
fi`);
  executable('gh', `if [[ "$1 $2" == 'run list' ]]; then
  [[ "$SCHEDULED" == 0 ]] || echo 2026-10-11T16:00:00Z
elif [[ "$*" == 'workflow run deploy' ]]; then
  echo dispatch >> "$FIXTURE/dispatch"
  [[ "$AMBIGUOUS" == 0 ]]
else exit 2; fi`);
  const result = spawnSync('/bin/bash', [join(scripts, 'backstop.sh'), ...(options.dry ? ['--dry-run'] : [])], {
    encoding: 'utf8', env: { ...env, PATH: `${bin}:/usr/bin:/bin`, FIXTURE: root, SLOT: slot, READY: options.ready ?? `ready=true\nsha=${'a'.repeat(40)}`,
      SCHEDULED: options.scheduled ? '1' : '0', AMBIGUOUS: options.ambiguous ? '1' : '0',
      WS_DEPLOY_BACKSTOP_LOG_DIR: join(root, 'logs') },
  });
  const lines = (name: string) => existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8').trim().split('\n') : [];
  return { result, dispatches: lines('dispatch'), checks: lines('checks'), readiness: lines('readiness') };
}

it('refuses dispatch while the shared hourly slot is occupied', () => {
  const r = run('free=false'); expect(r.result.status, r.result.stderr).toBe(0);
  expect(r.dispatches).toEqual([]); expect(r.checks).toHaveLength(1);
});
it('dispatches once only after proving the shared slot free', () => {
  const r = run('free=true'); expect(r.result.status, r.result.stderr).toBe(0);
  expect(r.dispatches).toHaveLength(1); expect(r.checks).toHaveLength(1);
});
it.each(['error', '', 'free=maybe'])('fails closed on an unavailable or unreadable slot proof: %s', (slot) => {
  const r = run(slot); expect(r.result.status).toBe(1); expect(r.dispatches).toEqual([]);
});
it('rechecks after an ambiguous dispatch error and avoids a duplicate release', () => {
  const r = run('free=true', { ambiguous: true }); expect(r.result.status, r.result.stderr).toBe(0);
  expect(r.dispatches).toHaveLength(1); expect(r.checks).toHaveLength(2);
});
it('checks the shared slot in dry-run mode without dispatching', () => {
  const r = run('free=true', { dry: true }); expect(r.result.status, r.result.stderr).toBe(0);
  expect(r.dispatches).toEqual([]); expect(r.checks).toHaveLength(1); expect(r.result.stdout).toContain('would dispatch');
});
it('keeps the existing scheduled-run suppression', () => {
  const r = run('free=true', { scheduled: true }); expect(r.result.status, r.result.stderr).toBe(0);
  expect(r.dispatches).toEqual([]); expect(r.checks).toEqual([]);
});

it('leaves the hour free when a newer candidate is still proving, including dry run', () => {
  for (const dry of [false, true]) {
    const r = run('free=true', { dry, ready: `ready=false\nsha=${'a'.repeat(40)}` });
    expect(r.result.status, r.result.stderr).toBe(0);
    expect(r.dispatches).toEqual([]); expect(r.readiness).toHaveLength(1);
    expect(r.result.stdout).toContain('leaving the hour free');
  }
});
it.each(['error', '', 'ready=true', 'ready=maybe\nsha=bad', `ready=true\nsha=${'a'.repeat(40)}\nready=false`])(
  'refuses unavailable or malformed candidate readiness: %s', (ready) => {
    const r = run('free=true', { ready });
    expect(r.result.status).toBe(1); expect(r.dispatches).toEqual([]);
  },
);
