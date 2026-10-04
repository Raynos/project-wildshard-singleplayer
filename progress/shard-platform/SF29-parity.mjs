// Fresh SF29 parent comparisons. Never writes or accepts a stored parity baseline.
// node progress/shard-platform/SF29-parity.mjs --current=<green sha> --out=<owned scratch>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture, weatherLeak } from '../../scripts/parity.mjs';
import { browserPool } from '../../scripts/parity/pool.mjs';
import { compare } from '../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../scripts/parity/record.mjs';
import { array, object, string } from '../../scripts/parity/value.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const rev = value => execFileSync('git', ['rev-parse', `${value}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
const current = rev(flag('current', 'origin/main'));
const parents = {
  'driftwood-isle': 'fba9cbf58^', 'pine-hollow': '2cdce8175^',
  'nalati-grasslands': '8e570b420^', 'nine-dragon-stack': '363fd5557^',
  'far-reach': 'e22054602^', 'sunscar-dunes': 'ed8654f91^',
};
const shards = flag('shards', Object.keys(parents).join(',')).split(',');
if (shards.some(shard => !Object.hasOwn(parents, shard))) throw new Error('Unknown SF29 shard');
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/sp-x3/sf29-parity`));
mkdirSync(out, { recursive: true });
const pool = browserPool(ROOT, 1, 'metal'), records = {}, reports = [];
const start = Date.now();
async function run(command, values) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, values, { cwd: out, env: { ...process.env,
      CLAUDE_CODE_SESSION_ID: `sp-x3-sf29-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') }, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = ''; child.stdout.on('data', data => { stdout += data; });
    child.on('error', reject); child.on('close', code => {
      if (code !== 0) reject(new Error(`${command} exited ${code}`)); else resolve(stdout.trim());
    });
  });
}
async function measure(label, sha, selected) {
  const base = String(await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `sf29-${label}`, '--hours', '1'])).replace(/\/$/u, '');
  try {
    const version = await (await fetch(`${base}/version.json`)).json();
    if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error('Preview identity mismatch');
    const browser = await pool.browser(0);
    for (const shard of selected) for (const tier of ['phone', 'desktop']) {
      const folder = join(out, `${label}-${shard}-${tier}`); mkdirSync(folder, { recursive: true });
      const opts = { shard, tier, lane: 'm5', sha, root: ROOT, out: folder, timeout: 240,
        full: true, only: undefined, offline: false, accelerated: true, settings: { memorySaver: 'off' } };
      const record = await capture(browser, base, opts);
      if (['pine-hollow', 'nalati-grasslands'].includes(shard) && record.leak) object(record.leak).weather = await weatherLeak(browser, base, opts);
      records[`${label}/${shard}/${tier}`] = record;
      writeFileSync(join(folder, 'capture.json'), JSON.stringify(record, null, 2) + '\n');
      console.log(`SF29 captured ${label}/${shard}/${tier}`);
    }
  } finally {
    await pool.release(0);
    await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port]);
  }
}
try {
  for (const shard of shards) await measure(`parent-${shard}`, rev(parents[shard]), [shard]);
  await measure('current', current, shards);
  const browser = await pool.browser(0), context = await browser.newContext(), page = await context.newPage();
  try {
    for (const shard of shards) for (const tier of ['phone', 'desktop']) {
      const parent = rev(parents[shard]);
      const before = records[`parent-${shard}/${shard}/${tier}`], record = records[`current/${shard}/${tier}`];
      const baseline = await aggregate(page, [before], { sha: parent, browser: browser.version() });
      const images = [];
      for (const pose of array(record.poses)) {
        const p = object(pose), name = string(p.name), previous = object(object(baseline.poses)[name]);
        const score = await imageScore(page, string(previous.shot), string(p.shot), [...array(previous.boxes), ...array(p.boxes)]);
        p.ssim = score.ssim; images.push({ name, ...score, diffBase64: undefined });
      }
      // The shared harness's existing ambient information entry; no new exclusion.
      const result = compare(baseline, record, { ambientInfo: ['forest.thrall'] });
      reports.push({ shard, tier, parent, verdict: result.verdict, images,
        differences: result.rows.filter(row => row.verdict === 'red' || row.verdict === 'new'),
        checks: result.rows.filter(row => row.class === 'D'), before, current: record });
      console.log(`SF29 ${shard}/${tier}: ${result.verdict}`);
    }
  } finally { await context.close(); }
  const report = { row: 'SF29', current, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    method: 'Fresh pre-audio parent and current pinned builds; shared capture/weatherLeak/aggregate/imageScore/compare. Both tiers, full poses/walk/combat/pause/unload, Metal, seeded accelerated clock, Memory saver OFF, default boot variants. Emulated phone Chromium; Safari is measured separately by frame-floor. No stored baseline writes or new quarantine.',
    reports };
  writeFileSync(join(out, 'SF29-parity.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Report ${join(out, 'SF29-parity.json')}`);
  if (reports.some(report => report.verdict !== 'green')) process.exitCode = 2;
} finally { await pool.close(); }
