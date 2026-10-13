#!/usr/bin/env node
// E357 F4: the linter measures file counts; budget measurements belong to the parity harness.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { debugFlags } from './debug-flags.mjs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIME_ALLOW } from './wildshard-plugin.js';
import { compareCounts, hardRules, requiredGuardRules } from '../scripts/guard-counts.mjs';
import { legacyInventory, registeredLegacyFile } from '../scripts/legacy-shards.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const NON_FILE = new Set(['allow', 'budgets', 'debugRows']);
const configFile = resolve(REPO, '.oxlintrc.ratchet.json');
const ruleNames = new Set(Object.keys(JSON.parse(readFileSync(configFile, 'utf8')).rules));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sorted = (value) => object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)])) : value;
const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => { writeFileSync(file, `${JSON.stringify(sorted(value), null, 2)}\n`); };

function validate(baseline) {
  if (!object(baseline)) throw new Error('Ratchet must be an object');
  for (const [key, value] of Object.entries(baseline)) {
    if (key === 'allow') {
      if (!object(value) || Object.values(value).some((entries) => !object(entries) || Object.values(entries).some((reason) => typeof reason !== 'string' || !reason.trim()))) throw new Error('Invalid allow section: every file needs a reason');
    } else if (key === 'budgets') {
      if (!object(value) || Object.values(value).some((n) => !number(n))) throw new Error('Invalid budgets section');
    } else if (key === 'debugRows') {
      if (!object(value) || !number(value.max) || !Number.isInteger(value.max) || !Array.isArray(value.raisedBy)) throw new Error('Invalid debugRows section');
    } else if (!ruleNames.has(key) || !object(value) || Object.values(value).some((n) => !number(n) || !Number.isInteger(n))) throw new Error(`Invalid or unconfigured rule section: ${key}`);
  }
}

/** @param {string} root @param {string} baselineFile @param {string[] | null} files */
function counts(root, baselineFile, files = null, /** @type {{guardRequirement?: string}} */ options = {}) {
  const {guardRequirement}=options;
  if (guardRequirement!==undefined && files===null) throw new Error('Required guard only applies to scoped commit measurement');
  const guardedHard=guardRequirement===undefined ? null : requiredGuardRules(root,guardRequirement,files ?? []);
  const measuredFiles = files === null ? null : files.filter(file => /\.[cm]?[jt]sx?$/u.test(file) && existsSync(resolve(root,file)));
  // Oxlint with no path arguments scans cwd. An empty staged scope must
  // measure no files, while main still prunes deleted rows and checks policy.
  if (measuredFiles?.length === 0) return {};
  const frozen = legacyInventory(root), hard = hardRules(resolve(REPO, '.oxlintrc.json')); 
  if (!existsSync(resolve(root, 'src'))) throw new Error(`Missing source directory: ${root}/src`);
  if (files !== null && !files.some(file => existsSync(resolve(root,file)))) return {};
  let measuredConfig = configFile;
  if (guardRequirement!==undefined) {
    if (guardedHard===null) throw new Error('Missing required guard rules');
    const config=readJSON(configFile);
    for (const key of guardedHard) if (Object.hasOwn(config.rules,key)) config.rules[key]='off';
    measuredConfig=resolve(root,'.commit-debt-lint.json');
    save(measuredConfig,config);
  }
  const result = spawnSync(process.execPath, [resolve(REPO, 'node_modules/oxlint/bin/oxlint'), '-c', measuredConfig, '-f', 'json', ...(measuredFiles ?? ['src'])], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, WILDSHARD_RATCHET_FILE: baselineFile, WS_HTML_LINT_FILES: measuredFiles === null ? undefined : JSON.stringify(measuredFiles) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error(`oxlint failed (${result.status}): ${result.stderr}`);
  const output = JSON.parse(result.stdout);
  if (!Array.isArray(output.diagnostics)) throw new Error('oxlint returned no diagnostics array');
  const current = {};
  for (const diagnostic of output.diagnostics) {
    const match = /^wildshard\(([^)]+)\)$/u.exec(diagnostic.code ?? '');
    const key = match ? `wildshard/${match[1]}` : null;
    if (!key || !ruleNames.has(key) || typeof diagnostic.filename !== 'string') throw new Error(`Unexpected lint diagnostic: ${JSON.stringify(diagnostic)}`);
    const file = relative(root, resolve(root, diagnostic.filename)).replaceAll('\\', '/');
    if (!hard.has(key) && registeredLegacyFile(frozen, file)) continue;
    current[key] ??= {};
    current[key][file] = (current[key][file] ?? 0) + 1;
  }
  if (result.status === 1 && output.diagnostics.length === 0) throw new Error(`oxlint failed without diagnostics: ${result.stderr}`);
  return current;
}

