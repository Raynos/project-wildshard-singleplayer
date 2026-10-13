// Commit-only reuse; ordinary builds still run the defining boot-table producer.
import { createHash } from 'node:crypto';
import fs, { existsSync, globSync as globPaths, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inputValue, treeEntries } from './gate-cache.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const preloaded = process.execArgv.some((arg, i) => arg === '--import'
  && typeof process.execArgv[i + 1] === 'string' && resolve(process.execArgv[i + 1]) === import.meta.filename);
const modules = new Set([`F ${import.meta.filename}`, `F ${resolve(ROOT, 'scripts/gate-cache.mjs')}`]);
/** @type {Set<string> | null} */
let reads = null;
/** @param {string} kind @param {unknown} value */
function note(kind, value) {
  if (reads === null) return;
  if (typeof value === 'string') reads.add(`${kind} ${resolve(value)}`);
  else if (value instanceof URL && value.protocol === 'file:') reads.add(`${kind} ${fileURLToPath(value)}`);
}
if (preloaded) {
  registerHooks({
    load(url, context, next) {
      if (url.startsWith('file:')) modules.add(`F ${fileURLToPath(url)}`);
      return next(url, context);
    },
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        const base = fileURLToPath(new URL(specifier, context.parentURL));
        for (const suffix of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.js']) modules.add(`F ${base + suffix}`);
      }
      return next(specifier, context);
    }
  });
  /** @type {Record<string, unknown>} */
  const table = fs;
  /** @type {[string, string[]][]} */
  const groups = [['F', ['readFileSync', 'existsSync', 'statSync', 'lstatSync', 'realpathSync', 'openSync', 'accessSync', 'writeFileSync', 'copyFileSync']], ['D', ['readdirSync', 'opendirSync']]];
  for (const [kind, names] of groups) for (const name of names) {
    const original = table[name];
    if (typeof original !== 'function') continue;
    table[name] = /** @this {unknown} @param {...unknown} args */ function tracedFile(...args) {
      note(kind, args[0]);
      if (name === 'copyFileSync') note('F', args[1]);
      return Reflect.apply(original, this, args);
    };
  }
  const glob = table.globSync;
  if (typeof glob === 'function') table.globSync = /** @this {unknown} @param {...unknown} args */ function globSync(...args) {
    const options = args[1];
    const at = options !== null && typeof options === 'object' && 'cwd' in options ? options.cwd : process.cwd();
    const cwd = typeof at === 'string' ? resolve(at) : at instanceof URL ? fileURLToPath(at) : process.cwd();
    if (reads !== null) for (const item of Array.isArray(args[0]) ? args[0] : [args[0]]) {
      if (typeof item === 'string') reads.add(`G ${cwd}\t${item}`);
    }
    return Reflect.apply(glob, this, args);
  };
  syncBuiltinESMExports();
}

/** Reuse only exact traced inputs and produced bytes; untraced invocation always runs.
 * @param {string} root @param {string} cache @param {()=>void} run @returns {boolean} Verified cache hit. */
export function generateBootTablesCached(root, cache, run) {
  if (!preloaded || resolve(root) !== ROOT) { run(); return false; }
  const digest = (/** @type {unknown} */ value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const context = { node: process.version, platform: process.platform, arch: process.arch,
    environment: digest(Object.fromEntries(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)))) };
  const receipt = resolve(cache, 'boot.json');
  try {
    const saved = JSON.parse(readFileSync(receipt, 'utf8'));
    if (saved.digest === digest({ context: saved.context, inputs: saved.inputs })
      && JSON.stringify(saved.context) === JSON.stringify(context)
      && saved.inputs !== null && typeof saved.inputs === 'object' && Object.keys(saved.inputs).length > 2
      && Object.entries(saved.inputs).every(([entry, value]) => inputValue(root, entry) === value)) {
      console.log('gen-boot: verified input/output receipt'); return true;
    }
  } catch { /* Missing or corrupt evidence runs the real producer. */ }
  /** @type {string[]} */
  let direct = [];
  reads = new Set();
  try { run(); direct = [...modules, ...reads]; } finally { reads = null; }
  const entries = treeEntries(root, direct);
  // Writers need not read their outputs. Bind bytes and the output inventory.
  const patterns = ['src/game/boot/**/*.generated.*', 'src/game/shard/art.generated.ts', 'public/assets/packs/**/*'];
  for (const pattern of patterns) entries.push(`G .\t${pattern}`);
  for (const path of globPaths(patterns, { cwd: root })) if (lstatSync(resolve(root, path)).isFile()) entries.push(`F ${path}`);
  for (const file of ['scripts/gen-boot-cache.mjs', 'scripts/gate-cache.mjs', 'pnpm-lock.yaml', 'package.json',
    ...['engine', 'game', 'sdk', 'format', 'commons'].map(layer => `src/${layer}/package.json`)]) {
    if (existsSync(resolve(root, file))) entries.push(`F ${file}`);
  }
  const inputs = Object.fromEntries([...new Set(entries)].map(entry => [entry, inputValue(root, entry)]));
  mkdirSync(cache, { recursive: true });
  writeFileSync(receipt, JSON.stringify({ context, inputs, digest: digest({ context, inputs }) }));
  return false;
}
