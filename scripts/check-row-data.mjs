#!/usr/bin/env node
// SHARD-PLATFORM SP3: content rows become data. The TypeScript compiler walks every content row type the layer
// packages export (species, strikes, loot, quests, weapon profiles …) and lists each field whose type is a function or a
// class: a row with one can't be written as JSON, so it can't ship in an uploaded shard (MMO-REQUIREMENTS R1, S6).
// The list is a ratchet in lint/row-functions.json: a new function field fails, and a field that became data must
// leave the list in the same commit. Fields become data by turning into a value or a named id the engine resolves.
//   node scripts/check-row-data.mjs           print the fields
//   node scripts/check-row-data.mjs --check   fail on a new field or a stale entry
//   node scripts/check-row-data.mjs --update  rewrite the list (only after removing fields)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';

const ROOT = resolve(import.meta.dirname, '..');
const LIST = 'lint/row-functions.json';
/** Content row types by their defining public package or relocated shard module. Package surfaces come from
 *  package.json exports (E434); a shard-private profile remains measured after it leaves the kit surface. */
export const ROW_TYPES = {
  'src/engine/package.json': [
    'AmmoRow', 'BossDef', 'BossDefinition', 'DamageRuleDef', 'DayCycleSpec', 'EffectDef', 'EliteDefinition', 'EncounterDefinition',
    'EquipmentRow', 'HitscanProfile', 'HitStopProfile', 'InteractTable', 'LevelAudioProfile', 'LoadoutSpec', 'NpcDef', 'PickupDef',
    'MeleeProfile', 'QuestDef', 'RangedFeelProfile', 'SkinDef', 'SkinRow', 'SlashTrailProfile', 'SpawnTableRow', 'SpeciesLook', 'SpeciesRow', 'ThrownProfile',
    'StrikeSpec', 'StringTable', 'TableSpec', 'VoiceTable', 'WeatherProfile',
  ],
  'src/game/package.json': ['AchievementDef', 'CosmeticDef', 'EliteDef', 'ItemRow', 'LootTableRow', 'PresentedQuestDef', 'QuestRewardSpec', 'RainCurtainSpec', 'ShardManifest'],
  'src/kit/package.json': ['BowProfile', 'NpcRigProfile', 'NpcRow'],
  'src/sdk/package.json': ['FirearmProfile'],
  'src/shards/pine-hollow/weapons/crossbow/profiles.ts': ['CrossbowProfile'],
};
const DEPTH = 5;

/** every function- or class-typed field path in the row types, e.g. `StrikeSpec.weight`, `TableSpec.rows[].when` */
export function rowFunctions(root = ROOT) {
  const configPath = ts.findConfigFile(root, (f) => ts.sys.fileExists(f));
  const config = configPath ? ts.readConfigFile(configPath, (f) => ts.sys.readFile(f)).config : {};
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
  const modulesOf = (pkg) => !pkg.endsWith('/package.json') ? [resolve(root, pkg)] : Object.values(JSON.parse(readFileSync(resolve(root, pkg), 'utf8')).exports ?? {})
    .filter((target) => typeof target === 'string').map((target) => resolve(root, dirname(pkg), target));
  const program = ts.createProgram(Object.keys(ROW_TYPES).flatMap(modulesOf), { ...options, noEmit: true });
  const checker = program.getTypeChecker();
  const external = (type) => (type.getSymbol()?.declarations ?? []).some((d) => d.getSourceFile().fileName.includes('/node_modules/'));
  const found = new Set();
  const visit = (type, path, depth, seen) => {
    if (depth > DEPTH || seen.has(type)) return;
    if (type.isUnion() || type.isIntersection()) { for (const part of type.types) visit(part, path, depth, seen); return; }
    if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) { found.add(path); return; }
    if (!(type.flags & ts.TypeFlags.Object)) return; // primitives are data
    const next = new Set(seen).add(type);
    if (checker.isArrayType(type) || checker.isTupleType(type)) { // before the library check: arrays are declared in lib
      for (const element of checker.getTypeArguments(type)) visit(element, `${path}[]`, depth + 1, next);
      return;
    }
    if (external(type)) return; // library objects (three's Vector3, a Map) are out of scope here
    if ((type.getSymbol()?.flags ?? 0) & ts.SymbolFlags.Class) { found.add(`${path} (class instance)`); return; } // behaviour, not a value
    const index = checker.getIndexInfosOfType(type);
    for (const info of index) visit(info.type, `${path}[*]`, depth + 1, next);
    for (const prop of checker.getPropertiesOfType(type)) {
      const decl = prop.valueDeclaration ?? prop.declarations?.[0];
      if (decl?.getSourceFile().fileName.includes('/node_modules/')) continue;
      const propType = decl ? checker.getTypeOfSymbolAtLocation(prop, decl) : checker.getDeclaredTypeOfSymbol(prop);
      visit(propType, `${path}.${prop.getName()}`, depth + 1, next);
    }
  };
  for (const [file, names] of Object.entries(ROW_TYPES)) {
    const exports = new Map();
    for (const path of modulesOf(file)) {
      const source = program.getSourceFile(path);
      const module = source && checker.getSymbolAtLocation(source);
      if (module) for (const s of checker.getExportsOfModule(module)) if (!exports.has(s.getName())) exports.set(s.getName(), s);
    }
    for (const name of names) {
      const symbol = exports.get(name);
      if (!symbol) throw new Error(`check-row-data: ${file} no longer exports ${name}`);
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      visit(checker.getDeclaredTypeOfSymbol(target), name, 0, new Set());
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** a new field fails; a recorded field that is gone fails too, so the list only shrinks and never keeps slack */
export function compareRowFunctions(recorded, current) {
  const now = new Set(current), before = new Set(recorded);
  return { added: current.filter((p) => !before.has(p)), removed: recorded.filter((p) => !now.has(p)) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const current = rowFunctions();
  const path = resolve(ROOT, LIST);
  const mode = process.argv[2];
  if (mode === '--update') {
    const doc = { about: 'SHARD-PLATFORM SP3: content row fields that hold a function or a class (scripts/check-row-data.mjs). May only shrink: turn a field into data or a named id, then remove its line.', fields: current, provenance: Object.fromEntries(current.map((field) => [field, 'legacy, pre-SF1'])) };
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`check-row-data: ${current.length} function fields recorded`);
  } else if (mode === '--check') {
    const { added, removed } = compareRowFunctions(JSON.parse(readFileSync(path, 'utf8')).fields, current);
    for (const p of added) console.error(`check-row-data: new function field ${p}: rows are data (an id the engine resolves, or a value)`);
    for (const p of removed) console.error(`check-row-data: ${p} is data now: remove it from ${LIST} (node scripts/check-row-data.mjs --update)`);
    if (added.length > 0 || removed.length > 0) process.exit(1);
    console.log(`check-row-data: ${current.length} function fields, none new`);
  } else for (const p of current) console.log(p);
}
