#!/usr/bin/env node
// E357 L7: check actual module ownership and lazy isolation, not chunk filenames.
// Exact grouped layout is deliberately not enforced: B69's three grouping attempts broke boot,
// and L7's final try failed all seven slugs in both tiers (undefined runtime_exports).
// Evidence: progress/normalization/l7/group-failure.json. Grouping stays disabled; shard code
// may span several lazy chunks, but startup must remain clean and shard owners cannot mix.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkChunks(manifest, modules, closures) {
  const errors = [];
  // SF16 keeps picker metadata; every authored template gameplay module is data loaded from its shardfile.
  const templateMetadata = new Set(['manifest.ts', 'budgets.ts', 'budgetCeilings.ts', 'data/budgets.ts', 'data/budgetCeilings.ts', 'data/spawn.ts', 'explore/art.ts'].map((path) => `src/shards/_template/${path}`));
  const allowed = new Set(Object.values(closures).flat());
  const cold = new Set();
  function reach(key) {
    const row = manifest[key];
    if (!row) { errors.push(`manifest has no chunk ${key}`); return; }
    if (cold.has(row.file)) return;
    cold.add(row.file);
    for (const next of row.imports ?? []) reach(next);
  }
  const entry = Object.entries(manifest).find(([key, row]) => row.isEntry && (key === 'index.html' || key === 'src/entry.ts'));
  if (!entry) errors.push('manifest has no web entry');
  else reach(entry[0]);
  // E188: a dropped Three download can only retry after this small entry graph has evaluated.
  const beforeEntry = new Set(cold);
  for (const file of beforeEntry) for (const raw of modules[file]?.moduleIds ?? []) {
    const id = raw.replaceAll('\\', '/').split('?')[0];
    if (id === 'src/engine/app/runtime.ts' || /node_modules\/three\/(?:build|src)\//.test(id)) errors.push(`${id} is in the pre-entry static graph (${file}); module downloads cannot reach retried()`);
  }

  for (const [key, row] of Object.entries(manifest)) if (row.src === 'src/main.ts' || key === 'src/main.ts' || row.src === 'src/engine/boot/runtime.ts' || modules[row.file]?.name === 'three' || modules[row.file]?.name === 'engine') reach(key);
  const owners = new Map();
  for (const [file, row] of Object.entries(modules)) {
    for (const raw of row.moduleIds) {
      const id = raw.replaceAll('\\', '/').split('?')[0];
      const match = /^src\/shards\/([^/]+)\//.exec(id);
      if (match?.[1] === '_template' && !templateMetadata.has(id)) errors.push(`${id} is template gameplay code in chunk ${file}: SF16 requires no template runtime chunk`);
      // SHARD-PLATFORM SP5: a shard's generators run at bake time; their code never ships in any chunk
      if (match && /^src\/shards\/[^/]+\/generators\//.test(id)) errors.push(`${id} is a generator in chunk ${file}: generators run at bake time and never ship`);
      if (!match || allowed.has(id)) continue;
      const slug = match[1];
      if (cold.has(file)) errors.push(`${id} is in cold-boot chunk ${file}`);
      if (!owners.has(file)) owners.set(file, new Set());
      owners.get(file).add(slug);
    }
  }
  for (const [file, slugs] of owners) if (slugs.size > 1) errors.push(`${file} mixes shard owners ${[...slugs].join(', ')}`);
  // The bundler may split a shard internally; every static or dynamic chunk edge must preserve its owner.
  for (const [key, row] of Object.entries(manifest)) {
    const sourceOwners = owners.get(row.file);
    if (!sourceOwners) continue;
    for (const next of [...row.imports ?? [], ...row.dynamicImports ?? []]) {
      const target = manifest[next];
      if (!target) { errors.push(`${key} imports missing chunk ${next}`); continue; }
      const targetOwners = owners.get(target.file);
      if (targetOwners) for (const slug of targetOwners) if (!sourceOwners.has(slug)) errors.push(`${row.file} imports another shard (${slug}) through ${target.file}`);
    }
  }
  // Fail closed if the report was missing, incomplete or from a different build.
  for (const row of Object.values(manifest)) if ((row.name !== undefined || row.isEntry || row.isDynamicEntry || cold.has(row.file)) && row.file.endsWith('.js') && !modules[row.file]) errors.push(`missing module report for ${row.file}`);
  if (Object.keys(modules).length === 0) errors.push('empty chunk module report');
  return { errors, table: Object.entries(modules).map(([file, row]) => ({ file, name: row.name, gzBytes: row.gzBytes, modules: row.moduleIds.length })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const dist = resolve(process.argv[2] ?? 'dist');
    const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
    const result = checkChunks(json(resolve(dist, '.vite/manifest.json')), json(resolve(dist, '.vite/chunk-modules.json')), json(resolve('src/game/shard/manifest-closure.generated.json')));
    for (const row of result.table) console.log(`${row.name.padEnd(32)} ${(row.gzBytes / 1024).toFixed(1).padStart(8)} gz KB  ${String(row.modules).padStart(4)} modules  ${row.file}`);
    for (const error of result.errors) console.error(`check-chunks: ${error}`);
    if (result.errors.length > 0) process.exitCode = 1;
  } catch (error) { console.error(`check-chunks: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
}
