// Retained authoring-only typed AS producer. No game, runtime, legacy, page or renderer inputs.
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

registerHooks({ resolve(specifier, context, next) {
  if (/^@wildshard\/(?:engine|game)\//u.test(specifier)) throw new Error('Nalati raid producer cannot import a runtime');
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const at = new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.mjs']) {
      const url = new URL(at.href + suffix);
      if (existsSync(fileURLToPath(url)) && statSync(fileURLToPath(url)).isFile()) return { url: url.href, shortCircuit: true };
    }
  }
  return next(specifier, context);
} });

const { compileBehaviourModule } = await import('@wildshard/sdk/buildBehaviour');
const { generateDirectorAbi } = await import('@wildshard/sdk/directorAbi');
const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/nalati-grasslands';
const declaration = JSON.parse(readFileSync(resolve(root, project, 'data/director.json'), 'utf8'));
const source = readFileSync(resolve(root, project, 'behaviour/director.as'), 'utf8');
const compiled = await compileBehaviourModule(source, 1, { 'wildshard-director.ts': generateDirectorAbi(declaration) });
if (declaration.module !== compiled.module) throw new Error('Nalati raid author module hash differs; update its declaration deliberately');
const notice = 'DO-NOT-EDIT: generated from retained behaviour/director.as with the pinned SDK compiler; regenerate and compare hashes.';
const products = new Map([
  [`${project}/assets/${compiled.module}`, compiled.bytes],
  [`${project}/behaviour/director.generated.json`, new TextEncoder().encode(`${JSON.stringify({ generated: notice, module: compiled.module, bytes: Buffer.from(compiled.bytes).toString('base64') }, null, 2)}\n`)],
]);
for (const [file, bytes] of products) {
  const path = resolve(root, file);
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || !Buffer.from(readFileSync(path)).equals(Buffer.from(bytes))) throw new Error(`Nalati raid output stale: ${file}`);
  } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }
}
console.info('Nalati raid: retained typed AS outputs match the declared immutable hash');
