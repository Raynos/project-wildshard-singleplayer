// Source-only dependency walk: no imports execute and no products are prepared.
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from '@typescript/typescript6';

/** @param {string} root */
function sourceWalker(root) {
  const config = ts.findConfigFile(root, path => ts.sys.fileExists(path));
  const options = config === undefined ? { allowJs: true } : ts.parseJsonConfigFileContent(
    ts.readConfigFile(config, path => ts.sys.readFile(path)).config, ts.sys, root).options;
  /** @type {Map<string,string[]>} */
  const imports = new Map();
  /** @param {readonly string[]} files @returns {string[]} */
  return files => {
  const pending = files.map(file => resolve(root, file));
  const seen = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || seen.has(path) || !existsSync(path)) continue;
    const name = relative(root, path);
    if (name.startsWith('..') || name.split('/').includes('node_modules')) continue;
    seen.add(path);
    if (!/\.[cm]?[jt]sx?$/u.test(path)) continue;
    const cached = imports.get(path);
    if (cached !== undefined) { pending.push(...cached); continue; }
    const dependencies = [];
    const source = readFileSync(path, 'utf8');
    for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
      const module = ts.resolveModuleName(imported.fileName, path, options, ts.sys).resolvedModule;
      if (module !== undefined) {
        const target = module.resolvedFileName;
        dependencies.push(target);
        // A handwritten .d.mts types the script; its implementation still runs.
        const implementation = target.replace(/\.d\.mts$/u, '.mjs');
        if (implementation !== target && existsSync(implementation)) dependencies.push(implementation);
      }
    }
    // Disk/script readers have literal paths without an import edge.
    for (const match of source.matchAll(/['"`]((?:scripts|test|src)\/[\w./-]+\.(?:[cm]?[jt]s|py|sh|json))['"`]/gu)) {
      const file = match[1];
      dependencies.push(resolve(root, file));
    }
    imports.set(path, dependencies);
    pending.push(...dependencies);
  }
  return [...seen].map(path => relative(root, path)).sort();
  };
}

/** @param {string} root @param {readonly string[]} files @returns {string[]} */
export function sourceInputs(root, files) { return sourceWalker(root)(files); }

/** Live push tests cannot launch builders, browsers or other external jobs.
 * CI and batch checks retain the full selection and its product edges.
 * @param {string} root @param {readonly string[]} tests @param {Record<string,string[]>} products
 * @returns {string[]} */
export function liveTests(root, tests, products) {
  const inputs = sourceWalker(root);
  return tests.filter(test => !test.startsWith('test/scripts/') && !(products[test]?.length)
    && inputs([test]).every(file => {
      if (!/\.[cm]?[jt]sx?$/u.test(file)) return true;
      const source = readFileSync(resolve(root, file), 'utf8');
      return !/(?:child_process|\b(?:execFile|spawnSync|execSync)\s*\(|build-shardfiles|build-mirror|serve-build|scripts\/gen\.mjs)/u.test(source);
    }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.info(JSON.stringify(sourceInputs(process.cwd(), process.argv.slice(2))));
}