function debugCount(root, cacheDir) {
  let receipt, key;
  if (cacheDir !== undefined) {
    const digest=createHash('sha256').update(JSON.stringify([process.version,process.platform,process.arch]));
    // The complete AST census reads every eligible source, including files
    // outside the commit's debt scope. Include additions/deletions and helpers.
    for (const file of globSync('src/**/*',{cwd:root}).filter(path=>/\.[cm]?[jt]sx?$/u.test(path) && !path.startsWith('src/sdk/dist/')).sort()) {
      digest.update(JSON.stringify([file,createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')]));
    }
    for (const file of ['lint/ratchet.mjs','lint/debug-flags.mjs','scripts/legacy-shards.mjs','package.json','pnpm-lock.yaml','node_modules/vite/package.json']) {
      digest.update(JSON.stringify([file,existsSync(resolve(REPO,file)) ? createHash('sha256').update(readFileSync(resolve(REPO,file))).digest('hex') : null]));
    }
    const legacy=resolve(root,'lint/legacy-shards.json');
    if (existsSync(legacy)) digest.update(readFileSync(legacy));
    key=digest.digest('hex');receipt=resolve(cacheDir,'debug-census',`${key}.json`);
    try {
      const saved=readJSON(receipt);
      if (saved.key===key && Number.isSafeInteger(saved.count) && saved.count>=0
        && saved.digest===createHash('sha256').update(JSON.stringify([key,saved.count])).digest('hex')) {
        console.log('Ratchet Debug census: verified exact source receipt');
        return saved.count;
      }
    } catch { /* a missing or corrupt receipt requires the actual AST census */ }
  }
  const frozen = legacyInventory(root);
  const count=debugFlags(root, cacheDir).filter((row) => row.purpose !== 'developer' && !registeredLegacyFile(frozen, relative(root, row.file).replaceAll('\\', '/'))).length;
  if (receipt!==undefined) {
    mkdirSync(resolve(cacheDir,'debug-census'),{recursive:true});
    save(receipt,{key,count,digest:createHash('sha256').update(JSON.stringify([key,count])).digest('hex')});
  }
  return count;
}

function main() {
  let root = REPO, baselineFile = resolve(REPO, 'lint/ratchet.json'), mode = 'check', addRule = null, deferReductions = false;
  /** @type {string[] | null} */
  let scopedPaths = null;
  let guardRequirement;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg==='--guard-required') {
      guardRequirement=args[++i]; if (!guardRequirement) throw new Error('Missing required guard receipt');
    } else if (arg === '--files-from') {
      const value = args[++i];
      if (!value) throw new Error('Missing path list');
      scopedPaths = readJSON(resolve(value));
      if (!Array.isArray(scopedPaths) || scopedPaths.some(file => typeof file !== 'string' || !file.startsWith('src/') || file.split('/').some(part => part === '..' || part === '.' || part === ''))) throw new Error('Invalid scoped debt paths');
    } else if (arg === '--root' || arg === '--baseline' || arg === '--add-rule' || arg === '--rebaseline-rule') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--root') root = resolve(value);
      else if (arg === '--baseline') baselineFile = resolve(value);
      else { if (mode !== 'check') throw new Error('Only one write mode is allowed'); mode = arg === '--add-rule' ? 'add' : 'rebaseline'; addRule = value; }
    } else if (arg === '--defer-reductions') {
      deferReductions = true;
    } else if (arg === '--init' || arg === '--update' || arg === '--measure') {
      if (mode !== 'check') throw new Error('Only one write mode is allowed');
      mode = arg.slice(2);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  // Source-commit advisories leave debt reductions to the serialized pusher; rises and hard policies still fail.
  if (deferReductions && mode !== 'check') throw new Error('--defer-reductions is read-only and cannot be combined with a write or measure mode');
  if (mode === 'init' && existsSync(baselineFile)) throw new Error(`Refusing --init: ${baselineFile} already exists`);
  if (mode !== 'init' && !existsSync(baselineFile)) throw new Error(`Missing ratchet: ${baselineFile}; use --init once`);
  // X8 initializes debugRows. --init records rules and seeds the measurement allowlist only.
  const baseline = mode === 'init' ? { allow: { 'wildshard/no-raw-random-time': TIME_ALLOW }, budgets: {} } : readJSON(baselineFile);
  validate(baseline);
  if (scopedPaths !== null && mode !== 'update') throw new Error('--files-from is a shrink-only update mode');
  if (guardRequirement!==undefined && (mode!=='update' || scopedPaths===null)) throw new Error('Required guard is commit-only');
  const measured = counts(root, baselineFile, scopedPaths,{guardRequirement});
  const current = scopedPaths === null ? measured : Object.fromEntries(Object.entries(baseline).filter(([key]) => !NON_FILE.has(key)).map(([key, values]) => [key, { ...values }]));
  if (scopedPaths !== null) {
    for (const values of Object.values(current)) for (const file of Object.keys(values)) if (scopedPaths.includes(file) || !existsSync(resolve(root,file))) delete values[file];
    for (const [key, values] of Object.entries(measured)) { current[key] ??= {}; Object.assign(current[key],values); }
    for (const [key, values] of Object.entries(current)) if (Object.keys(values).length === 0) delete current[key];
  }
  if (mode === 'init') { save(baselineFile, { ...baseline, ...current }); console.log(`Ratchet initialized: ${baselineFile}`); return; }
  if (mode === 'add' || mode === 'rebaseline') {
    if (!ruleNames.has(addRule)) throw new Error(`Unknown configured rule: ${addRule}`);
    if (mode === 'add' && Object.hasOwn(baseline, addRule)) throw new Error(`Refusing --add-rule: ${addRule} already has entries`);
    if (mode === 'rebaseline' && !Object.hasOwn(baseline, addRule)) throw new Error(`Refusing --rebaseline-rule: ${addRule} has no baseline`);
    if (!current[addRule] && !hardRules(resolve(REPO, '.oxlintrc.json')).has(addRule)) throw new Error(`${addRule} is zero: promote it in .oxlintrc.json instead of recording an empty section`);
    const recorded = { ...(mode === 'rebaseline' ? baseline[addRule] : {}) };
    for (const [file, count] of Object.entries(current[addRule] ?? {})) recorded[file] = Math.max(recorded[file] ?? 0, count);
    // A widening command adds only new detections. Ordinary --update owns all debt reductions.
    save(baselineFile, { ...baseline, [addRule]: recorded });
    console.log(`Ratchet recorded ${addRule}`); return;
  }
  const hard = hardRules(resolve(REPO, '.oxlintrc.json'));
  const { failures, warnings } = compareCounts(baseline, current, hard, undefined, mode === 'update' || deferReductions, mode === 'measure');
  if (mode === 'measure') for (const [rule, files] of Object.entries(current)) if (hard.has(rule) && Object.keys(files).length > 0) failures.push(`${rule}: hard rule cannot be measured as legacy debt`);
  if (mode !== 'measure') for (const warning of warnings) console.warn(deferReductions
    ? warning.replace('partial slack; lower the ratchet', 'central regeneration will lower the debt') : warning);
  const rows = baseline.debugRows ? debugCount(root,mode==='update' && scopedPaths!==null ? process.env.WS_COMMIT_WITNESS_CACHE : undefined) : null;
  if (rows !== null && rows > baseline.debugRows.max) failures.push(`debugRows: was ${baseline.debugRows.max}, now ${rows}`);
  if (failures.length > 0) throw new Error(`Ratchet rose:\n${failures.join('\n')}`);
  if (mode === 'measure') { console.log(JSON.stringify(current)); return; }
  if (mode === 'update') {
    const next = Object.fromEntries(Object.entries(baseline).filter(([key]) => NON_FILE.has(key)));
    for (const [key, files] of Object.entries(current)) next[key] = files;
    save(baselineFile, next);
    console.log(`Ratchet lowered: ${baselineFile}`);
  } else console.log('Ratchet passed: no file count or Debug row count rose');
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
