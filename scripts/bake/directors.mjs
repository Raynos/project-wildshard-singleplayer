#!/usr/bin/env node
// SF24: authored data plus immutable bounded director modules. No renderer or runtime installs are imported.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { compileScript } from '../compile-script.mjs';

const root = resolve(import.meta.dirname, '../..');
for (const slug of ['driftwood-isle', 'nalati-grasslands', 'pine-hollow']) {
  const directory = resolve(root, 'src/shards', slug);
  const bytes = await compileScript(readFileSync(resolve(directory, 'behaviour/director.as'), 'utf8'), { maximumPages: 1 });
  const module = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(resolve(directory, 'assets'), { recursive: true });
  writeFileSync(resolve(directory, 'assets', module), bytes);
  const file = resolve(directory, 'data/director.json'), data = JSON.parse(readFileSync(file, 'utf8'));
  data.module = module; writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  if (slug === 'pine-hollow') writeFileSync(resolve(directory, 'behaviour/director.json'), `${JSON.stringify({ module, bytes: Buffer.from(bytes).toString('base64') }, null, 2)}\n`);
  process.stdout.write(`${slug} ${module} ${bytes.length} bytes\n`);
}
