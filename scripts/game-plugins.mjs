#!/usr/bin/env node
// G307: discover defining plugin modules; the game's exports map remains the only public surface.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
function filesIn(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesIn(resolve(root, entry.name)) : /\.[cm]?[jt]sx?$/u.test(entry.name) ? [resolve(root, entry.name)] : []);
}
function specifiers(path, source) {
  const result = new Set();
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    const literal = value => value?.type === 'Literal' && typeof value.value === 'string' ? value.value : null;
    const value = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression', 'TSImportType'].includes(node.type)
      ? literal(node.source) : node.type === 'TSExternalModuleReference' ? literal(node.expression)
        : node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require' ? literal(node.arguments[0]) : null;
    if (value !== null) result.add(value);
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else visit(child);
  };
  visit(parseSync(path, source).program);
  return [...result];
}

/** Follow current primary runtime closures through SDK facades, stopping at each defining game module. */
export function gamePluginInventory(root = ROOT) {
  const manifest = layer => JSON.parse(readFileSync(resolve(root, `src/${layer}/package.json`), 'utf8'));
  const game = manifest('game'), sdk = manifest('sdk');
  const frozenFile = resolve(root, 'lint/legacy-shards.json');
  const frozen = existsSync(frozenFile) ? JSON.parse(readFileSync(frozenFile, 'utf8')).shards : {};
  const modules = new Map();
  const target = (layer, specifier) => {
    const entry = (layer === 'game' ? game : sdk).exports?.[`.${specifier.slice(`@wildshard/${layer}`.length)}`];
    return typeof entry === 'string' ? resolve(root, `src/${layer}`, entry) : null;
  };
  for (const entry of readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })) {
    if (!entry.isDirectory() || Object.hasOwn(frozen, entry.name)) continue;
    const shard = resolve(root, 'src/shards', entry.name), seen = new Set(), queue = filesIn(resolve(shard, 'runtime'));
    while (queue.length > 0) {
      const path = queue.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      for (const specifier of specifiers(path, readFileSync(path, 'utf8'))) {
        if (specifier.startsWith('@wildshard/game/')) {
          if (!modules.has(specifier)) modules.set(specifier, { specifier, target: target('game', specifier), facades: new Set(), shards: new Set() });
          const row = modules.get(specifier);
          row.shards.add(entry.name);
          if (path.startsWith(`${resolve(root, 'src/sdk')}/`)) row.facades.add(relative(root, path));
          continue;
        }
        const base = specifier.startsWith('@wildshard/sdk/') ? target('sdk', specifier)
          : specifier.startsWith('.') ? resolve(dirname(path), specifier) : null;
        if (base === null) continue;
        const next = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`].find(candidate => existsSync(candidate) && /\.[cm]?[jt]sx?$/u.test(candidate));
        if (next !== undefined && (next.startsWith(`${shard}/`) || next.startsWith(`${resolve(root, 'src/sdk')}/`))) queue.push(next);
      }
    }
  }
  return [...modules.values()].sort((a, b) => a.specifier.localeCompare(b.specifier)).map(row => ({
    specifier: row.specifier, target: row.target === null ? null : relative(root, row.target),
    facades: [...row.facades].sort((a, b) => a.localeCompare(b)), shards: [...row.shards].sort((a, b) => a.localeCompare(b)),
    published: row.target !== null && existsSync(row.target),
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--report')) {
    const scratch = mkdtempSync(resolve(tmpdir(), 'game-plugin-report-'));
    try {
      const config = resolve(scratch, 'config.json');
      writeFileSync(config, JSON.stringify({ jsPlugins: [resolve(ROOT, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/shard-game-plugins': 'warn', 'wildshard/generator-imports': 'warn', 'wildshard/shard-engine-imports': 'warn', 'wildshard/sdk-no-facade': 'warn' } }));
      const result = spawnSync(process.execPath, [resolve(ROOT, 'node_modules/oxlint/bin/oxlint'), '-c', config, ...(process.argv.includes('--json') ? ['-f', 'json'] : []), 'src/shards', 'src/sdk'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error('Plugin report failed to execute');
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  } else console.log(JSON.stringify({ enforcement: 'report-only', modules: gamePluginInventory() }, null, 2));
}
