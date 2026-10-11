// DO NOT EDIT the generated transports; these retained AS policies and prelude are their authoring source.
// No game, renderer, runtime, legacy, generated seed or warm cache is read.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';

const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/pine-hollow';
const prelude = readFileSync(resolve(root, project, 'behaviour/elitePrelude.as'), 'utf8');
const products = new Map();
for (const name of ['ironhide', 'ghostStag', 'blackpaw', 'imperialBull']) {
  const source = prelude + readFileSync(resolve(root, project, `behaviour/${name}.as`), 'utf8');
  const compiled = await compileBehaviourModule(source, 1);
  products.set(resolve(root, project, `behaviour/${name}.json`), new TextEncoder().encode(`${JSON.stringify({ module: compiled.module, bytes: Buffer.from(compiled.bytes).toString('base64') }, null, 2)}\n`));
}
for (const [path, bytes] of products) {
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || !Buffer.from(readFileSync(path)).equals(Buffer.from(bytes))) throw new Error(`Pine elite transport stale: ${path}`);
  } else writeFileSync(path, bytes);
}
console.info('Pine elites: all four retained native policies compiled to their immutable transports');
