// G143: authored build-time packs must never enter a runtime's transitive import closure.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parseSync } from 'vite';

const cache = new Map();
function imports(file) {
  const source = readFileSync(file, 'utf8'), cached = cache.get(file);
  if (cached?.source === source) return cached.specifiers;
  const parsed = parseSync(file, source), specifiers = new Set(parsed.module.staticImports.map(row => row.moduleRequest.value));
  for (const row of parsed.module.staticExports) for (const entry of row.entries) if (entry.moduleRequest) specifiers.add(entry.moduleRequest.value);
  for (const row of parsed.module.dynamicImports) {
    const expression = source.slice(row.moduleRequest.start, row.moduleRequest.end).trim();
    const literal = /^(['"`])([^'"`$]+)\1$/u.exec(expression);
    const prefix = literal ?? /^(['"])([^'"]+)\1\s*\+/u.exec(expression) ?? /^(`)([^`$]+)\$\{/u.exec(expression);
    if (prefix !== null) specifiers.add(prefix[2]);
  }
  const result = [...specifiers]; cache.set(file, { source, specifiers: result }); return result;
}
function target(root, from, specifier) {
  let base;
  const pkg = /^@wildshard\/(engine|game|kit|sdk|commons)(?:\/(.+))?$/u.exec(specifier);
  if (pkg !== null) {
    const manifest = resolve(root, 'src', pkg[1], 'package.json');
    if (!existsSync(manifest)) return null;
    const subpath = specifier.slice(`@wildshard/${pkg[1]}/`.length);
    const entry = JSON.parse(readFileSync(manifest, 'utf8')).exports?.[subpath === '' ? '.' : `./${subpath}`];
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
