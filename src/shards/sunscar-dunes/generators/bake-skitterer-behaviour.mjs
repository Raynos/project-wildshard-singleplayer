// DO NOT EDIT the generated transport; this retained authoring source compiles the native skitterer policy.
// No game, renderer, runtime, legacy, generated seed or warm cache is read.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';

const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/sunscar-dunes';
const source = readFileSync(resolve(root, project, 'behaviour/skitterer.as'), 'utf8');
const compiled = await compileBehaviourModule(source, 1);
const bytes = new TextEncoder().encode(`${JSON.stringify({ module: compiled.module, bytes: Buffer.from(compiled.bytes).toString('base64') }, null, 2)}\n`);
const output = resolve(root, project, 'behaviour/skitterer.json');
if (process.argv.includes('--check')) {
  if (!existsSync(output) || !Buffer.from(readFileSync(output)).equals(Buffer.from(bytes))) throw new Error('Signal skitterer transport stale');
} else writeFileSync(output, bytes);
console.info('Signal skitterer: retained native policy compiled to its immutable transport');
