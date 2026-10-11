// DO NOT EDIT generated module/declaration bytes; regenerate from the retained AS and typed author rows.
// No game, renderer, runtime, legacy, generated seed or warm cache is read.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { generateNalatiWeaponHooks } from './weaponHooks.ts';

const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/nalati-grasslands';
const source = readFileSync(resolve(root, project, 'behaviour/weapons.as'), 'utf8');
const compiled = await generateNalatiWeaponHooks(source);
const products = new Map([
  [`${project}/assets/${compiled.module}`, compiled.bytes],
  [`${project}/behaviour/weapons.json`, new TextEncoder().encode(`${JSON.stringify(compiled.declaration, null, 2)}\n`)],
]);
for (const [file, bytes] of products) {
  const path = resolve(root, file);
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || !Buffer.from(readFileSync(path)).equals(Buffer.from(bytes))) throw new Error(`Nalati weapon hook output stale: ${file}`);
  } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }
}
console.info('Nalati weapon hooks: retained policy and typed declaration compiled to original products');
