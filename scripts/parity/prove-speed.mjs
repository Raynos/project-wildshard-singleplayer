#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { capture, weatherLeak } from '../parity.mjs';
import { shardFolders } from '../gen-shards.mjs';
import { cachedTree, serve } from './serve.mjs';
import { browserPool, parallel } from './pool.mjs';
import { aggregate, imageScore } from './record.mjs';
import { compare, normalize } from './compare.mjs';
import { array, get, object, string } from './value.mjs';

// Same SHA, observers, poses and frame/input trajectories; only callback pacing changes. No repo baselines written.
const root = resolve(import.meta.dirname, '../..');
/** @type {Record<string,string|undefined>} */ const opts = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const sha = opts.export ?? '', jobs = Number(opts.jobs ?? 3), tiers = (opts.tiers ?? 'phone,desktop').split(',');
if (!/^[a-f0-9]{40}$/.test(sha) || !Number.isInteger(jobs) || jobs < 1 || jobs > 8 || tiers.some((tier) => !['phone', 'desktop'].includes(tier)) || (opts.fixture !== undefined && opts.fixture !== 'telemetry')) throw new Error('usage: prove-speed --export=<full SHA> [--jobs=3] [--tiers=phone,desktop] [--fixture=telemetry] [--out=<dir>]');
const out = resolve(opts.out ?? `/tmp/wildshard-speed-proof-${sha.slice(0,7)}`); mkdirSync(out, { recursive: true });
const started = performance.now(), exported = await cachedTree(root, sha), preview = await serve(exported.tree, sha, true), pool = browserPool(root, jobs, 'metal');
/** @type {Record<string,number|boolean>} */ const timings = { cacheHit: exported.hit, buildMs: performance.now() - started };
/** @type {string[]} */ const shards = opts.shards ? opts.shards.split(',') : shardFolders(exported.tree);
const pairs = shards.flatMap((shard) => tiers.map((tier) => ({ shard, tier })));
/** @type {Map<string,import('./value.mjs').RecordValue[]>} */ const records = new Map();
try {
  for (const clock of ['raf', 'fast']) {
    const begin = performance.now();
    const tasks = pairs.flatMap((pair) => Array.from({ length: 3 }, (_, run) => ({ ...pair, run })));
    const results = await parallel(tasks, jobs, async (task, _, slot) => {
      if(clock==='raf'&&opts['reuse-native']){
        const source=join(opts['reuse-native'],`run-${task.run+1}`,`${task.shard}.${task.tier}`);
        const captured=object(JSON.parse(readFileSync(`${source}.raw.json`,'utf8'))),boot=object(captured.boot);
        if(boot.sha!==sha||boot.shard!==task.shard||boot.tier!==task.tier||boot.lane!=='m5')throw new Error(`infrastructure: incompatible native proof capture ${source}`);
        return {key:`${task.shard}.${task.tier}`,captured};
      }
      const browser = await pool.browser(slot), dir = join(out, clock, `run-${task.run+1}`); mkdirSync(dir, { recursive: true });
      const options = { ...task, lane: 'm5', sha, root: exported.tree, out: dir, timeout: 240, full: false, only: undefined, offline: false, accelerated: clock === 'fast', telemetryFixture:opts.fixture==='telemetry' };
      const captured = object(await capture(browser, preview.url, options));
      if (captured.leak && ['pine-hollow', 'nalati-grasslands'].includes(task.shard)) object(captured.leak).weather = object(await weatherLeak(browser, preview.url, options));
      writeFileSync(join(dir, `${task.shard}.${task.tier}.raw.json`), JSON.stringify(captured, null, 2));
      return { key: `${task.shard}.${task.tier}`, captured };
    }, (slot) => pool.release(slot));
    timings[`${clock}Ms`] = performance.now() - begin;
    for (const { shard, tier } of pairs) records.set(`${clock}/${shard}.${tier}`, results.filter((r) => r.key === `${shard}.${tier}`).map((r) => r.captured));
  }
  const browser = await pool.browser(0), context = await browser.newContext(), page = await context.newPage();
  try {
    const summary = [];
    for (const { shard, tier } of pairs) {
      const key = `${shard}.${tier}`, nativeRuns = records.get(`raf/${key}`) ?? [], fastRuns = records.get(`fast/${key}`) ?? [];
      const baseline = await aggregate(page, nativeRuns, { sha, browser: browser.version() });
      const current = await aggregate(page, fastRuns, { sha, browser: browser.version() });
      const checked = [];
      const modes=/** @type {[string,import('./value.mjs').RecordValue[]][]} */([['raf',nativeRuns],['fast',fastRuns]]);
      for (const [mode, runs] of modes) for (const [index, raw] of runs.entries()) {
        const record = normalize(raw);
        for (const [name, value] of Object.entries(object(record.poses))) {
          const pose = object(value), original = object(get(baseline, `poses.${name}`));
          const score = await imageScore(page, string(original.shot), string(pose.shot), [.../** @type {number[][]} */(array(original.boxes)), .../** @type {number[][]} */(array(pose.boxes))]);
          pose.ssim = score.ssim ?? 0;
          if (score.diffBase64 && pose.ssim < 0.99) writeFileSync(join(out, `${key}.${mode}.${index+1}.${name}.diff.png`), Buffer.from(score.diffBase64, 'base64'));
        }
        const result = compare(baseline, record);
        checked.push({ mode, run: index+1, ...result });
      }
      writeFileSync(join(out, `${key}.baseline.json`), JSON.stringify(baseline,null,2));
      writeFileSync(join(out, `${key}.fast.json`), JSON.stringify(current,null,2));
      writeFileSync(join(out, `${key}.proof.json`), JSON.stringify(checked,null,2));
      summary.push({ key, verdict: checked.some((r) => r.verdict === 'red') ? 'red' : 'green',
        red: checked.flatMap((r) => r.rows.filter((row) => row.verdict === 'red').map((row) => {const tagged={mode:r.mode,run:r.run};return Object.assign(tagged,row);})) });
    }
    writeFileSync(join(out, 'proof.json'), JSON.stringify({ sha,fixture:opts.fixture??null,reusedNative:opts['reuse-native']??null, verdict: summary.some((r) => r.verdict === 'red') ? 'red' : 'green', summary },null,2));
    process.exitCode = summary.some((r) => r.verdict === 'red') ? 1 : 0;
    console.log(`speed proof: ${process.exitCode ? 'red' : 'green'}; ${out}/proof.json`);
  } finally { await context.close(); }
} finally {
  try { await pool.close(); } finally {
    preview.close(); exported.cleanup(); timings.totalMs = performance.now() - started;
    writeFileSync(join(out, 'timings.json'), JSON.stringify(timings,null,2));
  }
}
