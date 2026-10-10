#!/usr/bin/env node
// SF27: compile each shard's admitted species scripts (behaviour/<name>.as) and write behaviour/<name>.json: the module's
// SHA-256 and its bytes as base64 (a trusted runtime imports them as data, so admission stays synchronous in the client
// and the headless host). Run in a clean export, never the main checkout. No renderer or runtime installs are imported.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { compileScript } from '../compile-script.mjs';

const root = resolve(import.meta.dirname, '../..');
for (const [slug, name] of [['sunscar-dunes', 'skitterer']]) {
  const directory = resolve(root, 'src/shards', slug, 'behaviour');
  const bytes = await compileScript(readFileSync(resolve(directory, `${name}.as`), 'utf8'), { maximumPages: 1 });
  const module = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify({ module, bytes: Buffer.from(bytes).toString('base64') }, null, 2)}\n`);
  process.stdout.write(`${slug}/${name} ${module} ${bytes.length} bytes\n`);
}
