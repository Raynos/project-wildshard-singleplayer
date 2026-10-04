#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runWildshard } from './wildshard.mjs';

const root = resolve(import.meta.dirname, '..'), projects = resolve(root, 'src/shards');
let count = 0;
for (const entry of readdirSync(projects, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  const project = resolve(projects, entry.name);
  if (!entry.isDirectory() || !existsSync(resolve(project, 'shard.config.ts'))) continue;
  await runWildshard(['build', project, resolve(root, 'public/shardfiles', entry.name), '--product-only']); count++;
}
console.info(`wildshard build: ${count} shardfile project(s)`);
