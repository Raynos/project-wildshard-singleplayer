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
 *   7. a shard whose wave is done (`DONE`: Nine Dragon, M4; Pine Hollow, M2) drawing or registering a thing by hand outside its models/
 *      folder — only the files it declares world may, each with its reason and its counts
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
  // M1, Driftwood (E315): the world side of every model moved so far (their hand-rolled drawing is held by test/models-driftwood.test.ts)
  'src/world/Palms.ts', 'src/world/Bushes.ts', 'src/world/Boulders.ts', 'src/world/Pier.ts', 'src/world/Hut.ts', 'src/world/Shrine.ts',
  'src/world/Boat.ts', 'src/world/Seabed.ts', 'src/world/BlenderIsland.ts', 'src/world/Trailside.ts', 'src/world/Lookout.ts',
  'src/world/nalati/painted.ts', 'src/world/nalati/KurganField.ts', 'src/world/nalati/Balbals.ts', 'src/world/nalati/Bridge.ts',
  'src/world/nalati/EagleRock.ts', 'src/world/nalati/Cairn.ts', 'src/world/nalati/Crags.ts', 'src/world/nalati/Stair.ts',
  'src/world/nalati/Bowl.ts',
];

/**
 * 7. A shard whose migration wave is done draws and registers only through `defineModel` / `place` (E315 M8): outside
 *    its models/ folder, no hand registration and no hand-rolled drawing (the report's counters) except in the files it
 *    declares world — each with why, and how many of what (a declared file that grows one more fails too).
 */
export const DONE = {
  'nine-dragon-stack': {
    'src/chunks/nine-dragon-stack/index.ts': { why: 'the fragment\'s built fabric — the square, the towers, the Well, their kits — is one world piece (`nds-floors`) with its collision', counts: { 'registry add with object': 1 } },
    'src/chunks/nine-dragon-stack/world/facade/batch.ts': { why: 'the facade shell and its ~10 k window quads are the towers\' own fabric; its pieces are models', counts: { InstancedMesh: 1 } },
    'src/chunks/nine-dragon-stack/world/hero/kitx.ts': { why: 'the kits\' curved-piece builder merges a region\'s geometry (world)', counts: { mergeGeometries: 1 } },
    'src/chunks/nine-dragon-stack/vm/geo.ts': { why: 'the first-person arms and the jian are Gear (M5)', counts: { mergeGeometries: 1 } },
  },
  'pine-hollow': {
    'src/world/PineCrags.ts': { why: 'the ONE batch the crag models are placed into, sized for the face skin and the cave (world, welded to the ground)', counts: { BatchedMesh: 1 } },
    'src/world/PineLandmarks.ts': { why: "the landmarks' lights — the waystones' glow and anchors, the cave's shaft and drips — added as world, without colliders", counts: { 'registry add with object': 1 } },
    'src/world/Cabin.ts': { why: "the homestead draws its building and prop models (placed drawnInto, src/chunks/pine-hollow/world/cabins.ts): its log kit merges each building per material and the cabins' cores across them, its props are instanced across the buildings, a specimen's for the Explorer", counts: { InstancedMesh: 3, mergeGeometries: 9 } },
    'src/world/PineStreams.ts': { why: 'the creek, the waterfall and the plunge foam are water (world); the spray at the foot is an effect', counts: { InstancedMesh: 1 } },
    'src/world/Undergrowth.ts': { why: "the forest floor's field draws its six kinds' copies (models placed drawnInto: src/chunks/pine-hollow/world/drawnModels.ts)", counts: { InstancedMesh: 1 } },
    'src/pinehollow/kingModel.ts': { why: 'the Antler King is a creature (M5: the species list)', counts: { mergeGeometries: 2 } },
    'src/pinehollow/life/wildlifeMesh.ts': { why: 'the birds and the hare are creatures (M5)', counts: { InstancedMesh: 1 } },
    'src/pinehollow/life/skinKnife.ts': { why: 'the skinning knife is Gear (M5)', counts: { mergeGeometries: 1 } },
    'src/pinehollow/quest/npcFigure.ts': { why: "the ranger, the trader and the miller are People (M5)", counts: { mergeGeometries: 1 } },
  },
};

/** a file's hand registrations and hand-rolled draws (comments stripped): the report's counters */
function countsOf(code) {
  return {
    addBuilt: (code.match(/\baddBuilt\(/g) ?? []).length - (/const addBuilt\s*=/.test(code) ? 1 : 0),
    registerModel: (code.match(/\bregisterModel\(/g) ?? []).length - (/export function registerModel/.test(code) ? 1 : 0),
    registerSolid: (code.match(/\bregisterSolid\(/g) ?? []).length - (/export function registerSolid/.test(code) ? 1 : 0),
    'registry add with object': (code.match(/\.add\(\{[^}]*?\bobject:/g) ?? []).length,
    'model flag': (code.match(/\bmodel:\s*(?:\{|true)/g) ?? []).length,
    InstancedMesh: (code.match(/new (?:THREE\.)?InstancedMesh\(/g) ?? []).length,
    BatchedMesh: (code.match(/new (?:THREE\.)?BatchedMesh\(/g) ?? []).length,
    mergeGeometries: (code.match(/\bmergeGeometries\(/g) ?? []).length,
  };
}

const SHARD_MODELS = /^src\/chunks\/([^/]+)\/models\//;
const SHARD_FILE = /^src\/chunks\/([^/]+)\//;
/** Pine Hollow's world side in src/world (only Pine Hollow builds these: its homestead, its forest floor, its props' scatter) */
const PINE_WORLD = /^src\/world\/(Cabin|Undergrowth|Props)\.ts$/;
/** Driftwood's world side in src/world (only Driftwood builds these; its report counts them apart from the shared code) */
const DRIFTWOOD_WORLD = /^src\/world\/(Palms|Bushes|Boulders|Pier|Hut|Shrine|Boat|Seabed|BlenderIsland|blenderArea|coverTint|Trailside|Lookout|Wreck|Cove|RopeBridge|Gulls|GroundCover|driftwood)\.ts$/;

/** which area a file belongs to, for the report */
export function areaOf(file) {
  const m = SHARD_FILE.exec(file);
  if (m) return m[1];
  if (/^src\/(nalati|world\/nalati)\//.test(file)) return 'nalati-grasslands';
  if (/^src\/(pinehollow\/|world\/Pine)/.test(file) || PINE_WORLD.test(file)) return 'pine-hollow';
  if (DRIFTWOOD_WORLD.test(file)) return 'driftwood-isle';
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
    const counts = countsOf(code);
    for (const [key, n] of Object.entries(counts)) bump(area, key, n);
    const done = DONE[area];
    if (done !== undefined) {
      const declared = done[file]?.counts ?? {};
      for (const [key, n] of Object.entries(counts)) {
        if (n > (declared[key] ?? 0)) violations.push(`${file}: ${area} is on the model contract (DONE) — ${n} × ${key} here; draw and register things through defineModel / place, or declare the file world in DONE with its reason`);
      }
    }
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
