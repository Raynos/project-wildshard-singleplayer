#!/usr/bin/env node
/**
 * check-models — the model contract's static check (E306 / E315 row M8; the contract is src/models/model.ts).
 *
 * FAILS (exit 1) on a broken rule, anywhere:
 *   1. `defineModel(` outside `src/models/` and `src/chunks/<slug>/models/`
 *   2. a file under `src/chunks/<slug>/models/` that defines no model (a models folder holds models only)
 *   3. a model id not prefixed by its folder: `<slug>/…` in a shard's models, `shared/…` in src/models/
 *   4. a shard importing another shard's models (`src/chunks/<a>/**` → `chunks/<b>/models/`)
 *   5. `src/models/` importing a shard (`chunks/…`): the contract stays shard-agnostic
 *   6. a file already on the contract (`ON_CONTRACT`) registering a built thing by hand again
 * REPORTS (never fails) what has not moved onto the contract yet, per area: registrations by hand (`addBuilt`,
 * `registerModel`, `registerSolid`, a registry `add` with an `object`, a `model:` flag) and hand-rolled drawing
 * (`new InstancedMesh` / `BatchedMesh`, `mergeGeometries`) outside src/models/. Each migration wave (M1–M5) drives its
 * area's numbers to zero; then M6 turns the report into rules.
 *
 *   node scripts/check-models.mjs            # the report + the rules
 *   node scripts/check-models.mjs --quiet    # the rules only
 * test/models-contract.test.ts runs the rules in vitest, so CI and the pre-push gate enforce them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** every .ts under src/, repo-relative with forward slashes */
function sources(dir = join(ROOT, 'src')) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
}

/**
 * 6. Files already moved onto the contract never register a built thing by hand again (a `registerSolid` /
 *    `registerModel`, a registry `add` with an `object`, a `model:` flag): they place models. Each wave adds its files
 *    (M3, Nalati: every place but the camps and the road fences, whose files other lanes hold; E315).
 */
export const ON_CONTRACT = [
  'src/world/nalati/painted.ts', 'src/world/nalati/KurganField.ts', 'src/world/nalati/Balbals.ts', 'src/world/nalati/Bridge.ts',
  'src/world/nalati/EagleRock.ts', 'src/world/nalati/Cairn.ts', 'src/world/nalati/Crags.ts', 'src/world/nalati/Stair.ts',
  'src/world/nalati/Bowl.ts',
];

const SHARD_MODELS = /^src\/chunks\/([^/]+)\/models\//;
const SHARD_FILE = /^src\/chunks\/([^/]+)\//;

/** which area a file belongs to, for the report */
export function areaOf(file) {
  const m = SHARD_FILE.exec(file);
  if (m) return m[1];
  if (/^src\/(nalati|world\/nalati)\//.test(file)) return 'nalati-grasslands';
  if (/^src\/(pinehollow\/|world\/Pine)/.test(file)) return 'pine-hollow';
  if (file.startsWith('src/models/')) return 'models (contract)';
  return 'shared / driftwood (src/world, main.ts, …)';
}

/** the import specifiers of a file, resolved repo-relative when they are relative */
function importsOf(file, text) {
  const out = [];
  for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    out.push(spec.startsWith('.') ? relative(ROOT, resolve(ROOT, file, '..', spec)).split('\\').join('/') : spec);
  }
  return out;
}

/** Check the tree (or the given { file: text } map): the broken rules, and the not-yet-migrated report. */
export function checkModels(files) {
  const texts = files ?? Object.fromEntries(sources().map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
  const violations = [];
  const report = new Map();
  const bump = (area, key, n) => { if (n === 0) return; const r = report.get(area) ?? {}; r[key] = (r[key] ?? 0) + n; report.set(area, r); };
  for (const [file, text] of Object.entries(texts)) {
    const code = text.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, ''); // comments don't count
    const inShardModels = SHARD_MODELS.exec(file), inShared = file.startsWith('src/models/');
    const defines = [...code.matchAll(/defineModel(?:<[^(]*>)?\(\s*\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]);
    const calls = (code.match(/\bdefineModel(?:<[^(]*>)?\(/g) ?? []).length - (/export function defineModel/.test(code) ? 1 : 0);
    if (calls > 0 && !inShardModels && !inShared) violations.push(`${file}: defineModel outside src/models/ and src/chunks/<slug>/models/`);
    if (inShardModels && calls === 0) violations.push(`${file}: a file in a models folder that defines no model`);
    for (const id of defines) {
      const want = inShardModels ? `${inShardModels[1]}/` : 'shared/';
      if ((inShardModels || inShared) && !id.startsWith(want)) violations.push(`${file}: model id '${id}' must start with '${want}'`);
    }
    const shard = SHARD_FILE.exec(file)?.[1];
    for (const spec of importsOf(file, code)) {
      const target = /(?:^|\/)chunks\/([^/]+)\/models\//.exec(spec)?.[1];
      if (shard !== undefined && target !== undefined && target !== shard) violations.push(`${file}: imports another shard's models (${spec})`);
      if (inShared && /(?:^|\/)chunks\//.test(spec)) violations.push(`${file}: src/models/ imports a shard (${spec})`);
    }
    if (inShared || inShardModels) continue;
    if (ON_CONTRACT.includes(file) && /\bregisterSolid\(|\bregisterModel\(|\.add\(\{[^}]*?\bobject:|\bmodel:\s*(?:\{|true)/.test(code)) {
      violations.push(`${file}: on the model contract — it places models, it never registers a built thing by hand`);
    }
    const area = areaOf(file);
    bump(area, 'addBuilt', (code.match(/\baddBuilt\(/g) ?? []).length - (/const addBuilt\s*=/.test(code) ? 1 : 0));
    bump(area, 'registerModel', (code.match(/\bregisterModel\(/g) ?? []).length - (/export function registerModel/.test(code) ? 1 : 0));
    bump(area, 'registerSolid', (code.match(/\bregisterSolid\(/g) ?? []).length - (/export function registerSolid/.test(code) ? 1 : 0));
    bump(area, 'registry add with object', (code.match(/\.add\(\{[^}]*?\bobject:/g) ?? []).length);
    bump(area, 'model flag', (code.match(/\bmodel:\s*(?:\{|true)/g) ?? []).length);
    bump(area, 'InstancedMesh', (code.match(/new (?:THREE\.)?InstancedMesh\(/g) ?? []).length);
    bump(area, 'BatchedMesh', (code.match(/new (?:THREE\.)?BatchedMesh\(/g) ?? []).length);
    bump(area, 'mergeGeometries', (code.match(/\bmergeGeometries\(/g) ?? []).length);
  }
  return { violations, report: Object.fromEntries([...report].sort(([a], [b]) => a.localeCompare(b))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { violations, report } = checkModels();
  if (!process.argv.includes('--quiet')) {
    console.info('Not yet on the model contract (src/models/place.ts), per area — the migration waves take these to zero:');
    for (const [area, r] of Object.entries(report)) console.info(`  ${area.padEnd(44)} ${Object.entries(r).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  }
  if (violations.length > 0) {
    console.error(`check-models: ${violations.length} broken rule(s):\n  ${violations.join('\n  ')}`);
    process.exit(1);
  }
  console.info('check-models: the contract holds');
}
