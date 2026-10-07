#!/usr/bin/env node
// G187 (E435): Pine Hollow parent build vs candidate build, the same Pine memory trim row on both (adapted from
// progress/shard-platform/sf47/parity.mjs, which compares two rows on one build). Trim off isolates the invisible cuts
// (view distance B applies only with the trim on); trim on adds view distance B (Jake's pick, a visible change).
// Both builds are served by the caller (scripts/serve-build.sh --rev <sha>).
// scripts/browser-lane.sh node progress/shard-platform/g187/parity.mjs --parent=<sha> --parent-url=<url> --current=<sha> --current-url=<url> [--trim=off] [--tiers=phone,desktop] [--out=<scratch>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture } from '../../../scripts/parity.mjs';
import { browserPool } from '../../../scripts/parity/pool.mjs';
import { compare } from '../../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../../scripts/parity/record.mjs';
import { array, object, string } from '../../../scripts/parity/value.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const ROOT = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const parent = flag('parent', ''), current = flag('current', ''), urls = { parent: flag('parent-url', ''), current: flag('current-url', '') };
if (!parent || !current || !urls.parent || !urls.current) throw new Error('need --parent / --parent-url / --current / --current-url');
const TRIM = flag('trim', 'off'), tiers = flag('tiers', 'phone,desktop').split(','), shard = 'pine-hollow', KEY = 'debug.plugin.pine-hollow.pineMemoryTrim';
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/g187/parity-${TRIM}-${Date.now()}`));
mkdirSync(out, { recursive: true });
const pool = browserPool(ROOT, 1, 'metal'), records = {}, reports = [];
const start = Date.now();
try {
  for (const [label, sha] of [['parent', parent], ['current', current]]) {
    const base = urls[label].replace(/\/$/u, '');
    const version = await (await fetch(`${base}/version.json`)).json();
    if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error(`Preview identity mismatch for ${label}`);
    const browser = await pool.browser(0);
    const captureBrowser = {
      version: () => browser.version(),
      newContext: async (options) => {
        const context = await browser.newContext(options);
        await saveFixture(context, { scope: 'device', key: KEY, data: TRIM });
        return context;
      },
    };
    try {
      for (const tier of tiers) {
        const folder = join(out, `${label}-${tier}`); mkdirSync(folder, { recursive: true });
        const opts = { shard, tier, lane: 'm5', sha, root: ROOT, out: folder, timeout: 240, full: true, only: undefined, offline: false, accelerated: true, settings: { memorySaver: 'off' } };
        const record = await capture(captureBrowser, base, opts);
        records[`${label}/${tier}`] = record;
        writeFileSync(join(folder, 'capture.json'), JSON.stringify(record, null, 2) + '\n');
        console.log(`g187 captured ${label}/${tier} heapMB=${record.boot?.heapMB}`);
      }
    } finally { await pool.release(0); }
  }
  const browser = await pool.browser(0), context = await browser.newContext(), scorePage = await context.newPage();
  try {
    for (const tier of tiers) {
      const baseline = await aggregate(scorePage, [records[`parent/${tier}`]], { sha: parent, browser: browser.version() });
      const record = records[`current/${tier}`], images = [];
      for (const pose of array(record.poses)) {
        const p = object(pose), name = string(p.name), before = object(object(baseline.poses)[name]);
        const masks = [...array(before.boxes), ...array(p.boxes)];
        const score = await imageScore(scorePage, string(before.shot), string(p.shot), masks);
        p.ssim = score.ssim; images.push({ name, ssim: score.ssim, full: score.full, masked: score.masked, note: score.note });
      }
      const result = compare(baseline, record, { ambientInfo: ['forest.thrall'] });
      reports.push({ tier, verdict: result.verdict, images, differences: result.rows.filter((r) => r.verdict === 'red' || r.verdict === 'new') });
      console.log(`g187 trim ${TRIM} ${tier}: ${result.verdict}, images ${images.map((i) => `${i.name}=${i.ssim}`).join(', ')}`);
    }
  } finally { await context.close(); }
  const slim = { row: `G187 parent vs candidate, Pine memory trim ${TRIM} on both`, parent, current, trim: TRIM, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    method: 'Fresh parent and current captures using scripts/parity.mjs capture(), compare(), aggregate() and masked imageScore(). Memory saver OFF. Metal poses, full walk/combat/pause/resume/unload; seeded accelerated clock. Phone tier is emulated Chromium (iPhone 16 Pro), not Safari.',
    reports: reports.map((r) => ({ tier: r.tier, verdict: r.verdict, images: r.images.map((i) => ({ name: i.name, ssim: i.ssim, note: i.note })), differences: r.differences.map((d) => ({ path: d.path, verdict: d.verdict, before: d.before, after: d.after })) })) };
  const summary = join(ROOT, 'progress/shard-platform/g187', `parity-${current.slice(0, 9)}-trim-${TRIM}.json`);
  writeFileSync(summary, JSON.stringify(slim, null, 2) + '\n'); console.log(`Summary ${summary}`);
  if (reports.some((report) => report.verdict !== 'green')) process.exitCode = 2;
} finally { await pool.close(); }
