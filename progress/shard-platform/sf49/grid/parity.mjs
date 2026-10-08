// SF49 generic cadence / fall-floor correction: fresh pinned standalone parent and candidate, no golden writes.
// browserPool owns the one muted browser-lane slot. node parity.mjs <parent-url> <current-url> <scratch-out>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture } from '../../../../scripts/parity.mjs';
import { browserPool } from '../../../../scripts/parity/pool.mjs';
import { compare } from '../../../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../../../scripts/parity/record.mjs';

const [parentURL, currentURL, output] = process.argv.slice(2);
if (!parentURL || !currentURL || !output) throw new Error('Expected pinned parent/current URLs and scratch output');
const root = resolve(import.meta.dirname, '../../../..'), out = resolve(output);
mkdirSync(out, { recursive: true });
const report = { method: 'scripts/parity.mjs full standalone capture, aggregate, compare and masked imageScore on both tiers. Metal, seeded accelerated clock, Memory saver OFF; fresh parent and current, no stored golden writes.',
  parent: await (await fetch(new URL('version.json', parentURL))).json(), current: await (await fetch(new URL('version.json', currentURL))).json(), pairs: [] };
const pool = browserPool(root, 1, 'metal'), started = Date.now();
const save = () => writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
try {
  const browser = await pool.browser(0), records = {};
  for (const [label, url] of [['parent', parentURL], ['current', currentURL]]) for (const tier of ['phone', 'desktop']) {
    const folder = join(out, `${label}-${tier}`); mkdirSync(folder, { recursive: true });
    records[`${label}-${tier}`] = await capture(browser, url.replace(/\/$/u, ''), { shard: 'far-reach', tier, lane: 'm5', sha: report[label].build,
      root, out: folder, timeout: 240, full: true, offline: false, accelerated: true, settings: { memorySaver: 'off' } });
    writeFileSync(join(folder, 'capture.json'), `${JSON.stringify(records[`${label}-${tier}`], null, 2)}\n`);
    console.log(`Captured ${label}/${tier}`);
  }
  const context = await browser.newContext(), page = await context.newPage();
  try {
    for (const tier of ['phone', 'desktop']) {
      const before = records[`parent-${tier}`], after = records[`current-${tier}`];
      const baseline = await aggregate(page, [before], { sha: report.parent.build, browser: browser.version() }), images = [];
      for (const pose of after.poses ?? []) {
        const previous = baseline.poses[pose.name];
        if (!previous) throw new Error('Missing parent pose ' + pose.name);
        const score = await imageScore(page, previous.shot, pose.shot, [...(previous.boxes ?? []), ...(pose.boxes ?? [])]);
        pose.ssim = score.ssim; images.push({ name: pose.name, ...score });
      }
      const result = compare(baseline, after, { ambientInfo: ['forest.thrall'] });
      report.pairs.push({ tier, verdict: result.verdict, images, result, before, after }); save();
      console.log(JSON.stringify({ tier, verdict: result.verdict, images: images.map(({ name, ssim }) => ({ name, ssim })) }));
    }
  } finally { await context.close(); }
  report.pass = report.pairs.length === 2 && report.pairs.every(pair => pair.verdict === 'green');
  if (!report.pass) process.exitCode = 1;
} catch (error) { report.failure = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
finally { await pool.close(); report.closed = true; report.seconds = (Date.now() - started) / 1000; save(); }
