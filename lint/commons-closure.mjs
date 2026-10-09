// G143: authored build-time packs must never enter a runtime's transitive import closure.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parseSync } from 'vite';

const cache = new Map(), manifests = new Map();
// SF74 speed 3: a file whose whole closure a walk finished without reaching commons is clean, and later walks skip it.
// Skipping a clean file drops only clean nodes (whatever a clean file reaches is clean), so each walk still visits the
// unclean files in the same order and returns the same first reference. Before, each of the tree's ~2,900 runtime import
// statements walked a fresh closure (55 s). The clean set lasts one lint pass: it clears when a file or one of its import
// statements comes back (the next pass, or an editor re-lint), after 2 s without a call, and when a parsed file changed.
let clean = new Set(), lastCall = 0, lastFrom = '', linted = new Set(), statements = new Set();
const PASS_GAP_MS = 2000;
// E454: a file's stamp (size + mtime) validates its cached parse without reading it again; this walk runs per import.
const stamp = (file) => { const info = statSync(file, { throwIfNoEntry: false }); return info === undefined ? null : `${info.size}:${info.mtimeMs}`; };
function imports(file) {
  const at = stamp(file), cached = cache.get(file);
  if (at !== null && cached?.at === at) return cached.specifiers;
  if (cached !== undefined) clean = new Set(); // SF74 speed 3: a changed file may change any clean closure
  const source = readFileSync(file, 'utf8');
  const parsed = parseSync(file, source), specifiers = new Set(parsed.module.staticImports.map(row => row.moduleRequest.value));
  for (const row of parsed.module.staticExports) for (const entry of row.entries) if (entry.moduleRequest) specifiers.add(entry.moduleRequest.value);
  for (const row of parsed.module.dynamicImports) {
    const expression = source.slice(row.moduleRequest.start, row.moduleRequest.end).trim();
    const literal = /^(['"`])([^'"`$]+)\1$/u.exec(expression);
    const prefix = literal ?? /^(['"])([^'"]+)\1\s*\+/u.exec(expression) ?? /^(`)([^`$]+)\$\{/u.exec(expression);
    if (prefix !== null) specifiers.add(prefix[2]);
  }
  const result = [...specifiers]; cache.set(file, { at, specifiers: result }); return result;
}
function target(root, from, specifier) {
  let base;
  const pkg = /^@wildshard\/(engine|game|sdk|commons)(?:\/(.+))?$/u.exec(specifier);
  if (pkg !== null) {
    const manifest = resolve(root, 'src', pkg[1], 'package.json');
    const at = stamp(manifest);
    if (at === null) return null;
    if (manifests.get(manifest)?.at !== at) manifests.set(manifest, { at, exports: JSON.parse(readFileSync(manifest, 'utf8')).exports });
    const subpath = specifier.slice(`@wildshard/${pkg[1]}/`.length);
    const entry = manifests.get(manifest)?.exports?.[subpath === '' ? '.' : `./${subpath}`];
    if (typeof entry !== 'string') return null;
    base = resolve(root, 'src', pkg[1], entry);
  } else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  if (/^src\/commons(?:\/|$)/u.test(relative(root, base).replaceAll('\\', '/'))) return base;
  if (!relative(resolve(root, 'src'), base).startsWith('..')) {
    const plain = base.replace(/\.js$/u, '');
    for (const file of [base, `${plain}.ts`, `${plain}.tsx`, `${plain}.mjs`, `${plain}.js`, `${plain}/index.ts`]) if (/\.[cm]?[jt]sx?$/u.test(file) && existsSync(file)) return file;
  }
  return null;
}
function passStart(from, specifier) {
  const fresh = () => { clean = new Set(); linted = new Set(); statements = new Set(); };
  if (Date.now() - lastCall > PASS_GAP_MS) fresh();
  if (from !== lastFrom) {
    if (linted.has(from)) fresh();
    linted.add(lastFrom); lastFrom = from; statements = new Set();
  } else if (statements.has(specifier)) fresh();
  statements.add(specifier);
}
/** Return the first commons reference reached from an actual runtime import, following local and workspace modules. */
export function runtimeCommonsClosure(from, specifier) {
  const normalized = from.replaceAll('\\', '/'), boundary = normalized.lastIndexOf('/src/');
  if (boundary === -1) return null;
  passStart(from, specifier);
  const root = normalized.slice(0, boundary), queue = [{ from, specifier }], seen = new Set();
  try {
    while (queue.length > 0) {
      const edge = queue.pop(); if (edge === undefined) break;
      if (/^@wildshard\/commons(?:\/|$)/u.test(edge.specifier)) return edge.specifier;
      const file = target(root, edge.from, edge.specifier);
      if (file === null || seen.has(file) || clean.has(file)) continue;
      if (/^src\/commons(?:\/|$)/u.test(relative(root, file).replaceAll('\\', '/'))) return relative(root, file);
      seen.add(file); for (const next of imports(file)) queue.push({ from: file, specifier: next });
    }
    for (const file of seen) clean.add(file);
    return null;
  } finally { lastCall = Date.now(); }
}
