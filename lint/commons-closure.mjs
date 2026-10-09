// G143: authored build-time packs must never enter a runtime's transitive import closure.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parseSync } from 'vite';

const cache = new Map(), manifests = new Map();
// E454: a file's stamp (size + mtime) validates its cached parse without reading it again; this walk runs per import.
const stamp = (file) => { const info = statSync(file, { throwIfNoEntry: false }); return info === undefined ? null : `${info.size}:${info.mtimeMs}`; };
function imports(file) {
  const at = stamp(file), cached = cache.get(file);
  if (at !== null && cached?.at === at) return cached.specifiers;
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
/** Return the first commons reference reached from an actual runtime import, following local and workspace modules. */
export function runtimeCommonsClosure(from, specifier) {
  const normalized = from.replaceAll('\\', '/'), boundary = normalized.lastIndexOf('/src/');
  if (boundary === -1) return null;
  const root = normalized.slice(0, boundary), queue = [{ from, specifier }], seen = new Set();
  while (queue.length > 0) {
    const edge = queue.pop(); if (edge === undefined) break;
    if (/^@wildshard\/commons(?:\/|$)/u.test(edge.specifier)) return edge.specifier;
    const file = target(root, edge.from, edge.specifier);
    if (file === null || seen.has(file)) continue;
    if (/^src\/commons(?:\/|$)/u.test(relative(root, file).replaceAll('\\', '/'))) return relative(root, file);
    seen.add(file); for (const next of imports(file)) queue.push({ from: file, specifier: next });
  }
  return null;
}
