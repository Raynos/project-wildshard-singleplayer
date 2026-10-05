// G180 (E435, from SF47-g's parity.mjs): one build, Pine Hollow's pineMemoryTrim row A vs B with GPU textures forced to KTX2 (the phone's steady state, so B2's ASTC 6×6 overlay is in the frame).
// A=off B=off is Pine's same-build noise floor; A=off B=on is the trim's evidence.
// scripts/browser-lane.sh node progress/shard-platform/g180/parity.mjs [--current=<sha>] [--a=off] [--b=on] [--out=<owned scratch>]
// Captures go to --out (scratch); the slim verdict + per-pose SSIM summary is written to
// progress/shard-platform/g180/parity-<sha>-<a>-<b>.json.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture, weatherLeak } from '../../../scripts/parity.mjs';
import { browserPool } from '../../../scripts/parity/pool.mjs';
import { compare } from '../../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../../scripts/parity/record.mjs';
import { array, object, string, get } from '../../../scripts/parity/value.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const ROOT = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const rev = (value) => execFileSync('git', ['rev-parse', `${value}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
const current = rev(flag('current', 'HEAD')), parent = current;
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/pine-g180/parity-${Date.now()}`));
mkdirSync(out, { recursive: true });
const shards = flag('shards', 'pine-hollow').split(',');
const A = flag('a', 'off'), B = flag('b', 'on'), KEY = 'debug.plugin.pine-hollow.pineMemoryTrim';
if (![A, B].every((v) => ['off', 'on'].includes(v))) throw new Error('--a / --b must be off or on');
const pool = browserPool(ROOT, 1, 'metal'), records = {}, reports = [];
const start = Date.now();
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: out, env: { ...process.env, CLAUDE_CODE_SESSION_ID: `g180-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') }, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = ''; child.stdout.on('data', (data) => { stdout += data; });
    child.on('error', reject); child.on('close', (code) => { if (code !== 0) reject(new Error(`${command} exited ${code}`)); else resolve(stdout.trim()); });
  });
}
try {
  const url = await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', current, '--name', 'g180', '--hours', '1']);
  const base = String(url).replace(/\/$/u, '');
  try {
    const version = await (await fetch(`${base}/version.json`)).json();
    if (!JSON.stringify(version).includes(current.slice(0, 7))) throw new Error('Preview identity mismatch');
    for (const [label, row] of [['parent', A], ['current', B]]) {
      const browser = await pool.browser(0);
      const captureBrowser = {
        version: () => browser.version(),
        newContext: async (options) => {
          const context = await browser.newContext(options);
          await saveFixture(context, { scope: 'device', key: KEY, data: row });
          return context;
        },
      };
      try {
        for (const setting of ['off']) for (const shard of shards) for (const tier of ['phone', 'desktop']) {
          const folder = join(out, `${label}-${setting}-${shard}-${tier}`); mkdirSync(folder, { recursive: true });
          const opts = { shard, tier, lane: 'm5', sha: current, root: ROOT, out: folder, timeout: 240, full: true, only: undefined, offline: false, accelerated: true, settings: { memorySaver: setting, tex: 'ktx2' } };
          const record = await capture(captureBrowser, base, opts);
          const key = `${setting}/${shard}/${tier}`;
          records[`${label}/${key}`] = record;
          writeFileSync(join(folder, 'capture.json'), JSON.stringify(record, null, 2) + '\n');
          console.log(`sf47 captured ${label}(${row})/${key} heapMB=${record.boot?.heapMB}`);
        }
      } finally { await pool.release(0); }
    }
  } finally { await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port]); }
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
      console.log(`sf47 ${key}: ${result.verdict}, images ${images.map((i) => `${i.name}=${i.ssim}`).join(', ')}`);
    }
  } finally { await context.close(); }
  const record = { row: `G180 pineMemoryTrim ${A} vs ${B}`, parent, current, a: A, b: B, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    method: 'Fresh pinned parent and current captures using scripts/parity.mjs capture()/weatherLeak(), compare(), aggregate() and masked imageScore(). Memory saver OFF. Metal poses, full walk/combat/pause/resume/unload; seeded accelerated clock. No stored baseline writes. Phone tier is emulated Chromium, not Safari.',
    ambientInfo: ['forest.thrall'], reports };
  writeFileSync(join(out, 'sf47-parity.json'), JSON.stringify(record, null, 2) + '\n');
  const slim = { ...record, reports: reports.map((r) => ({ setting: r.setting, shard: r.shard, tier: r.tier, verdict: r.verdict, images: r.images.map((i) => ({ name: i.name, ssim: i.ssim, note: i.note })), differences: r.differences.map((d) => ({ path: d.path, verdict: d.verdict, before: d.before, after: d.after })), heapMB: { off: r.parent?.boot?.heapMB ?? null, on: r.current?.boot?.heapMB ?? null } })) };
  const summary = join(ROOT, 'progress/shard-platform/g180', `parity-${current.slice(0, 9)}-${A}-${B}.json`);
  writeFileSync(summary, JSON.stringify(slim, null, 2) + '\n'); console.log(`Summary ${summary}`);
  console.log(`Report ${join(out, 'sf47-parity.json')}`);
  if (reports.some((report) => report.verdict !== 'green')) process.exitCode = 2;
} finally { await pool.close(); }
