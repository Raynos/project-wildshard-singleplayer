#!/usr/bin/env node
// SF59 / G169: rebake the ink valley's terrain and props (its own copy of the template generators: the valley field with
// the terrain on its `ground` toon preset and the props on its `rock` cel graph) into src/shards/ink-cel-valley/{data,assets},
// then drop the content-addressed files no declaration names any more. Deterministic; run it from a clean export.
import { build } from 'vite';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '../..'), project = resolve(root, 'src/shards/ink-cel-valley');
// the SDK's native image module stays outside the bundle, resolved from the SDK package
const sharp = pathToFileURL(createRequire(resolve(root, 'src/sdk/package.json')).resolve('sharp')).href;
const result = await build({ plugins: [{ name: 'external-build-tool', enforce: 'pre', resolveId(id) { if (id === 'sharp') return { id: sharp, external: true }; return id === 'vite' ? { id: import.meta.resolve('vite'), external: true } : null; } }], configFile: false, publicDir: false, logLevel: 'silent', build: { write: false, minify: false,
  lib: { entry: resolve(project, 'generators/bake.ts'), formats: ['es'], fileName: 'bake' }, rolldownOptions: { platform: 'node', external: [/^node:/u] } } });
const output = Array.isArray(result) ? result.at(0) : result;
const chunks = output?.output.filter((entry) => entry.type === 'chunk') ?? [];
const chunk = chunks.at(0);
if (chunks.length !== 1 || chunk === undefined) throw new Error(`ink bake must bundle once: ${chunks.map((entry) => entry.fileName).join(',')}`);
// a file, not a data: URL: the bundle calls createRequire(import.meta.url)
const scratch = mkdtempSync(join(tmpdir(), 'ink-bake-'));
try {
  symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'));
  writeFileSync(join(scratch, 'bake.mjs'), chunk.code);
  const generator = await import(pathToFileURL(join(scratch, 'bake.mjs')).href);
  const files = generator.bakeInk();
  for (const [path, bytes] of files) writeFileSync(resolve(project, path), bytes);
  // every hash a declaration names (the bake's outputs, the skins, the scripts) keeps its file; the rest are stale
  const named = new Set();
  for (const file of ['shard.config.ts', ...['behaviour', 'data', 'quests'].flatMap((dir) => readdirSync(resolve(project, dir)).map((name) => `${dir}/${name}`))]) {
    for (const hash of readFileSync(resolve(project, file), 'utf8').matchAll(/[0-9a-f]{64}/gu)) named.add(hash[0]);
  }
  const stale = readdirSync(resolve(project, 'assets')).filter((name) => /^[0-9a-f]{64}$/u.test(name) && !named.has(name));
  for (const name of stale) rmSync(resolve(project, 'assets', name));
  console.info(`ink bake: ${files.size} files, ${stale.length} stale removed`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
