#!/usr/bin/env node
// SF36: compile each shard's admitted weapon-hook module (behaviour/weapons.as) and record its hash in behaviour/weapons.json.
// Run in a clean export, never the main checkout. No renderer or runtime installs are imported.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { compileScript } from '../compile-script.mjs';

const root = resolve(import.meta.dirname, '../..');
for (const slug of ['nalati-grasslands']) {
  const directory = resolve(root, 'src/shards', slug);
  const bytes = await compileScript(readFileSync(resolve(directory, 'behaviour/weapons.as'), 'utf8'), { maximumPages: 1 });
  const module = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(resolve(directory, 'assets'), { recursive: true });
  writeFileSync(resolve(directory, 'assets', module), bytes);
  const file = resolve(directory, 'behaviour/weapons.json'), data = JSON.parse(readFileSync(file, 'utf8'));
  data.module = module; writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  process.stdout.write(`${slug} ${module} ${bytes.length} bytes\n`);
}
