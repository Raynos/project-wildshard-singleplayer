#!/usr/bin/env node
// SF59 / G169: rebake the pastel plain's terrain and props (its own copy of the template generators, with the terrain on
// its `ground` preset and the props on its `rock` graph) into src/shards/pastel-plain/{data,assets}. Deterministic.
import { build } from 'vite';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '../..'), project = resolve(root, 'src/shards/pastel-plain');
// the SDK's native image module stays outside the bundle, resolved from the SDK package
const sharp = pathToFileURL(createRequire(resolve(root, 'src/sdk/package.json')).resolve('sharp')).href;
const result = await build({ plugins: [{ name: 'external-build-tool', enforce: 'pre', resolveId(id) { if (id === 'sharp') return { id: sharp, external: true }; return id === 'vite' ? { id: import.meta.resolve('vite'), external: true } : null; } }], configFile: false, publicDir: false, logLevel: 'silent', build: { write: false, minify: false,
  lib: { entry: resolve(project, 'generators/bake.ts'), formats: ['es'], fileName: 'bake' }, rolldownOptions: { platform: 'node', external: [/^node:/u] } } });
const output = Array.isArray(result) ? result.at(0) : result;
const chunks = output?.output.filter((entry) => entry.type === 'chunk') ?? [];
const chunk = chunks.at(0);
if (chunks.length !== 1 || chunk === undefined) throw new Error(`pastel bake must bundle once: ${chunks.map((entry) => entry.fileName).join(',')}`);
// a file, not a data: URL: the bundle calls createRequire(import.meta.url)
const scratch = mkdtempSync(join(tmpdir(), 'pastel-bake-'));
try {
  symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'));
  writeFileSync(join(scratch, 'bake.mjs'), chunk.code);
  const generator = await import(pathToFileURL(join(scratch, 'bake.mjs')).href);
  const files = generator.bakePastel();
  for (const [path, bytes] of files) writeFileSync(resolve(project, path), bytes);
  console.info(`pastel bake: ${files.size} files`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
