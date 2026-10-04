// Same-build cold Safari memory readings for SF22d. Simulator-relative evidence, not physical iPhone caps.
// node progress/shard-platform/SF22d-memory.mjs --rev=<sha> --out=<owned scratch>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '../..'), args = process.argv.slice(2);
const flag = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sha = execFileSync('git', ['rev-parse', `${flag('rev', 'HEAD')}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/sp-x3/sf22d-memory-${Date.now()}`));
mkdirSync(out, { recursive: true });
const env = { ...process.env, CLAUDE_CODE_SESSION_ID: `sp-x3-sf22d-memory-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') };
async function run(command, argv, echo = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { cwd: out, env, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = ''; child.stdout.on('data', (data) => { stdout += data; if (echo) process.stdout.write(data); });
    child.on('error', reject); child.on('close', (code) => { resolve({ code, stdout: stdout.trim() }); });
  });
}
const served = await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', sha, '--name', 'sf22d-memory', '--hours', '1']);
if (served.code !== 0) throw new Error(`Preview failed: ${served.code}`);
const base = served.stdout, start = Date.now(), reports = [];
try {
  const version = await (await fetch(`${base}version.json`)).json();
  if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error('Wrong preview build');
  for (const setting of ['off', 'on']) {
    const folder = join(out, setting);
    const measured = await run(join(ROOT, 'scripts/sim-lane.sh'), ['run', '--max', '15', 'frame-floor-iphone-17-pro', process.execPath, join(ROOT, 'scripts/sim-memory.mjs'), `--url=${base}`, '--shards=pine-hollow,driftwood-isle', '--runs=1', '--play=60', '--fly=60', `--setting=memorySaver=${setting}`, `--out=${folder}`], true);
    reports.push({ setting, exitCode: measured.code, ...JSON.parse(readFileSync(join(folder, 'report.json'), 'utf8')) });
  }
  const record = { row: 'SF22d', sha, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000, method: 'Same clean build; cold Safari per shard; 60 seconds play and 60 seconds World Explorer flight. One run per variant/shard, three settled native/Inspector samples per phase. Memory saver seeded through v2 SaveStore before reload and observed settings verified. Native kernel footprint plus Inspector; Simulator-relative only, not physical iPhone memory-cap evidence.', reports };
  writeFileSync(join(out, 'SF22d-memory.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`SF22d memory report ${join(out, 'SF22d-memory.json')}`);
} finally { await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port], true); }
