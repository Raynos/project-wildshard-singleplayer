#!/usr/bin/env node
// Deterministically regenerate template prop rows and immutable GLBs; generator closures never enter the client.
import { build } from 'vite';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(import.meta.dirname, '../..'), scratch = mkdtempSync(join(tmpdir(), 'template-props-'));
try {
  symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
  await build({ configFile: false, logLevel: 'silent', build: { target: 'esnext', outDir: join(scratch, 'generator'), emptyOutDir: true, lib: { entry: join(repo, 'test/fixtures/sim-level/props/build.ts'), formats: ['es'], fileName: 'build' }, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] } } });
  const generator = await import(pathToFileURL(join(scratch, 'generator/build.js')).href);
  await generator.writeTemplateProps(join(repo, 'public/assets/baked/template-props'), join(repo, 'src/shards/_template/data/props.json'));
} finally { rmSync(scratch, { recursive: true, force: true }); }
