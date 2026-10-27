// G694 F3: source-only primary layout; exact legacy inventory is held for LD.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { legacyInventory } from './legacy-shards.mjs';
import { shardOutputs } from './shard-outputs.mjs';

const EMPTY_FROZEN = { shards: {} };

/** Primary folders have one source layout. Frozen legacy paths are inventoried
 * individually and keep their historical layout until LD; a suffix grants nothing. */
export function checkShardLayout(entries, config, frozen = EMPTY_FROZEN, outputs = {}) {
  const failures = [], source = config.sourceLayout;
  for (const [slug, names] of Object.entries(entries)) {
    const legacy = frozen.shards[slug];
    if (legacy !== undefined) {
      const files = Object.keys(legacy.files ?? {});
      for (const name of names) if (!files.some(file => file === name || name.endsWith('/') && file.startsWith(name)))
        failures.push(`${slug}/${name}: outside the registered legacy inventory`);
      continue;
    }
    if (slug !== '_template' && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(slug)) failures.push(`${slug}: folder name must be a kebab-case slug`);
    const allowed = new Set([...source.requiredFiles, ...source.allowedFiles, ...source.folders.map(name => `${name}/`)]);
    const productFiles = new Set((outputs[slug] ?? []).map(output => `discovery.${output}.generated.ts`));
    if (productFiles.size > 0) productFiles.add('outputs.json');
    for (const name of names) if (!allowed.has(name) && !productFiles.has(name) && !/\.d(?:\.json)?\.ts$/u.test(name))
      failures.push(`${slug}/${name}: outside the standalone source layout`);
    for (const name of source.requiredFiles) if (!names.includes(name)) failures.push(`${slug}: missing required ${name}`);
  }
  return failures;
}

/** A Git index path list can be inspected without touching other agents' working files. */
export function shardEntries(paths, selected, homes = []) {
  const entries = {};
  for (const path of paths) {
    const match = /^src\/shards\/([^/]+)\/([^/]+)(\/|$)/u.exec(path);
    if (!match || (selected && !selected.has(match[1]))) continue;
    entries[match[1]] ??= new Set();
    entries[match[1]].add(match[2] + (match[3] ? '/' : ''));
    const local = path.slice(`src/shards/${match[1]}/`.length);
    if (homes.includes(local)) entries[match[1]].add(local);
  }
  return Object.fromEntries(Object.entries(entries).map(([slug, names]) => [slug, [...names].sort((a, b) => a.localeCompare(b))]));
}

// Empty build scaffolding carries no source entry; symlinks and every real file
// still participate in layout validation.
function hasFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).some(entry => !entry.isDirectory() || hasFiles(resolve(folder, entry.name)));
}

// Generated declarations can remain under historical output directories. This
// does not admit source runtime files or a folder by name: every leaf must be
// an exact output of the existing registered producer catalogue.
function generatedOnly(root, path, outputs) {
  return readdirSync(resolve(root, path), { withFileTypes: true }).every(entry => {
    const file = `${path}/${entry.name}`;
    return entry.isDirectory() ? generatedOnly(root, file, outputs) : entry.isFile() && outputs.has(file);
  });
}

// Only the registered, flat content-addressed product transport is generated
// storage (pinned or wholly regenerated), beside the SDK writer's receipt. Unknown
// files, source modules, symlinks and other hidden folders still
// belong to the source layout check. Staged paths retain the pure layout policy.
function generatedProduct(root, slug) {
  const base = `src/shards/${slug}/.wildshard`;
  const homes = readdirSync(resolve(root, base), { withFileTypes: true }).filter(entry => !entry.isDirectory() || hasFiles(resolve(root, base, entry.name)));
  const policy = homes.find(entry => entry.name === 'build-policy.json');
  if (policy !== undefined) {
    if (!policy.isFile()) return false;
    try {
      const bytes = readFileSync(resolve(root, base, policy.name));
      if (bytes.length > 4096) return false;
      const value = JSON.parse(bytes.toString('utf8'));
      if (value.version !== 1 || !Number.isSafeInteger(value.decisionLegacyLines) || value.decisionLegacyLines < 1 || Object.keys(value).length !== 2) return false;
    } catch { return false; }
  }
  return homes.length === 1 && policy !== undefined;
}

/** @param {string} root @param {Set<string>} [selected] */
export function checkShards(root, selected) {
  const config = JSON.parse(readFileSync(resolve(root, 'lint/shard-layout.json'), 'utf8'));
  const sourceFile = resolve(root, 'scripts/source-generation-outputs.json');
  const generated = new Set(existsSync(sourceFile)
    ? Object.values(JSON.parse(readFileSync(sourceFile, 'utf8')).producers).flat() : []);
  const entries = {};
  const outputs = {};
  for (const dir of readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })) {
    if (!dir.isDirectory() || (selected && !selected.has(dir.name))) continue;
    const products = shardOutputs(root, dir.name);
    if (products !== null) outputs[dir.name] = products.map(product => product.slug);
    entries[dir.name] = readdirSync(resolve(root, 'src/shards', dir.name), { withFileTypes: true })
      .filter(entry => !entry.isDirectory() || hasFiles(resolve(root, 'src/shards', dir.name, entry.name)))
      .filter(entry => entry.name !== '.wildshard' || !entry.isDirectory() || !generatedProduct(root, dir.name))
      .filter(entry => entry.name === '.wildshard' || (entry.isDirectory()
        ? !generatedOnly(root, `src/shards/${dir.name}/${entry.name}`, generated)
        : !entry.isFile() || !generated.has(`src/shards/${dir.name}/${entry.name}`)))
      .map(entry => entry.name + (entry.isDirectory() ? '/' : ''));
  }
  return checkShardLayout(entries, config, legacyInventory(root), outputs);
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '..');
  if (!existsSync(resolve(root, 'lint/shard-layout.json'))) throw new Error('Missing shard layout policy');
  const failures = checkShards(root);
  if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Shard layout passed');
}
