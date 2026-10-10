#!/usr/bin/env node
// SF72: Driftwood's renderer-free headless runtime steers its fauna by the browser's own baked navmesh
// (public/assets/baked/driftwood-isle/navmesh.bin, scripts/bake-navmesh.mjs). Node imports JSON, not bytes, so this copies
// the file's exact bytes (base64, with their SHA-256) into src/shards/driftwood-isle/runtime/navmesh.baked.json;
// test/shards/driftwood-isle/headless-runtime.test.ts holds the copy equal to the file. Rerun after every navmesh rebake.
//   node src/shards/driftwood-isle/generators/bake-driftwood-navmesh.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../..');
const bytes = readFileSync(resolve(root, 'public/assets/baked/driftwood-isle/navmesh.bin'));
const out = { source: 'public/assets/baked/driftwood-isle/navmesh.bin', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.toString('base64') };
writeFileSync(resolve(root, 'src/shards/driftwood-isle/runtime/navmesh.baked.json'), `${JSON.stringify(out)}\n`);
console.log(`navmesh.baked.json: ${bytes.length} bytes, sha256 ${out.sha256}`);
