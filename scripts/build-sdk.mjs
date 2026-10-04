#!/usr/bin/env node
// Build author tools against the same public contract as the game; pnpm pack uses these portable JS modules.
import { build } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await build({ configFile: false, logLevel: 'warn', build: { outDir: resolve(root, 'src/sdk/dist'), emptyOutDir: true, minify: false, lib: {
  entry: Object.fromEntries(['version', 'shardfile', 'author', 'assets', 'project', 'cli'].map((name) => [name, resolve(root, `src/sdk/${name}.ts`)])), formats: ['es'], fileName: (_format, name) => `${name}.js`,
}, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] } } });
