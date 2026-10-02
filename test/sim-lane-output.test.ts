// oxlint-disable-next-line import/no-nodejs-modules -- This Node-only regression exercises the Simulator lane's real shell watchdog.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Child-process pipe closure is the regression being measured.
import { spawn } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The failing shell's isolated process group must be cleaned up on timeout.
import process from 'node:process';
import { expect, it } from 'vitest';

it('closes Simulator lane output when the command finishes, before its watchdog deadline', async () => {
  // Exercise the real watchdog and cleanup lines without booting or reserving a Simulator.
  const source = readFileSync(new URL('../scripts/sim-lane.sh', import.meta.url), 'utf8');
  const watchdog = source.split('\n').find((line) => line.includes('( sleep $((max * 60))'));
  const cleanup = source.split('\n').find((line) => line.includes('kill "$timer" 2>/dev/null'));
  if (!watchdog || !cleanup) throw new Error('Simulator watchdog/cleanup lines missing');
  const script = `max=1; dev=test; log() { :; }; sleep 0.1 & child=$!\n${watchdog}\nwait "$child"; rc=$?\n${cleanup}\nexit "$rc"`;
  const started = Date.now();
  const child = spawn('bash', ['-c', script], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume(); child.stderr.resume();
  const timer = setTimeout(() => { if (child.pid) process.kill(-child.pid, 'SIGKILL'); }, 2500);
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    expect(code).toBe(0);
    expect(Date.now() - started).toBeLessThan(2000);
  } finally { clearTimeout(timer); }
});
