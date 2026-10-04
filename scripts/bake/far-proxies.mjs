#!/usr/bin/env node
// SHARD-PLATFORM SF23: deterministically regenerate every grid shard's far proxy (public/assets/baked/<slug>/far.glb +
// far.json) from its baked terrain and its look/far.ts; prints each proxy's resident MB, wire KB and triangles.
import { build } from 'vite';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(import.meta.dirname, '../..'), scratch = mkdtempSync(join(tmpdir(), 'far-proxies-'));
try {
  symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
  await build({ configFile: false, logLevel: 'silent', build: { target: 'esnext', outDir: join(scratch, 'generator'), emptyOutDir: true, lib: { entry: join(repo, 'scripts/bake/farProxiesSource.ts'), formats: ['es'], fileName: 'build' }, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] } } });
  const generator = await import(pathToFileURL(join(scratch, 'generator/build.js')).href);
  const manifests = generator.writeFarProxies(repo);
  for (const [slug, { far }] of Object.entries(manifests)) console.log(`${slug.padEnd(18)} resident ${((far.decoded + far.gpu) / 1e6).toFixed(3)} MB  wire ${(far.compressed / 1e3).toFixed(0)} KB  ${far.triangles} tris  ${far.draws} draw`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
