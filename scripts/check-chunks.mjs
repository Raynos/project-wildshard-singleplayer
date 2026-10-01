#!/usr/bin/env node
// E357 X3: check actual output modules and the cold-boot static graph, not chunk filenames alone.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkChunks(manifest, modules, closures) {
  const errors = [];
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
  for (const [key, row] of Object.entries(manifest)) if (row.src === 'src/main.ts' || key === 'src/main.ts' || modules[row.file]?.name === 'three' || modules[row.file]?.name === 'engine') reach(key);
  const owners = new Map();
  for (const [file, row] of Object.entries(modules)) {
    for (const raw of row.moduleIds) {
      const id = raw.replaceAll('\\', '/').split('?')[0];
      const match = /^src\/shards\/([^/]+)\//.exec(id);
      if (!match || allowed.has(id)) continue;
      const slug = match[1];
      if (cold.has(file)) errors.push(`${id} is in cold-boot chunk ${file}`);
      if (row.name !== `shard-${slug}`) errors.push(`${id} is in ${file} (${row.name}), expected shard-${slug}`);
      if (!owners.has(slug)) owners.set(slug, new Set());
      owners.get(slug).add(file);
    }
  }
  for (const [slug, files] of owners) if (files.size > 1) errors.push(`${slug} is split across ${[...files].join(', ')}`);
  // Fail closed if the report was missing, incomplete or from a different build.
  for (const file of cold) if (file.endsWith('.js') && !modules[file]) errors.push(`missing module report for ${file}`);
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
