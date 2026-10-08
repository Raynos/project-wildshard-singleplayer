// One owned device, cold-erased only while shut down. sim-lane serializes each pair behind other owners.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { safariReport } from './safari-data.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = arg('out');
if (!output) throw new Error('Requires --out and both arms base/pin/dist');
const root = fileURLToPath(new URL('../../', import.meta.url)), out = resolvePath(output);
mkdirSync(out, { recursive: true });
const args = ['before', 'before-pin', 'before-dist', 'after', 'after-pin', 'after-dist'].map(name => {
  const value = arg(name); if (!value) throw new Error(`Requires --${name}`); return `--${name}=${value}`;
});
const runtimes = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'runtimes', '-j'], { encoding: 'utf8' })).runtimes;
const runtime = runtimes.findLast(row => row.platform === 'iOS' && row.isAvailable);
if (!runtime) throw new Error('No available iOS Simulator runtime');
const device = execFileSync('xcrun', ['simctl', 'create', `x5-sf67-${process.pid}`, 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro', runtime.identifier], { encoding: 'utf8' }).trim();
writeFileSync(resolvePath(out, 'device.json'), JSON.stringify({ device, runtime, createdBy: process.pid, createdAt: new Date().toISOString(), policy: 'one owned device, erased while shut down before each shard pair' }, null, 2));
try {
  const shards = (arg('shards') ?? 'driftwood-isle,nalati-grasslands,_template,pine-hollow,far-reach,sunscar-dunes,nine-dragon-stack').split(',');
  const repeats = Number(arg('repeats') ?? 2);
  if (!Number.isInteger(repeats) || repeats < 2 || repeats > 4) throw new Error('Requires two to four interleaved AB/BA pairs per shard');
  const pairs = shards.flatMap(shard => Array.from({ length: repeats }, (_, repeat) => ({ shard, repeat: repeat + 1 })));
  for (const [index, { shard, repeat }] of pairs.entries()) {
    if (index > 0) execFileSync('xcrun', ['simctl', 'erase', device]); // this exact UDID was created above, never a shared device
    const startedAt = new Date().toISOString(), loadStart = loadavg();
    await new Promise((resolve, reject) => {
      const child = spawn(`${root}/scripts/sim-lane.sh`, ['run', '--max', '15', device, process.execPath, `${root}/scripts/loading-benchmark/safari.mjs`, ...args, `--shard=${shard}`, `--repeat=${repeat}`, `--order=${repeat % 2 === 0 ? 'after' : 'before'}`, `--out=${out}`], { stdio: 'inherit' });
      child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Simulator pair exited ${code}`)));
    });
    writeFileSync(resolvePath(out, `r${repeat}-${shard}-load.json`), JSON.stringify({ shard, repeat, order: repeat % 2 === 0 ? 'BA' : 'AB', startedAt, endedAt: new Date().toISOString(), loadStart, loadEnd: loadavg(), note: 'Load above 30 is flagged, not treated as a quiet or isolated pair.' }, null, 2));
  }
  const captures = readdirSync(out).filter(name => /^r[1-4]-(before|after)-.*-(cold|warm)\.json$/u.test(name)).map(name => { const capture = JSON.parse(readFileSync(resolvePath(out, name), 'utf8')); capture.arm = name.includes('-before-') ? 'before' : 'after'; return capture; });
  for (const arm of ['before', 'after']) writeFileSync(resolvePath(out, `${arm}-report.json`), `${JSON.stringify(safariReport(arg(`${arm}-pin`), captures.filter(row => row.arm === arm)), null, 2)}\n`);
} finally {
  // sim-lane completed/shut down this owned device. No shared Simulator or preview is stopped here.
  execFileSync('xcrun', ['simctl', 'delete', device]);
}
