import { posix } from 'node:path';
import ts from '@typescript/typescript6';

const MODULE = /\.[cm]?[jt]sx?$/u;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const stem = (/** @type {string} */ path) => posix.basename(path).replace(/\.(?:test|spec)\.[cm]?[jt]sx?$/u, '').replace(/\.[^.]+$/u, '');

/** Candidate imports only: no Vite transform, working-tree source or module
 * execution is needed to find the nearest tests. All staged tests are kept;
 * only additional importer suites are bounded. Full CI keeps full coverage.
 * @param {ReadonlyMap<string, string>} sources
 * @param {readonly string[]} changed
 * @param {readonly string[]} [paths]
 * @param {number} [limit]
 * @param {ReadonlyMap<string, readonly string[]>} [imports] */
export function selectRelatedSuites(sources, changed, paths = [...sources.keys()], limit = 20, imports = new Map()) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid nearest-suite limit');
  const present = new Set(paths);
  /** @type {Map<string, string>} */
  const exports = new Map();
  for (const [file, text] of sources) {
    const layer = /^src\/([^/]+)\/package\.json$/u.exec(file)?.[1];
    if (layer === undefined) continue;
    /** @type {unknown} */
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || !('exports' in parsed)) continue;
    const entries = parsed.exports;
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) continue;
    for (const [key, value] of Object.entries(entries))
      if (key.startsWith('./') && typeof value === 'string')
        exports.set(`@wildshard/${layer}/${key.slice(2)}`, posix.join('src', layer, value));
  }
  const target = (/** @type {string} */ file, /** @type {string} */ specifier) => {
    const clean = specifier.split(/[?#]/u)[0] ?? '';
    const base = clean.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), clean)) : exports.get(clean);
    if (base === undefined) return null;
    const candidates = [base, ...['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '/index.ts', '/index.js'].map(extension => base + extension)];
    if (/\.[cm]?js$/u.test(base)) candidates.push(base.replace(/\.([cm]?)js$/u, '.$1ts'), base.replace(/\.js$/u, '.tsx'));
    return candidates.find(candidate => present.has(candidate)) ?? null;
  };
  /** @type {Map<string, Set<string>>} */
  const importers = new Map();
  const add = (/** @type {string} */ dependency, /** @type {string} */ file) => {
    const readers = importers.get(dependency) ?? new Set([file]);
    readers.add(file); importers.set(dependency, readers);
  };
  for (const [file, text] of sources) {
    if (!MODULE.test(file)) continue;
    for (const imported of imports?.get(file) ?? ts.preProcessFile(text, true, true).importedFiles.map(row => row.fileName)) {
      const dependency = target(file, imported);
      if (dependency === null) continue;
      add(dependency, file);
      const layer = /^@wildshard\/([^/]+)\//u.exec(imported)?.[1];
      if (layer !== undefined) add(`src/${layer}/package.json`, file);
    }
  }
  // Vitest/package configuration changes affect discovery itself, rather than
  // appearing as runtime imports. Keep their bounded run nonempty as well.
  for (const config of changed.filter(file => /(?:^|\/)vitest\.config\.[cm]?[jt]s$/u.test(file) || file === 'package.json'))
    for (const file of sources.keys()) if (TEST.test(file)) add(config, file);
  for (const config of changed.filter(file => /(?:^|\/)tsconfig[^/]*\.json$/u.test(file))) {
    const directory = posix.dirname(config);
    for (const file of sources.keys()) if (TEST.test(file) && (directory === '.' || file.startsWith(`${directory}/`))) add(config, file);
  }
  const direct = [...new Set(changed.filter(file => TEST.test(file) && present.has(file)))].sort();
  const directSet = new Set(direct), queue = [...new Set(changed)], distance = new Map(queue.map(file => [file, 0]));
  /** @type {Map<string, number>} */
  const tests = new Map();
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    if (file === undefined) continue;
    const depth = (distance.get(file) ?? 0) + 1;
    for (const importer of importers.get(file) ?? []) {
      if (distance.has(importer)) continue;
      distance.set(importer, depth); queue.push(importer);
      if (TEST.test(importer) && !directSet.has(importer)) tests.set(importer, depth);
    }
  }
  const names = new Set(changed.map(stem));
  const ordered = [...tests.keys()].sort((a, b) => (tests.get(a) ?? 0) - (tests.get(b) ?? 0)
    || Number(names.has(stem(b))) - Number(names.has(stem(a))) || a.localeCompare(b));
  const nearest = ordered.slice(0, limit);
  return { files: [...direct, ...nearest], direct, nearest, candidates: direct.length + ordered.length, omitted: ordered.length - nearest.length };
}
