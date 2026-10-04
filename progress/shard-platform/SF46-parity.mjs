// Fresh parent comparisons for SF46. No stored parity baseline is written or accepted.
// node progress/shard-platform/SF46-parity.mjs --current=<sha> --parent=f49cebb7c --out=<owned scratch>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture, weatherLeak } from '../../scripts/parity.mjs';
import { browserPool } from '../../scripts/parity/pool.mjs';
import { compare } from '../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../scripts/parity/record.mjs';
import { array, object, string, get } from '../../scripts/parity/value.mjs';
import { saveFixture } from '../../scripts/debug-settings.mjs';
const ROOT = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const rev = (value) => execFileSync('git', ['rev-parse', `${value}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
const current = rev(flag('current', 'HEAD')), parent = rev(flag('parent', 'f49cebb7c'));
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/sp-x1/sf46-parity-${Date.now()}`));
mkdirSync(out, { recursive: true });
const shards = flag('shards', '_template,driftwood-isle,pine-hollow,nalati-grasslands,sunscar-dunes,far-reach,nine-dragon-stack').split(',');
const hybrid = flag('hybrid', 'off');
if (!['off', 'on'].includes(hybrid)) throw new Error('--hybrid must be off or on');
const pool = browserPool(ROOT, 1, 'metal'), records = {}, reports = [];
const start = Date.now();
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: out, env: { ...process.env, CLAUDE_CODE_SESSION_ID: `sp-x1-sf46-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') }, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = ''; child.stdout.on('data', (data) => { stdout += data; });
    child.on('error', reject); child.on('close', (code) => { if (code !== 0) reject(new Error(`${command} exited ${code}`)); else resolve(stdout.trim()); });
  });
}
try {
  for (const [label, sha] of [['parent', parent], ['current', current]]) {
    const url = await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `sf46-${label}`, '--hours', '1']);
    const base = String(url).replace(/\/$/u, '');
    try {
      const version = await (await fetch(`${base}/version.json`)).json();
      if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error('Preview identity mismatch');
      const browser = await pool.browser(0);
      const captureBrowser = hybrid === 'on' ? {
        version: () => browser.version(),
        newContext: async (options) => {
          const context = await browser.newContext(options);
          await saveFixture(context, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: 'on' });
          return context;
        },
      } : browser;
      for (const setting of ['off']) for (const shard of shards) for (const tier of ['phone', 'desktop']) {
        const folder = join(out, `${label}-${setting}-${shard}-${tier}`); mkdirSync(folder, { recursive: true });
        const opts = { shard, tier, lane: 'm5', sha, root: ROOT, out: folder, timeout: 240, full: true, only: undefined, offline: false, accelerated: true, settings: { memorySaver: setting } };
        const record = await capture(captureBrowser, base, opts);
        if (['pine-hollow', 'nalati-grasslands'].includes(shard)) object(record.leak).weather = await weatherLeak(captureBrowser, base, opts);
        const key = `${setting}/${shard}/${tier}`;
        records[`${label}/${key}`] = record;
        writeFileSync(join(folder, 'capture.json'), JSON.stringify(record, null, 2) + '\n');
        console.log(`SF46 captured ${label}/${key}`);
      }
    } finally { await pool.release(0); await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port]); }
  }
  const browser = await pool.browser(0), context = await browser.newContext(), scorePage = await context.newPage();
  try {
    for (const setting of ['off']) for (const shard of shards) for (const tier of ['phone', 'desktop']) {
      const key = `${setting}/${shard}/${tier}`;
      const baseline = await aggregate(scorePage, [records[`parent/${key}`]], { sha: parent, browser: browser.version() });
      const record = records[`current/${key}`], images = [];
      for (const pose of array(record.poses)) {
        const p = object(pose), name = string(p.name), before = object(object(baseline.poses)[name]);
        const masks = [...array(before.boxes), ...array(p.boxes)];
        const score = await imageScore(scorePage, string(before.shot), string(p.shot), masks);
        p.ssim = score.ssim; images.push({ name, ssim: score.ssim, full: score.full, masked: score.masked, note: score.note });
      }
      // Existing approved ambient information entry, also used by the main parity harness.
      const result = compare(baseline, record, { ambientInfo: ['forest.thrall'] });
      reports.push({ setting, shard, tier, verdict: result.verdict, images, differences: result.rows.filter((r) => r.verdict === 'red' || r.verdict === 'new'), checks: result.rows.filter((r) => r.class === 'D'), parent: records[`parent/${key}`], current: record });
      console.log(`SF46 ${key}: ${result.verdict}, images ${images.map((i) => `${i.name}=${i.ssim}`).join(', ')}`);
    }
  } finally { await context.close(); }
  const record = { row: 'SF46', parent, current, hybridDebugFixture: hybrid, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    method: 'Fresh pinned parent and current captures using scripts/parity.mjs capture()/weatherLeak(), compare(), aggregate() and masked imageScore(). Memory saver OFF. Metal poses, full walk/combat/pause/resume/unload; seeded accelerated clock. No stored baseline writes. Phone tier is emulated Chromium, not Safari.',
    ambientInfo: ['forest.thrall'], reports };
  writeFileSync(join(out, 'SF46-parity.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`Report ${join(out, 'SF46-parity.json')}`);
  if (reports.some((report) => report.verdict !== 'green')) process.exitCode = 2;
} finally { await pool.close(); }
