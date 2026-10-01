#!/usr/bin/env node
// E357 S1.6: run after F2 recordings land and after each accepted calibration.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { baselineCeilings } from './parity/budgetCeilings.mjs';
import { shardFolders } from './gen-shards.mjs';

await import('./bake-loader.mjs');
const { deriveBudget } = await import('../src/engine/render/budgets');
const { parseCalibration } = await import('../src/engine/render/calibration');
/** @type {Record<string, string | undefined>} */
const options = Object.fromEntries(process.argv.slice(2).map((s) => { const m = /^--(root|lanes|reports)=(.+)$/.exec(s); if (!m) throw new Error(`Unknown argument ${s}`); return [m[1], m[2]]; }));
const root = resolve(options.root ?? join(import.meta.dirname, '..')), lanes = (options.lanes ?? 'm5,gh-macos15').split(','), records = [], provenance = [];
for (const lane of lanes) {
  const dir = join(root, 'test/parity/baselines', lane);
  if (!existsSync(dir)) throw new Error(`Missing baseline lane ${lane}; pass --lanes=m5 to explicitly seed the available lane`);
  for (const file of readdirSync(dir).filter((name) => /\.(phone|desktop)\.json$/.test(name))) {
    const path = join(dir, file), record = JSON.parse(readFileSync(path, 'utf8')); records.push(record); provenance.push({ file: `test/parity/baselines/${lane}/${file}`, sha: record.sha, recorded: record.recorded });
  }
}
// Supplemental captures measure the free-camera D absent from pre-S1.6 standing-pose baselines.
if (options.reports) for (const file of readdirSync(options.reports).filter((name) => /\.(phone|desktop)\.json$/.test(name))) {
  const path = join(options.reports, file), report = JSON.parse(readFileSync(path, 'utf8'));
  records.push(report); provenance.push({ file: path, sha: report.sha ?? report.boot?.sha, recorded: report.recorded ?? null });
}
const measured = baselineCeilings(records), ratchetPath = join(root, 'lint/ratchet.json'), ratchet = JSON.parse(readFileSync(ratchetPath, 'utf8'));
const current = join(root, 'budgets/calibration.json'), calibration = existsSync(current) ? parseCalibration(readFileSync(current, 'utf8')) : null;
const specs = new Map();
for (const slug of shardFolders(root)) { const { default: manifest } = await import(join(root, 'src/shards', slug, 'manifest.ts')); specs.set(slug, manifest.budgets ?? {}); }
const next = { ...ratchet.budgets };
for (const [slug, inputs] of specs) for (const [tier, poses] of Object.entries(inputs.ceilings ?? {})) for (const [pose, limits] of Object.entries(poses)) for (const [metric, ceiling] of Object.entries(limits)) {
  const key = `${slug}.${tier}.${pose}.${metric}`; next[key] = Math.min(next[key] ?? ceiling, ceiling);
}
for (const [key, ceiling] of Object.entries(measured)) {
  const [slug, tier, , metric] = key.split('.'), inputs = specs.get(slug);
  if ((tier !== 'phone' && tier !== 'desktop') || (metric !== 'draws' && metric !== 'tris' && metric !== 'programs' && metric !== 'gpuMB')) throw new Error(`Invalid budget key ${key}`);
  const target = calibration && inputs ? deriveBudget(inputs, tier, calibration)?.limits[metric] : null;
  if (target !== null && target !== undefined && ceiling <= target) { delete next[key]; continue; }
  next[key] = Math.min(next[key] ?? ceiling, ceiling);
}
// Owning manifests import these data files; no renderer or cross-shard imports enter the manifests.
for (const slug of specs.keys()) {
  /** @type {Record<'phone' | 'desktop', Record<string, Record<string, number>>>} */
  const ceilings = { phone: {}, desktop: {} };
  for (const [key, ceiling] of Object.entries(next)) {
    const [id, tier, pose, metric] = key.split('.');
    if (id !== slug) continue;
    if ((tier !== 'phone' && tier !== 'desktop') || !pose || !metric) throw new Error(`Invalid budget key ${key}`);
    (ceilings[tier][pose] ??= {})[metric] = ceiling;
  }
  writeFileSync(join(root, 'src/shards', slug, 'budgetCeilings.ts'), `import type { LevelSpec } from '#engine';\n\n/** F2 rollout maxima, lowered after calibration; provenance: budgets/ceiling-sources.json. */\nexport const BUDGET_CEILINGS = ${JSON.stringify(ceilings, null, 2)} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;\n`);
}
ratchet.budgets = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(ratchetPath, `${JSON.stringify(ratchet, null, 2)}\n`);
mkdirSync(join(root, 'budgets'), { recursive: true });
writeFileSync(join(root, 'budgets/ceiling-sources.json'), `${JSON.stringify({ source: 'F2 max(lanes) plus recorded parity band; numeric ceilings may only decrease', lanes, calibration: calibration?.measuredAt ?? null, baselines: provenance }, null, 2)}\n`);
console.info(`Seeded/lowered ${Object.keys(measured).length} budget measurements from ${records.length} baselines. Run node lint/ratchet.mjs; commit budgets and provenance by private index if ratchet has other WIP.`);
