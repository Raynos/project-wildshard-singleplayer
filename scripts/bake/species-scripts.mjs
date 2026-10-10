#!/usr/bin/env node
// SF27: compile each shard's admitted species scripts (behaviour/<name>.as) and write behaviour/<name>.json: the module's
// SHA-256 and its bytes as base64 (a trusted runtime imports them as data, so admission stays synchronous in the client
// and the headless host); a module with a prelude (Pine's elite fight scripts, behaviour/elitePrelude.as) compiles with it in
// front. Run in a clean export, never the main checkout. No renderer or runtime installs are imported.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { compileScript } from '../compile-script.mjs';

const root = resolve(import.meta.dirname, '../..');
/** @type {readonly [string, string, string | null][]} */
const MODULES = [['sunscar-dunes', 'skitterer', null], ...['ironhide', 'ghostStag', 'blackpaw', 'imperialBull'].map(name => /** @type {[string, string, string]} */ (['pine-hollow', name, 'elitePrelude']))];
for (const [slug, name, prelude] of MODULES) {
  const directory = resolve(root, 'src/shards', slug, 'behaviour');
  const source = (prelude === null ? '' : readFileSync(resolve(directory, `${prelude}.as`), 'utf8')) + readFileSync(resolve(directory, `${name}.as`), 'utf8');
  const bytes = await compileScript(source, { maximumPages: 1 });
  const module = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify({ module, bytes: Buffer.from(bytes).toString('base64') }, null, 2)}\n`);
  process.stdout.write(`${slug}/${name} ${module} ${bytes.length} bytes\n`);
}
