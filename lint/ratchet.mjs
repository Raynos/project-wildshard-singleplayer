#!/usr/bin/env node
// E357 F4: the linter measures file counts; budget measurements belong to the parity harness.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'vite';
import { TIME_ALLOW } from './wildshard-plugin.js';

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

function counts(root, baselineFile) {
  if (!existsSync(resolve(root, 'src'))) throw new Error(`Missing source directory: ${root}/src`);
  const result = spawnSync(process.execPath, [resolve(REPO, 'node_modules/oxlint/bin/oxlint'), '-c', configFile, '-f', 'json', 'src'], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, WILDSHARD_RATCHET_FILE: baselineFile },
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
    current[key] ??= {};
    current[key][file] = (current[key][file] ?? 0) + 1;
  }
  if (result.status === 1 && output.diagnostics.length === 0) throw new Error(`oxlint failed without diagnostics: ${result.stderr}`);
  return current;
}

function walk(node, visit) {
  if (!object(node)) return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) { for (const item of value) walk(item, visit); }
    else if (object(value)) walk(value, visit);
  }
}
function debugCount(root) {
  let count = 0;
  const scan = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
      const parsed = parseSync(file, readFileSync(file, 'utf8'));
      if (parsed.errors.length > 0) throw new Error(`Cannot count Debug rows in ${file}`);
      walk(parsed.program, (node) => {
        if (node.type === 'VariableDeclarator' && node.id?.name === 'DEBUG_ROWS') {
          let array = node.init;
          while (array?.expression) array = array.expression;
          if (array?.type !== 'ArrayExpression' || array.elements.some((element) => !element || element.type === 'SpreadElement')) throw new Error(`DEBUG_ROWS must be a literal row array: ${file}`);
          count += array.elements.length;
        }
        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && !node.callee.computed && node.callee.property?.name === 'debugRow' && node.callee.object?.name !== 'adapters') count += 1;
      });
    }
  };
  scan(resolve(root, 'src'));
  return count;
}

function main() {
  let root = REPO, baselineFile = resolve(REPO, 'lint/ratchet.json'), mode = 'check', addRule = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root' || arg === '--baseline' || arg === '--add-rule') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--root') root = resolve(value);
      else if (arg === '--baseline') baselineFile = resolve(value);
      else { if (mode !== 'check') throw new Error('Only one write mode is allowed'); mode = 'add'; addRule = value; }
    } else if (arg === '--init' || arg === '--update') {
      if (mode !== 'check') throw new Error('Only one write mode is allowed');
      mode = arg.slice(2);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (mode === 'init' && existsSync(baselineFile)) throw new Error(`Refusing --init: ${baselineFile} already exists`);
  if (mode !== 'init' && !existsSync(baselineFile)) throw new Error(`Missing ratchet: ${baselineFile}; use --init once`);
  // X8 initializes debugRows. --init records rules and seeds the measurement allowlist only.
  const baseline = mode === 'init' ? { allow: { 'wildshard/no-raw-random-time': TIME_ALLOW }, budgets: {} } : readJSON(baselineFile);
  validate(baseline);
  const current = counts(root, baselineFile);
  if (mode === 'init') { save(baselineFile, { ...baseline, ...current }); console.log(`Ratchet initialized: ${baselineFile}`); return; }
  if (mode === 'add') {
    if (!ruleNames.has(addRule)) throw new Error(`Unknown configured rule: ${addRule}`);
    if (Object.hasOwn(baseline, addRule)) throw new Error(`Refusing --add-rule: ${addRule} already has entries`);
    save(baselineFile, { ...baseline, [addRule]: current[addRule] ?? {} });
    console.log(`Ratchet recorded ${addRule}`); return;
  }
  const failures = [];
  for (const [key, files] of Object.entries(current)) {
    for (const [file, now] of Object.entries(files)) {
      const was = baseline[key]?.[file] ?? 0;
      if (now > was) failures.push(`${file}: ${key} was ${was}, now ${now}`);
    }
  }
  const rows = baseline.debugRows ? debugCount(root) : null;
  if (rows !== null && rows > baseline.debugRows.max) failures.push(`debugRows: was ${baseline.debugRows.max}, now ${rows}`);
  if (failures.length > 0) throw new Error(`Ratchet rose:\n${failures.join('\n')}`);
  if (mode === 'update') {
    const next = Object.fromEntries(Object.entries(baseline).filter(([key]) => NON_FILE.has(key)));
    for (const [key, files] of Object.entries(current)) next[key] = files;
    if (next.debugRows) next.debugRows = { ...next.debugRows, max: rows };
    save(baselineFile, next);
    console.log(`Ratchet lowered: ${baselineFile}`);
  } else console.log('Ratchet passed: no file count or Debug row count rose');
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
