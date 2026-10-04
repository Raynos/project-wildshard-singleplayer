// oxlint-disable-next-line import/no-nodejs-modules -- Real shell locks are the concurrency boundary under test.
import { spawn, type ChildProcess } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture isolates Simulator state and executables on disk.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only its temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths must survive spaces.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture subprocesses are killed only in their own process group.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Wait for observable fixture events, not a real Simulator.
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, it } from 'vitest';

interface Event { kind: 'start' | 'end'; id: string; lease: string }
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sf0d-lane-'));
  const bin = join(dir, 'bin'), lane = join(dir, 'lane');
  mkdirSync(bin); mkdirSync(lane);
  writeFileSync(join(dir, 'state'), 'Booted'); // specifically exercise an already-booted device
  const fake = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path'), dir = process.env.SF0D_FIXTURE_DIR;
const args = process.argv.slice(2), state = path.join(dir, 'state');
if (args[1] === 'list') {
  const device = {udid:'SF0D-DEVICE',name:'fixture-phone',state:fs.readFileSync(state,'utf8')};
  console.log(JSON.stringify({devices:{fixture:args.includes('booted') && device.state !== 'Booted' ? [] : [device]}}));
} else if (args[1] === 'boot') fs.writeFileSync(state, 'Booted');
else if (args[1] === 'shutdown') fs.writeFileSync(state, 'Shutdown');
`;
  writeFileSync(join(bin, 'xcrun'), fake); chmodSync(join(bin, 'xcrun'), 0o755);
  for (const [name, code] of [['pgrep', 1], ['osascript', 0]] as const) {
    writeFileSync(join(bin, name), `#!/bin/sh\nexit ${code}\n`); chmodSync(join(bin, name), 0o755);
  }
  writeFileSync(join(dir, 'worker.cjs'), `
const fs=require('node:fs'),path=require('node:path'),dir=process.env.SF0D_FIXTURE_DIR,id=process.argv[2];
const lease=()=>fs.readFileSync(path.join(process.env.SIM_LANE_DIR,'SF0D-DEVICE.lease'),'utf8').trim();
const event=kind=>fs.appendFileSync(path.join(dir,'events'),JSON.stringify({kind,id,lease:lease()})+'\\n');
event('start'); const start=Date.now();
const timer=setInterval(()=>{if(id !== 'A' || fs.existsSync(path.join(dir,'release-A')) || Date.now()-start>5000){clearInterval(timer);event('end');process.exit(id==='fail'?7:0);}},20);
`);
  const children: ChildProcess[] = [];
  const env = { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, SIM_LANE_DIR: lane, SF0D_FIXTURE_DIR: dir };
  const launch = (args: string[]) => {
    const child = spawn('bash', ['scripts/sim-lane.sh', ...args], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child); child.stdout.resume(); child.stderr.resume();
    const done = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    return { child, done };
  };
  const run = (id: string, device = 'fixture-phone') => launch(['run', '--max', '1', device, process.execPath, join(dir, 'worker.cjs'), id]);
  const events = (): Event[] => existsSync(join(dir, 'events')) ? readFileSync(join(dir, 'events'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Event) : [];
  const until = async (predicate: () => boolean) => {
    const start = Date.now();
    while (!predicate()) { if (Date.now() - start > 5000) throw new Error('Simulator fixture event timed out'); await sleep(10); }
  };
  const cleanup = () => {
    for (const child of children) if (child.exitCode === null && child.pid !== undefined) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* This owned child already exited. */ }
    }
    rmSync(dir, { recursive: true, force: true });
  };
  return { dir, lane, run, launch, events, until, cleanup };
}

it.runIf(process.platform === 'darwin')('serializes name and UDID callers without overwriting the active lease; a queued release waits too', async () => {
  const f = fixture();
  try {
    const a = f.run('A');
    await f.until(() => f.events().length === 1);
    const lease = readFileSync(join(f.lane, 'SF0D-DEVICE.lease'), 'utf8');
    const b = f.run('B', 'SF0D-DEVICE');
    await sleep(250);
    expect(f.events().map((e) => `${e.id}:${e.kind}`)).toEqual(['A:start']);
    expect(readFileSync(join(f.lane, 'SF0D-DEVICE.lease'), 'utf8')).toBe(lease);
    const release = f.launch(['release', 'SF0D-DEVICE']);
    await sleep(100);
    expect(readFileSync(join(f.dir, 'state'), 'utf8')).toBe('Booted');
    writeFileSync(join(f.dir, 'release-A'), 'go');
    expect(await a.done).toBe(0); expect(await b.done).toBe(0); expect(await release.done).toBe(0);
    expect(f.events().map((e) => `${e.id}:${e.kind}`)).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
    expect(f.events()[0]?.lease).toBe(f.events()[1]?.lease);
    expect(f.events()[2]?.lease).toBe(f.events()[3]?.lease);
    expect(existsSync(join(f.lane, 'SF0D-DEVICE.lease'))).toBe(false);
    expect(readFileSync(join(f.dir, 'state'), 'utf8')).toBe('Shutdown');
  } finally { f.cleanup(); }
}, 15000);

it.runIf(process.platform === 'darwin')('releases the device lock after a failing command and protects active runs from reaping', async () => {
  const f = fixture();
  try {
    const a = f.run('A'); await f.until(() => f.events().length === 1);
    expect(await f.launch(['reap']).done).toBe(0);
    expect(readFileSync(join(f.dir, 'state'), 'utf8')).toBe('Booted');
    writeFileSync(join(f.dir, 'release-A'), 'go'); expect(await a.done).toBe(0);
    expect(await f.run('fail').done).toBe(7);
    expect(await f.run('next').done).toBe(0);
    expect(f.events().map((e) => `${e.id}:${e.kind}`)).toEqual(['A:start', 'A:end', 'fail:start', 'fail:end', 'next:start', 'next:end']);
  } finally { f.cleanup(); }
}, 15000);

it.runIf(process.platform === 'darwin')('waits for a live lease written by a wrapper that predates the device lock', async () => {
  const f = fixture();
  const legacy = spawn(process.execPath, ['-e', 'setTimeout(function(){}, 600)'], { stdio: 'ignore' });
  const legacyDone = new Promise<number | null>((resolve, reject) => { legacy.on('error', reject); legacy.on('close', resolve); });
  try {
    if (legacy.pid === undefined) throw new Error('Legacy owner did not start');
    const lease = `${Math.floor(Date.now() / 1000) + 60} ${legacy.pid}\n`;
    writeFileSync(join(f.lane, 'SF0D-DEVICE.lease'), lease);
    const next = f.run('next'); await sleep(250);
    expect(f.events()).toEqual([]);
    expect(readFileSync(join(f.lane, 'SF0D-DEVICE.lease'), 'utf8')).toBe(lease);
    expect(await legacyDone).toBe(0); expect(await next.done).toBe(0);
    expect(f.events().map((e) => `${e.id}:${e.kind}`)).toEqual(['next:start', 'next:end']);
  } finally { if (legacy.exitCode === null) legacy.kill('SIGKILL'); f.cleanup(); }
}, 15000);
