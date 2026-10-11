// Retained authoring-only typed AS producer. No game, runtime, legacy, page or renderer inputs.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';

import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';

const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/pine-hollow';
const declaration = JSON.parse(readFileSync(resolve(root, project, 'data/director.json'), 'utf8'));
const source = readFileSync(resolve(root, project, 'behaviour/director.as'), 'utf8');
const compiled = await compileBehaviourModule(source, 1, { 'wildshard-director.ts': generateDirectorAbi(declaration) });
if (declaration.module !== compiled.module) throw new Error('Pine clock author module hash differs; update its declaration deliberately');
// Preserve the historical transport shape; the catalogue and retained producer carry provenance.
const products = new Map([
  [`${project}/assets/${compiled.module}`, compiled.bytes],
  [`${project}/behaviour/director.json`, new TextEncoder().encode(`${JSON.stringify({ module: compiled.module, bytes: Buffer.from(compiled.bytes).toString('base64') }, null, 2)}\n`)],
]);
for (const [file, bytes] of products) {
  const path = resolve(root, file);
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || !Buffer.from(readFileSync(path)).equals(Buffer.from(bytes))) throw new Error(`Pine clock output stale: ${file}`);
  } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }
}
console.info('Pine clock: retained typed AS outputs match the declared immutable hash');
