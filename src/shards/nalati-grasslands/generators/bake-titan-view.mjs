import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// Nalati zero R6: the Storm Titan's tells-and-pose view module (behaviour/titanView.as), compiled once for the product;
// the engine's view program runs it from its rows (generators/titanView.ts, client plan view.program).
const source = readFileSync(new URL('../behaviour/titanView.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 4096 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 4096, bytes: module.length, source: 'behaviour/titanView.generated.wasm', module: `blobs/wasm/${Buffer.from(await crypto.subtle.digest('SHA-256', module)).toString('hex')}.wasm` }, null, 2)}\n`;
const target = new URL('../behaviour/titanView.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Titan view module is stale');
  if (!readFileSync(new URL('../behaviour/titanView.generated.wasm', import.meta.url)).equals(module)) throw new Error('View binary is stale');
} else {
  writeFileSync(new URL('../behaviour/titanView.generated.wasm', import.meta.url), module);
  writeFileSync(target, bytes);
}
console.info(`nalati-titan-view: ${module.length} bytes`);
