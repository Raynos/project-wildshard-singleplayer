// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shell reservation and reaper boundary.
import { spawn, type ChildProcess } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- This fixture owns and removes only its private temporary files.
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use canonical temporary paths as the production reaper does.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths can contain spaces.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Kill only the fixture's owned process groups.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Wait for a blocked build's observable marker.
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, it } from 'vitest';

it('protects a build directory from the reaper before the preview process starts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf0-serve-'));
  const bin = join(dir, 'bin'), scripts = join(dir, 'scripts'), registry = join(dir, 'registry'), builds = join(dir, 'builds');
  const children: ChildProcess[] = [];
  try {
    for (const path of [bin, scripts, registry, builds, join(dir, 'public')]) mkdirSync(path);
    for (const name of ['serve-build.sh', 'browser-lane.sh', 'heavy-lane.py']) copyFileSync(`scripts/${name}`, join(scripts, name));
    writeFileSync(join(scripts, 'gen.mjs'), '');
    writeFileSync(join(scripts, 'build-shardfiles.mjs'), `import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('public/shardfiles/_template',{recursive:true});
writeFileSync('public/shardfiles/_template/shard.json',JSON.stringify({version:0}));`);
    const executable = (name: string, source: string) => { const path = join(bin, name); writeFileSync(path, source); chmodSync(path, 0o755); };
    executable('pgrep', '#!/bin/sh\nexit 1\n');
    executable('ps', '#!/bin/sh\nif [ "$1" = "-o" ] && [ "$2" = "pgid=" ]; then cat "$SF0_SERVE_FIXTURE/preview-pid"; fi\n');
    executable('lsof', '#!/bin/sh\nif [ -f "$SF0_SERVE_FIXTURE/preview-pid" ]; then cat "$SF0_SERVE_FIXTURE/preview-pid"; else exit 1; fi\n');
    executable('curl', '#!/bin/sh\nexit 0\n');
    executable('pnpm', `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),dir=process.env.SF0_SERVE_FIXTURE;
if(process.argv.includes('preview')) { fs.writeFileSync(path.join(dir,'preview-pid'),String(process.pid)); setInterval(()=>{},1000); }
else {
 if(!fs.existsSync(path.join(dir,'public/shardfiles/_template/shard.json'))) throw new Error('Vite started before shardfile products were built');
 const config=fs.readFileSync(process.argv[process.argv.indexOf('--config')+1],'utf8');
 const out=/outDir: '([^']+)'/.exec(config)[1];
 fs.writeFileSync(path.join(dir,'building'),out);
 const timer=setInterval(()=>{if(fs.existsSync(path.join(dir,'resume'))){fs.mkdirSync(out,{recursive:true});clearInterval(timer);}},10);
}
`);
    const env = { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, SERVE_REG_DIR: registry, SERVE_BUILD_DIR: builds, SF0_SERVE_FIXTURE: dir, WS_HEAVY_ROOT: join(dir, 'fixture-lane'), WS_HEAVY_TOKEN: '', WS_HEAVY_GATE: '', CLAUDE_CODE_SESSION_ID: 'sf0-reservation-fixture' };
    const launch = (script: string, args: string[]) => {
      const child = spawn('bash', [join(scripts, script), ...args], { cwd: dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      children.push(child);
      let output = ''; child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); }); child.stderr.resume();
      const done = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
      return { done, output: () => output };
    };
    const build = launch('serve-build.sh', ['--port', '4999', '--hours', '1', '--name', 'reservation']);
    const started = Date.now();
    while (!existsSync(join(dir, 'building'))) { if (Date.now() - started > 5000) throw new Error('Fixture build did not start'); await sleep(10); }
    const entry = readFileSync(join(registry, '4999'), 'utf8').trim().split(' ');
    const activeDir = entry[2];
    if (activeDir === undefined) throw new Error('Missing reservation directory');
    expect(existsSync(activeDir)).toBe(true);
    expect(await launch('browser-lane.sh', ['reap']).done).toBe(0);
    expect(existsSync(activeDir)).toBe(true);
    writeFileSync(join(dir, 'resume'), 'go');
    expect(await build.done).toBe(0);
    expect(build.output()).toContain('http://127.0.0.1:4999/');
    expect(existsSync(readFileSync(join(dir, 'building'), 'utf8'))).toBe(true);
    const product = join(readFileSync(join(dir, 'building'), 'utf8'), 'shardfiles/_template/shard.json');
    expect(JSON.parse(readFileSync(product, 'utf8'))).toEqual({ version: 0 });
    expect(await launch('serve-build.sh', ['stop', '4999']).done).toBe(0);
  } finally {
    for (const child of children) if (child.exitCode === null && child.pid !== undefined) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* The owned process already exited. */ }
    }
    // A detached preview outlives its build shell; its registry records only this fixture's PID.
    const entry = join(registry, '4999');
    if (existsSync(entry)) { const pid = Number(readFileSync(entry, 'utf8').split(' ')[0]); if (pid > 0) try { process.kill(pid, 'SIGKILL'); } catch { /* Already stopped. */ } }
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
