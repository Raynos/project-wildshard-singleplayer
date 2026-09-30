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
 *   8. a species rig with no model (E315 M5): every kind a file registers (`registerSpecies({ … kind: '<kind>'` or a string
 *      constant) is some model's species rig — `creature(<kind>…)` (src/models/creature.ts) or its `rig: { species }` — so a
 *      new creature can't slip past the Model Explorer
 *   9. a named place with no Set (E315 M12, Jake: "all four shards need to have models and sets"): every place in a
 *      shard's list of named places (`NAMED_PLACES`: Driftwood's DRIFTWOOD_PLACES, Nalati's map POIs = NALATI_PLACES,
 *      Pine Hollow's PINE_HOLLOW_POIS + its quest places, Nine Dragon's NINE_DRAGON_PLACES) is named by some
 *      `placeSet({ … place: '<slug>/<id>' … })` (or a set table's row), and every such `place` names a real place.
 *      Enforced per shard (`PLACES_ENFORCED`) once its pass has registered them; reported for the rest
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
  'src/world/Boat.ts', 'src/world/Seabed.ts', 'src/world/BlenderIsland.ts', 'src/world/Trailside.ts', 'src/world/Lookout.ts', 'src/world/Wreck.ts',
  'src/world/RopeBridge.ts', 'src/world/Zipline.ts',
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
    'src/chunks/nine-dragon-stack/vm/geo.ts': { why: "the viewmodel's geometry library (`Geo`, merged per rigid group): the fp arms' knot, the jian's parts and the facade kit's pieces build with it; it draws nothing of its own — the arms are the Gear model nine-dragon-stack/fp-arms (models/gear.ts, M5)", counts: { mergeGeometries: 1 } },
  },
  'pine-hollow': {
    'src/world/PineCrags.ts': { why: 'the ONE batch the crag models are placed into, sized for the face skin and the cave (world, welded to the ground)', counts: { BatchedMesh: 1 } },
    'src/world/PineLandmarks.ts': { why: "the landmarks' lights — the waystones' glow and anchors, the cave's shaft and drips — added as world, without colliders", counts: { 'registry add with object': 1 } },
    'src/world/Cabin.ts': { why: "the homestead draws its building and prop models (placed drawnInto, src/chunks/pine-hollow/world/cabins.ts): its log kit merges each building per material and the cabins' cores across them, its props are instanced across the buildings, a specimen's for the Explorer", counts: { InstancedMesh: 3, mergeGeometries: 9 } },
    'src/world/PineStreams.ts': { why: 'the creek, the waterfall and the plunge foam are water (world); the spray at the foot is an effect', counts: { InstancedMesh: 1 } },
    'src/world/Undergrowth.ts': { why: "the forest floor's field draws its six kinds' copies (models placed drawnInto: src/chunks/pine-hollow/world/drawnModels.ts)", counts: { InstancedMesh: 1 } },
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

/**
 * 9. Every named place is a Set (M12). A shard's named places, read from its own list: `file` holds `list`, an array
 *    whose rows carry `id: '…'` (or, `labels`, `label: '…'` slugged the way NALATI_PLACES slugs them). A shard's list
 *    file not in the checked files (a test's partial map) skips that shard; in the whole tree a missing one fails.
 */
export const NAMED_PLACES = {
  'driftwood-isle': [{ file: 'src/game/quest/Places.ts', list: 'DRIFTWOOD_PLACES' }],
  'nalati-grasslands': [{ file: 'src/chunks/nalatiLayout.ts', list: 'pois', labels: true }], // NALATI_PLACES = NALATI_MAP.pois, slugged (src/game/quest/nalati.ts)
  'pine-hollow': [{ file: 'src/chunks/pineHollowLayout.ts', list: 'PINE_HOLLOW_POIS' }, { file: 'src/chunks/pine-hollow/world/places.ts', list: 'PINE_HOLLOW_QUEST_PLACES', optional: true }],
  'nine-dragon-stack': [{ file: 'src/chunks/nine-dragon-stack/places.ts', list: 'NINE_DRAGON_PLACES' }],
};
/** the shards whose every named place must have its set (the rest are reported) */
export const PLACES_ENFORCED = [];

/** the text of the array `name` (`name = [` or `name: [`), brackets matched; null when absent */
function arrayText(code, name) {
  const m = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*\\[`).exec(code) ?? new RegExp(`\\b${name}\\s*:\\s*\\[`).exec(code);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < code.length; i++) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') { const q = c; for (i++; i < code.length && code[i] !== q; i++) if (code[i] === '\\') i++; continue; }
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return code.slice(m.index + m[0].length - 1, i + 1);
  }
  return null;
}

const placeSlug = (s) => s.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '');

/** rule 9: each shard's named places, the places some set names, and the gaps */
function namedPlaceSets(texts, whole, strip) {
  const named = new Map(), problems = [];
  for (const [shard, lists] of Object.entries(NAMED_PLACES)) {
    const ids = [];
    let read = false;
    for (const l of lists) {
      const text = texts[l.file];
      if (text === undefined) { if (whole && !l.optional) problems.push({ shard, msg: `${l.file}: ${shard}'s list of named places (${l.list}) is missing` }); continue; }
      const arr = arrayText(strip(text), l.list);
      if (arr === null) { problems.push({ shard, msg: `${l.file}: no ${l.list} array — ${shard}'s named places` }); continue; }
      read = true;
      for (const m of arr.matchAll(l.labels ? /\blabel:\s*'([^']+)'/g : /\{\s*id:\s*'([^']+)'/g)) ids.push(l.labels ? placeSlug(m[1]) : m[1]);
    }
    if (read) named.set(shard, ids);
  }
  const setFor = new Map();
  for (const [file, text] of Object.entries(texts)) {
    for (const m of strip(text).matchAll(/\bplace:\s*'([a-z0-9-]+)\/([a-z0-9-]+)'/g)) {
      const [, shard, id] = m;
      const ids = named.get(shard);
      if (ids !== undefined && !ids.includes(id)) problems.push({ shard, msg: `${file}: a set names the place '${shard}/${id}', which is not in ${shard}'s named places` });
      setFor.set(`${shard}/${id}`, file);
    }
  }
  const places = {};
  for (const [shard, ids] of named) {
    const missing = ids.filter((id) => !setFor.has(`${shard}/${id}`));
    places[shard] = { named: ids.length, sets: ids.length - missing.length, missing };
    for (const id of missing) problems.push({ shard, msg: `${shard}: the named place '${id}' has no set — placeSet({ … place: '${shard}/${id}' … }) with the models placed there` });
  }
  return { places, problems };
}

/** Check the tree (or the given { file: text } map): the broken rules, and the not-yet-migrated report. */
export function checkModels(files) {
  const texts = files ?? Object.fromEntries(sources().map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
  const violations = [];
  const report = new Map();
  // rule 8: the kinds registered (kind → the file) and the kinds some model is; a kind given as a constant is resolved
  // through the tree's `const NAME = '…'` string constants (the file's own first)
  const strip = (t) => t.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
  const constsIn = (code) => new Map([...code.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const globalConsts = new Map();
  for (const text of Object.values(texts)) for (const [k, v] of constsIn(strip(text))) if (!globalConsts.has(k)) globalConsts.set(k, v);
  const speciesKinds = new Map(), modelled = new Set();
  for (const [file, text] of Object.entries(texts)) {
    const code = strip(text), own = constsIn(code);
    const value = (lit, name) => lit ?? own.get(name) ?? globalConsts.get(name);
    for (const m of code.matchAll(/\bregisterSpecies\(\{[^}]*?\bkind:\s*(?:'([^']+)'|([A-Z][A-Z0-9_]*)\b)/g)) { const k = value(m[1], m[2]); if (k !== undefined) speciesKinds.set(k, file); }
    if (SHARD_MODELS.test(file) || file.startsWith('src/models/')) for (const m of code.matchAll(/\b(?:creature\(\s*|species:\s*)(?:'([^']+)'|([A-Z][A-Z0-9_]*)\b)/g)) { const k = value(m[1], m[2]); if (k !== undefined) modelled.add(k); }
  }
  for (const [kind, file] of speciesKinds) if (!modelled.has(kind)) violations.push(`${file}: the species '${kind}' is no model — define it in a models folder with creature('${kind}') (src/models/creature.ts) and list it in its shard's roster`);
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
  const { places, problems } = namedPlaceSets(texts, files === undefined, (t) => t.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, ''));
  for (const p of problems) if (PLACES_ENFORCED.includes(p.shard)) violations.push(p.msg);
  return { violations, report: Object.fromEntries([...report].sort(([a], [b]) => a.localeCompare(b))), places, placeProblems: problems.map((p) => p.msg) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { violations, report, places } = checkModels();
  if (!process.argv.includes('--quiet')) {
    console.info('Not yet on the model contract (src/models/place.ts), per area — the migration waves take these to zero:');
    for (const [area, r] of Object.entries(report)) console.info(`  ${area.padEnd(44)} ${Object.entries(r).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    console.info('Named places with a set (M12), per shard:');
    for (const [shard, p] of Object.entries(places)) console.info(`  ${shard.padEnd(44)} ${p.sets} / ${p.named}${PLACES_ENFORCED.includes(shard) ? ' (enforced)' : ''}${p.missing.length > 0 ? ` · no set: ${p.missing.join(', ')}` : ''}`);
    for (const shard of Object.keys(NAMED_PLACES)) if (!(shard in places)) console.info(`  ${shard.padEnd(44)} no list of named places yet (${NAMED_PLACES[shard].map((l) => `${l.list} in ${l.file}`).join(', ')})`);
  }
  if (violations.length > 0) {
    console.error(`check-models: ${violations.length} broken rule(s):\n  ${violations.join('\n  ')}`);
    process.exit(1);
  }
  console.info('check-models: the contract holds');
}
