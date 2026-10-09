// E362 AG9: one data-defined layout, with exact grandfathered entries for existing shards.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';
import { shardfileDescriptor } from './gen-shards.mjs';
import { legacyInventory } from './legacy-shards.mjs';

const EMPTY_FROZEN = { shards: {} };

/** entries: slug -> top-level names (directories carry a trailing slash). */
export function checkShardLayout(entries, config, readManifest, runtimeBaseline = {}, frozen = EMPTY_FROZEN) {
  const failures = [];
  const files = new Set(config.requiredFiles.concat(config.allowedFiles));
  const folders = new Set(config.folders.map((name) => `${name}/`));
  for (const [slug, names] of Object.entries(entries)) {
    const primary = frozen.shards[slug]?.primary ?? slug;
    if (names.includes('runtime/') && !Object.hasOwn(runtimeBaseline, primary)) failures.push(`${slug}/runtime/: custom runtime is reserved for transition shards in lint/shard-platform.json`);
    if (slug.startsWith('_')) continue;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(slug)) failures.push(`${slug}: folder name must be a kebab-case slug`);
    const legacy = config.legacy[primary] ?? { entries: [], missing: [] };
    for (const name of names) if (!files.has(name) && !folders.has(name) && !legacy.entries.includes(name)) failures.push(`${slug}/${name}: outside the canonical shard layout`);
    const manifest = names.includes('manifest.ts') && readManifest ? readManifest(`src/shards/${slug}/manifest.ts`) : null;
    const descriptor = manifest === null ? null : shardfileDescriptor(manifest);
    const dataManifest = descriptor?.path === `/shardfiles/${slug}/shard.json` && !descriptor.load;
    const required = names.includes('shard.config.ts') && (!names.includes('manifest.ts') || dataManifest) ? (config.shardfileRequiredFiles ?? ['shard.config.ts', 'README.md']) : config.requiredFiles;
    for (const name of required) if (!names.includes(name) && !legacy.missing.includes(name)) failures.push(`${slug}: missing required ${name}`);
    for (const folder of config.folders) if (names.includes(`${folder}.ts`) && names.includes(`${folder}/`)) failures.push(`${slug}: ${folder}.ts and ${folder}/ name the same concept`);
    if (manifest !== null) {
      const file = `src/shards/${slug}/manifest.ts`;
      const parsed = parseSync(file, manifest);
      if (parsed.errors.length > 0) { failures.push(`${slug}: manifest does not parse`); continue; }
      const found = [];
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Property' && (node.key?.name ?? node.key?.value) === 'slug') {
          let value = node.value;
          while (value?.expression && ['TSAsExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression'].includes(value.type)) value = value.expression;
          if (typeof value?.value === 'string') found.push(value.value);
        }
        for (const [key, value] of Object.entries(node)) if (key !== 'parent') {
          if (Array.isArray(value)) { for (const child of value) visit(child); }
          else if (value && typeof value === 'object') visit(value);
        }
      };
      visit(parsed.program);
      if (found.length !== 1 || found[0] !== slug) failures.push(`${slug}: manifest slug must equal its folder name`);
    }
  }
  return failures;
}

/** A Git index path list can be inspected without touching other agents' working files. */
export function shardEntries(paths, selected) {
  const entries = {};
  for (const path of paths) {
    const match = /^src\/shards\/([^/]+)\/([^/]+)(\/|$)/u.exec(path);
    if (!match || (selected && !selected.has(match[1]))) continue;
    entries[match[1]] ??= new Set();
    entries[match[1]].add(match[2] + (match[3] ? '/' : ''));
  }
  return Object.fromEntries(Object.entries(entries).map(([slug, names]) => [slug, [...names].sort((a, b) => a.localeCompare(b))]));
}

/** @param {string} root @param {Set<string>} [selected] */
export function checkShards(root, selected) {
  const config = JSON.parse(readFileSync(resolve(root, 'lint/shard-layout.json'), 'utf8'));
  const entries = {};
  for (const dir of readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })) {
    if (!dir.isDirectory() || (selected && !selected.has(dir.name))) continue;
    entries[dir.name] = readdirSync(resolve(root, 'src/shards', dir.name), { withFileTypes: true }).map((entry) => entry.name + (entry.isDirectory() ? '/' : ''));
  }
  return checkShardLayout(entries, config, (file) => readFileSync(resolve(root, file), 'utf8'), JSON.parse(readFileSync(resolve(root, 'lint/shard-platform.json'), 'utf8')).baseline, legacyInventory(root));
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '..');
  if (!existsSync(resolve(root, 'lint/shard-layout.json'))) throw new Error('Missing shard layout policy');
  const failures = checkShards(root);
  if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Shard layout passed');
}
