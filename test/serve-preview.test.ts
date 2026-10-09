// oxlint-disable-next-line import/no-nodejs-modules -- Verifies the real preview launcher without compiling or opening a game.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this fixture's temporary executable and log are written.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The native child fixture lives outside the repository.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Builds paths for the isolated native child fixture.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Controls only the detached child group created by this fixture.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Waits for child stdout without blocking the test worker.
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';

function retire(pid: number): void {
  try { process.kill(-pid, 'SIGTERM'); } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
  }
}

it.for(['stop', 'expiry'] as const)('keeps a detached preview alive after launch, and %s retires its whole owned group', async (cleanup, { signal }) => {
  const shell = readFileSync('scripts/serve-build.sh', 'utf8');
  const match = /<<'PREVIEW_NODE'\n([\s\S]+?)\nPREVIEW_NODE/u.exec(shell), launcher = match?.[1];
  if (!launcher) throw new Error('Missing real preview launcher');
  const dir = mkdtempSync(join(tmpdir(), 'serve-preview-')), log = join(dir, 'preview.log'), beat = join(dir, 'heartbeat');
  let pid: number | undefined;
  try {
    const childCode = `import {writeFileSync} from 'node:fs'; import {createServer} from 'node:http'; let i=0; setInterval(() => writeFileSync(${JSON.stringify(beat)},String(++i)),20); const server=createServer((_req,res)=>res.end('detached preview alive')); server.listen(0,'127.0.0.1',()=>console.log('fixture-port '+server.address().port));`;
    writeFileSync(join(dir, 'pnpm'), `#!${process.execPath}\nconst {spawn}=require('node:child_process'); const child=spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(childCode)}],{stdio:['ignore','inherit','inherit']}); console.log('fixture-ready '+child.pid); setInterval(() => {},1000);\n`, { mode: 0o755 });
    const laneRoot = join(dir, 'lane');
    pid = Number(execFileSync('python3', [join(process.cwd(), 'scripts/heavy-lane.py'), 'build', '--', process.execPath, '--input-type=module', '-', 'config', 'dist', '4402', log], {
      input: launcher, env: { ...process.env, PATH: `${dir}:${process.env['PATH'] ?? ''}`, WS_HEAVY_ROOT: laneRoot, WS_HEAVY_TOKEN: '', WS_HEAVY_GATE: '' }, encoding: 'utf8', timeout: 5000,
    }).trim());
    if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error('Invalid child identity');
    expect(process.kill(pid, 0)).toBe(true);
    expect(Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim())).toBe(pid);
    let output = readFileSync(log, 'utf8');
    // Readiness is bounded by this test's existing deadline, including cancellation under a loaded full suite.
    while (!output.includes('fixture-ready') || !/fixture-port \d+/u.test(output)) {
      await delay(20, undefined, { signal });
      output = readFileSync(log, 'utf8');
    }
    expect(output).toContain('fixture-ready');
    // The real build wrapper exited and released its lease; the detached preview still serves bytes.
    expect(existsSync(join(laneRoot, 'build.active.json'))).toBe(false);
    const port = /fixture-port (\d+)/u.exec(output)?.[1];
    if (!port) throw new Error('Missing listening preview port');
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe('detached preview alive');
    const child = /fixture-ready (\d+)/u.exec(output)?.[1];
    if (!child) throw new Error('Missing descendant identity');
    expect(Number(execFileSync('ps', ['-o', 'pgid=', '-p', child], { encoding: 'utf8' }).trim())).toBe(pid);
    for (let i = 0; i < 100 && !existsSync(beat); i++) await delay(20);
    expect(existsSync(beat)).toBe(true);
    if (cleanup === 'stop') {
      writeFileSync(join(dir, '4402'), `${pid} 9999999999 ${dir} fixture fixture\n`);
      execFileSync('bash', ['scripts/serve-build.sh', 'stop', '4402'], { env: { ...process.env, SERVE_REG_DIR: dir }, timeout: 5000 });
    } else {
      // Exercise the exact expiry disposer without scanning or reaping another agent's registered processes.
      const reaper = readFileSync('scripts/browser-lane.sh', 'utf8');
      const start = reaper.indexOf('kill_tree() {'), end = reaper.indexOf('\n\nreap()', start);
      if (start === -1 || end === -1) throw new Error('Missing expiry disposer');
      execFileSync('bash', ['-c', `${reaper.slice(start, end)}\nkill_tree "$1"`, 'fixture', String(pid)], { timeout: 5000 });
    }
    const stopped = readFileSync(beat, 'utf8'); await delay(100);
    expect(readFileSync(beat, 'utf8')).toBe(stopped);
  } finally {
    if (pid !== undefined && Number.isSafeInteger(pid) && pid > 1) retire(pid);
    rmSync(dir, { recursive: true, force: true });
  }
});
